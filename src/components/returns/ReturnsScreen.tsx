import React, { useState } from 'react';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import { RotateCcw, Search, CheckCircle2, AlertCircle, ArrowRightLeft } from 'lucide-react';

export const ReturnsScreen: React.FC = () => {
  const [searchInv, setSearchInv] = useState('');
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<
    Array<{
      original_item_id: number;
      variant_id: number;
      product_name: string;
      size: string;
      color: string;
      eligible_qty: number;
      quantity: number;
      refund_unit_price: number;
      restock_condition: 'SALEABLE' | 'DAMAGED';
    }>
  >([]);

  const [reason, setReason] = useState('Customer size exchange / return');
  const [refundMode, setRefundMode] = useState<'CASH' | 'UPI' | 'STORE_CREDIT'>('CASH');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Past returns list
  const [pastReturns, setPastReturns] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const inv = searchInv.trim();
    if (!inv) return;

    setLoading(true);
    setMessage(null);
    setInvoiceData(null);
    try {
      const res = await api.get<{ invoice: any; items: any[] }>(`/returns/lookup?invoice_number=${encodeURIComponent(inv)}`);
      setInvoiceData(res.invoice);

      // Initialize return items table
      const initial = res.items
        .filter((it) => it.eligible_qty > 0)
        .map((it) => ({
          original_item_id: it.id,
          variant_id: it.variant_id,
          product_name: it.product_name,
          size: it.size,
          color: it.color,
          eligible_qty: it.eligible_qty,
          quantity: 0,
          refund_unit_price: it.line_total / it.quantity,
          restock_condition: 'SALEABLE' as const
        }));

      setReturnItems(initial);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Invoice not found' });
    } finally {
      setLoading(false);
    }
  };

  const totalRefundAmount = returnItems.reduce((s, it) => s + (it.refund_unit_price * it.quantity), 0);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToReturn = returnItems.filter((it) => it.quantity > 0);
    if (itemsToReturn.length === 0) {
      setMessage({ type: 'error', text: 'Select at least 1 item quantity to return' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.post<{ returnNumber: string; totalRefundAmount: number }>('/returns/process', {
        original_invoice_id: invoiceData.id,
        return_items: itemsToReturn.map((it) => ({
          original_item_id: it.original_item_id,
          variant_id: it.variant_id,
          quantity: it.quantity,
          refund_unit_price: it.refund_unit_price,
          restock_condition: it.restock_condition
        })),
        reason,
        refund_mode: refundMode
      });

      setMessage({
        type: 'success',
        text: `Return processed successfully! Reference: ${res.returnNumber} (Refund: ${formatINR(res.totalRefundAmount)})`
      });
      setInvoiceData(null);
      setReturnItems([]);
      setSearchInv('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Return processing failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const loadPastReturns = async () => {
    try {
      const data = await api.get<{ returns: any[] }>('/returns');
      setPastReturns(data.returns || []);
      setShowHistory(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8F5F0] min-h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
            Returns, Exchanges & Credit Notes
          </h1>
          <p className="text-xs text-[#776C70]">
            Search original bill, verify eligible units, assign condition (saleable vs damaged), and process refunds
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!showHistory) loadPastReturns();
            else setShowHistory(false);
          }}
          className="px-4 py-2 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#776C70] hover:bg-[#F6EBF0]"
        >
          {showHistory ? 'Back to Return Form' : 'View Past Returns'}
        </button>
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

      {!showHistory ? (
        <div className="space-y-6">
          {/* Invoice Search Bar */}
          <div className="bg-white p-5 rounded-xl border border-[#E9DFE2] shadow-xs">
            <form onSubmit={handleLookup} className="flex space-x-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#776C70] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={searchInv}
                  onChange={(e) => setSearchInv(e.target.value)}
                  placeholder="Enter invoice number (e.g. AE/24-25/0001)..."
                  className="w-full pl-9 pr-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs font-mono focus:outline-none focus:border-[#681C32]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-[#681C32] hover:bg-[#451222] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {loading ? 'Searching...' : 'Lookup Bill'}
              </button>
            </form>
          </div>

          {/* Invoice Items & Return Form */}
          {invoiceData && (
            <form onSubmit={handleSubmitReturn} className="space-y-6">
              {/* Invoice Summary Card */}
              <div className="bg-white p-4 rounded-xl border border-[#E9DFE2] shadow-xs flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-sm text-[#30262A] font-mono">{invoiceData.invoice_number}</span>
                  <div className="text-[#776C70] mt-0.5">
                    Customer: {invoiceData.customer_name} ({invoiceData.customer_phone || 'Walk-in'})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[#776C70]">Original Bill Date: {new Date(invoiceData.invoice_date).toLocaleDateString('en-IN')}</div>
                  <div className="font-mono font-bold text-[#681C32] text-sm">Grand Total: {formatINR(invoiceData.grand_total)}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
                <div className="p-3 bg-[#F8F5F0] border-b border-[#E9DFE2] font-bold text-xs text-[#776C70]">
                  Select Eligible Items to Return / Exchange
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white border-b text-[10px] font-bold text-[#776C70] uppercase">
                      <th className="p-3">Item</th>
                      <th className="p-3">Size/Color</th>
                      <th className="p-3 text-center">Eligible Qty</th>
                      <th className="p-3 text-center">Return Qty</th>
                      <th className="p-3 text-center">Disposition / Stocking</th>
                      <th className="p-3 text-right">Refund Rate</th>
                      <th className="p-3 text-right">Line Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E9DFE2]">
                    {returnItems.map((item, idx) => (
                      <tr key={item.original_item_id} className="hover:bg-[#FDFBFA]">
                        <td className="p-3 font-semibold text-[#30262A]">{item.product_name}</td>
                        <td className="p-3">
                          <span className="font-bold text-[#681C32]">{item.size}</span> / {item.color}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#776C70]">
                          {item.eligible_qty}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={item.eligible_qty}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = Math.min(item.eligible_qty, Math.max(0, Number(e.target.value) || 0));
                              setReturnItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                              );
                            }}
                            className="w-16 p-1 text-center font-mono font-bold border rounded bg-[#F8F5F0]"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <select
                            value={item.restock_condition}
                            onChange={(e) => {
                              const c = e.target.value as any;
                              setReturnItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, restock_condition: c } : it))
                              );
                            }}
                            className="px-2 py-1 text-xs border rounded bg-[#F8F5F0] font-semibold"
                          >
                            <option value="SALEABLE">Saleable (Restock)</option>
                            <option value="DAMAGED">Damaged (Do Not Restock)</option>
                          </select>
                        </td>
                        <td className="p-3 text-right font-mono text-[#776C70]">{formatINR(item.refund_unit_price)}</td>
                        <td className="p-3 text-right font-mono font-bold text-[#681C32]">
                          {formatINR(item.refund_unit_price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Settlement Block */}
              <div className="bg-white p-5 rounded-xl border border-[#E9DFE2] shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-[#776C70] mb-1">Return / Exchange Reason *</label>
                    <input
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Size fitting issue, replaced with different color"
                      className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#776C70] mb-1">Refund Settlement Method</label>
                    <select
                      value={refundMode}
                      onChange={(e) => setRefundMode(e.target.value as any)}
                      className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg font-semibold"
                    >
                      <option value="CASH">Cash Refund</option>
                      <option value="UPI">UPI Refund</option>
                      <option value="STORE_CREDIT">Store Credit / Advance Voucher</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-[#F8F5F0] rounded-xl border border-[#E9DFE2] flex flex-col justify-between">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-[#776C70]">Total Refund Value:</span>
                    <span className="font-mono font-bold text-2xl text-[#681C32]">{formatINR(totalRefundAmount)}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || totalRefundAmount <= 0}
                    className="w-full mt-3 py-3 bg-[#681C32] hover:bg-[#451222] text-white font-bold rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {submitting ? 'Processing...' : 'Confirm Return / Issue Credit Note'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* History View */
        <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E9DFE2] font-bold text-xs text-[#776C70]">
            Past Processed Returns Register
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F5F0] border-b text-[10px] font-bold text-[#776C70] uppercase">
                <th className="p-3">Return Ref</th>
                <th className="p-3">Original Invoice</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Refund Mode</th>
                <th className="p-3 text-right">Refund Amount</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9DFE2]">
              {pastReturns.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 font-mono font-bold text-[#681C32]">{r.return_number}</td>
                  <td className="p-3 font-mono text-[#30262A]">{r.invoice_number}</td>
                  <td className="p-3">{r.customer_name || 'Walk-in'}</td>
                  <td className="p-3 text-[#776C70]">{r.reason}</td>
                  <td className="p-3 font-semibold">{r.refund_mode}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#B42332]">{formatINR(r.total_refund_amount)}</td>
                  <td className="p-3 text-[#776C70] font-mono">{new Date(r.return_date).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
