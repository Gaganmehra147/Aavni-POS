import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run, withTransaction } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Hold Cart
router.post('/hold', requireAuth, async (req: Request, res: Response) => {
  try {
    const { customer_name, customer_phone, cart_data } = req.body;
    if (!cart_data) return res.status(400).json({ error: 'Cart data is required' });

    const info = await run(
      `INSERT INTO held_carts (customer_name, customer_phone, cart_data, created_by)
       VALUES (?, ?, ?, ?)`,
      [customer_name || 'Walk-in Customer', customer_phone || null, JSON.stringify(cart_data), req.user!.id]
    );

    res.status(201).json({ id: info.lastInsertRowid, message: 'Cart held successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List Held Carts
router.get('/held', requireAuth, async (req: Request, res: Response) => {
  try {
    const carts = await queryAll(`
      SELECT h.*, u.name as cashier_name
      FROM held_carts h
      LEFT JOIN users u ON h.created_by = u.id
      ORDER BY h.id DESC
    `);

    const formatted = carts.map((c: any) => ({
      ...c,
      cart_data: JSON.parse(c.cart_data)
    }));

    res.json({ held_carts: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Held Cart
router.delete('/held/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await run('DELETE FROM held_carts WHERE id = ?', [id]);
    res.json({ message: 'Held cart removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Checkout / Finalize POS Sale (Atomic Transaction)
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  const {
    customer_id,
    customer_name,
    customer_phone,
    customer_gstin,
    customer_state_code = '23',
    items,
    discount_total = 0,
    payments,
    notes,
    held_cart_id
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cannot checkout with an empty cart' });
  }

  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: 'Payment details are required' });
  }

  try {
    const result = await withTransaction(async (tx) => {
      // 1. Fetch store settings
      const settings = (await tx.execute({ sql: 'SELECT * FROM store_settings WHERE id = 1', args: [] })).rows[0] as any;
      const storeStateCode = settings.state_code || '23';
      const isGstRegistered = Boolean(settings.is_gst_registered && settings.gstin);
      const isInterstate = isGstRegistered && (customer_state_code !== storeStateCode);

      let calculatedSubtotal = 0;
      let calculatedTaxable = 0;
      let calculatedCgst = 0;
      let calculatedSgst = 0;
      let calculatedIgst = 0;
      let calculatedTaxTotal = 0;

      const validatedItems: any[] = [];

      for (const item of items) {
        const v = (await tx.execute({
          sql: `SELECT v.*, p.name as product_name, p.design_code, p.hsn_code, p.gst_rate
                FROM product_variants v
                JOIN products p ON v.product_id = p.id
                WHERE v.id = ?`,
          args: [item.variant_id]
        })).rows[0] as any;

        if (!v) {
          throw new Error(`Variant ID ${item.variant_id} does not exist`);
        }

        const qty = parseInt(item.quantity, 10);
        if (qty <= 0) {
          throw new Error(`Invalid quantity for item: ${v.product_name}`);
        }

        if (v.stock_quantity < qty && !settings.allow_negative_stock) {
          throw new Error(
            `Insufficient stock for ${v.product_name} (${v.size}/${v.color}). Available: ${v.stock_quantity}, Requested: ${qty}`
          );
        }

        const unitPrice = Number(item.unit_price !== undefined ? item.unit_price : v.selling_price);
        const itemDiscount = Number(item.discount_amount || 0);
        const lineSubtotal = Math.max(0, (unitPrice * qty) - itemDiscount);

        let taxableAmount = lineSubtotal;
        let cgstRate = 0;
        let cgstAmount = 0;
        let sgstRate = 0;
        let sgstAmount = 0;
        let igstRate = 0;
        let igstAmount = 0;
        let lineTax = 0;

        const gstRate = isGstRegistered ? (Number(item.gst_rate !== undefined ? item.gst_rate : v.gst_rate) || 0) : 0;

        if (isGstRegistered && gstRate > 0) {
          if (settings.tax_calculation_mode === 'inclusive') {
            taxableAmount = Number((lineSubtotal / (1 + (gstRate / 100))).toFixed(2));
            lineTax = Number((lineSubtotal - taxableAmount).toFixed(2));
          } else {
            taxableAmount = Number(lineSubtotal.toFixed(2));
            lineTax = Number(((taxableAmount * gstRate) / 100).toFixed(2));
          }

          if (isInterstate) {
            igstRate = gstRate;
            igstAmount = lineTax;
          } else {
            cgstRate = gstRate / 2;
            sgstRate = gstRate / 2;
            cgstAmount = Number((lineTax / 2).toFixed(2));
            sgstAmount = Number((lineTax - cgstAmount).toFixed(2));
          }
        }

        const lineTotal = settings.tax_calculation_mode === 'inclusive'
          ? lineSubtotal
          : Number((taxableAmount + lineTax).toFixed(2));

        calculatedSubtotal += (unitPrice * qty);
        calculatedTaxable += taxableAmount;
        calculatedCgst += cgstAmount;
        calculatedSgst += sgstAmount;
        calculatedIgst += igstAmount;
        calculatedTaxTotal += lineTax;

        validatedItems.push({
          variant: v,
          quantity: qty,
          unitPrice,
          costPrice: v.purchase_cost,
          discountAmount: itemDiscount,
          taxableAmount,
          gstRate,
          cgstRate,
          cgstAmount,
          sgstRate,
          sgstAmount,
          igstRate,
          igstAmount,
          lineTax,
          lineTotal
        });
      }

      const billDiscount = Number(discount_total) || 0;
      const finalTaxable = Math.max(0, calculatedTaxable - (settings.tax_calculation_mode === 'exclusive' ? billDiscount : 0));

      let unroundedGrandTotal = (settings.tax_calculation_mode === 'inclusive')
        ? Math.max(0, calculatedSubtotal - billDiscount)
        : Math.max(0, calculatedTaxable + calculatedTaxTotal - billDiscount);

      const roundedGrandTotal = Math.round(unroundedGrandTotal);
      const roundOff = Number((roundedGrandTotal - unroundedGrandTotal).toFixed(2));

      // Verify payments match grand total
      const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      if (Math.abs(totalPaid - roundedGrandTotal) > 0.05) {
        throw new Error(`Total payment (₹${totalPaid.toFixed(2)}) must equal invoice grand total (₹${roundedGrandTotal.toFixed(2)})`);
      }

      // Generate Sequential Invoice Number
      const nextSeq = settings.invoice_next_seq || 1;
      const prefix = settings.invoice_prefix || 'AE/24-25/';
      const seqStr = String(nextSeq).padStart(4, '0');
      const invoiceNumber = `${prefix}${seqStr}`;

      await tx.execute({
        sql: 'UPDATE store_settings SET invoice_next_seq = invoice_next_seq + 1 WHERE id = 1',
        args: []
      });

      let invoiceType = 'RETAIL';
      if (isGstRegistered) {
        invoiceType = customer_gstin ? 'TAX_INVOICE' : 'RETAIL_GST';
      }

      // Insert Invoice record
      const nowIso = new Date().toISOString();
      const invoiceInfo = await tx.execute({
        sql: `INSERT INTO invoices (
                invoice_number, invoice_date, customer_id, customer_name, customer_phone, customer_gstin, customer_state_code,
                cashier_id, cashier_name, invoice_type, is_interstate,
                subtotal, discount_total, taxable_amount, cgst_amount, sgst_amount, igst_amount, tax_total,
                round_off, grand_total, status, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
        args: [
          invoiceNumber,
          nowIso,
          customer_id || null,
          customer_name || 'Walk-in Customer',
          customer_phone || null,
          customer_gstin || null,
          customer_state_code,
          req.user!.id,
          req.user!.name,
          invoiceType,
          isInterstate ? 1 : 0,
          calculatedSubtotal,
          billDiscount,
          finalTaxable,
          calculatedCgst,
          calculatedSgst,
          calculatedIgst,
          calculatedTaxTotal,
          roundOff,
          roundedGrandTotal,
          notes || null
        ]
      });

      const invoiceId = Number(invoiceInfo.lastInsertRowid);

      // Insert Items and Deduct Stock
      for (const vItem of validatedItems) {
        await tx.execute({
          sql: `INSERT INTO invoice_items (
                  invoice_id, product_id, variant_id, product_name, design_code, size, color, sku, barcode,
                  hsn_code, quantity, unit_price, cost_price, discount_amount, taxable_amount,
                  gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_tax, line_total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            invoiceId,
            vItem.variant.product_id,
            vItem.variant.id,
            vItem.variant.product_name,
            vItem.variant.design_code,
            vItem.variant.size,
            vItem.variant.color,
            vItem.variant.sku,
            vItem.variant.barcode,
            vItem.variant.hsn_code,
            vItem.quantity,
            vItem.unitPrice,
            vItem.costPrice,
            vItem.discountAmount,
            vItem.taxableAmount,
            vItem.gstRate,
            vItem.cgstRate,
            vItem.cgstAmount,
            vItem.sgstRate,
            vItem.sgstAmount,
            vItem.igstRate,
            vItem.igstAmount,
            vItem.lineTax,
            vItem.lineTotal
          ]
        });

        const prevStock = vItem.variant.stock_quantity;
        const newStock = prevStock - vItem.quantity;

        await tx.execute({
          sql: 'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
          args: [vItem.quantity, vItem.variant.id]
        });

        await tx.execute({
          sql: `INSERT INTO stock_movements (
                  variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
                ) VALUES (?, 'SALE', ?, ?, ?, ?, ?, ?)`,
          args: [
            vItem.variant.id,
            -vItem.quantity,
            prevStock,
            newStock,
            invoiceNumber,
            `Sale on invoice ${invoiceNumber}`,
            req.user!.id
          ]
        });
      }

      // Record Payments
      for (const p of payments) {
        await tx.execute({
          sql: `INSERT INTO payments (
                  invoice_id, payment_mode, amount, tendered_amount, change_returned, reference_no
                ) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            invoiceId,
            p.payment_mode,
            Number(p.amount) || 0,
            Number(p.tendered_amount) || Number(p.amount) || 0,
            Number(p.change_returned) || 0,
            p.reference_no || null
          ]
        });

        if (p.payment_mode === 'CREDIT' && customer_id) {
          await tx.execute({
            sql: 'UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?',
            args: [Number(p.amount), customer_id]
          });
        }
      }

      if (held_cart_id) {
        await tx.execute({ sql: 'DELETE FROM held_carts WHERE id = ?', args: [held_cart_id] });
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'SALE_CHECKOUT', 'invoice', ?, ?)`,
        args: [req.user!.id, invoiceNumber, `Invoice ${invoiceNumber} created. Grand Total: ₹${roundedGrandTotal}`]
      });

      return {
        invoiceId,
        invoiceNumber,
        grandTotal: roundedGrandTotal
      };
    });

    res.status(201).json({
      message: 'Sale finalized successfully',
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
