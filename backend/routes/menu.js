// routes/menu.js — GET /api/menu
const express = require('express');
const router  = express.Router();
const { sql } = require('../db/client');

/**
 * GET /api/menu
 * Returns all menu items grouped with categories.
 * Query params: ?category=burgers&veg=true&spicy=true&chef=true&q=search
 */
router.get('/', async (req, res) => {
  try {
    const { category, veg, spicy, chef, q } = req.query;

    // Build dynamic query — we keep it simple but safe with tagged literals
    let items;

    if (category && category !== 'all') {
      // Validate category
      const VALID_CATS = ['burgers','chicken','sides','drinks','combos','desserts'];
      if (!VALID_CATS.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      items = await sql`
        SELECT * FROM menu_items
        WHERE category = ${category}
        ORDER BY is_popular DESC, name ASC
      `;
    } else {
      items = await sql`
        SELECT * FROM menu_items
        ORDER BY is_popular DESC, category ASC, name ASC
      `;
    }

    // JS-side filters for dietary & search (simpler than complex dynamic SQL)
    if (veg === 'true')   items = items.filter(i => i.is_veg);
    if (spicy === 'true') items = items.filter(i => i.is_spicy);
    if (chef === 'true')  items = items.filter(i => i.is_chef_special);
    if (q && q.trim()) {
      const search = q.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(search) ||
        (i.description && i.description.toLowerCase().includes(search)) ||
        i.category.toLowerCase().includes(search)
      );
    }

    // Normalize snake_case DB columns to camelCase for the frontend
    const normalized = items.map(normalizeItem);

    const categories = [
      { id: 'all',      name: 'All Items',      icon: '🔥' },
      { id: 'burgers',  name: 'Smash Burgers',  icon: '🍔' },
      { id: 'chicken',  name: 'Crispy Chicken', icon: '🍗' },
      { id: 'sides',    name: 'Fries & Sides',  icon: '🍟' },
      { id: 'drinks',   name: 'Shakes & Drinks',icon: '🥤' },
      { id: 'combos',   name: 'Value Combos',   icon: '🍱' },
      { id: 'desserts', name: 'Desserts',        icon: '🍦' },
    ];

    res.json({
      categories,
      items: normalized,
      total: normalized.length
    });
  } catch (err) {
    console.error('GET /api/menu error:', err);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

/**
 * GET /api/menu/:id — single item details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !/^[a-zA-Z0-9_-]{1,20}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    const rows = await sql`SELECT * FROM menu_items WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(normalizeItem(rows[0]));
  } catch (err) {
    console.error('GET /api/menu/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// DB column → frontend camelCase
function normalizeItem(row) {
  return {
    id:             row.id,
    name:           row.name,
    category:       row.category,
    price:          parseFloat(row.price),
    calories:       row.calories,
    prepTime:       row.prep_time,
    isPopular:      row.is_popular,
    isChefSpecial:  row.is_chef_special,
    isSpicy:        row.is_spicy,
    isVeg:          row.is_veg,
    image:          row.image_url,
    description:    row.description,
    customizations: row.customizations || {}
  };
}

module.exports = router;
