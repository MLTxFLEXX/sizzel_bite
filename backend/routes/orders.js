// routes/orders.js — Full order lifecycle CRUD
const express = require('express');
const router  = express.Router();
const { sql } = require('../db/client');

const TAX_RATE  = 0.08;
const MAX_TABLE = 12;
const VALID_STATUSES = ['received', 'cooking', 'ready', 'served'];
const VALID_PAYMENTS = ['pay_at_table', 'instant_card'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateOrderCode() {
  return 'ORD-' + Math.floor(1000 + Math.random() * 9000);
}

function normalizeOrder(row, items = []) {
  return {
    id:            row.order_code,
    dbId:          row.id,
    tableNumber:   row.table_number,
    status:        row.status,
    paymentMethod: row.payment_method,
    subtotal:      parseFloat(row.subtotal),
    tax:           parseFloat(row.tax),
    tip:           parseFloat(row.tip),
    total:         parseFloat(row.total),
    estimatedTime: row.estimated_time,
    createdAt:     new Date(row.created_at).getTime(),
    updatedAt:     new Date(row.updated_at).getTime(),
    items:         items.map(normalizeOrderItem)
  };
}

function normalizeOrderItem(row) {
  return {
    id:                 row.menu_item_id || '',
    name:               row.name,
    price:              parseFloat(row.unit_price),
    basePrice:          parseFloat(row.base_price),
    quantity:           row.quantity,
    customizationsText: row.customizations_text || '',
    instructions:       row.instructions || ''
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateOrderBody(body) {
  const { tableNumber, items, paymentMethod, tip } = body;
  const errors = [];

  const table = parseInt(tableNumber, 10);
  if (!table || table < 1 || table > MAX_TABLE) {
    errors.push(`tableNumber must be 1–${MAX_TABLE}`);
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('items must be a non-empty array');
  } else {
    items.forEach((item, idx) => {
      if (!item.name || typeof item.name !== 'string') {
        errors.push(`items[${idx}].name is required`);
      }
      if (typeof item.totalPrice !== 'number' || item.totalPrice < 0) {
        errors.push(`items[${idx}].totalPrice must be a non-negative number`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        errors.push(`items[${idx}].quantity must be a positive integer`);
      }
    });
  }

  if (paymentMethod && !VALID_PAYMENTS.includes(paymentMethod)) {
    errors.push(`paymentMethod must be one of: ${VALID_PAYMENTS.join(', ')}`);
  }

  if (tip !== undefined && (typeof tip !== 'number' || tip < 0)) {
    errors.push('tip must be a non-negative number');
  }

  return errors;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/orders
 * All active orders (status != served) — used by KDS.
 * Query: ?status=received|cooking|ready|served&table=N
 */
router.get('/', async (req, res) => {
  try {
    const { status, table } = req.query;

    let orderRows;
    if (status && table) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      const tableNum = parseInt(table, 10);
      orderRows = await sql`
        SELECT * FROM orders
        WHERE status = ${status} AND table_number = ${tableNum}
        ORDER BY created_at DESC
      `;
    } else if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      orderRows = await sql`
        SELECT * FROM orders
        WHERE status = ${status}
        ORDER BY created_at DESC
      `;
    } else if (table) {
      const tableNum = parseInt(table, 10);
      if (!tableNum || tableNum < 1 || tableNum > MAX_TABLE) {
        return res.status(400).json({ error: 'Invalid table number' });
      }
      orderRows = await sql`
        SELECT * FROM orders
        WHERE table_number = ${tableNum}
        ORDER BY created_at DESC
      `;
    } else {
      // Return all non-served + most recent served (last 20)
      orderRows = await sql`
        SELECT * FROM orders
        WHERE status != 'served'
        UNION ALL
        (SELECT * FROM orders WHERE status = 'served' ORDER BY created_at DESC LIMIT 20)
        ORDER BY created_at DESC
      `;
    }

    // Fetch all items for matched orders
    const orderIds = orderRows.map(o => o.id);
    let allItems = [];
    if (orderIds.length > 0) {
      allItems = await sql`
        SELECT * FROM order_items WHERE order_id = ANY(${orderIds})
      `;
    }

    const itemsByOrderId = {};
    allItems.forEach(item => {
      if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
      itemsByOrderId[item.order_id].push(item);
    });

    const orders = orderRows.map(o => normalizeOrder(o, itemsByOrderId[o.id] || []));
    res.json({ orders });
  } catch (err) {
    console.error('GET /api/orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/orders/:orderCode
 * Single order details — used by Live Order Tracker + receipt.
 */
router.get('/:orderCode', async (req, res) => {
  try {
    const { orderCode } = req.params;
    if (!orderCode || !/^ORD-\d{4}$/.test(orderCode)) {
      return res.status(400).json({ error: 'Invalid order code format' });
    }

    const orderRows = await sql`
      SELECT * FROM orders WHERE order_code = ${orderCode} LIMIT 1
    `;
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRows[0];
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${order.id}`;

    res.json(normalizeOrder(order, items));
  } catch (err) {
    console.error('GET /api/orders/:code error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * POST /api/orders
 * Create a new order from cart.
 * Body: { tableNumber, items: [{menuItemId, name, basePrice, totalPrice, quantity, customizationsText, instructions}], paymentMethod, tip }
 */
router.post('/', async (req, res) => {
  const errors = validateOrderBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const {
    tableNumber,
    items,
    paymentMethod = 'pay_at_table',
    tip = 0
  } = req.body;

  const table = parseInt(tableNumber, 10);
  const subtotal = items.reduce((sum, i) => sum + (i.totalPrice * i.quantity), 0);
  const tax      = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const tipAmt   = parseFloat(parseFloat(tip).toFixed(2));
  const total    = parseFloat((subtotal + tax + tipAmt).toFixed(2));
  const orderCode = generateOrderCode();

  try {
    // Insert order
    const orderRows = await sql`
      INSERT INTO orders (order_code, table_number, status, payment_method, subtotal, tax, tip, total, estimated_time)
      VALUES (${orderCode}, ${table}, 'received', ${paymentMethod}, ${subtotal.toFixed(2)}, ${tax}, ${tipAmt}, ${total}, 8)
      RETURNING *
    `;
    const order = orderRows[0];

    // Insert order items
    for (const item of items) {
      const menuItemId = item.menuItemId || null;
      const basePx     = parseFloat(item.basePrice  || item.totalPrice);
      const unitPx     = parseFloat(item.totalPrice);
      const qty        = parseInt(item.quantity, 10);
      const custText   = (item.customizationsText || '').substring(0, 500);
      const instrText  = (item.instructions || '').substring(0, 500);
      const itemName   = item.name.substring(0, 200);

      await sql`
        INSERT INTO order_items (order_id, menu_item_id, name, base_price, unit_price, quantity, customizations_text, instructions)
        VALUES (${order.id}, ${menuItemId}, ${itemName}, ${basePx.toFixed(2)}, ${unitPx.toFixed(2)}, ${qty}, ${custText}, ${instrText})
      `;
    }

    const allItems = await sql`SELECT * FROM order_items WHERE order_id = ${order.id}`;
    res.status(201).json(normalizeOrder(order, allItems));
  } catch (err) {
    console.error('POST /api/orders error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * PATCH /api/orders/:orderCode/status
 * Update order status — called from KDS action buttons.
 * Body: { status: 'cooking' | 'ready' | 'served' }
 */
router.patch('/:orderCode/status', async (req, res) => {
  const { orderCode } = req.params;
  const { status } = req.body;

  if (!orderCode || !/^ORD-\d{4}$/.test(orderCode)) {
    return res.status(400).json({ error: 'Invalid order code format' });
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }

  try {
    const updated = await sql`
      UPDATE orders
      SET status = ${status}
      WHERE order_code = ${orderCode}
      RETURNING *
    `;
    if (updated.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = updated[0];
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${order.id}`;
    res.json(normalizeOrder(order, items));
  } catch (err) {
    console.error('PATCH /api/orders/:code/status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * DELETE /api/orders/:orderCode
 * Cancel/delete an order ticket from KDS.
 */
router.delete('/:orderCode', async (req, res) => {
  const { orderCode } = req.params;
  if (!orderCode || !/^ORD-\d{4}$/.test(orderCode)) {
    return res.status(400).json({ error: 'Invalid order code format' });
  }

  try {
    const deleted = await sql`
      DELETE FROM orders WHERE order_code = ${orderCode} RETURNING order_code
    `;
    if (deleted.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: `Order ${orderCode} deleted`, orderCode });
  } catch (err) {
    console.error('DELETE /api/orders/:code error:', err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;
