import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run, withTransaction } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// List Suppliers
router.get('/suppliers', requireAuth, async (req: Request, res: Response) => {
  try {
    const suppliers = await queryAll('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC');
    res.json({ suppliers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add Supplier
router.post('/suppliers', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { name, contact_person, phone, email, address, city, state, state_code, gstin } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });

    const info = await run(`
      INSERT INTO suppliers (
        name, contact_person, phone, email, address, city, state, state_code, gstin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      contact_person || null,
      phone || null,
      email || null,
      address || null,
      city || null,
      state || 'Madhya Pradesh',
      state_code || '23',
      gstin ? gstin.trim().toUpperCase() : null
    ]);

    res.status(201).json({ id: info.lastInsertRowid, message: 'Supplier created successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List Purchases
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const purchases = await queryAll(`
      SELECT p.*, s.name as supplier_name, u.name as created_by_name,
        (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as item_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.id DESC
    `);

    res.json({ purchases });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Purchase Details
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const purchase = await queryOne(`
      SELECT p.*, s.name as supplier_name, s.gstin as supplier_gstin, s.phone as supplier_phone
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `, [id]);

    if (!purchase) return res.status(404).json({ error: 'Purchase record not found' });

    const items = await queryAll(`
      SELECT pi.*, v.sku, v.barcode, v.size, v.color, p.name as product_name, p.design_code
      FROM purchase_items pi
      JOIN product_variants v ON pi.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      WHERE pi.purchase_id = ?
    `, [id]);

    const payments = await queryAll(`
      SELECT * FROM supplier_payments WHERE purchase_id = ? ORDER BY id DESC
    `, [id]);

    res.json({ purchase, items, payments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create and Finalize Purchase (Goods Received - updates stock safely)
router.post('/', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const {
    supplier_id,
    supplier_invoice_no,
    purchase_date,
    items,
    freight_charges = 0,
    paid_amount = 0,
    payment_mode = 'BANK',
    notes
  } = req.body;

  if (!supplier_id) return res.status(400).json({ error: 'Supplier is required' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one purchase item is required' });
  }

  try {
    const result = await withTransaction(async (tx) => {
      let subtotal = 0;
      let taxTotal = 0;

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        const cost = Number(item.unit_cost);
        if (qty <= 0 || cost < 0) throw new Error('Invalid quantity or unit cost');

        const itemTotal = qty * cost;
        const gst = Number(item.gst_rate) || 0;
        const itemTax = (itemTotal * gst) / 100;

        subtotal += itemTotal;
        taxTotal += itemTax;
      }

      const freight = Number(freight_charges) || 0;
      const grandTotal = Number((subtotal + taxTotal + freight).toFixed(2));
      const paid = Number(paid_amount) || 0;
      const paymentStatus = paid >= grandTotal ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID');

      const purchaseNumber = `PO-${Date.now().toString().slice(-6)}`;

      const pInfo = await tx.execute({
        sql: `INSERT INTO purchases (
                purchase_number, supplier_id, supplier_invoice_no, purchase_date,
                subtotal, tax_total, freight_charges, grand_total, paid_amount, payment_status,
                status, created_by, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?)`,
        args: [
          purchaseNumber,
          supplier_id,
          supplier_invoice_no || null,
          purchase_date || new Date().toISOString().split('T')[0],
          subtotal,
          taxTotal,
          freight,
          grandTotal,
          paid,
          paymentStatus,
          req.user!.id,
          notes || null
        ]
      });

      const purchaseId = Number(pInfo.lastInsertRowid);

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        const cost = Number(item.unit_cost);
        const gst = Number(item.gst_rate) || 0;
        const lineTotal = Number((qty * cost).toFixed(2));

        await tx.execute({
          sql: `INSERT INTO purchase_items (
                  purchase_id, variant_id, quantity, unit_cost, gst_rate, line_total
                ) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [purchaseId, item.variant_id, qty, cost, gst, lineTotal]
        });

        const variant = (await tx.execute({
          sql: 'SELECT stock_quantity FROM product_variants WHERE id = ?',
          args: [item.variant_id]
        })).rows[0] as any;

        if (!variant) throw new Error(`Variant ID ${item.variant_id} not found`);

        const prev = variant.stock_quantity;
        const next = prev + qty;

        await tx.execute({
          sql: `UPDATE product_variants
                SET stock_quantity = stock_quantity + ?,
                    purchase_cost = ?
                WHERE id = ?`,
          args: [qty, cost, item.variant_id]
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
            purchaseNumber,
            `Purchased on ${purchaseNumber} (Supplier Invoice: ${supplier_invoice_no || 'N/A'})`,
            req.user!.id
          ]
        });
      }

      if (paid > 0) {
        await tx.execute({
          sql: `INSERT INTO supplier_payments (
                  supplier_id, purchase_id, amount, payment_mode, payment_date, reference_no, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            supplier_id,
            purchaseId,
            paid,
            payment_mode,
            purchase_date || new Date().toISOString().split('T')[0],
            supplier_invoice_no || null,
            req.user!.id
          ]
        });
      }

      const unpaid = grandTotal - paid;
      if (unpaid !== 0) {
        await tx.execute({
          sql: 'UPDATE suppliers SET balance = balance + ? WHERE id = ?',
          args: [unpaid, supplier_id]
        });
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'CREATE_PURCHASE', 'purchase', ?, ?)`,
        args: [req.user!.id, purchaseNumber, `Goods received on ${purchaseNumber}. Total: ₹${grandTotal}`]
      });

      return { purchaseId, purchaseNumber };
    });

    res.status(201).json({ message: 'Purchase and goods receipt posted successfully', ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record additional Supplier Payment
router.post('/supplier-payments', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { supplier_id, purchase_id, amount, payment_mode, payment_date, reference_no, notes } = req.body;
  const payAmount = Number(amount);
  if (!supplier_id || !payAmount || payAmount <= 0) {
    return res.status(400).json({ error: 'Valid supplier and positive amount are required' });
  }

  try {
    await withTransaction(async (tx) => {
      await tx.execute({
        sql: `INSERT INTO supplier_payments (
                supplier_id, purchase_id, amount, payment_mode, payment_date, reference_no, notes, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          supplier_id,
          purchase_id || null,
          payAmount,
          payment_mode || 'BANK',
          payment_date || new Date().toISOString().split('T')[0],
          reference_no || null,
          notes || null,
          req.user!.id
        ]
      });

      await tx.execute({
        sql: 'UPDATE suppliers SET balance = balance - ? WHERE id = ?',
        args: [payAmount, supplier_id]
      });

      if (purchase_id) {
        const p = (await tx.execute({
          sql: 'SELECT grand_total, paid_amount FROM purchases WHERE id = ?',
          args: [purchase_id]
        })).rows[0] as any;

        if (p) {
          const newPaid = p.paid_amount + payAmount;
          const newStatus = newPaid >= p.grand_total ? 'PAID' : 'PARTIAL';
          await tx.execute({
            sql: 'UPDATE purchases SET paid_amount = ?, payment_status = ? WHERE id = ?',
            args: [newPaid, newStatus, purchase_id]
          });
        }
      }
    });

    res.json({ message: 'Supplier payment recorded successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
