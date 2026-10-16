import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatINR, amountInWords } from '../../lib/currency';
import { formatDeviceDate, formatDeviceTime } from '../../lib/datetime';
import { X, Printer, Download, Sparkles } from 'lucide-react';

interface A4InvoiceModalProps {
  invoiceId: number;
  onClose: () => void;
}

export const A4InvoiceModal: React.FC<A4InvoiceModalProps> = ({ invoiceId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await api.get(`/invoices/${invoiceId}`);
        setData(res);
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
          Generating A4 Color Tax Invoice...
        </div>
      </div>
    );
  }

  const { invoice, items, payments, store } = data;
  const isGstRegistered = Boolean(store.is_gst_registered && store.gstin);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-[#E9DFE2] overflow-hidden my-8">
        {/* Controls Bar */}
        <div className="no-print bg-[#681C32] px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="font-serif font-bold text-lg">A4 Color Tax Invoice Preview</h2>
            <p className="text-xs text-white/80">Invoice #{invoice.invoice_number}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white text-[#681C32] hover:bg-[#F6EBF0] text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Canvas */}
        <div className="p-8 bg-white overflow-y-auto max-h-[80vh] text-[#30262A]">
          <div className="border border-[#E9DFE2] rounded-xl p-8 relative shadow-xs">
            {/* Top Brand Banner */}
            <div className="flex justify-between items-start border-b-2 border-[#681C32] pb-6">
              <div>
                <div className="flex items-center space-x-5">
                  <img
                    src="/aavni-logo.png"
                    alt="Aavni Ethnicwear"
                    className="h-24 max-w-[240px] object-contain rounded-lg mix-blend-multiply"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <h1 className="font-serif font-bold text-2xl text-[#681C32] tracking-wider">
                      {store.brand_name || 'AAVNI ETHNICWEAR'}
                    </h1>
                    <p className="text-xs font-semibold text-[#681C32] tracking-widest uppercase mt-0.5">
                      {store.tagline || 'Ethnic Wear For Every You'}
                    </p>
                    <p className="text-[11px] font-medium text-[#776C70]">{store.legal_name}</p>
                  </div>
                </div>
                <div className="text-xs text-[#776C70] mt-3 space-y-0.5 max-w-sm">
                  <p>{store.address}</p>
                  <p>State: {store.state} (Code: {store.state_code})</p>
                  <p>Phone: {store.phone} | Email: {store.email}</p>
                  <p className="font-bold text-[#681C32]">GSTIN: {store.gstin || '23BLAPM8179G2ZY'}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-[#681C32] text-white text-xs font-bold uppercase tracking-widest rounded-md mb-2">
                  {isGstRegistered ? (invoice.customer_gstin ? 'TAX INVOICE' : 'RETAIL TAX INVOICE') : 'RETAIL BILL OF SUPPLY'}
                </span>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-[#776C70]">Invoice No: </span>
                    <strong className="font-mono text-sm text-[#30262A]">{invoice.invoice_number}</strong>
                  </div>
                  <div>
                    <span className="text-[#776C70]">Date: </span>
                    <strong>{formatDeviceDate(invoice.invoice_date)}</strong>
                  </div>
                  <div>
                    <span className="text-[#776C70]">Time: </span>
                    <strong>{formatDeviceTime(invoice.invoice_date)}</strong>
                  </div>
                  <div>
                    <span className="text-[#776C70]">Place of Supply: </span>
                    <strong>Madhya Pradesh (23)</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To Customer Section */}
            <div className="my-6 p-4 rounded-lg bg-[#F8F5F0] border border-[#E9DFE2] grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block mb-1">
                  Billed To Customer:
                </span>
                <p className="font-bold text-sm text-[#30262A]">{invoice.customer_name}</p>
                {invoice.customer_phone && <p className="text-[#776C70]">Phone: {invoice.customer_phone}</p>}
                {invoice.customer_gstin && <p className="font-bold text-[#681C32]">GSTIN: {invoice.customer_gstin}</p>}
              </div>
              <div className="text-right space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block mb-1">
                  Payment Details:
                </span>
                <p className="font-medium">
                  Mode: <strong className="uppercase">{invoice.payment_modes || 'CASH'}</strong>
                </p>
                <p className="text-[#776C70]">Billed by: {invoice.cashier_name}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6 overflow-hidden rounded-lg border border-[#E9DFE2]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#681C32] text-white text-[11px] font-bold">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Description of Goods</th>
                    <th className="py-2.5 px-2">HSN</th>
                    <th className="py-2.5 px-2">Size/Color</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate</th>
                    <th className="py-2.5 px-2 text-right">Disc</th>
                    <th className="py-2.5 px-2 text-right">Taxable</th>
                    {isGstRegistered && <th className="py-2.5 px-2 text-right">GST %</th>}
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9DFE2]">
                  {items.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#FDFBFA]">
                      <td className="py-2.5 px-3 text-[#776C70]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#30262A]">
                        {it.product_name}
                        <div className="text-[10px] text-[#776C70] font-normal">
                          Design: {it.design_code} | Barcode: {it.barcode}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[#776C70]">{it.hsn_code}</td>
                      <td className="py-2.5 px-2">
                        <span className="font-semibold text-[#681C32]">{it.size}</span>
                        <span className="text-[#776C70] text-[10px]"> / {it.color}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold">{it.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(it.unit_price)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-[#28794B]">
                        {it.discount_amount > 0 ? formatINR(it.discount_amount) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">{formatINR(it.taxable_amount)}</td>
                      {isGstRegistered && (
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-[#681C32]">
                          {it.gst_rate}%
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#30262A]">
                        {formatINR(it.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculation & Tax Summary Footer */}
            <div className="grid grid-cols-2 gap-8 items-start mb-6">
              {/* Left Column: Amount in Words & Bank Details */}
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-[#F8F5F0] rounded-lg border border-[#E9DFE2]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block mb-0.5">
                    Amount in Words:
                  </span>
                  <p className="font-bold text-xs text-[#681C32]">
                    {amountInWords(invoice.grand_total)}
                  </p>
                </div>

                <div className="p-3 border border-[#E9DFE2] rounded-lg space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block">
                    Store Banking / Payment Coordinates:
                  </span>
                  <p>Bank: <strong>{store.bank_name || 'State Bank of India'}</strong></p>
                  <p>A/c No: <strong className="font-mono">{store.bank_account || '38291048291'}</strong></p>
                  <p>IFSC: <strong className="font-mono">{store.bank_ifsc || 'SBIN0001234'}</strong></p>
                  <p>UPI ID: <strong className="font-mono text-[#681C32]">{store.upi_id || '9516331531@upi'}</strong></p>
                </div>
              </div>

              {/* Right Column: Totals Breakup */}
              <div className="p-4 bg-[#F8F5F0] rounded-lg border border-[#E9DFE2] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#776C70]">Subtotal:</span>
                  <span className="font-mono font-semibold">{formatINR(invoice.subtotal)}</span>
                </div>
                {invoice.discount_total > 0 && (
                  <div className="flex justify-between text-[#28794B]">
                    <span>Discount:</span>
                    <span className="font-mono">- {formatINR(invoice.discount_total)}</span>
                  </div>
                )}
                {isGstRegistered && (
                  <>
                    <div className="flex justify-between text-[#776C70]">
                      <span>Taxable Value:</span>
                      <span className="font-mono">{formatINR(invoice.taxable_amount)}</span>
                    </div>
                    {invoice.is_interstate ? (
                      <div className="flex justify-between text-[#776C70]">
                        <span>IGST:</span>
                        <span className="font-mono">{formatINR(invoice.igst_amount)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-[#776C70]">
                          <span>CGST:</span>
                          <span className="font-mono">{formatINR(invoice.cgst_amount)}</span>
                        </div>
                        <div className="flex justify-between text-[#776C70]">
                          <span>SGST:</span>
                          <span className="font-mono">{formatINR(invoice.sgst_amount)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                {invoice.round_off !== 0 && (
                  <div className="flex justify-between text-[#776C70]">
                    <span>Round Off:</span>
                    <span className="font-mono">{invoice.round_off > 0 ? `+${invoice.round_off}` : invoice.round_off}</span>
                  </div>
                )}
                <div className="pt-2 border-t-2 border-[#681C32] flex justify-between items-center text-sm font-bold text-[#681C32]">
                  <span>GRAND TOTAL:</span>
                  <span className="text-xl font-mono">{formatINR(invoice.grand_total)}</span>
                </div>
              </div>
            </div>

            {/* Terms & Signatory Block */}
            <div className="border-t border-[#E9DFE2] pt-4 grid grid-cols-2 gap-8 items-end text-[11px] text-[#776C70]">
              <div>
                <p className="font-bold text-[#30262A] uppercase mb-1">Terms & Conditions:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-[10px]">
                  <li>Goods once sold will be exchanged within 7 days with original tags and bill.</li>
                  <li>No cash or card refunds. Exchange against other garments or store credit only.</li>
                  <li>All disputes subject to Jabalpur, Madhya Pradesh jurisdiction.</li>
                </ol>
              </div>

              <div className="text-right">
                <p className="font-bold text-[#30262A] mb-8">For {store.brand_name || 'AAVNI ETHNICWEAR'}</p>
                <div className="border-t border-dashed border-[#776C70] pt-1 inline-block text-center min-w-44">
                  <span className="text-[10px] text-[#776C70]">Authorized Signatory</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
