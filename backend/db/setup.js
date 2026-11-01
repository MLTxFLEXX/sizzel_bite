// db/setup.js — Creates tables and seeds menu items
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function setup() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('📦 Reading schema...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // Neon serverless driver: we split on semicolons, but must IGNORE semicolons
  // inside $$-dollar-quoted function bodies (otherwise the trigger function
  // gets chopped up and every piece fails). Leading comment lines are then
  // stripped from each statement.
  function splitSchemaStatements(text) {
    const parts = [];
    let buf = '';
    let inDollar = false;
    for (let i = 0; i < text.length; i++) {
      if (text.startsWith('$$', i)) {
        inDollar = !inDollar;
        buf += '$$';
        i++;
        continue;
      }
      if (text[i] === ';' && !inDollar) {
        parts.push(buf.trim());
        buf = '';
        continue;
      }
      buf += text[i];
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts
      .map(s => s.replace(/^(?:--[^\n]*\n)+/, '').trim())
      .filter(s => s.length > 0);
  }

  const statements = splitSchemaStatements(schema);

  console.log(`🔨 Applying ${statements.length} schema statements...`);
  for (const stmt of statements) {
    try {
      // NOTE: sql.unsafe() only builds a raw fragment; it must be CALLED via
      // sql.query() (or interpolated into the sql`` template tag) to execute.
      await sql.query(stmt + ';');
    } catch (err) {
      console.warn(`⚠️  Statement skipped (${err.message.slice(0, 60)})`);
    }
  }

  console.log('🌱 Seeding menu items...');
  await seedMenuItems(sql);

  console.log('\n✅ Database setup complete!\n');
  process.exit(0);
}

async function seedMenuItems(sql) {
  const items = [
    {
      id: 'b1', name: 'The Double Sizzle Smash', category: 'burgers',
      price: 299.00, calories: 820, prep_time: '6-8 mins',
      is_popular: true, is_chef_special: true, is_spicy: false, is_veg: false,
      image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
      description: 'Two 100% Angus smash beef patties, double melted cheddar, caramelized onions, house pickles, and secret Sizzle burger sauce on a toasted brioche bun.',
      customizations: {"patty":{"title":"Choose Patty Style","type":"radio","required":true,"options":[{"name":"Double Angus Beef (Included)","price":0},{"name":"Triple Angus Beef","price":80},{"name":"Beyond Meat Plant-Based","price":50}]},"addons":{"title":"Add Extra Toppings","type":"checkbox","options":[{"name":"Crispy Smoked Bacon","price":60},{"name":"Extra Melted Cheddar","price":40},{"name":"Grilled Jalapeños","price":30},{"name":"Fried Farm Egg","price":40},{"name":"Truffle Aioli Dip","price":35}]}}
  }
  console.log(`\n✅ ${items.length} menu items seeded.`);
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
