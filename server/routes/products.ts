import { Router, Request, Response } from 'express';
import { queryAll, queryOne, run, withTransaction } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Get categories
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const unstitched = await queryOne<{ id: number }>(
      "SELECT id FROM categories WHERE LOWER(name) IN ('unstitched suit', 'unstitched suits')"
    );
    if (!unstitched) {
      await run('INSERT INTO categories (name, description) VALUES (?, ?)', [
        'Unstitched Suit',
        'Unstitched suit pieces, fabric sets, and dress materials'
      ]);
    }

    const categories = await queryAll('SELECT * FROM categories ORDER BY name ASC');
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add category
router.post('/categories', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const info = await run('INSERT INTO categories (name, description) VALUES (?, ?)', [name.trim(), description || null]);
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all products with variants
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, category, low_stock } = req.query;

    let query = `
      SELECT p.*, c.name as category_name, s.name as supplier_name,
        COALESCE(SUM(v.stock_quantity), 0) as total_stock,
        COUNT(v.id) as variant_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN product_variants v ON p.id = v.product_id
      WHERE p.is_active = 1
    `;

    const params: any[] = [];

    if (category) {
      query += ` AND p.category_id = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.design_code LIKE ? OR p.brand LIKE ? OR p.hsn_code LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` GROUP BY p.id ORDER BY p.id DESC`;

    const products = await queryAll(query, params);

    // Fetch variants for each product
    const allVariants = await queryAll(`
      SELECT * FROM product_variants 
      WHERE is_active = 1
      ORDER BY id ASC
    `);

    const variantMap: Record<number, any[]> = {};
    for (const v of allVariants) {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
      variantMap[v.product_id].push(v);
    }

    const result = products.map((prod) => ({
      ...prod,
      variants: variantMap[prod.id] || []
    }));

    if (low_stock === 'true') {
      const filtered = result.filter((p) =>
        p.variants.some((v: any) => v.stock_quantity <= v.reorder_threshold)
      );
      return res.json({ products: filtered });
    }

    res.json({ products: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search variants directly (for high-speed POS barcode / name search)
router.get('/variants/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) return res.json({ variants: [] });

    const variants = await queryAll(`
      SELECT v.*, 
        p.name as product_name, p.brand, p.design_code, p.fabric, p.hsn_code, p.gst_rate,
        c.name as category_name
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE v.is_active = 1 AND p.is_active = 1
        AND (
          v.barcode = ? 
          OR v.sku = ? 
          OR v.barcode LIKE ? 
          OR v.sku LIKE ? 
          OR p.design_code LIKE ? 
          OR p.name LIKE ?
          OR v.size LIKE ?
          OR v.color LIKE ?
        )
      LIMIT 25
    `, [q, q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);

    res.json({ variants });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Quick barcode exact lookup (for instant POS scanner hit)
router.get('/variants/by-barcode/:barcode', requireAuth, async (req: Request, res: Response) => {
  try {
    const barcode = req.params.barcode.trim();
    const variant = await queryOne(`
      SELECT v.*, 
        p.name as product_name, p.brand, p.design_code, p.fabric, p.hsn_code, p.gst_rate,
        c.name as category_name
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE v.is_active = 1 AND p.is_active = 1 AND (v.barcode = ? OR v.sku = ?)
      LIMIT 1
    `, [barcode, barcode]);

    if (!variant) {
      return res.status(404).json({ error: `No active product found with barcode/SKU: ${barcode}` });
    }

    res.json({ variant });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create product with variants (Transactional)
router.post('/', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const {
    name,
    category_id,
    brand,
    design_code,
    description,
    fabric,
    hsn_code,
    gst_rate,
    supplier_id,
    image_url,
    variants
  } = req.body;

  if (!name || !design_code) {
    return res.status(400).json({ error: 'Product name and design code are required' });
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    return res.status(400).json({ error: 'At least one variant (size/color) is required' });
  }

  // Check unique SKUs and Barcodes
  for (const v of variants) {
    if (!v.sku || !v.barcode || !v.size || !v.color) {
      return res.status(400).json({ error: 'Each variant must have SKU, Barcode, Size, and Color' });
    }
    const dupCheck = await queryOne('SELECT id FROM product_variants WHERE sku = ? OR barcode = ?', [v.sku, v.barcode]);
    if (dupCheck) {
      return res.status(400).json({ error: `Duplicate SKU or Barcode detected: ${v.sku} / ${v.barcode}` });
    }
  }

  try {
    const newId = await withTransaction(async (tx) => {
      const prodInfo = await tx.execute({
        sql: `INSERT INTO products (
                name, category_id, brand, design_code, description, fabric, hsn_code, gst_rate, supplier_id, image_url
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          name.trim(),
          category_id || null,
          brand || 'Aavni',
          design_code.trim(),
          description || null,
          fabric || null,
          hsn_code || '6204',
          Number(gst_rate) || 5.0,
          supplier_id || null,
          image_url || null
        ]
      });

      const productId = Number(prodInfo.lastInsertRowid);

      for (const v of variants) {
        const stock = Math.max(0, parseInt(v.stock_quantity, 10) || 0);
        const varInfo = await tx.execute({
          sql: `INSERT INTO product_variants (
                  product_id, sku, barcode, size, color, purchase_cost, selling_price, mrp, stock_quantity, reorder_threshold
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            productId,
            v.sku.trim().toUpperCase(),
            v.barcode.trim(),
            v.size.trim(),
            v.color.trim(),
            Number(v.purchase_cost) || 0,
            Number(v.selling_price) || 0,
            v.mrp ? Number(v.mrp) : Number(v.selling_price),
            stock,
            parseInt(v.reorder_threshold, 10) || 3
          ]
        });

        const variantId = Number(varInfo.lastInsertRowid);

        if (stock > 0) {
          await tx.execute({
            sql: `INSERT INTO stock_movements (
                    variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
                  ) VALUES (?, 'OPENING_STOCK', ?, 0, ?, 'INITIAL_CATALOG', 'Initial Opening Stock Entry', ?)`,
            args: [variantId, stock, stock, req.user!.id]
          });
        }
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'CREATE_PRODUCT', 'product', ?, ?)`,
        args: [req.user!.id, String(productId), `Created product ${name} with ${variants.length} variants`]
      });

      return productId;
    });

    res.status(201).json({ message: 'Product created successfully', id: newId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update product
router.put('/:id', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const productId = parseInt(req.params.id, 10);
  const {
    name,
    category_id,
    brand,
    design_code,
    description,
    fabric,
    hsn_code,
    gst_rate,
    supplier_id,
    image_url,
    variants
  } = req.body;

  try {
    await withTransaction(async (tx) => {
      await tx.execute({
        sql: `UPDATE products SET
                name = ?, category_id = ?, brand = ?, design_code = ?, description = ?,
                fabric = ?, hsn_code = ?, gst_rate = ?, supplier_id = ?, image_url = ?
              WHERE id = ?`,
        args: [
          name,
          category_id || null,
          brand,
          design_code,
          description || null,
          fabric || null,
          hsn_code,
          Number(gst_rate) || 5.0,
          supplier_id || null,
          image_url || null,
          productId
        ]
      });

      if (Array.isArray(variants)) {
        for (const v of variants) {
          if (v.id) {
            await tx.execute({
              sql: `UPDATE product_variants SET
                      size = ?, color = ?, purchase_cost = ?, selling_price = ?, mrp = ?, reorder_threshold = ?
                    WHERE id = ? AND product_id = ?`,
              args: [
                v.size,
                v.color,
                Number(v.purchase_cost) || 0,
                Number(v.selling_price) || 0,
                Number(v.mrp) || Number(v.selling_price),
                parseInt(v.reorder_threshold, 10) || 3,
                v.id,
                productId
              ]
            });
          } else {
            const dup = (await tx.execute({
              sql: 'SELECT id FROM product_variants WHERE sku = ? OR barcode = ?',
              args: [v.sku, v.barcode]
            })).rows[0];
            if (dup) throw new Error(`SKU/Barcode already exists: ${v.sku}/${v.barcode}`);

            const stock = Math.max(0, parseInt(v.stock_quantity, 10) || 0);
            const varInfo = await tx.execute({
              sql: `INSERT INTO product_variants (
                      product_id, sku, barcode, size, color, purchase_cost, selling_price, mrp, stock_quantity, reorder_threshold
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                productId,
                v.sku.trim().toUpperCase(),
                v.barcode.trim(),
                v.size.trim(),
                v.color.trim(),
                Number(v.purchase_cost) || 0,
                Number(v.selling_price) || 0,
                Number(v.mrp) || Number(v.selling_price),
                stock,
                parseInt(v.reorder_threshold, 10) || 3
              ]
            });

            if (stock > 0) {
              await tx.execute({
                sql: `INSERT INTO stock_movements (
                        variant_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, user_id
                      ) VALUES (?, 'OPENING_STOCK', ?, 0, ?, 'NEW_VARIANT_ADD', 'New Variant Stock', ?)`,
                args: [Number(varInfo.lastInsertRowid), stock, stock, req.user!.id]
              });
            }
          }
        }
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'UPDATE_PRODUCT', 'product', ?, ?)`,
        args: [req.user!.id, String(productId), `Updated product ${name}`]
      });
    });

    res.json({ message: 'Product updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete / Soft-archive product
router.delete('/:id', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });

    const prod = await queryOne('SELECT name FROM products WHERE id = ?', [id]);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    await run('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    await run('UPDATE product_variants SET is_active = 0 WHERE product_id = ?', [id]);

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'ARCHIVE_PRODUCT', 'product', ?, ?)`,
      [req.user!.id, String(id), `Deleted/Archived product ${prod.name}`]
    );

    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk Delete products
router.post('/bulk-delete', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }

    await withTransaction(async (tx) => {
      for (const rawId of ids) {
        const id = parseInt(rawId, 10);
        if (!isNaN(id)) {
          await tx.execute({
            sql: 'UPDATE products SET is_active = 0 WHERE id = ?',
            args: [id]
          });
          await tx.execute({
            sql: 'UPDATE product_variants SET is_active = 0 WHERE product_id = ?',
            args: [id]
          });
        }
      }

      await tx.execute({
        sql: `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
              VALUES (?, 'BULK_DELETE_PRODUCTS', 'product', ?, ?)`,
        args: [req.user!.id, ids.join(','), `Bulk deleted ${ids.length} products`]
      });
    });

    res.json({ message: `Successfully deleted ${ids.length} products` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
