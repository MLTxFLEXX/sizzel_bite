# 🔥 SizzleBite — Dine-In Ordering System Backend

Node.js/Express REST API powering the SizzleBite dine-in ordering system: a digital menu for customers, a full order lifecycle, and table-service requests — backed by **Neon PostgreSQL** (serverless Postgres).

## Tech Stack

| Layer        | Technology                                      |
|--------------|--------------------------------------------------|
| Runtime      | Node.js + Express 4                             |
| Database     | Neon PostgreSQL (serverless driver `@neondatabase/serverless`) |
| Config       | `dotenv`                                        |
| CORS         | `cors` (dev-friendly origin allow-list)         |
| Dev reload   | `nodemon`                                       |

## Project Structure

```
backend/
├── server.js          # Express app entry point — routes, CORS, health check
├── package.json       # Scripts + dependencies
├── db/
│   ├── schema.sql     # Tables, indexes, updated_at trigger
│   ├── setup.js       # Applies schema to Neon + seeds the menu
│   └── client.js      # Exports the Neon `sql` template-tag client
└── routes/
    ├── menu.js        # GET /api/menu, GET /api/menu/:id
    ├── orders.js      # Full order lifecycle CRUD
    └── services.js    # Table service requests (water, waiter, bill…)
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in this folder (same directory as `package.json`) with your Neon connection string from the [Neon Console](https://console.neon.tech) → **Connect**:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# optional
PORT=3001
FRONTEND_URL=http://localhost:5500
```

> **Note (Windows):** run all commands from the `backend` folder itself — it *is* the project root (`server.js` and `.env` live here), so don't nest it again.

### 3. Create the database schema & seed menu

```bash
npm run setup-db
```

This applies `db/schema.sql` (4 tables, indexes, an auto-updating `updated_at` trigger on orders) and seeds **18 menu items**. It's safe to re-run (idempotent `IF NOT EXISTS` + upsert seeding).

### 4. Start the server

```bash
npm start        # production
npm run dev      # nodemon (auto-reload)
```

Server listens on `PORT` (default **3001**).

## Database Schema

| Table              | Purpose                                                        |
|--------------------|----------------------------------------------------------------|
| `menu_items`       | Menu catalog: price, calories, prep time, dietary flags, `customizations` JSONB (patty/addon/heat options) |
| `orders`           | Order header: `order_code` (ORD-XXXX), table number, status, payment, subtotal/tax/tip/total |
| `order_items`      | Line items per order, with customization text & special instructions |
| `service_requests` | Table service calls: `request_code` (SRV-XXX), type, handled flag |

Order status lifecycle: `received → cooking → ready → served`
Payment methods: `pay_at_table` \| `instant_card`

## API Reference

Everything is under `/api`. All responses use camelCase keys for the frontend (DB columns are normalized automatically).

### Health

```http
GET /api/health
```
Returns `{ "status": "ok", "database": "connected", ... }` on success, `503` with `database: "disconnected"` if the DB unreachable.

### Menu — `GET /api/menu`

```http
GET /api/menu
GET /api/menu?category=burgers&veg=true&spicy=true&chef=true&q=shake
GET /api/menu/:id          # single item (e.g. /api/menu/b1)
```

Query params:
- `category` — one of `burgers`, `chicken`, `sides`, `drinks`, `combos`, `desserts` (or `all`)
- `veg=true`, `spicy=true`, `chef=true` — dietary/preference filters
- `q` — free-text search over name/description/category

Response shape:
```json
{
  "categories": [ { "id": "all", "name": "All Items", "icon": "🔥" }, ... ],
  "items": [ { "id": "b1", "name": "The Double Sizzle Smash", "price": 11.99,
               "prepTime": "6-8 mins", "customizations": { ... }, ... } ],
  "total": 18
}
```

### Orders

```http
# Kitchen queue: active (non-served) orders + last 20 served
GET /api/orders
GET /api/orders?status=cooking        # received|cooking|ready|served
GET /api/orders?table=5
GET /api/orders/:orderCode            # e.g. ORD-1234 (live order tracker / receipt)

# Create order from cart
POST /api/orders
Content-Type: application/json

{
  "tableNumber": 4,
  "paymentMethod": "pay_at_table",
  "tip": 2.5,
  "items": [
    {
      "menuItemId": "b1",
      "name": "The Double Sizzle Smash",
      "basePrice": 11.99,
      "totalPrice": 13.19,          // base + customizations
      "quantity": 2,
      "customizationsText": "Double beef, + bacon",
      "instructions": "No pickles"
    }
  ]
}
# → 201 with computed subtotal / tax (8%) / tip / total, code ORD-XXXX

# Move order along (Kitchen Display System)
PATCH /api/orders/:orderCode/status     # body: { "status": "cooking" }

# Cancel / delete ticket
DELETE /api/orders/:orderCode
```

Validation: table number **1–12**, items must be a non-empty array with `name`, non-negative `totalPrice`, positive integer `quantity`. Errors return `400 { error: "Validation failed", details: [...] }`.

### Service Requests

```http
GET /api/services                      # unhandled requests (KDS alerts panel)
GET /api/services?handled=true         # last 50 handled
GET /api/services?table=3

POST /api/services
{ "tableNumber": 4, "type": "waiter" } # water | napkins | sauces | waiter | bill
# → 201 with code SRV-XXX and auto-generated label e.g. "Call Server to Table"

PATCH /api/services/:requestCode/resolve   # staff marks handled
```

## Configuration Notes

- **CORS** — allows origins from `FRONTEND_URL` (default `http://localhost:5500`), plus `:3000`, `127.0.0.1` variants, and `null` (for `file://` pages). Blocked origins get logged and rejected.
- **Request logging** — every request logs `[timestamp] METHOD /url`.
- **Tax rate** — fixed at **8%** (`TAX_RATE` in `routes/orders.js`); tips are customer-set.
- **Max tables** — **12** (`MAX_TABLE` validated in both orders and services routes).
- **Payload limit** — JSON bodies capped at `1mb`.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `DATABASE_URL is not set` on startup | `.env` missing or wrong folder. It must sit next to `package.json`. |
| `Connection string format ... should be: postgresql://user:password@host...` | Malformed URL — make sure `postgresql://username:password@host/db` (no lost characters when copying). |
| `password authentication failed` | Wrong password — reset it in the Neon Console and re-copy the **entire** connection string. |
| `relation "menu_items" does not exist` | Run `npm run setup-db` first. |
| Health endpoint shows `disconnected` but startup looked fine | An **old** server process may still be listening on the port with a stale connection string — kill it (e.g. `netstat -ano \| grep :3001` then `taskkill //F //PID <pid>`) and restart. |
| `EADDRINUSE :::3001` | Another process holds port 3001 (see above), or change `PORT` in `.env`. |
| CORS blocked in browser | Add your frontend origin to `allowedOrigins` in `server.js` or set `FRONTEND_URL` in `.env`. |
