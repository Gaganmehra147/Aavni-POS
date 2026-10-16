import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run, withTransaction } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Get stock movements audit ledger
router.get('/ledger', requireAuth, async (req: Request, res: Response) => {
  try {
    const { variant_id, movement_type, limit = 100 } = req.query;

    let query = `
      SELECT m.*, 
        v.sku, v.barcode, v.size, v.color,
        p.name as product_name, p.design_code,
        u.name as user_name
      FROM stock_movements m
      JOIN product_variants v ON m.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (variant_id) {
      query += ` AND m.variant_id = ?`;
      params.push(variant_id);
    }
    if (movement_type) {
      query += ` AND m.movement_type = ?`;
      params.push(movement_type);
    }

    query += ` ORDER BY m.id DESC LIMIT ?`;
    params.push(Number(limit));

    const movements = await queryAll(query, params);
    res.json({ movements });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// STOCK IN: Bulk continuous scan or batch entry
router.post('/stock-in', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { supplier_id, reference_no, items, notes } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided for stock-in' });
  }

  try {
    const ref = await withTransaction(async (tx) => {
      const generatedRef = reference_no ? `IN-${reference_no.trim()}` : `IN-${Date.now()}`;

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (qty <= 0) continue;

        const current = (await tx.execute({
          sql: 'SELECT stock_quantity FROM product_variants WHERE id = ?',
          args: [item.variant_id]
        })).rows[0] as any;

        if (!current) throw new Error(`Variant ID ${item.variant_id} does not exist`);

        const prev = current.stock_quantity;
        const next = prev + qty;
        const cost = Number(item.unit_cost) || 0;

        await tx.execute({
          sql: `UPDATE product_variants 
                SET stock_quantity = stock_quantity + ?,
                    purchase_cost = CASE WHEN ? > 0 THEN ? ELSE purchase_cost END
                WHERE id = ?`,
          args: [qty, cost, cost, item.variant_id]
        });

        await tx.execute({
          sql: `INSERT INTO stock_movements (
                  variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
                ) VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?, ?)`,
          args: [
            item.variant_id,
            qty,
            prev,
            next,
            generatedRef,
            notes || 'Stock-in receipt',
            req.user!.id
          ]
        });
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'STOCK_IN', 'inventory', ?, ?)`,
        args: [req.user!.id, generatedRef, `Stock-in performed for ${items.length} items`]
      });

      return generatedRef;
    });

    res.status(201).json({ message: 'Stock-in recorded successfully', reference: ref });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// STOCK OUT / ADJUSTMENT: Damage, missing, sample, write-off
router.post('/adjustment', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { variant_id, adjustment_type, quantity, reason } = req.body;
  const qty = parseInt(quantity, 10);
  if (!variant_id || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Valid variant_id and positive quantity are required' });
  }

  const validTypes = ['DAMAGE_ADJUSTMENT', 'MISSING_ADJUSTMENT', 'SAMPLE_ADJUSTMENT', 'MANUAL_COUNT_ADJUSTMENT'];
  if (!validTypes.includes(adjustment_type)) {
    return res.status(400).json({ error: 'Invalid adjustment type' });
  }

  try {
    const result = await withTransaction(async (tx) => {
      const settings = (await tx.execute({ sql: 'SELECT allow_negative_stock FROM store_settings WHERE id = 1', args: [] })).rows[0] as any;
      const variant = (await tx.execute({ sql: 'SELECT stock_quantity FROM product_variants WHERE id = ?', args: [variant_id] })).rows[0] as any;
      if (!variant) throw new Error('Variant not found');

      const prev = variant.stock_quantity;
      const next = prev - qty;

      if (next < 0 && !settings.allow_negative_stock) {
        throw new Error(`Insufficient stock. Current stock is ${prev}, cannot deduct ${qty}`);
      }

      await tx.execute({
        sql: 'UPDATE product_variants SET stock_quantity = ? WHERE id = ?',
        args: [next, variant_id]
      });

      const ref = `ADJ-${Date.now()}`;
      await tx.execute({
        sql: `INSERT INTO stock_movements (
                variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [variant_id, adjustment_type, -qty, prev, next, ref, reason || adjustment_type, req.user!.id]
      });

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'STOCK_ADJUSTMENT', 'inventory', ?, ?)`,
        args: [req.user!.id, String(variant_id), `Adjusted ${qty} units (${adjustment_type}): ${reason || 'No reason'}`]
      });

      return { prev, next, ref };
    });

    res.json({ message: 'Stock adjustment saved successfully', ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// STOCK COUNT: Reconcile physical inventory counts against system counts
router.post('/stock-count/reconcile', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { counts } = req.body;
  if (!Array.isArray(counts) || counts.length === 0) {
    return res.status(400).json({ error: 'No count entries provided' });
  }

  try {
    const result = await withTransaction(async (tx) => {
      const ref = `AUDIT-${Date.now()}`;
      const discrepancies: any[] = [];

      for (const c of counts) {
        const variant = (await tx.execute({ sql: 'SELECT stock_quantity FROM product_variants WHERE id = ?', args: [c.variant_id] })).rows[0] as any;
        if (!variant) continue;

        const prev = variant.stock_quantity;
        const counted = Math.max(0, parseInt(c.counted_quantity, 10));
        const diff = counted - prev;

        if (diff !== 0) {
          await tx.execute({
            sql: 'UPDATE product_variants SET stock_quantity = ? WHERE id = ?',
            args: [counted, c.variant_id]
          });
          await tx.execute({
            sql: `INSERT INTO stock_movements (
                    variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
                  ) VALUES (?, 'MANUAL_COUNT_ADJUSTMENT', ?, ?, ?, ?, ?, ?)`,
            args: [
              c.variant_id,
              diff,
              prev,
              counted,
              ref,
              `Physical Audit Reconciled: ${c.remarks || 'Stock take variance'}`,
              req.user!.id
            ]
          });
          discrepancies.push({ variant_id: c.variant_id, prev, counted, diff });
        }
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'PHYSICAL_STOCK_COUNT', 'inventory', ?, ?)`,
        args: [req.user!.id, ref, `Reconciled ${discrepancies.length} discrepancies during stock count`]
      });

      return { ref, discrepanciesCount: discrepancies.length };
    });

    res.json({ message: 'Stock count reconciled successfully', ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
