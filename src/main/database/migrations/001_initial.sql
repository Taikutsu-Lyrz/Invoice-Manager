-- Initial database schema for Invoice & Revenue Manager
-- Version: 001

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Profiles table (local user profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings table (per-profile settings stored as JSON)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  billing_address TEXT NOT NULL,
  shipping_address TEXT,
  tax_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clients_profile ON clients(profile_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  price REAL NOT NULL DEFAULT 0,
  cost REAL,
  tax_rate_id TEXT,
  stock INTEGER,
  track_stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_profile ON products(profile_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  client_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  attachments TEXT DEFAULT '[]',
  recurring_rule TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_invoices_profile ON invoices(profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  product_id TEXT,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  payment_date TEXT NOT NULL,
  notes TEXT,
  is_refund INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_profile ON payments(profile_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Expense categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_profile ON expense_categories(profile_id);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  vendor TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  tax_amount REAL NOT NULL DEFAULT 0,
  expense_date TEXT NOT NULL,
  notes TEXT,
  attachment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_expenses_profile ON expenses(profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_profile ON audit_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
