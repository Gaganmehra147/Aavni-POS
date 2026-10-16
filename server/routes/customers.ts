import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// List customers
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, limit = 100 } = req.query;
    let query = `
      SELECT c.*,
        (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id) as total_bills,
        COALESCE((SELECT SUM(grand_total) FROM invoices WHERE customer_id = c.id), 0) as total_spent
      FROM customers c
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY c.id DESC LIMIT ?`;
    params.push(Number(limit));

    const customers = await queryAll(query, params);
    res.json({ customers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search customers (quick autocomplete for POS)
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) return res.json({ customers: [] });

    const customers = await queryAll(`
      SELECT id, name, phone, email, address, state_code, gstin, credit_balance
      FROM customers
      WHERE phone LIKE ? OR name LIKE ?
      LIMIT 10
    `, [`%${q}%`, `%${q}%`]);

    res.json({ customers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add customer
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, phone, email, address, city, state, state_code, gstin, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const existing = await queryOne('SELECT id FROM customers WHERE phone = ?', [cleanPhone]);
    if (existing) {
      return res.status(400).json({ error: `Customer with phone ${cleanPhone} already exists` });
    }

    const info = await run(`
      INSERT INTO customers (
        name, phone, email, address, city, state, state_code, gstin, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      cleanPhone,
      email ? email.trim() : null,
      address ? address.trim() : null,
      city ? city.trim() : 'Jabalpur',
      state ? state.trim() : 'Madhya Pradesh',
      state_code || '23',
      gstin ? gstin.trim().toUpperCase() : null,
      notes || null
    ]);

    res.status(201).json({ id: info.lastInsertRowid, message: 'Customer added successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer purchase history
router.get('/:id/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const customer = await queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const invoices = await queryAll(`
      SELECT * FROM invoices WHERE customer_id = ? ORDER BY id DESC
    `, [id]);

    res.json({ customer, invoices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
