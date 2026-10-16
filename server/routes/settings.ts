import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run, dbPath } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { seedDemoData, clearDemoData } from '../seed';

const router = Router();

// Get Store Settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await queryOne('SELECT * FROM store_settings WHERE id = 1');
    res.json({ settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Store Settings
router.put('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const {
      brand_name,
      legal_name,
      address,
      city,
      state,
      state_code,
      pincode,
      phone,
      email,
      gstin,
      is_gst_registered,
      gst_type,
      invoice_prefix,
      invoice_next_seq,
      return_policy,
      bank_name,
      bank_account,
      bank_ifsc,
      upi_id,
      default_print_format,
      tax_calculation_mode,
      allow_negative_stock
    } = req.body;

    let cleanGstin = (gstin || '').trim().toUpperCase();
    let isRegistered = is_gst_registered ? 1 : 0;
    if (cleanGstin) {
      if (cleanGstin.length !== 15) {
        return res.status(400).json({ error: 'Indian GSTIN must be exactly 15 alphanumeric characters' });
      }
      isRegistered = 1;
    }

    await run(`
      UPDATE store_settings SET
        brand_name = ?,
        legal_name = ?,
        address = ?,
        city = ?,
        state = ?,
        state_code = ?,
        pincode = ?,
        phone = ?,
        email = ?,
        gstin = ?,
        is_gst_registered = ?,
        gst_type = ?,
        invoice_prefix = ?,
        invoice_next_seq = ?,
        return_policy = ?,
        bank_name = ?,
        bank_account = ?,
        bank_ifsc = ?,
        upi_id = ?,
        default_print_format = ?,
        tax_calculation_mode = ?,
        allow_negative_stock = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      brand_name || 'AAVNI ETHNICWEAR',
      legal_name || 'Aavni Ethnicwear Retail',
      address || '1673, Sadashiv Niwas, Gorakhpur, Gurudwara Road, Jabalpur, Madhya Pradesh - 482001',
      city || 'Jabalpur',
      state || 'Madhya Pradesh',
      state_code || '23',
      pincode || '482001',
      phone || '9516331531',
      email || 'contact@aavniethnicwear.com',
      cleanGstin,
      isRegistered,
      gst_type || (cleanGstin ? 'regular' : 'none'),
      invoice_prefix || 'AE/24-25/',
      parseInt(invoice_next_seq, 10) || 1,
      return_policy || 'Exchange within 7 days with original tag and bill. No cash refunds.',
      bank_name || 'State Bank of India',
      bank_account || '38291048291',
      bank_ifsc || 'SBIN0001234',
      upi_id || '9516331531@upi',
      default_print_format || 'thermal-80',
      tax_calculation_mode || 'exclusive',
      allow_negative_stock ? 1 : 0
    ]);

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'UPDATE_SETTINGS', 'store_settings', '1', 'Store settings updated')`,
      [req.user!.id]
    );

    res.json({ message: 'Store settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download Database Backup (Direct SQLite binary download)
router.get('/backup/download', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `aavni_backup_${timestamp}.sqlite`;

    res.download(dbPath, filename, async (err) => {
      if (!err) {
        await run(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES (?, 'BACKUP_DOWNLOAD', 'database', 'sqlite', 'Database backup downloaded')`,
          [req.user!.id]
        );
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export JSON Backup of All Tables
router.get('/backup/json', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const backupData = {
      store_settings: await queryAll('SELECT * FROM store_settings'),
      categories: await queryAll('SELECT * FROM categories'),
      suppliers: await queryAll('SELECT * FROM suppliers'),
      products: await queryAll('SELECT * FROM products'),
      product_variants: await queryAll('SELECT * FROM product_variants'),
      customers: await queryAll('SELECT * FROM customers'),
      invoices: await queryAll('SELECT * FROM invoices'),
      invoice_items: await queryAll('SELECT * FROM invoice_items'),
      payments: await queryAll('SELECT * FROM payments'),
      returns: await queryAll('SELECT * FROM returns'),
      return_items: await queryAll('SELECT * FROM return_items'),
      purchases: await queryAll('SELECT * FROM purchases'),
      purchase_items: await queryAll('SELECT * FROM purchase_items'),
      stock_movements: await queryAll('SELECT * FROM stock_movements'),
      expenses: await queryAll('SELECT * FROM expenses'),
      exported_at: new Date().toISOString()
    };

    res.setHeader('Content-Disposition', `attachment; filename=aavni_data_${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seed Demo Data
router.post('/demo-data/seed', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await seedDemoData();
    res.json({ message: 'Demo data loaded successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Wipe Demo Data
router.post('/demo-data/clear', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await clearDemoData();
    res.json({ message: 'Demo data cleared successfully. System ready for live production.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
