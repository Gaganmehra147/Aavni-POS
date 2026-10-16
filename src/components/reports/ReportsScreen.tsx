import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  DollarSign,
  Package,
  Calendar,
  Download,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export const ReportsScreen: React.FC = () => {
  const [range, setRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeReportTab, setActiveReportTab] = useState<'DASHBOARD' | 'GST' | 'PROFIT_LOSS'>('DASHBOARD');

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [profitLossData, setProfitLossData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let queryParams = `range=${range}`;
      if (range === 'custom' && startDate && endDate) {
        queryParams += `&start_date=${startDate}&end_date=${endDate}`;
      }

      const [dash, gst, pl] = await Promise.all([
        api.get(`/reports/dashboard?${queryParams}`),
        api.get(`/reports/gst-report?${queryParams}`),
        api.get(`/reports/profit-loss?${queryParams}`)
      ]);

      setDashboardData(dash);
      setGstData(gst);
      setProfitLossData(pl);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [range, startDate, endDate]);

  const metrics = dashboardData?.metrics || {};

  return (
    <div className="p-6 space-y-6 bg-[#F8F5F0] min-h-[calc(100vh-4rem)]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
            Retail Analytics, GST & Profit Reports
          </h1>
          <p className="text-xs text-[#776C70]">
            Live store metrics, tax breakdown registers, COGS profit estimations, and inventory valuation
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-[#E9DFE2] shadow-xs text-xs">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                range === item.id
                  ? 'bg-[#681C32] text-white shadow-xs'
                  : 'text-[#776C70] hover:text-[#30262A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex border-b border-[#E9DFE2] space-x-3">
        <button
          onClick={() => setActiveReportTab('DASHBOARD')}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            activeReportTab === 'DASHBOARD' ? 'border-[#681C32] text-[#681C32]' : 'border-transparent text-[#776C70]'
          }`}
        >
          Executive Dashboard
        </button>
        <button
          onClick={() => setActiveReportTab('GST')}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            activeReportTab === 'GST' ? 'border-[#681C32] text-[#681C32]' : 'border-transparent text-[#776C70]'
          }`}
        >
          GST & HSN Tax Register
        </button>
        <button
          onClick={() => setActiveReportTab('PROFIT_LOSS')}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            activeReportTab === 'PROFIT_LOSS' ? 'border-[#681C32] text-[#681C32]' : 'border-transparent text-[#776C70]'
          }`}
        >
          Profit & Loss / Valuation
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm font-semibold text-[#776C70]">
          Aggregating store records...
        </div>
      ) : activeReportTab === 'DASHBOARD' ? (
        /* EXECUTIVE DASHBOARD */
        <div className="space-y-6">
          {/* Key Financial Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#E9DFE2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block">
                Net Sales Revenue
              </span>
              <div className="text-2xl font-bold font-mono text-[#681C32] mt-1">
                {formatINR(metrics.netSales)}
              </div>
              <div className="text-[11px] text-[#776C70] mt-1">
                {metrics.billsCount || 0} bills generated
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E9DFE2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block">
                Estimated Gross Profit
              </span>
              <div className="text-2xl font-bold font-mono text-[#28794B] mt-1">
                {formatINR(metrics.grossProfit)}
              </div>
              <div className="text-[11px] text-[#776C70] mt-1">
                COGS: {formatINR(metrics.cogs)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E9DFE2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block">
                Discounts & Refunds
              </span>
              <div className="text-2xl font-bold font-mono text-[#B42332] mt-1">
                {formatINR((metrics.discounts || 0) + (metrics.refundsTotal || 0))}
              </div>
              <div className="text-[11px] text-[#776C70] mt-1">
                Refunds: {formatINR(metrics.refundsTotal)} ({metrics.returnsCount || 0})
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E9DFE2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#776C70] block">
                Stock Attention
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold font-mono text-[#B7791F]">
                  {metrics.lowStockCount || 0}
                </span>
                <span className="text-xs text-[#776C70]">low stock</span>
                <span className="text-lg font-bold font-mono text-[#B42332]">
                  / {metrics.outOfStockCount || 0}
                </span>
                <span className="text-xs text-[#776C70]">out</span>
              </div>
              <div className="text-[11px] text-[#776C70] mt-1">
                Supplier Debt: {formatINR(metrics.supplierDebt)}
              </div>
            </div>
          </div>

          {/* Payment Collections Breakdown & Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Collections */}
            <div className="bg-white p-5 rounded-2xl border border-[#E9DFE2] shadow-xs">
              <h3 className="font-serif font-bold text-sm text-[#30262A] border-b border-[#E9DFE2] pb-3 mb-4">
                Collections by Payment Method
              </h3>
              {dashboardData?.paymentBreakdown?.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#776C70]">No collections in selected period.</div>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.paymentBreakdown?.map((p: any) => (
                    <div key={p.payment_mode} className="flex items-center justify-between p-3 rounded-xl bg-[#F8F5F0]">
                      <span className="font-bold text-xs uppercase text-[#30262A]">{p.payment_mode}</span>
                      <span className="font-mono font-bold text-sm text-[#681C32]">{formatINR(p.total_amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Selling Garments */}
            <div className="bg-white p-5 rounded-2xl border border-[#E9DFE2] shadow-xs">
              <h3 className="font-serif font-bold text-sm text-[#30262A] border-b border-[#E9DFE2] pb-3 mb-4">
                Top Moving Ethnic Designs
              </h3>
              {dashboardData?.topProducts?.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#776C70]">No sales logged in selected period.</div>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.topProducts?.map((tp: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs border-b border-[#E9DFE2] pb-2 last:border-b-0">
                      <div>
                        <div className="font-bold text-[#30262A]">{tp.product_name}</div>
                        <div className="text-[10px] text-[#776C70]">
                          Code: {tp.design_code} • {tp.size}/{tp.color}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#28794B]">{tp.units_sold} units sold</div>
                        <div className="font-mono text-[11px] text-[#776C70]">{formatINR(tp.revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeReportTab === 'GST' ? (
        /* GST & HSN TAX REGISTERS */
        <div className="space-y-6">
          {/* Rate-Wise Tax Slabs */}
          <div className="bg-white rounded-2xl border border-[#E9DFE2] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#F8F5F0] border-b border-[#E9DFE2] font-bold text-xs text-[#776C70]">
              GST Rate-Wise Sales Breakdown (Madhya Pradesh Intra-State vs Inter-State)
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white border-b text-[10px] font-bold text-[#776C70] uppercase">
                  <th className="p-3">GST Rate</th>
                  <th className="p-3 text-right">Taxable Value</th>
                  <th className="p-3 text-right">CGST</th>
                  <th className="p-3 text-right">SGST</th>
                  <th className="p-3 text-right">IGST</th>
                  <th className="p-3 text-right">Total Tax Collected</th>
                  <th className="p-3 text-right">Gross Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9DFE2]">
                {gstData?.rateWise?.map((rw: any) => (
                  <tr key={rw.gst_rate} className="hover:bg-[#FDFBFA]">
                    <td className="p-3 font-bold text-[#681C32]">{rw.gst_rate}% Slab</td>
                    <td className="p-3 text-right font-mono">{formatINR(rw.total_taxable)}</td>
                    <td className="p-3 text-right font-mono text-[#776C70]">{formatINR(rw.total_cgst)}</td>
                    <td className="p-3 text-right font-mono text-[#776C70]">{formatINR(rw.total_sgst)}</td>
                    <td className="p-3 text-right font-mono text-[#776C70]">{formatINR(rw.total_igst)}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#28794B]">{formatINR(rw.total_tax)}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#30262A]">{formatINR(rw.total_gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HSN-Wise Summary */}
          <div className="bg-white rounded-2xl border border-[#E9DFE2] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#F8F5F0] border-b border-[#E9DFE2] font-bold text-xs text-[#776C70]">
              HSN-Wise Summary (Apparel & Fabric Classifications)
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white border-b text-[10px] font-bold text-[#776C70] uppercase">
                  <th className="p-3">HSN Code</th>
                  <th className="p-3 text-center">Total Quantity</th>
                  <th className="p-3 text-right">Taxable Amount</th>
                  <th className="p-3 text-right">Total Tax</th>
                  <th className="p-3 text-right">Invoice Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9DFE2]">
                {gstData?.hsnWise?.map((hw: any) => (
                  <tr key={hw.hsn_code} className="hover:bg-[#FDFBFA]">
                    <td className="p-3 font-mono font-bold text-[#681C32]">{hw.hsn_code}</td>
                    <td className="p-3 text-center font-bold">{hw.total_quantity} pcs</td>
                    <td className="p-3 text-right font-mono">{formatINR(hw.total_taxable)}</td>
                    <td className="p-3 text-right font-mono text-[#28794B]">{formatINR(hw.total_tax)}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#30262A]">{formatINR(hw.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PROFIT & LOSS AND INVENTORY VALUATION */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Operating Profit & Loss */}
          <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-base text-[#30262A] border-b pb-2">
              Trading & Operating Result
            </h3>
            <div className="divide-y divide-[#E9DFE2] text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-[#776C70]">Taxable Revenue (Excl. GST):</span>
                <span className="font-mono font-bold text-[#30262A]">{formatINR(profitLossData?.taxableRevenue)}</span>
              </div>
              <div className="py-2.5 flex justify-between text-[#B42332]">
                <span>- Cost of Goods Sold (Purchase Cost):</span>
                <span className="font-mono font-bold">- {formatINR(profitLossData?.cogs)}</span>
              </div>
              <div className="py-2.5 flex justify-between font-bold text-[#28794B] bg-green-50 px-2 rounded">
                <span>= Gross Profit Margin:</span>
                <span className="font-mono text-sm">{formatINR(profitLossData?.grossProfit)}</span>
              </div>
              <div className="py-2.5 flex justify-between text-[#B42332]">
                <span>- Store Operating Expenses:</span>
                <span className="font-mono font-bold">- {formatINR(profitLossData?.expenses)}</span>
              </div>
              <div className="py-3 flex justify-between font-bold text-sm text-[#681C32] bg-[#F6EBF0] px-3 rounded-lg mt-2">
                <span>= Net Operating Result:</span>
                <span className="font-mono text-base">{formatINR(profitLossData?.netProfit)}</span>
              </div>
            </div>
          </div>

          {/* Current Stock Valuation */}
          <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-base text-[#30262A] border-b pb-2">
              Inventory Asset Valuation
            </h3>
            <div className="divide-y divide-[#E9DFE2] text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-[#776C70]">Total Units in Stock:</span>
                <span className="font-mono font-bold text-base text-[#30262A]">
                  {profitLossData?.inventoryValuation?.totalUnits} units
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#776C70]">Asset Cost Valuation (FIFO/Avg):</span>
                <span className="font-mono font-bold text-[#681C32]">
                  {formatINR(profitLossData?.inventoryValuation?.costValue)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#776C70]">Retail Market Value:</span>
                <span className="font-mono font-bold text-[#30262A]">
                  {formatINR(profitLossData?.inventoryValuation?.retailValue)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between font-bold text-[#28794B] bg-green-50 px-2 rounded">
                <span>Potential Inventory Gross Margin:</span>
                <span className="font-mono text-sm">
                  {formatINR(profitLossData?.inventoryValuation?.potentialMargin)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
