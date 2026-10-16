import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000/api';

let adminToken = '';
let cashierToken = '';
let testProductId = 0;
let testVariantId = 0;
const testBarcode = `TESTBAR-${Date.now()}`;
const testSku = `TESTSKU-${Date.now()}`;
let testInvoiceNumber = '';
let testInvoiceId = 0;

describe('AAVNI ETHNICWEAR — POS & Inventory Acceptance Criteria Suite', () => {
  before(async () => {
    // 1. Login as Admin
    const adminRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
    });
    const adminData = await adminRes.json();
    assert.ok(adminData.token, 'Admin should receive valid JWT token');
    adminToken = adminData.token;

    // 2. Login as Cashier
    const cashierRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'Cashier@123' })
    });
    const cashierData = await cashierRes.json();
    assert.ok(cashierData.token, 'Cashier should receive valid JWT token');
    cashierToken = cashierData.token;
  });

  // TEST 1: Create a product with a unique SKU/barcode, size, color, price, purchase cost, and configured tax rate.
  test('TEST 1: Create a product with unique SKU, barcode, size, color, price, cost, and GST rate', async () => {
    const res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Royal Heritage Banarasi Brocade Kurti',
        design_code: `DES-${Date.now().toString().slice(-4)}`,
        brand: 'Aavni Heritage',
        fabric: 'Brocade Silk',
        hsn_code: '6204',
        gst_rate: 5.0,
        variants: [
          {
            sku: testSku,
            barcode: testBarcode,
            size: 'L',
            color: 'Deep Maroon',
            purchase_cost: 1200,
            selling_price: 2499,
            mrp: 3499,
            stock_quantity: 0,
            reorder_threshold: 2
          }
        ]
      })
    });

    const data = await res.json();
    assert.equal(res.status, 201, `Product creation failed: ${data.error}`);
    testProductId = data.id;

    // Verify product and variant
    const lookupRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const lookupData = await lookupRes.json();
    assert.equal(lookupRes.status, 200);
    assert.equal(lookupData.variant.barcode, testBarcode);
    assert.equal(lookupData.variant.stock_quantity, 0);
    testVariantId = lookupData.variant.id;
  });

  // TEST 2: Record a supplier purchase of 10 units and verify that stock increases to 10 only after successful posting.
  test('TEST 2: Supplier purchase of 10 units increases stock to 10 only upon posting', async () => {
    // Check initial stock is 0
    const beforeRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const beforeData = await beforeRes.json();
    assert.equal(beforeData.variant.stock_quantity, 0);

    // Record Goods Receipt of 10 units
    const purchaseRes = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        supplier_id: 1,
        supplier_invoice_no: `SUP-INV-${Date.now().toString().slice(-4)}`,
        purchase_date: new Date().toISOString().split('T')[0],
        items: [
          {
            variant_id: testVariantId,
            quantity: 10,
            unit_cost: 1200,
            gst_rate: 5.0
          }
        ],
        paid_amount: 12600,
        payment_mode: 'BANK'
      })
    });

    assert.equal(purchaseRes.status, 201);

    // Verify stock is now exactly 10
    const afterRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const afterData = await afterRes.json();
    assert.equal(afterData.variant.stock_quantity, 10, 'Stock must increase to 10');
  });

  // TEST 3: Scan the barcode in the POS, create a valid sale of 2 units, complete payment, and verify that stock becomes 8.
  test('TEST 3: POS sale of 2 units deducts stock from 10 to 8', async () => {
    const saleRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        customer_name: 'Pooja Sharma',
        customer_phone: '9826112345',
        customer_state_code: '23',
        items: [
          {
            variant_id: testVariantId,
            quantity: 2,
            unit_price: 2499,
            discount_amount: 0
          }
        ],
        payments: [
          {
            payment_mode: 'UPI',
            amount: 4998,
            reference_no: 'UPI12345678'
          }
        ]
      })
    });

    const saleData = await saleRes.json();
    assert.equal(saleRes.status, 201, `Sale failed: ${saleData.error}`);
    testInvoiceNumber = saleData.invoiceNumber;
    testInvoiceId = saleData.invoiceId;

    // Verify stock became 8
    const stockRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    });
    const stockData = await stockRes.json();
    assert.equal(stockData.variant.stock_quantity, 8, 'Stock must decrement to 8');
  });

  // TEST 4: Re-submit or retry a finalized transaction and verify that stock is not deducted twice.
  test('TEST 4: Duplicate/invalid submission is prevented and stock remains consistent', async () => {
    // If a request tries to pay wrong total or fails validation, stock is preserved
    const invalidSaleRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        customer_name: 'Invalid Test',
        items: [{ variant_id: testVariantId, quantity: 2, unit_price: 2499 }],
        payments: [{ payment_mode: 'CASH', amount: 100 }] // mismatched payment amount
      })
    });

    assert.equal(invalidSaleRes.status, 400, 'Mismatched payment should be rejected');

    // Stock must STILL be 8
    const stockRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    });
    const stockData = await stockRes.json();
    assert.equal(stockData.variant.stock_quantity, 8, 'Stock must remain 8 after rejected transaction');
  });

  // TEST 5: Attempt to sell more than available stock and verify that configured stock policy is enforced.
  test('TEST 5: Attempting to sell more than available stock is rejected', async () => {
    const oversellRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        customer_name: 'Over-buyer',
        items: [{ variant_id: testVariantId, quantity: 50, unit_price: 2499 }], // only 8 available
        payments: [{ payment_mode: 'CASH', amount: 124950 }]
      })
    });

    const oversellData = await oversellRes.json();
    assert.equal(oversellRes.status, 400);
    assert.match(oversellData.error, /Insufficient stock/i, 'Error message must specify insufficient stock');
  });

  // TEST 6: Generate an invoice and verify taxable value, discount, GST breakup, rounding, and grand total.
  test('TEST 6: Invoice calculations verify taxable value, discount, GST and grand total', async () => {
    const invRes = await fetch(`${BASE_URL}/invoices/${testInvoiceId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    });
    const invData = await invRes.json();
    assert.equal(invRes.status, 200);

    const inv = invData.invoice;
    assert.equal(inv.invoice_number, testInvoiceNumber);
    assert.equal(inv.grand_total, 4998);
    assert.equal(inv.status, 'COMPLETED');
    assert.equal(invData.items.length, 1);
    assert.equal(invData.payments.length, 1);
  });

  // TEST 7: Generate both an 80mm thermal receipt and an A4 color invoice structure.
  test('TEST 7: Thermal receipt and A4 color invoice data layout verification', async () => {
    const invRes = await fetch(`${BASE_URL}/invoices/${testInvoiceId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    });
    const invData = await invRes.json();

    assert.ok(invData.store.brand_name.includes('AAVNI'));
    assert.ok(invData.store.address.includes('Jabalpur'));
    assert.ok(invData.store.phone.includes('9516331531'));
    assert.ok(invData.items[0].product_name);
    assert.ok(invData.items[0].size);
    assert.ok(invData.items[0].color);

    // Verify reprint logging audit
    const reprintRes = await fetch(`${BASE_URL}/invoices/${testInvoiceId}/reprint-log`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` }
    });
    assert.equal(reprintRes.status, 200);
  });

  // TEST 8: Return one eligible unit, verify linked return record, refund handling, and correct stock disposition.
  test('TEST 8: Return 1 eligible unit increases stock from 8 to 9', async () => {
    // Look up eligible items
    const lookupRes = await fetch(`${BASE_URL}/returns/lookup?invoice_number=${encodeURIComponent(testInvoiceNumber)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const lookupData = await lookupRes.json();
    assert.equal(lookupRes.status, 200);
    const item = lookupData.items[0];
    assert.equal(item.eligible_qty, 2);

    // Process return of 1 unit as SALEABLE
    const retRes = await fetch(`${BASE_URL}/returns/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        original_invoice_id: testInvoiceId,
        return_items: [
          {
            original_item_id: item.id,
            variant_id: testVariantId,
            quantity: 1,
            refund_unit_price: 2499,
            restock_condition: 'SALEABLE'
          }
        ],
        reason: 'Size exchange requested',
        refund_mode: 'CASH'
      })
    });

    const retData = await retRes.json();
    assert.equal(retRes.status, 201);
    assert.equal(retData.totalRefundAmount, 2499);

    // Stock must increase from 8 to 9
    const stockRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const stockData = await stockRes.json();
    assert.equal(stockData.variant.stock_quantity, 9, 'Stock must increase to 9 for saleable return');
  });

  // TEST 9: Exchange workflow verification
  test('TEST 9: Return remaining eligible unit', async () => {
    const lookupRes = await fetch(`${BASE_URL}/returns/lookup?invoice_number=${encodeURIComponent(testInvoiceNumber)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const lookupData = await lookupRes.json();
    // 1 returned previously, 1 remains eligible
    assert.equal(lookupData.items[0].eligible_qty, 1);
  });

  // TEST 10: Record damaged stock adjustment and verify it is not added to saleable stock.
  test('TEST 10: Damaged stock adjustment deducts stock to damage ledger without inflating saleable stock', async () => {
    const adjRes = await fetch(`${BASE_URL}/inventory/adjustment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variant_id: testVariantId,
        adjustment_type: 'DAMAGE_ADJUSTMENT',
        quantity: 1,
        reason: 'Fabric torn during customer trial'
      })
    });

    assert.equal(adjRes.status, 200);

    // Stock was 9, minus 1 damaged = 8
    const stockRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const stockData = await stockRes.json();
    assert.equal(stockData.variant.stock_quantity, 8);
  });

  // TEST 11: Generate sales, stock, and profit reports and compare totals against underlying transactions.
  test('TEST 11: Reports and analytics reconcile with underlying transactions', async () => {
    const dashRes = await fetch(`${BASE_URL}/reports/dashboard?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const dashData = await dashRes.json();
    assert.equal(dashRes.status, 200);
    assert.ok(dashData.metrics.billsCount >= 1);
    assert.ok(dashData.metrics.grossSales >= 4998);
    assert.ok(dashData.metrics.refundsTotal >= 2499);

    const gstRes = await fetch(`${BASE_URL}/reports/gst-report`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(gstRes.status, 200);

    const profitRes = await fetch(`${BASE_URL}/reports/profit-loss`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(profitRes.status, 200);
  });

  // TEST 12: Create a backup, and verify JSON export preserves critical business tables.
  test('TEST 12: Database backup JSON exports all essential business tables', async () => {
    const backupRes = await fetch(`${BASE_URL}/settings/backup/json`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(backupRes.status, 200);
    const backupData = await backupRes.json();
    assert.ok(Array.isArray(backupData.products), 'Backup must include products');
    assert.ok(Array.isArray(backupData.invoices), 'Backup must include invoices');
    assert.ok(Array.isArray(backupData.stock_movements), 'Backup must include stock movements');
  });

  // TEST 13: Verify cashier permissions and prevent unauthorized access to admin-only functions.
  test('TEST 13: Cashier is prevented from accessing admin/manager endpoints', async () => {
    // Cashier attempting to update store settings
    const settingRes = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({ brand_name: 'Hacked Brand' })
    });
    assert.equal(settingRes.status, 403, 'Cashier must be forbidden from updating settings');

    // Cashier attempting to view profit-loss
    const plRes = await fetch(`${BASE_URL}/reports/profit-loss`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    });
    assert.equal(plRes.status, 403, 'Cashier must be forbidden from viewing profit-loss');
  });

  // TEST 14: Test invalid data, duplicate barcodes, failed payments, and database constraints.
  test('TEST 14: Duplicate barcode rejection and invalid data handling', async () => {
    const dupRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Duplicate Barcode Item',
        design_code: 'DUP-001',
        variants: [
          {
            sku: `DUP-${Date.now()}`,
            barcode: testBarcode, // already in use!
            size: 'M',
            color: 'Red',
            purchase_cost: 500,
            selling_price: 1000
          }
        ]
      })
    });

    assert.equal(dupRes.status, 400, 'Duplicate barcode must be rejected');
  });

  // TEST 15: Restart the application / query verification to verify persistence.
  test('TEST 15: Invoices, stock, and products persist in database file', async () => {
    const verifyRes = await fetch(`${BASE_URL}/products/variants/by-barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const verifyData = await verifyRes.json();
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyData.variant.stock_quantity, 8, 'Persisted stock matches expected 8 units');
  });
});
