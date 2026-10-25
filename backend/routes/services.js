// routes/services.js — Customer service requests (water, waiter, bill, etc.)
const express = require('express');
const router  = express.Router();
const { sql } = require('../db/client');

const MAX_TABLE    = 12;
const VALID_TYPES  = ['water', 'napkins', 'sauces', 'waiter', 'bill'];
const TYPE_LABELS  = {
  water:   'Request Fresh Water',
  napkins: 'Extra Napkins & Cutlery',
  sauces:  'Extra Dip / Sauces',
  waiter:  'Call Server to Table',
  bill:    'Request Paper Bill'
};

function generateServiceCode() {
  return 'SRV-' + Math.floor(100 + Math.random() * 900);
}

function normalizeRequest(row) {
  return {
    id:          row.request_code,
    dbId:        row.id,
    tableNumber: row.table_number,
    type:        row.type,
    text:        row.text,
    handled:     row.handled,
    time:        new Date(row.created_at).getTime(),
    handledAt:   row.handled_at ? new Date(row.handled_at).getTime() : null
  };
}

/**
 * GET /api/services
 * All unhandled service requests (for KDS alerts panel).
 * Query: ?handled=false|true&table=N
 */
router.get('/', async (req, res) => {
  try {
    const { handled, table } = req.query;

    let rows;
    if (table) {
      const tableNum = parseInt(table, 10);
      if (!tableNum || tableNum < 1 || tableNum > MAX_TABLE) {
        return res.status(400).json({ error: 'Invalid table number' });
      }
      rows = await sql`
        SELECT * FROM service_requests
        WHERE table_number = ${tableNum}
        ORDER BY created_at DESC
      `;
    } else if (handled === 'true') {
      rows = await sql`
        SELECT * FROM service_requests WHERE handled = TRUE ORDER BY created_at DESC LIMIT 50
      `;
    } else {
      // Default: return unhandled requests
      rows = await sql`
        SELECT * FROM service_requests WHERE handled = FALSE ORDER BY created_at DESC
      `;
    }

    res.json({ requests: rows.map(normalizeRequest) });
  } catch (err) {
    console.error('GET /api/services error:', err);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
});

/**
 * POST /api/services
 * Customer submits a service request.
 * Body: { tableNumber: number, type: 'water'|'napkins'|'sauces'|'waiter'|'bill' }
 */
router.post('/', async (req, res) => {
  const { tableNumber, type } = req.body;
  const errors = [];

  const table = parseInt(tableNumber, 10);
  if (!table || table < 1 || table > MAX_TABLE) {
    errors.push(`tableNumber must be 1–${MAX_TABLE}`);
  }
  if (!type || !VALID_TYPES.includes(type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const text        = TYPE_LABELS[type];
  const requestCode = generateServiceCode();

  try {
    const rows = await sql`
      INSERT INTO service_requests (request_code, table_number, type, text)
      VALUES (${requestCode}, ${table}, ${type}, ${text})
      RETURNING *
    `;
    res.status(201).json(normalizeRequest(rows[0]));
  } catch (err) {
    console.error('POST /api/services error:', err);
    res.status(500).json({ error: 'Failed to save service request' });
  }
});

/**
 * PATCH /api/services/:requestCode/resolve
 * Kitchen staff marks a service request as handled.
 */
router.patch('/:requestCode/resolve', async (req, res) => {
  const { requestCode } = req.params;
  if (!requestCode || !/^SRV-\d{3}$/.test(requestCode)) {
    return res.status(400).json({ error: 'Invalid request code format' });
  }

  try {
    const updated = await sql`
      UPDATE service_requests
      SET handled = TRUE, handled_at = NOW()
      WHERE request_code = ${requestCode}
      RETURNING *
    `;
    if (updated.length === 0) return res.status(404).json({ error: 'Request not found' });
    res.json(normalizeRequest(updated[0]));
  } catch (err) {
    console.error('PATCH /api/services/:code/resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve service request' });
  }
});

module.exports = router;
