import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import { formatDeviceDate, formatDeviceTime } from '../../lib/datetime';
import { X, Printer } from 'lucide-react';

interface ThermalReceiptModalProps {
  invoiceId: number;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({ invoiceId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await api.get(`/invoices/${invoiceId}`);
        setData(res);
        // Log reprint
        await api.post(`/invoices/${invoiceId}/reprint-log`);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl text-center text-sm font-semibold">
          Loading receipt layout...
        </div>
      </div>
    );
  }

  const { invoice, items, payments, store } = data;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#E9DFE2] overflow-hidden my-8">
        {/* Modal Controls */}
        <div className="no-print bg-[#681C32] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Printer className="w-5 h-5 text-white/80" />
            <h2 className="font-serif font-bold text-base">Thermal Receipt ({paperWidth})</h2>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={paperWidth}
              onChange={(e) => setPaperWidth(e.target.value as any)}
              className="bg-white/20 text-white text-xs px-2 py-1 rounded border border-white/30 focus:outline-none"
            >
              <option value="80mm" className="text-black">80mm Roll</option>
              <option value="58mm" className="text-black">58mm Roll</option>
            </select>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action button in preview */}
        <div className="no-print p-4 bg-[#F8F5F0] border-b border-[#E9DFE2] flex justify-between items-center">
          <span className="text-xs text-[#776C70]">Thermal Printer Ready</span>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#681C32] hover:bg-[#451222] text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>

        {/* Actual Thermal Receipt Sheet */}
        <div className="p-6 bg-white overflow-y-auto max-h-[70vh] flex justify-center">
          <div
            className={`font-mono text-[11px] leading-tight text-black ${
              paperWidth === '80mm' ? 'w-[72mm] max-w-[72mm]' : 'w-[52mm] max-w-[52mm]'
            }`}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-black">
              {/* Boutique Logo */}
              <div className="flex justify-center mb-2">
                <img
                  src="/aavni-logo.png"
                  alt="Aavni Ethnicwear"
                  className={`object-contain mix-blend-multiply ${
                    paperWidth === '80mm' ? 'w-56 max-w-[220px] h-auto max-h-32' : 'w-44 max-w-[170px] h-auto max-h-24'
                  }`}
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <h1 className="text-base font-bold tracking-wider uppercase font-serif">
                {store.brand_name || 'AAVNI ETHNICWEAR'}
              </h1>
              <p className="text-[10px] font-medium tracking-wide uppercase text-gray-800 mt-0.5">
                {store.tagline || 'Ethnic Wear For Every You'}
              </p>
              <p className="text-[10px] mt-1">{store.address}</p>
              <p className="text-[10px]">Contact: {store.phone}</p>
              <p className="text-[10px] font-bold mt-0.5">GSTIN: {store.gstin || '23BLAPM8179G2ZY'}</p>
              <p className="text-[9px] font-semibold mt-0.5 tracking-wider uppercase">
                {store.is_gst_registered ? (invoice.customer_gstin ? 'TAX INVOICE' : 'RETAIL TAX INVOICE') : 'RETAIL INVOICE'}
              </p>
            </div>

            {/* Bill Details */}
            <div className="py-2 border-b border-black space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Bill No: {invoice.invoice_number}</span>
                <span>Date: {formatDeviceDate(invoice.invoice_date)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier: {invoice.cashier_name}</span>
                <span>Time: {formatDeviceTime(invoice.invoice_date)}</span>
              </div>
              {invoice.customer_name && invoice.customer_name !== 'Walk-in Customer' && (
                <div className="pt-0.5">
                  Customer: {invoice.customer_name} {invoice.customer_phone ? `(${invoice.customer_phone})` : ''}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-black">
              <div className="flex justify-between font-bold pb-1 text-[10px]">
                <span className="w-1/2">Item</span>
                <span className="w-1/6 text-center">Qty</span>
                <span className="w-1/6 text-right">Rate</span>
                <span className="w-1/6 text-right">Amt</span>
              </div>
              <div className="divide-y divide-dashed divide-gray-400">
                {items.map((it: any, i: number) => (
                  <div key={i} className="py-1">
                    <div className="font-bold text-[10px]">{it.product_name}</div>
                    <div className="text-[9px] text-gray-600 flex justify-between">
                      <span>{it.size} | {it.color}</span>
                      <span>HSN:{it.hsn_code}</span>
                    </div>
                    <div className="flex justify-between text-[10px] pt-0.5">
                      <span className="w-1/2 font-mono text-[9px]">{it.barcode}</span>
                      <span className="w-1/6 text-center font-bold">{it.quantity}</span>
                      <span className="w-1/6 text-right">{it.unit_price}</span>
                      <span className="w-1/6 text-right font-bold">{it.line_total}</span>
                    </div>
                    {Number(it.discount_amount) > 0 && (
                      <div className="text-[9px] text-gray-600 flex justify-between italic pl-2 pt-0.5">
                        <span>Item Discount:</span>
                        <span>- ₹{Number(it.discount_amount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2 border-b border-black space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal (MRP):</span>
                <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discount_total) > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Discount:</span>
                  <span>- ₹{Number(invoice.discount_total).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.round_off) !== 0 && (
                <div className="flex justify-between text-[9px]">
                  <span>Round Off:</span>
                  <span>{Number(invoice.round_off) > 0 ? `+${invoice.round_off}` : invoice.round_off}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-black">
                <span>TOTAL PAYABLE:</span>
                <span className="text-sm">₹{Number(invoice.grand_total).toFixed(2)}</span>
              </div>
              <div className="text-[9px] text-gray-600 text-center italic">
                (Price inclusive of all taxes / GST)
              </div>

              {/* GST Breakdown (Segregated below Total so it does not confuse the bill addition) */}
              {store.is_gst_registered && Number(invoice.tax_total) > 0 && (
                <div className="pt-1.5 mt-1 border-t border-dotted border-gray-400 text-[9px] text-gray-700 space-y-0.5">
                  <div className="text-center font-bold text-[9px] text-black">
                    -- GST Breakdown (Included in Total) --
                  </div>
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span>₹{Number(invoice.taxable_amount).toFixed(2)}</span>
                  </div>
                  {invoice.is_interstate ? (
                    <div className="flex justify-between">
                      <span>IGST:</span>
                      <span>₹{Number(invoice.igst_amount).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>CGST:</span>
                        <span>₹{Number(invoice.cgst_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST:</span>
                        <span>₹{Number(invoice.sgst_amount).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Total Tax:</span>
                    <span>₹{Number(invoice.tax_total).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payments */}
            <div className="py-2 border-b border-black text-[10px] space-y-0.5">
              {payments.map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>Paid ({p.payment_mode}):</span>
                  <span>₹{Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
              {payments[0]?.tendered_amount > 0 && payments[0]?.change_returned > 0 && (
                <div className="flex justify-between text-gray-700 text-[9px]">
                  <span>Change Given:</span>
                  <span>₹{Number(payments[0].change_returned).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Policy & Footer */}
            <div className="pt-2 text-center text-[9px] space-y-1">
              <p className="font-semibold">{store.return_policy || 'Exchange within 7 days with tag and bill.'}</p>
              <p className="font-bold uppercase tracking-wider text-[10px] pt-1">
                Thank you for shopping at AAVNI!
              </p>
              <p className="text-[8px] text-gray-500">Software: Aavni Retail POS v1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
