import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run, withTransaction } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// List Expenses
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, category } = req.query;
    let query = `
      SELECT e.*, u.name as recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date) {
      query += ` AND e.expense_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND e.expense_date <= ?`;
      params.push(end_date);
    }
    if (category) {
      query += ` AND e.category = ?`;
      params.push(category);
    }

    query += ` ORDER BY e.expense_date DESC, e.id DESC`;

    const expenses = await queryAll(query, params);
    res.json({ expenses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record Expense
router.post('/', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { expense_date, category, amount, payment_mode, description } = req.body;
    const expAmount = Number(amount);
    if (!category || !expAmount || expAmount <= 0) {
      return res.status(400).json({ error: 'Valid category and positive amount are required' });
    }

    const info = await run(`
      INSERT INTO expenses (expense_date, category, amount, payment_mode, description, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      expense_date || new Date().toISOString().split('T')[0],
      category,
      expAmount,
      payment_mode || 'CASH',
      description || null,
      req.user!.id
    ]);

    res.status(201).json({ id: info.lastInsertRowid, message: 'Expense recorded successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Current Active Cash Session
router.get('/cash-session/current', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await queryOne(`
      SELECT cs.*, u.name as opened_by_name
      FROM cash_sessions cs
      JOIN users u ON cs.opened_by = u.id
      WHERE cs.status = 'OPEN'
      ORDER BY cs.id DESC LIMIT 1
    `);

    if (!session) {
      return res.json({ session: null });
    }

    const cashSales = (await queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE p.payment_mode = 'CASH'
        AND p.created_at >= ?
        AND i.status = 'COMPLETED'
    `, [session.opened_at]))?.total || 0;

    const cashRefunds = (await queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(r.total_refund_amount), 0) as total
      FROM returns r
      WHERE r.refund_mode = 'CASH'
        AND r.created_at >= ?
    `, [session.opened_at]))?.total || 0;

    const cashExpenses = (await queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      WHERE e.payment_mode = 'CASH'
        AND e.created_at >= ?
    `, [session.opened_at]))?.total || 0;

    const expectedCash = session.opening_cash + cashSales - cashRefunds - cashExpenses;

    res.json({
      session,
      liveSummary: {
        openingCash: session.opening_cash,
        cashSales,
        cashRefunds,
        cashExpenses,
        expectedCash
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Open Cash Session
router.post('/cash-session/open', requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = await queryOne("SELECT id FROM cash_sessions WHERE status = 'OPEN'");
    if (existing) {
      return res.status(400).json({ error: 'A cash session is already open' });
    }

    const { opening_cash, remarks } = req.body;
    const amount = Number(opening_cash) || 0;

    const info = await run(`
      INSERT INTO cash_sessions (session_date, opened_by, opening_cash, remarks)
      VALUES (date('now'), ?, ?, ?)
    `, [req.user!.id, amount, remarks || null]);

    res.status(201).json({ id: info.lastInsertRowid, message: 'Cash session opened successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Close Cash Session
router.post('/cash-session/close', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { actual_cash, remarks } = req.body;
  const counted = Number(actual_cash);
  if (isNaN(counted) || counted < 0) {
    return res.status(400).json({ error: 'Valid counted cash amount is required' });
  }

  try {
    const result = await withTransaction(async (tx) => {
      const session = (await tx.execute({
        sql: "SELECT * FROM cash_sessions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1",
        args: []
      })).rows[0] as any;

      if (!session) throw new Error('No open cash session to close');

      const cashSalesRow = (await tx.execute({
        sql: `SELECT COALESCE(SUM(p.amount), 0) as total
              FROM payments p
              JOIN invoices i ON p.invoice_id = i.id
              WHERE p.payment_mode = 'CASH'
                AND p.created_at >= ?
                AND i.status = 'COMPLETED'`,
        args: [session.opened_at]
      })).rows[0] as any;
      const cashSales = cashSalesRow ? cashSalesRow.total : 0;

      const cashRefundsRow = (await tx.execute({
        sql: `SELECT COALESCE(SUM(r.total_refund_amount), 0) as total
              FROM returns r
              WHERE r.refund_mode = 'CASH'
                AND r.created_at >= ?`,
        args: [session.opened_at]
      })).rows[0] as any;
      const cashRefunds = cashRefundsRow ? cashRefundsRow.total : 0;

      const cashExpensesRow = (await tx.execute({
        sql: `SELECT COALESCE(SUM(e.amount), 0) as total
              FROM expenses e
              WHERE e.payment_mode = 'CASH'
                AND e.created_at >= ?`,
        args: [session.opened_at]
      })).rows[0] as any;
      const cashExpenses = cashExpensesRow ? cashExpensesRow.total : 0;

      const expectedCash = session.opening_cash + cashSales - cashRefunds - cashExpenses;
      const variance = Number((counted - expectedCash).toFixed(2));

      await tx.execute({
        sql: `UPDATE cash_sessions SET
                closed_by = ?,
                closing_cash_actual = ?,
                expected_closing_cash = ?,
                variance = ?,
                closed_at = CURRENT_TIMESTAMP,
                status = 'CLOSED',
                remarks = ?
              WHERE id = ?`,
        args: [req.user!.id, counted, expectedCash, variance, remarks || null, session.id]
      });

      return { expectedCash, counted, variance };
    });

    res.json({ message: 'Cash session closed and reconciled successfully', ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
