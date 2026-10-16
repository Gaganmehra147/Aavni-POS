import React, { useState, useEffect } from 'react';
import { Invoice } from '../../types';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import { formatDeviceDate, formatDeviceTime } from '../../lib/datetime';
import { Receipt, Search, Printer, Calendar, Download, Eye } from 'lucide-react';

interface InvoicesListProps {
  onPrintThermal: (id: number) => void;
  onPrintA4: (id: number) => void;
}

export const InvoicesList: React.FC<InvoicesListProps> = ({ onPrintThermal, onPrintA4 }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let url = `/invoices?limit=100`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const res = await api.get<{ invoices: Invoice[] }>(url);
      setInvoices(res.invoices || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchInvoices, 200);
    return () => clearTimeout(t);
  }, [search, startDate, endDate]);

  const handleExportCSV = () => {
    if (invoices.length === 0) return;
    const rows = [
      ['Invoice Number', 'Date', 'Customer Name', 'Phone', 'Payment Mode', 'Subtotal', 'Discount', 'Taxable', 'GST Tax', 'Grand Total']
    ];

    invoices.forEach((i) => {
      rows.push([
        i.invoice_number,
        new Date(i.invoice_date).toLocaleDateString('en-IN'),
        i.customer_name,
        i.customer_phone || '',
        i.payment_modes || '',
        String(i.subtotal),
        String(i.discount_total),
        String(i.taxable_amount),
        String(i.tax_total),
        String(i.grand_total)
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aavni_sales_register_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8F5F0] min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
            Sales Register & Invoices
          </h1>
          <p className="text-xs text-[#776C70]">
            Review transaction history, reprint thermal slips, generate A4 tax bills, and export sales register
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-3 py-2 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#776C70] hover:bg-[#F6EBF0] flex items-center space-x-1.5 cursor-pointer shadow-xs self-start"
        >
          <Download className="w-4 h-4" />
          <span>Export Sales Register (CSV)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-[#E9DFE2] shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#776C70] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number, customer name, mobile..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs text-[#30262A] focus:outline-none focus:border-[#681C32]"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Calendar className="w-4 h-4 text-[#776C70]" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs"
          />
          <span className="text-[#776C70]">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#776C70]">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#776C70]">No invoices found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F5F0] border-b text-[10px] font-bold text-[#776C70] uppercase tracking-wider">
                  <th className="p-3">Invoice No.</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Items</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Print Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9DFE2]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FDFBFA]">
                    <td className="p-3 font-mono font-bold text-[#681C32]">{inv.invoice_number}</td>
                    <td className="p-3 text-[#776C70] font-mono text-[11px]">
                      {formatDeviceDate(inv.invoice_date)} • {formatDeviceTime(inv.invoice_date)}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[#30262A]">{inv.customer_name}</div>
                      {inv.customer_phone && (
                        <div className="text-[10px] text-[#776C70] font-mono">{inv.customer_phone}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-[#F6EBF0] text-[#681C32]">
                        {inv.payment_modes || 'CASH'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#776C70]">{inv.item_count || 1}</td>
                    <td className="p-3 text-right font-mono font-bold text-sm text-[#30262A]">
                      {formatINR(inv.grand_total)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => onPrintThermal(inv.id)}
                          className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:bg-[#681C32] hover:text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Thermal
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintA4(inv.id)}
                          className="px-2.5 py-1 bg-[#F6EBF0] text-[#681C32] hover:bg-[#681C32] hover:text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          A4 Tax Bill
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
