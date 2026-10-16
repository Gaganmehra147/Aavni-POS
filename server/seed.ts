import bcrypt from 'bcryptjs';
import { queryOne, run, withTransaction } from './db';

export async function seedDemoData() {
  await withTransaction(async (tx) => {
    // 1. Ensure Default Admin & Staff
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('Admin@123', salt);
    const mgrHash = bcrypt.hashSync('Manager@123', salt);
    const cashHash = bcrypt.hashSync('Cashier@123', salt);

    await tx.execute({
      sql: `INSERT OR IGNORE INTO users (name, username, password_hash, role)
            VALUES 
              ('Store Owner', 'admin', ?, 'admin'),
              ('Rajesh Sharma (Manager)', 'manager', ?, 'manager'),
              ('Priya Patel (Cashier)', 'cashier', ?, 'cashier')`,
      args: [adminHash, mgrHash, cashHash]
    });

    const admin = (await tx.execute({
      sql: "SELECT id FROM users WHERE username = 'admin'",
      args: []
    })).rows[0] as any;
    const adminId = admin ? admin.id : 1;

    // 2. Suppliers
    const suppliers = [
      ['Chanderi Heritage Textiles', 'Kailash Chanderi', '9826199881', 'kailash@chanderiheritage.com', 'Bada Bazaar', 'Chanderi', 'Madhya Pradesh', '23', '23AAACH8821K1Z2', 15000],
      ['Varanasi Katan Weavers Co', 'Rameshwar Ji', '9415287612', 'sales@varanasikatan.com', 'Godowlia Road', 'Varanasi', 'Uttar Pradesh', '09', '09AABCV1293P1Z8', 0],
      ['Jaipur Ethnic Crafts', 'Mahendra Singh', '9829033441', 'crafts@jaipurethnic.com', 'Johari Bazaar', 'Jaipur', 'Rajasthan', '08', '08AAEFJ4412M1Z5', 8500]
    ];

    for (const s of suppliers) {
      await tx.execute({
        sql: `INSERT OR IGNORE INTO suppliers (name, contact_person, phone, email, address, city, state, state_code, gstin, balance)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: s
      });
    }

    const s1Row = (await tx.execute({ sql: "SELECT id FROM suppliers WHERE name = 'Chanderi Heritage Textiles'", args: [] })).rows[0] as any;
    const s2Row = (await tx.execute({ sql: "SELECT id FROM suppliers WHERE name = 'Varanasi Katan Weavers Co'", args: [] })).rows[0] as any;
    const s3Row = (await tx.execute({ sql: "SELECT id FROM suppliers WHERE name = 'Jaipur Ethnic Crafts'", args: [] })).rows[0] as any;

    const s1 = s1Row ? s1Row.id : 1;
    const s2 = s2Row ? s2Row.id : 2;
    const s3 = s3Row ? s3Row.id : 3;

    // 3. Customers
    const customers = [
      ['Pooja Sharma', '9826112345', 'pooja.sharma@gmail.com', '124, Napier Town', 'Jabalpur', 'Madhya Pradesh', '23', 0],
      ['Ananya Verma', '9425178901', 'ananya.v@outlook.com', '45, Wright Town', 'Jabalpur', 'Madhya Pradesh', '23', 0],
      ['Dr. Meenakshi Patel', '9893145678', 'drmeenakshi@yahoo.com', '78, Gorakhpur Gurudwara Rd', 'Jabalpur', 'Madhya Pradesh', '23', 0]
    ];

    for (const c of customers) {
      await tx.execute({
        sql: `INSERT OR IGNORE INTO customers (name, phone, email, address, city, state, state_code, credit_balance)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: c
      });
    }

    // 4. Categories IDs
    const catRows = (await tx.execute({ sql: 'SELECT id, name FROM categories', args: [] })).rows as any[];
    const catMap: Record<string, number> = {};
    for (const c of catRows) catMap[c.name] = c.id;

    // 5. Products & Variants (with realistic Indian ethnicwear details)
    const demoProducts = [
      {
        name: 'Gulbahar Handloom Chanderi Saree',
        category: 'Sarees',
        design_code: 'AAV-SAR-01',
        brand: 'Aavni Heritage',
        fabric: 'Pure Chanderi Silk with Zari Border',
        hsn: '5007',
        gst: 5.0,
        supplier: s1,
        variants: [
          { sku: 'AAV-SAR01-MRN', barcode: '8901001001', size: 'Free Size', color: 'Royal Maroon', cost: 1850, price: 3499, mrp: 4999, stock: 12 },
          { sku: 'AAV-SAR01-RPK', barcode: '8901001002', size: 'Free Size', color: 'Rani Pink', cost: 1850, price: 3499, mrp: 4999, stock: 8 },
          { sku: 'AAV-SAR01-EMG', barcode: '8901001003', size: 'Free Size', color: 'Emerald Green', cost: 1850, price: 3499, mrp: 4999, stock: 6 }
        ]
      },
      {
        name: 'Noor Anarkali Festive Kurta Set with Dupatta',
        category: 'Anarkali Suits',
        design_code: 'AAV-ANK-04',
        brand: 'Aavni Festive',
        fabric: 'Chanderi Georgette with Gotta Patti Work',
        hsn: '6204',
        gst: 12.0,
        supplier: s3,
        variants: [
          { sku: 'AAV-ANK04-M-WHT', barcode: '8901002001', size: 'M', color: 'Ivory Cream', cost: 2200, price: 4250, mrp: 5999, stock: 5 },
          { sku: 'AAV-ANK04-L-WHT', barcode: '8901002002', size: 'L', color: 'Ivory Cream', cost: 2200, price: 4250, mrp: 5999, stock: 8 },
          { sku: 'AAV-ANK04-XL-WHT', barcode: '8901002003', size: 'XL', color: 'Ivory Cream', cost: 2200, price: 4250, mrp: 5999, stock: 7 },
          { sku: 'AAV-ANK04-XXL-WHT', barcode: '8901002004', size: 'XXL', color: 'Ivory Cream', cost: 2200, price: 4250, mrp: 5999, stock: 2 } // Low stock demo!
        ]
      },
      {
        name: 'Zari Embroidered Velvet Bridal Lehenga',
        category: 'Lehengas',
        design_code: 'AAV-LHG-09',
        brand: 'Aavni Couture',
        fabric: 'Micro Velvet with Hand Zardozi and Dabka',
        hsn: '6204',
        gst: 12.0,
        supplier: s2,
        variants: [
          { sku: 'AAV-LHG09-FS-DMR', barcode: '8901003001', size: 'Free Size', color: 'Deep Wine Maroon', cost: 8500, price: 16999, mrp: 24999, stock: 4 }
        ]
      },
      {
        name: 'Bagh Print Cotton Straight Kurti',
        category: 'Kurtis',
        design_code: 'AAV-KRT-12',
        brand: 'Aavni Daily',
        fabric: '100% Breathable Malmal Cotton',
        hsn: '6204',
        gst: 5.0,
        supplier: s1,
        variants: [
          { sku: 'AAV-KRT12-S-IND', barcode: '8901004001', size: 'S', color: 'Indigo Blue', cost: 450, price: 999, mrp: 1499, stock: 10 },
          { sku: 'AAV-KRT12-M-IND', barcode: '8901004002', size: 'M', color: 'Indigo Blue', cost: 450, price: 999, mrp: 1499, stock: 14 },
          { sku: 'AAV-KRT12-L-IND', barcode: '8901004003', size: 'L', color: 'Indigo Blue', cost: 450, price: 999, mrp: 1499, stock: 15 },
          { sku: 'AAV-KRT12-XL-IND', barcode: '8901004004', size: 'XL', color: 'Indigo Blue', cost: 450, price: 999, mrp: 1499, stock: 0 }, // Out of stock demo!
          { sku: 'AAV-KRT12-XXL-IND', barcode: '8901004005', size: 'XXL', color: 'Indigo Blue', cost: 450, price: 999, mrp: 1499, stock: 6 }
        ]
      },
      {
        name: 'Banarasi Katan Silk Floral Dupatta',
        category: 'Dupattas',
        design_code: 'AAV-DUP-07',
        brand: 'Aavni Heritage',
        fabric: 'Pure Katan Silk with Meenakari Jaal',
        hsn: '5007',
        gst: 5.0,
        supplier: s2,
        variants: [
          { sku: 'AAV-DUP07-FS-RED', barcode: '8901005001', size: 'Free Size', color: 'Ruby Red', cost: 950, price: 1899, mrp: 2799, stock: 9 },
          { sku: 'AAV-DUP07-FS-GLD', barcode: '8901005002', size: 'Free Size', color: 'Antique Gold', cost: 950, price: 1899, mrp: 2799, stock: 11 }
        ]
      }
    ];

    for (const prod of demoProducts) {
      const existProd = (await tx.execute({
        sql: 'SELECT id FROM products WHERE design_code = ?',
        args: [prod.design_code]
      })).rows[0];
      if (existProd) continue;

      const catId = catMap[prod.category] || null;
      const pInfo = await tx.execute({
        sql: `INSERT INTO products (name, category_id, brand, design_code, description, fabric, hsn_code, gst_rate, supplier_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `[DEMO] ${prod.name}`,
          catId,
          prod.brand,
          prod.design_code,
          `Handcrafted ethnic wear by ${prod.brand}`,
          prod.fabric,
          prod.hsn,
          prod.gst,
          prod.supplier
        ]
      });

      const pId = Number(pInfo.lastInsertRowid);

      for (const v of prod.variants) {
        const vInfo = await tx.execute({
          sql: `INSERT INTO product_variants (product_id, sku, barcode, size, color, purchase_cost, selling_price, mrp, stock_quantity, reorder_threshold)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [pId, v.sku, v.barcode, v.size, v.color, v.cost, v.price, v.mrp, v.stock, 3]
        });

        const vId = Number(vInfo.lastInsertRowid);
        if (v.stock > 0) {
          await tx.execute({
            sql: `INSERT INTO stock_movements (variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id)
                  VALUES (?, 'OPENING_STOCK', ?, 0, ?, 'DEMO_SEED', 'Demo initial stock', ?)`,
            args: [vId, v.stock, v.stock, adminId]
          });
        }
      }
    }

    // 6. Expenses Sample
    const todayStr = new Date().toISOString().split('T')[0];
    await tx.execute({
      sql: `INSERT INTO expenses (expense_date, category, amount, payment_mode, description, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [todayStr, 'Electricity', 2400, 'UPI', 'Store monthly electricity bill', adminId]
    });
    await tx.execute({
      sql: `INSERT INTO expenses (expense_date, category, amount, payment_mode, description, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [todayStr, 'Packaging', 1500, 'CASH', 'Premium boutique shopping carry bags', adminId]
    });

    // 7. Store cash drawer opening session
    const openSession = (await tx.execute({
      sql: "SELECT id FROM cash_sessions WHERE status = 'OPEN'",
      args: []
    })).rows[0];

    if (!openSession) {
      await tx.execute({
        sql: `INSERT INTO cash_sessions (session_date, opened_by, opening_cash, remarks)
              VALUES (date('now'), ?, 5000, 'Morning drawer opening float')`,
        args: [adminId]
      });
    }
  });
}

export async function clearDemoData() {
  await withTransaction(async (tx) => {
    const demoProds = (await tx.execute({
      sql: "SELECT id FROM products WHERE name LIKE '[DEMO]%'",
      args: []
    })).rows as any[];

    for (const p of demoProds) {
      await tx.execute({ sql: 'DELETE FROM product_variants WHERE product_id = ?', args: [p.id] });
      await tx.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [p.id] });
    }

    await tx.execute({ sql: "DELETE FROM stock_movements WHERE reference_id = 'DEMO_SEED'", args: [] });
  });
}
