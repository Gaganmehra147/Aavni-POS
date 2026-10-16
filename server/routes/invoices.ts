import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// List Invoices
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, search, status, limit = 100 } = req.query;

    let query = `
      SELECT i.*, 
        (SELECT GROUP_CONCAT(DISTINCT payment_mode) FROM payments WHERE invoice_id = i.id) as payment_modes,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
      FROM invoices i
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date) {
      query += ` AND date(i.invoice_date) >= date(?)`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND date(i.invoice_date) <= date(?)`;
      params.push(end_date);
    }
    if (status) {
      query += ` AND i.status = ?`;
      params.push(status);
    }
    if (search) {
      query += ` AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.customer_phone LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY i.id DESC LIMIT ?`;
    params.push(Number(limit));

    const invoices = await queryAll(query, params);
    res.json({ invoices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single invoice complete details
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const isNum = !isNaN(Number(id));

    const invoice = await (isNum
      ? queryOne('SELECT * FROM invoices WHERE id = ?', [Number(id)])
      : queryOne('SELECT * FROM invoices WHERE invoice_number = ?', [id]));

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const items = await queryAll('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
    const payments = await queryAll('SELECT * FROM payments WHERE invoice_id = ?', [invoice.id]);
    const store = await queryOne('SELECT * FROM store_settings WHERE id = 1');

    res.json({
      invoice,
      items,
      payments,
      store
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Audit log a reprint
router.post('/:id/reprint-log', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'REPRINT_INVOICE', 'invoice', ?, 'Invoice printed/reprinted')`,
      [req.user!.id, String(id)]
    );

    res.json({ message: 'Reprint logged' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
