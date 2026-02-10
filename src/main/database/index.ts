import initSqlJs, { Database as SqlJsDatabase, SqlValue } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

let db: SqlJsDatabase | null = null;
let dbPath: string;

// Wrapper class to provide better-sqlite3-like API
export class Database {
  private db: SqlJsDatabase;
  private inTransaction = false;

  constructor(database: SqlJsDatabase) {
    this.db = database;
  }

  // Prepare statement returns an object with run, get, all methods
  prepare(sql: string) {
    const database = this.db;
    return {
      run: (...params: any[]) => {
        database.run(sql, params);
        if (!this.inTransaction) {
          saveDatabase();
        }
        return { changes: database.getRowsModified() };
      },
      get: (...params: any[]): any => {
        const result = database.exec(sql, params);
        if (result.length === 0 || result[0].values.length === 0) {
          return undefined;
        }
        const columns = result[0].columns;
        const row = result[0].values[0];
        const obj: any = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      },
      all: (...params: any[]): any[] => {
        const result = database.exec(sql, params);
        if (result.length === 0) {
          return [];
        }
        const columns = result[0].columns;
        return result[0].values.map((row) => {
          const obj: any = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
      },
    };
  }

  exec(sql: string) {
    this.db.run(sql);
    saveDatabase();
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      if (this.inTransaction) {
        throw new Error('Nested transactions are not supported');
      }

      this.db.run('BEGIN TRANSACTION');
      this.inTransaction = true;
      try {
        const result = fn();
        this.db.run('COMMIT');
        this.inTransaction = false;
        saveDatabase();
        return result;
      } catch (e: any) {
        console.error('Transaction failed:', e);
        try {
          this.db.run('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback error if no transaction is active
          console.error('Rollback failed (ignored):', rollbackError);
        } finally {
          this.inTransaction = false;
        }
        throw e;
      }
    };
  }
}

let wrappedDb: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (wrappedDb) return wrappedDb;

  const SQL = await initSqlJs();
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'data.db');

  // Load existing database or create new
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  wrappedDb = new Database(db);

  // Run migrations
  await runMigrations(db);

  // Seed default data if needed
  await seedDefaultData(db);

  // Save periodically
  setInterval(() => saveDatabase(), 30000);
  app.on('before-quit', () => saveDatabase());

  return wrappedDb;
}

export function getDatabase(): Database {
  if (!wrappedDb) throw new Error('Database not initialized');
  return wrappedDb;
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

async function runMigrations(database: SqlJsDatabase): Promise<void> {
  // Create migrations tracking table
  database.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Run initial migration
  const migrationName = '001_initial';
  const result = database.exec(`SELECT 1 FROM migrations WHERE name = '${migrationName}'`);

  if (result.length === 0) {
    // Run initial schema - split into individual statements
    const statements = [
      `CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pin_hash TEXT,
        pin_salt TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        billing_address TEXT NOT NULL,
        shipping_address TEXT,
        tax_number TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        sku TEXT,
        name TEXT NOT NULL,
        description TEXT,
        unit TEXT DEFAULT 'pcs',
        price REAL NOT NULL DEFAULT 0,
        cost REAL,
        tax_rate_id TEXT,
        stock INTEGER,
        track_stock INTEGER DEFAULT 0,
        image TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        tax_total REAL DEFAULT 0,
        discount_total REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        balance_due REAL DEFAULT 0,
        notes TEXT,
        terms TEXT,
        attachments TEXT DEFAULT '[]',
        recurring_rule TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`,
      `CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        product_id TEXT,
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        line_total REAL DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        invoice_id TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT DEFAULT 'bank',
        payment_date TEXT NOT NULL,
        reference TEXT,
        notes TEXT,
        is_refund INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        category_id TEXT,
        vendor TEXT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        expense_date TEXT NOT NULL,
        receipt_path TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES expense_categories(id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_profile ON invoices(profile_id)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
      `CREATE INDEX IF NOT EXISTS idx_clients_profile ON clients(profile_id)`,
      `CREATE INDEX IF NOT EXISTS idx_products_profile ON products(profile_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_profile ON expenses(profile_id)`,
    ];

    for (const stmt of statements) {
      database.run(stmt);
    }

    database.run(`INSERT INTO migrations (name) VALUES ('${migrationName}')`);
  }

  // Migration 002: Add soft delete (deleted_at column)
  const migration002 = '002_soft_delete';
  const result002 = database.exec(`SELECT 1 FROM migrations WHERE name = '${migration002}'`);

  if (result002.length === 0) {
    const softDeleteStatements = [
      `ALTER TABLE clients ADD COLUMN deleted_at TEXT NULL`,
      `ALTER TABLE products ADD COLUMN deleted_at TEXT NULL`,
      `ALTER TABLE invoices ADD COLUMN deleted_at TEXT NULL`,
      `ALTER TABLE payments ADD COLUMN deleted_at TEXT NULL`,
      `ALTER TABLE expenses ADD COLUMN deleted_at TEXT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_payments_deleted ON payments(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at)`,
    ];

    for (const stmt of softDeleteStatements) {
      try {
        database.run(stmt);
      } catch (e) {
        // Column might already exist
        console.log('Migration step skipped:', stmt);
      }
    }

    database.run(`INSERT INTO migrations (name) VALUES ('${migration002}')`);
  }

  saveDatabase();
}

async function seedDefaultData(database: SqlJsDatabase): Promise<void> {
  // Check if profile exists
  const profiles = database.exec('SELECT COUNT(*) as count FROM profiles');
  const profileCount = profiles.length > 0 ? profiles[0].values[0][0] as number : 0;

  if (profileCount === 0) {
    const profileId = uuidv4();
    const settingsId = uuidv4();

    // Create default profile
    database.run(
      `INSERT INTO profiles (id, name) VALUES (?, ?)`,
      [profileId, 'Default Profile']
    );

    // Create default settings
    const defaultTaxRates = [
      { id: uuidv4(), name: 'VAT 20%', rate: 20, isDefault: true },
      { id: uuidv4(), name: 'VAT 10%', rate: 10, isDefault: false },
      { id: uuidv4(), name: 'No Tax', rate: 0, isDefault: false },
    ];

    const settingsData = {
      companyName: 'My Company',
      invoicePrefix: 'INV',
      invoiceNextNumber: 1,
      currency: 'USD',
      currencySymbol: '$',
      taxRates: defaultTaxRates,
      defaultTerms: '',
      defaultNotes: '',
      footerText: '',
      autoLockMinutes: 0,
      pdfTemplate: 'modern',
      paperSize: 'a4'
    };

    database.run(
      `INSERT INTO settings (id, profile_id, data) VALUES (?, ?, ?)`,
      [settingsId, profileId, JSON.stringify(settingsData)]
    );

    // Create default expense categories
    const categories = [
      { name: 'Office Supplies', color: '#3b82f6' },
      { name: 'Travel', color: '#8b5cf6' },
      { name: 'Utilities', color: '#f59e0b' },
      { name: 'Marketing', color: '#10b981' },
      { name: 'Other', color: '#6b7280' },
    ];

    for (const cat of categories) {
      database.run(
        `INSERT INTO expense_categories (id, profile_id, name, color) VALUES (?, ?, ?, ?)`,
        [uuidv4(), profileId, cat.name, cat.color]
      );
    }

    saveDatabase();
  }
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    wrappedDb = null;
  }
}
