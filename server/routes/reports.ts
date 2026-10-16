import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Dashboard Summary & Analytics
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const { range = 'today', start_date, end_date } = req.query;

    let dateCondition = `date(i.invoice_date) = date('now', 'localtime')`;
    let returnDateCondition = `date(r.return_date) = date('now', 'localtime')`;
    let expenseDateCondition = `e.expense_date = date('now', 'localtime')`;

    if (range === 'yesterday') {
      dateCondition = `date(i.invoice_date) = date('now', 'localtime', '-1 day')`;
      returnDateCondition = `date(r.return_date) = date('now', 'localtime', '-1 day')`;
      expenseDateCondition = `e.expense_date = date('now', 'localtime', '-1 day')`;
    } else if (range === 'week') {
      dateCondition = `date(i.invoice_date) >= date('now', 'localtime', '-7 days')`;
      returnDateCondition = `date(r.return_date) >= date('now', 'localtime', '-7 days')`;
      expenseDateCondition = `e.expense_date >= date('now', 'localtime', '-7 days')`;
    } else if (range === 'month') {
      dateCondition = `date(i.invoice_date) >= date('now', 'localtime', 'start of month')`;
      returnDateCondition = `date(r.return_date) >= date('now', 'localtime', 'start of month')`;
      expenseDateCondition = `e.expense_date >= date('now', 'localtime', 'start of month')`;
    } else if (range === 'custom' && start_date && end_date) {
      dateCondition = `date(i.invoice_date) >= date('${start_date}') AND date(i.invoice_date) <= date('${end_date}')`;
      returnDateCondition = `date(r.return_date) >= date('${start_date}') AND date(r.return_date) <= date('${end_date}')`;
      expenseDateCondition = `e.expense_date >= date('${start_date}') AND e.expense_date <= date('${end_date}')`;
    }

    const salesMetrics = (await queryOne(`
      SELECT 
        COUNT(i.id) as bills_count,
        COALESCE(SUM(i.subtotal), 0) as gross_sales,
        COALESCE(SUM(i.discount_total), 0) as total_discounts,
        COALESCE(SUM(i.taxable_amount), 0) as total_taxable,
        COALESCE(SUM(i.tax_total), 0) as total_tax,
        COALESCE(SUM(i.grand_total), 0) as net_sales
      FROM invoices i
      WHERE i.status = 'COMPLETED' AND ${dateCondition}
    `)) || { bills_count: 0, gross_sales: 0, total_discounts: 0, total_taxable: 0, total_tax: 0, net_sales: 0 };

    const returnsMetrics = (await queryOne(`
      SELECT 
        COUNT(r.id) as return_count,
        COALESCE(SUM(r.total_refund_amount), 0) as total_refunds
      FROM returns r
      WHERE ${returnDateCondition}
    `)) || { return_count: 0, total_refunds: 0 };

    const paymentMetrics = await queryAll(`
      SELECT 
        p.payment_mode,
        COALESCE(SUM(p.amount), 0) as total_amount
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i.status = 'COMPLETED' AND ${dateCondition}
      GROUP BY p.payment_mode
    `);

    const cogsMetrics = (await queryOne(`
      SELECT 
        COALESCE(SUM(ii.cost_price * ii.quantity), 0) as total_cogs
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.status = 'COMPLETED' AND ${dateCondition}
    `)) || { total_cogs: 0 };

    const estimatedGrossProfit = Math.max(0, salesMetrics.total_taxable - cogsMetrics.total_cogs);

    const lowStockMetrics = (await queryOne(`
      SELECT 
        COUNT(CASE WHEN stock_quantity <= 0 THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN stock_quantity > 0 AND stock_quantity <= reorder_threshold THEN 1 END) as low_stock_count
      FROM product_variants
      WHERE is_active = 1
    `)) || { low_stock_count: 0, out_of_stock_count: 0 };

    const topProducts = await queryAll(`
      SELECT 
        ii.product_name, ii.design_code, ii.size, ii.color,
        SUM(ii.quantity) as units_sold,
        SUM(ii.line_total) as revenue
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.status = 'COMPLETED' AND ${dateCondition}
      GROUP BY ii.variant_id
      ORDER BY units_sold DESC
      LIMIT 5
    `);

    const recentInvoices = await queryAll(`
      SELECT i.id, i.invoice_number, i.customer_name, i.grand_total, i.status, i.created_at,
        (SELECT GROUP_CONCAT(DISTINCT payment_mode) FROM payments WHERE invoice_id = i.id) as payment_modes
      FROM invoices i
      ORDER BY i.id DESC
      LIMIT 8
    `);

    const pendingSupplierPayments = (await queryOne(`
      SELECT COALESCE(SUM(balance), 0) as total_supplier_debt FROM suppliers WHERE is_active = 1
    `)) || { total_supplier_debt: 0 };

    const pendingCustomerCredit = (await queryOne(`
      SELECT COALESCE(SUM(credit_balance), 0) as total_customer_credit FROM customers
    `)) || { total_customer_credit: 0 };

    const salesTrend = await queryAll(`
      SELECT 
        date(invoice_date) as sale_date,
        COUNT(id) as bills,
        COALESCE(SUM(grand_total), 0) as total_sales
      FROM invoices
      WHERE status = 'COMPLETED' AND date(invoice_date) >= date('now', 'localtime', '-6 days')
      GROUP BY date(invoice_date)
      ORDER BY date(invoice_date) ASC
    `);

    res.json({
      metrics: {
        billsCount: salesMetrics.bills_count,
        grossSales: salesMetrics.gross_sales,
        discounts: salesMetrics.total_discounts,
        taxableSales: salesMetrics.total_taxable,
        taxCollected: salesMetrics.total_tax,
        netSales: salesMetrics.net_sales,
        returnsCount: returnsMetrics.return_count,
        refundsTotal: returnsMetrics.total_refunds,
        cogs: cogsMetrics.total_cogs,
        grossProfit: estimatedGrossProfit,
        lowStockCount: lowStockMetrics.low_stock_count,
        outOfStockCount: lowStockMetrics.out_of_stock_count,
        supplierDebt: pendingSupplierPayments.total_supplier_debt,
        customerCredit: pendingCustomerCredit.total_customer_credit
      },
      paymentBreakdown: paymentMetrics,
      topProducts,
      recentInvoices,
      salesTrend
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GST Sales & Tax Breakdown Report
router.get('/gst-report', requireAuth, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    let filter = `1=1`;
    const params: any[] = [];

    if (start_date) {
      filter += ` AND date(i.invoice_date) >= date(?)`;
      params.push(start_date);
    }
    if (end_date) {
      filter += ` AND date(i.invoice_date) <= date(?)`;
      params.push(end_date);
    }

    const rateWise = await queryAll(`
      SELECT 
        ii.gst_rate,
        SUM(ii.taxable_amount) as total_taxable,
        SUM(ii.cgst_amount) as total_cgst,
        SUM(ii.sgst_amount) as total_sgst,
        SUM(ii.igst_amount) as total_igst,
        SUM(ii.total_tax) as total_tax,
        SUM(ii.line_total) as total_gross
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.status = 'COMPLETED' AND ${filter}
      GROUP BY ii.gst_rate
      ORDER BY ii.gst_rate ASC
    `, params);

    const hsnWise = await queryAll(`
      SELECT 
        ii.hsn_code,
        SUM(ii.quantity) as total_quantity,
        SUM(ii.taxable_amount) as total_taxable,
        SUM(ii.cgst_amount) as total_cgst,
        SUM(ii.sgst_amount) as total_sgst,
        SUM(ii.igst_amount) as total_igst,
        SUM(ii.total_tax) as total_tax,
        SUM(ii.line_total) as total_amount
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.status = 'COMPLETED' AND ${filter}
      GROUP BY ii.hsn_code
      ORDER BY total_amount DESC
    `, params);

    res.json({ rateWise, hsnWise });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Profit & Loss and Inventory Valuation Report
router.get('/profit-loss', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    let invFilter = `1=1`;
    let expFilter = `1=1`;
    const params: any[] = [];
    const expParams: any[] = [];

    if (start_date) {
      invFilter += ` AND date(i.invoice_date) >= date(?)`;
      expFilter += ` AND e.expense_date >= ?`;
      params.push(start_date);
      expParams.push(start_date);
    }
    if (end_date) {
      invFilter += ` AND date(i.invoice_date) <= date(?)`;
      expFilter += ` AND e.expense_date <= ?`;
      params.push(end_date);
      expParams.push(end_date);
    }

    const revenueData = (await queryOne(`
      SELECT 
        COALESCE(SUM(ii.taxable_amount), 0) as taxable_revenue,
        COALESCE(SUM(ii.cost_price * ii.quantity), 0) as cogs
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.status = 'COMPLETED' AND ${invFilter}
    `, params)) || { taxable_revenue: 0, cogs: 0 };

    const totalExpenses = (await queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses e WHERE ${expFilter}
    `, expParams))?.total || 0;

    const valuation = (await queryOne(`
      SELECT 
        SUM(stock_quantity) as total_units,
        SUM(stock_quantity * purchase_cost) as total_cost_value,
        SUM(stock_quantity * selling_price) as total_retail_value
      FROM product_variants
      WHERE is_active = 1
    `)) || { total_units: 0, total_cost_value: 0, total_retail_value: 0 };

    const grossProfit = Math.max(0, revenueData.taxable_revenue - revenueData.cogs);
    const netProfit = grossProfit - totalExpenses;

    res.json({
      taxableRevenue: revenueData.taxable_revenue,
      cogs: revenueData.cogs,
      grossProfit,
      expenses: totalExpenses,
      netProfit,
      inventoryValuation: {
        totalUnits: valuation.total_units || 0,
        costValue: valuation.total_cost_value || 0,
        retailValue: valuation.total_retail_value || 0,
        potentialMargin: (valuation.total_retail_value || 0) - (valuation.total_cost_value || 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
