import React, { useState, useEffect, useRef } from 'react';
import { ProductVariant, Supplier, StockMovement } from '../../types';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  History,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const StockMovementScreen: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'IN' | 'OUT' | 'COUNT' | 'LEDGER'>('IN');

  // Suppliers for Stock In
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | ''>('');
  const [invoiceRef, setInvoiceRef] = useState('');

  // Continuous Barcode Scanning
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItems, setScannedItems] = useState<
    Array<{
      variant: ProductVariant;
      quantity: number;
      unit_cost: number;
      counted_qty?: number;
      remarks?: string;
    }>
  >([]);

  // Adjustment specifics
  const [adjustmentType, setAdjustmentType] = useState('DAMAGE_ADJUSTMENT');
  const [adjustmentReason, setAdjustmentReason] = useState('Fabric defect / trial damage');

  // Audit Ledger
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Status message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSuppliers();
    if (activeMode === 'LEDGER') {
      fetchLedger();
    }
  }, [activeMode]);

  const fetchSuppliers = async () => {
    try {
      const data = await api.get<{ suppliers: Supplier[] }>('/purchases/suppliers');
      setSuppliers(data.suppliers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const data = await api.get<{ movements: StockMovement[] }>('/inventory/ledger?limit=100');
      setMovements(data.movements || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Handle continuous barcode scan
  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    try {
      const data = await api.get<{ variant: ProductVariant }>(`/products/variants/by-barcode/${encodeURIComponent(code)}`);
      if (data.variant) {
        addItem(data.variant);
        setBarcodeInput('');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Scan error: ${err.message || 'Product not found'}` });
    }
    barcodeRef.current?.focus();
  };

  const addItem = (v: ProductVariant) => {
    setScannedItems((prev) => {
      const idx = prev.findIndex((item) => item.variant.id === v.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          quantity: copy[idx].quantity + 1,
          counted_qty: (copy[idx].counted_qty || 0) + 1
        };
        return copy;
      }
      return [
        {
          variant: v,
          quantity: 1,
          unit_cost: v.purchase_cost,
          counted_qty: 1
        },
        ...prev
      ];
    });
  };

  const updateItemQty = (id: number, val: number) => {
    setScannedItems((prev) =>
      prev
        .map((it) => (it.variant.id === id ? { ...it, quantity: Math.max(1, val) } : it))
    );
  };

  const removeItem = (id: number) => {
    setScannedItems((prev) => prev.filter((it) => it.variant.id !== id));
  };

  // Submit Stock In
  const handleSubmitStockIn = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.post<{ message: string; reference: string }>('/inventory/stock-in', {
        supplier_id: selectedSupplier || null,
        reference_no: invoiceRef || undefined,
        items: scannedItems.map((it) => ({
          variant_id: it.variant.id,
          quantity: it.quantity,
          unit_cost: it.unit_cost
        }))
      });
      setMessage({ type: 'success', text: `Stock-In successful! Reference: ${res.reference}` });
      setScannedItems([]);
      setInvoiceRef('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Stock-In failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Stock Out / Adjustment
  const handleSubmitAdjustment = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      for (const it of scannedItems) {
        await api.post('/inventory/adjustment', {
          variant_id: it.variant.id,
          adjustment_type: adjustmentType,
          quantity: it.quantity,
          reason: adjustmentReason
        });
      }
      setMessage({ type: 'success', text: 'Stock adjustments saved and posted to ledger.' });
      setScannedItems([]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Adjustment failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Stock Count Reconciliation
  const handleSubmitStockCount = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.post<{ message: string; discrepanciesCount: number }>('/inventory/stock-count/reconcile', {
        counts: scannedItems.map((it) => ({
          variant_id: it.variant.id,
          counted_quantity: it.counted_qty || 0,
          remarks: it.remarks || 'Physical inventory audit'
        }))
      });
      setMessage({
        type: 'success',
        text: `Reconciliation complete. ${res.discrepanciesCount} discrepancies adjusted.`
      });
      setScannedItems([]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Reconciliation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8F5F0] min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div>
        <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
          Stock In / Out & Inventory Reconciliation
        </h1>
        <p className="text-xs text-[#776C70]">
          Continuous barcode scanning, purchase stock-in, damage write-offs, physical counts, and audit ledger
        </p>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-[#E9DFE2] space-x-2">
        {[
          { id: 'IN', label: 'Stock In (Inward/GRN)', icon: ArrowDownCircle },
          { id: 'OUT', label: 'Stock Out / Damage Adjustment', icon: ArrowUpCircle },
          { id: 'COUNT', label: 'Physical Stock Count', icon: ClipboardList },
          { id: 'LEDGER', label: 'Audit Movements Ledger', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = activeMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveMode(tab.id as any);
                setMessage(null);
                setScannedItems([]);
              }}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-2 transition-colors border-t border-x ${
                isSel
                  ? 'bg-white border-[#E9DFE2] text-[#681C32] border-b-white translate-y-[1px]'
                  : 'bg-[#F8F5F0] border-transparent text-[#776C70] hover:text-[#30262A]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-[#28794B]'
              : 'bg-red-50 border-red-200 text-[#B42332]'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* MODES: IN, OUT, COUNT */}
      {activeMode !== 'LEDGER' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Scan & Parameters Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Barcode Scanner Box */}
            <div className="bg-white p-4 rounded-xl border border-[#E9DFE2] shadow-xs">
              <label className="block text-xs font-bold text-[#30262A] uppercase tracking-wider mb-2">
                Continuous Barcode Scan (USB Scanner Mode)
              </label>
              <form onSubmit={handleBarcodeScan} className="flex space-x-2">
                <div className="relative flex-1">
                  <Barcode className="w-5 h-5 text-[#681C32] absolute left-3 top-2.5" />
                  <input
                    ref={barcodeRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan product barcode to append to list..."
                    className="w-full pl-10 pr-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-sm font-mono text-[#30262A] focus:outline-none focus:border-[#681C32] focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#681C32] text-white rounded-lg text-xs font-bold hover:bg-[#451222]"
                >
                  Add SKU
                </button>
              </form>
            </div>

            {/* Scanned Items Table */}
            <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
              <div className="p-3 bg-[#F8F5F0] border-b border-[#E9DFE2] font-bold text-xs text-[#776C70] flex justify-between items-center">
                <span>Scanned Variants List ({scannedItems.length})</span>
                {scannedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScannedItems([])}
                    className="text-[11px] text-[#B42332] hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {scannedItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#776C70]">
                  Scan items using barcode scanner or type barcode above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-[#E9DFE2] text-[10px] font-bold text-[#776C70] uppercase tracking-wider">
                        <th className="p-3">Product / SKU</th>
                        <th className="p-3">Size / Color</th>
                        <th className="p-3 text-center">System Stock</th>
                        <th className="p-3 text-center">
                          {activeMode === 'COUNT' ? 'Counted Qty' : 'Movement Qty'}
                        </th>
                        {activeMode === 'IN' && <th className="p-3 text-right">Unit Cost</th>}
                        <th className="p-3 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9DFE2]">
                      {scannedItems.map((item) => (
                        <tr key={item.variant.id} className="hover:bg-[#FDFBFA]">
                          <td className="p-3">
                            <div className="font-semibold text-[#30262A]">{item.variant.product_name}</div>
                            <div className="text-[10px] text-[#776C70] font-mono">
                              SKU: {item.variant.sku} | Barcode: {item.variant.barcode}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-[#681C32]">{item.variant.size}</span>
                            <span className="text-[#776C70] text-[11px]"> / {item.variant.color}</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-[#776C70]">
                            {item.variant.stock_quantity}
                          </td>
                          <td className="p-3 text-center">
                            {activeMode === 'COUNT' ? (
                              <input
                                type="number"
                                min="0"
                                value={item.counted_qty || 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setScannedItems((prev) =>
                                    prev.map((it) => (it.variant.id === item.variant.id ? { ...it, counted_qty: val } : it))
                                  );
                                }}
                                className="w-16 px-2 py-1 text-center font-mono font-bold border border-[#E9DFE2] rounded bg-[#F8F5F0]"
                              />
                            ) : (
                              <div className="inline-flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateItemQty(item.variant.id, item.quantity - 1)}
                                  className="w-5 h-5 rounded bg-[#F8F5F0] border border-[#E9DFE2] text-xs font-bold"
                                >
                                  -
                                </button>
                                <span className="font-mono font-bold w-6 text-center">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateItemQty(item.variant.id, item.quantity + 1)}
                                  className="w-5 h-5 rounded bg-[#F8F5F0] border border-[#E9DFE2] text-xs font-bold"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                          {activeMode === 'IN' && (
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                value={item.unit_cost}
                                onChange={(e) => {
                                  const c = Number(e.target.value) || 0;
                                  setScannedItems((prev) =>
                                    prev.map((it) => (it.variant.id === item.variant.id ? { ...it, unit_cost: c } : it))
                                  );
                                }}
                                className="w-20 px-2 py-1 text-right font-mono border border-[#E9DFE2] rounded bg-[#F8F5F0]"
                              />
                            </td>
                          )}
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.variant.id)}
                              className="text-[#776C70] hover:text-[#B42332]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Parameters & Action Column */}
          <div className="bg-white p-5 rounded-xl border border-[#E9DFE2] shadow-xs space-y-4 h-fit">
            <h3 className="font-serif font-bold text-sm text-[#30262A] border-b border-[#E9DFE2] pb-2">
              Transaction Parameters
            </h3>

            {activeMode === 'IN' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-xs font-bold text-[#776C70] uppercase mb-1">Supplier</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#776C70] uppercase mb-1">
                    Supplier Invoice / Challan Ref
                  </label>
                  <input
                    type="text"
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    placeholder="e.g. CH-2026/09"
                    className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg font-mono"
                  />
                </div>
                <button
                  type="button"
                  disabled={submitting || scannedItems.length === 0}
                  onClick={handleSubmitStockIn}
                  className="w-full py-3 bg-[#681C32] hover:bg-[#451222] text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-40"
                >
                  {submitting ? 'Committing...' : 'Commit Stock In'}
                </button>
              </div>
            )}

            {activeMode === 'OUT' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-xs font-bold text-[#776C70] uppercase mb-1">Adjustment Reason</label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                  >
                    <option value="DAMAGE_ADJUSTMENT">Damage / Defective Fabric</option>
                    <option value="MISSING_ADJUSTMENT">Missing Item / Shrinkage</option>
                    <option value="SAMPLE_ADJUSTMENT">Display / Press Sample</option>
                    <option value="MANUAL_COUNT_ADJUSTMENT">Stock Take Correction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#776C70] uppercase mb-1">Remarks</label>
                  <textarea
                    rows={2}
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs"
                  />
                </div>
                <button
                  type="button"
                  disabled={submitting || scannedItems.length === 0}
                  onClick={handleSubmitAdjustment}
                  className="w-full py-3 bg-[#B42332] hover:bg-[#8E1B27] text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-40"
                >
                  {submitting ? 'Applying...' : 'Apply Stock Deduction'}
                </button>
              </div>
            )}

            {activeMode === 'COUNT' && (
              <div className="space-y-3 text-xs">
                <p className="text-[#776C70] text-xs">
                  Physical counts will be compared with system stock quantities. Discrepancies will be automatically reconciled.
                </p>
                <button
                  type="button"
                  disabled={submitting || scannedItems.length === 0}
                  onClick={handleSubmitStockCount}
                  className="w-full py-3 bg-[#28794B] hover:bg-[#1E5D39] text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-40"
                >
                  {submitting ? 'Reconciling...' : 'Confirm Reconciliation'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* AUDIT LEDGER VIEW */
        <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E9DFE2] font-bold text-xs text-[#776C70]">
            Immutable Stock Movement Audit Trail
          </div>
          {ledgerLoading ? (
            <div className="p-12 text-center text-xs text-[#776C70]">Loading ledger...</div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#776C70]">No stock movements recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F5F0] border-b border-[#E9DFE2] text-[10px] font-bold text-[#776C70] uppercase tracking-wider">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Product / SKU</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-center">Change</th>
                    <th className="p-3 text-center">Prev → New</th>
                    <th className="p-3">Reference / Reason</th>
                    <th className="p-3">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9DFE2]">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FDFBFA]">
                      <td className="p-3 font-mono text-[11px] text-[#776C70]">
                        {new Date(m.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-[#30262A]">{m.product_name}</div>
                        <div className="text-[10px] text-[#776C70] font-mono">
                          {m.sku} • {m.size}/{m.color}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-[#F6EBF0] text-[#681C32]">
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span className={m.quantity_change > 0 ? 'text-[#28794B]' : 'text-[#B42332]'}>
                          {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-[11px] text-[#776C70]">
                        {m.previous_stock} → <strong className="text-[#30262A]">{m.new_stock}</strong>
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-[11px] font-semibold text-[#30262A]">{m.reference_id || 'N/A'}</div>
                        <div className="text-[10px] text-[#776C70]">{m.reason}</div>
                      </td>
                      <td className="p-3 text-[11px] text-[#776C70]">{m.user_name || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
