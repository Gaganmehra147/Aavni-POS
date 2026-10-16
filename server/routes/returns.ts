import { Router, Request, Response } from 'express';
import { queryAll, queryOne, withTransaction } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Search original invoice for return eligibility
router.get('/lookup', requireAuth, async (req: Request, res: Response) => {
  try {
    const invNum = ((req.query.invoice_number as string) || '').trim();
    if (!invNum) return res.status(400).json({ error: 'Invoice number required' });
    const invoice = await queryOne('SELECT * FROM invoices WHERE invoice_number = ?', [invNum]);
    if (!invoice) {
      return res.status(404).json({ error: `Invoice ${invNum} not found` });
    }

    const items = await queryAll(`
      SELECT ii.*,
        COALESCE((
          SELECT SUM(ri.quantity)
          FROM return_items ri
          JOIN returns r ON ri.return_id = r.id
          WHERE ri.original_item_id = ii.id
        ), 0) as already_returned_qty
      FROM invoice_items ii
      WHERE ii.invoice_id = ?
    `, [invoice.id]);

    const eligibleItems = items.map((item: any) => ({
      ...item,
      eligible_qty: Math.max(0, item.quantity - item.already_returned_qty)
    }));

    res.json({ invoice, items: eligibleItems });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Process a Return or Size/Color Exchange (Transactional)
router.post('/process', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const {
    original_invoice_id,
    return_items,
    reason,
    refund_mode,
    notes
  } = req.body;

  if (!original_invoice_id) return res.status(400).json({ error: 'Original invoice ID is required' });
  if (!Array.isArray(return_items) || return_items.length === 0) {
    return res.status(400).json({ error: 'At least one return item must be specified' });
  }

  try {
    const result = await withTransaction(async (tx) => {
      const invoice = (await tx.execute({
        sql: 'SELECT * FROM invoices WHERE id = ?',
        args: [original_invoice_id]
      })).rows[0] as any;

      if (!invoice) throw new Error('Original invoice not found');

      let totalRefundAmount = 0;

      for (const ret of return_items) {
        const originalItem = (await tx.execute({
          sql: `SELECT ii.*,
                  COALESCE((
                    SELECT SUM(ri.quantity)
                    FROM return_items ri
                    WHERE ri.original_item_id = ii.id
                  ), 0) as already_returned
                FROM invoice_items ii
                WHERE ii.id = ? AND ii.invoice_id = ?`,
          args: [ret.original_item_id, original_invoice_id]
        })).rows[0] as any;

        if (!originalItem) {
          throw new Error(`Item ID ${ret.original_item_id} does not belong to invoice ${invoice.invoice_number}`);
        }

        const eligible = originalItem.quantity - originalItem.already_returned;
        const requestedQty = parseInt(ret.quantity, 10);

        if (requestedQty <= 0 || requestedQty > eligible) {
          throw new Error(`Return quantity (${requestedQty}) exceeds eligible quantity (${eligible}) for ${originalItem.product_name}`);
        }

        const unitRefund = Number(ret.refund_unit_price !== undefined ? ret.refund_unit_price : (originalItem.line_total / originalItem.quantity));
        totalRefundAmount += (unitRefund * requestedQty);
      }

      const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

      const retInfo = await tx.execute({
        sql: `INSERT INTO returns (
                return_number, original_invoice_id, customer_id, reason, total_refund_amount, refund_mode, processed_by, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          returnNumber,
          original_invoice_id,
          invoice.customer_id,
          reason || 'Customer Return',
          totalRefundAmount,
          refund_mode || 'CASH',
          req.user!.id,
          notes || null
        ]
      });

      const returnId = Number(retInfo.lastInsertRowid);

      for (const ret of return_items) {
        const qty = parseInt(ret.quantity, 10);
        const condition = ret.restock_condition === 'DAMAGED' ? 'DAMAGED' : 'SALEABLE';

        await tx.execute({
          sql: `INSERT INTO return_items (
                  return_id, original_item_id, variant_id, quantity, refund_unit_price, restock_condition
                ) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            returnId,
            ret.original_item_id,
            ret.variant_id,
            qty,
            Number(ret.refund_unit_price) || 0,
            condition
          ]
        });

        const variant = (await tx.execute({
          sql: 'SELECT stock_quantity FROM product_variants WHERE id = ?',
          args: [ret.variant_id]
        })).rows[0] as any;

        const prevStock = variant ? variant.stock_quantity : 0;

        if (condition === 'SALEABLE') {
          await tx.execute({
            sql: 'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
            args: [qty, ret.variant_id]
          });
          await tx.execute({
            sql: `INSERT INTO stock_movements (
                    variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
                  ) VALUES (?, 'RETURN_SALEABLE', ?, ?, ?, ?, ?, ?)`,
            args: [
              ret.variant_id,
              qty,
              prevStock,
              prevStock + qty,
              returnNumber,
              `Return restocked from invoice ${invoice.invoice_number}`,
              req.user!.id
            ]
          });
        } else {
          await tx.execute({
            sql: `INSERT INTO stock_movements (
                    variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
                  ) VALUES (?, 'RETURN_DAMAGED', 0, ?, ?, ?, ?, ?)`,
            args: [
              ret.variant_id,
              prevStock,
              prevStock,
              returnNumber,
              `Damaged return logged from invoice ${invoice.invoice_number} (Not added to sellable stock)`,
              req.user!.id
            ]
          });
        }
      }

      if (refund_mode === 'STORE_CREDIT' && invoice.customer_id) {
        await tx.execute({
          sql: 'UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?',
          args: [totalRefundAmount, invoice.customer_id]
        });
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'PROCESS_RETURN', 'return', ?, ?)`,
        args: [req.user!.id, returnNumber, `Processed return ${returnNumber} for invoice ${invoice.invoice_number}. Refund: ₹${totalRefundAmount}`]
      });

      return {
        returnNumber,
        totalRefundAmount
      };
    });

    res.status(201).json({ message: 'Return processed successfully', ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// List all returns
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const returns = await queryAll(`
      SELECT r.*, i.invoice_number, c.name as customer_name, u.name as cashier_name
      FROM returns r
      JOIN invoices i ON r.original_invoice_id = i.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON r.processed_by = u.id
      ORDER BY r.id DESC
    `);

    res.json({ returns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
