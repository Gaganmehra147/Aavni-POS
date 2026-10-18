import { createClient, Client, Transaction } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'aavni_pos.sqlite');

const dbUrl = process.env.DATABASE_URL || `file:${dbPath}`;
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN || undefined;

export const client: Client = createClient({
  url: dbUrl,
  authToken: dbAuthToken
});

// Helper functions for clean async/await SQLite operations
export async function queryAll<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  const result = await client.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function queryOne<T = any>(sql: string, args: any[] = []): Promise<T | null> {
  const result = await client.execute({ sql, args });
  return (result.rows[0] as unknown as T) || null;
}

export async function run(sql: string, args: any[] = []): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  const result = await client.execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid || 0),
    rowsAffected: result.rowsAffected
  };
}

export async function exec(sql: string): Promise<void> {
  await client.executeMultiple(sql);
}

// Transaction wrapper
export async function withTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await client.transaction('write');
  try {
    const result = await callback(tx);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function initDatabase() {
  await exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Store settings table
    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      brand_name TEXT DEFAULT 'AAVNI ETHNICWEAR',
      legal_name TEXT DEFAULT 'Aavni Ethnicwear Retail',
      address TEXT DEFAULT '1673, Sadashiv Niwas, Gorakhpur, Gurudwara Road, Jabalpur, Madhya Pradesh - 482001',
      city TEXT DEFAULT 'Jabalpur',
      state TEXT DEFAULT 'Madhya Pradesh',
      state_code TEXT DEFAULT '23',
      pincode TEXT DEFAULT '482001',
      phone TEXT DEFAULT '9516331531',
      email TEXT DEFAULT 'contact@aavniethnicwear.com',
      tagline TEXT DEFAULT 'Ethnic Wear For Every You',
      logo_url TEXT DEFAULT '/aavni-logo.png',
      gstin TEXT DEFAULT '23BLAPM8179G2ZY',
      is_gst_registered INTEGER DEFAULT 1,
      gst_type TEXT DEFAULT 'regular',
      invoice_prefix TEXT DEFAULT 'AE/24-25/',
      invoice_next_seq INTEGER DEFAULT 1,
      return_policy TEXT DEFAULT 'Exchange within 7 days with original tag and bill. No cash refunds.',
      bank_name TEXT DEFAULT 'State Bank of India',
      bank_account TEXT DEFAULT '38291048291',
      bank_ifsc TEXT DEFAULT 'SBIN0001234',
      upi_id TEXT DEFAULT '9516331531@upi',
      default_print_format TEXT DEFAULT 'thermal-80',
      tax_calculation_mode TEXT DEFAULT 'inclusive',
      allow_negative_stock INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure initial settings row exists
    INSERT OR IGNORE INTO store_settings (id) VALUES (1);

    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      state_code TEXT,
      gstin TEXT,
      balance REAL DEFAULT 0.0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Products master table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      brand TEXT DEFAULT 'Aavni',
      design_code TEXT NOT NULL,
      description TEXT,
      fabric TEXT,
      hsn_code TEXT DEFAULT '6204',
      gst_rate REAL DEFAULT 5.0,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Product variants table
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      purchase_cost REAL NOT NULL,
      selling_price REAL NOT NULL,
      mrp REAL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      reorder_threshold INTEGER DEFAULT 3,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Customers table
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT DEFAULT 'Madhya Pradesh',
      state_code TEXT DEFAULT '23',
      gstin TEXT,
      credit_balance REAL DEFAULT 0.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      invoice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_gstin TEXT,
      customer_state_code TEXT DEFAULT '23',
      cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      cashier_name TEXT NOT NULL,
      invoice_type TEXT NOT NULL DEFAULT 'RETAIL',
      is_interstate INTEGER DEFAULT 0,
      subtotal REAL NOT NULL,
      discount_total REAL DEFAULT 0.0,
      taxable_amount REAL NOT NULL,
      cgst_amount REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      tax_total REAL DEFAULT 0.0,
      round_off REAL DEFAULT 0.0,
      grand_total REAL NOT NULL,
      status TEXT DEFAULT 'COMPLETED',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoice items table
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      design_code TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      sku TEXT NOT NULL,
      barcode TEXT NOT NULL,
      hsn_code TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      discount_amount REAL DEFAULT 0.0,
      taxable_amount REAL NOT NULL,
      gst_rate REAL NOT NULL,
      cgst_rate REAL DEFAULT 0.0,
      cgst_amount REAL DEFAULT 0.0,
      sgst_rate REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_rate REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      total_tax REAL DEFAULT 0.0,
      line_total REAL NOT NULL
    );

    -- Invoice payments table
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      payment_mode TEXT NOT NULL,
      amount REAL NOT NULL,
      tendered_amount REAL DEFAULT 0.0,
      change_returned REAL DEFAULT 0.0,
      reference_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sales Returns table
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      original_invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT NOT NULL,
      total_refund_amount REAL NOT NULL,
      refund_mode TEXT NOT NULL,
      processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Return items table
    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      original_item_id INTEGER REFERENCES invoice_items(id) ON DELETE SET NULL,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id),
      quantity INTEGER NOT NULL,
      refund_unit_price REAL NOT NULL,
      restock_condition TEXT NOT NULL CHECK(restock_condition IN ('SALEABLE', 'DAMAGED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchases table
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_invoice_no TEXT,
      purchase_date DATE NOT NULL,
      subtotal REAL NOT NULL,
      tax_total REAL DEFAULT 0.0,
      freight_charges REAL DEFAULT 0.0,
      grand_total REAL NOT NULL,
      paid_amount REAL DEFAULT 0.0,
      payment_status TEXT DEFAULT 'UNPAID',
      status TEXT DEFAULT 'RECEIVED',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchase items table
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id),
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      gst_rate REAL DEFAULT 5.0,
      line_total REAL NOT NULL
    );

    -- Supplier payments table
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      payment_date DATE NOT NULL,
      reference_no TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Stock movements (immutable audit ledger)
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id),
      movement_type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference_id TEXT,
      reason TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses table
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date DATE NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      description TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Daily cash sessions
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date DATE NOT NULL,
      opened_by INTEGER NOT NULL REFERENCES users(id),
      opening_cash REAL NOT NULL,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_by INTEGER REFERENCES users(id),
      closing_cash_actual REAL,
      expected_closing_cash REAL,
      variance REAL,
      closed_at DATETIME,
      status TEXT DEFAULT 'OPEN',
      remarks TEXT
    );

    -- Held carts
    CREATE TABLE IF NOT EXISTS held_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      customer_phone TEXT,
      cart_data TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default categories if not already present
  const catCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (!catCount || catCount.count === 0) {
    const defaultCats = [
      ['Kurtis', 'Everyday, cotton, printed, and festive casual kurtis'],
      ['Kurta Sets', 'Coordinated kurti with pant/palazzo and dupatta'],
      ['Anarkali Suits', 'Floor-length and flared heavy festive Anarkalis'],
      ['Sarees', 'Banarasi, Chanderi, Kanjivaram, Georgette, Silk sarees'],
      ['Lehengas', 'Bridal, party wear, and sangeet designer lehengas'],
      ['Dupattas', 'Banarasi, Chiffon, Bandhani, and Organza dupattas'],
      ['Co-ord Sets', 'Modern fusion ethnic two-piece sets'],
      ['Dress Materials', 'Unstitched suit material sets with dupatta'],
      ['Accessories', 'Potli bags, stoles, and ethnic accessories'],
      ['Other', 'Miscellaneous garments and alterations']
    ];
    for (const [name, desc] of defaultCats) {
      await run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, desc]);
    }
  }
}
