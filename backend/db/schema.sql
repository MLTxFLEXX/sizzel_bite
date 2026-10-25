-- SizzleBite Database Schema
-- Run this via: node db/setup.js
-- Or paste directly into Neon SQL Editor

-- --------------------------------------------------------
-- MENU ITEMS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  id            VARCHAR(20)   PRIMARY KEY,
  name          TEXT          NOT NULL,
  category      VARCHAR(50)   NOT NULL,
  price         NUMERIC(8,2)  NOT NULL CHECK (price >= 0),
  calories      INTEGER,
  prep_time     VARCHAR(30),
  is_popular    BOOLEAN       DEFAULT FALSE,
  is_chef_special BOOLEAN     DEFAULT FALSE,
  is_spicy      BOOLEAN       DEFAULT FALSE,
  is_veg        BOOLEAN       DEFAULT FALSE,
  image_url     TEXT,
  description   TEXT,
  customizations JSONB        DEFAULT '{}',
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- --------------------------------------------------------
-- ORDERS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL        PRIMARY KEY,
  order_code      VARCHAR(20)   NOT NULL UNIQUE,  -- e.g. ORD-1234
  table_number    INTEGER       NOT NULL CHECK (table_number >= 1 AND table_number <= 12),
  status          VARCHAR(20)   NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','cooking','ready','served')),
  payment_method  VARCHAR(30)   NOT NULL DEFAULT 'pay_at_table',
  subtotal        NUMERIC(10,2) NOT NULL,
  tax             NUMERIC(10,2) NOT NULL,
  tip             NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  estimated_time  INTEGER       DEFAULT 8,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- --------------------------------------------------------
-- ORDER ITEMS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                  SERIAL        PRIMARY KEY,
  order_id            INTEGER       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id        VARCHAR(20)   REFERENCES menu_items(id),
  name                TEXT          NOT NULL,
  base_price          NUMERIC(8,2)  NOT NULL,
  unit_price          NUMERIC(8,2)  NOT NULL,  -- price after customizations
  quantity            INTEGER       NOT NULL CHECK (quantity > 0),
  customizations_text TEXT,
  instructions        TEXT,
  created_at          TIMESTAMPTZ   DEFAULT NOW()
);

-- --------------------------------------------------------
-- SERVICE REQUESTS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_requests (
  id            SERIAL        PRIMARY KEY,
  request_code  VARCHAR(20)   NOT NULL UNIQUE,  -- e.g. SRV-101
  table_number  INTEGER       NOT NULL CHECK (table_number >= 1 AND table_number <= 12),
  type          VARCHAR(30)   NOT NULL
                CHECK (type IN ('water','napkins','sauces','waiter','bill')),
  text          TEXT          NOT NULL,
  handled       BOOLEAN       DEFAULT FALSE,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  handled_at    TIMESTAMPTZ
);

-- --------------------------------------------------------
-- INDEXES
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_number, status);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_service_table       ON service_requests(table_number, handled);
CREATE INDEX IF NOT EXISTS idx_menu_category       ON menu_items(category);

-- --------------------------------------------------------
-- AUTO-UPDATE updated_at trigger for orders
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
