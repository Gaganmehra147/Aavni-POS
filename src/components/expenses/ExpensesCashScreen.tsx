import React, { useState, useEffect } from 'react';
import { CashSession } from '../../types';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import { Wallet, Plus, Lock, Unlock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ExpensesCashScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'EXPENSES' | 'DRAWER'>('EXPENSES');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Expense form
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expCategory, setExpCategory] = useState('Packaging');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expMode, setExpMode] = useState('CASH');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  // Cash Session Drawer
  const [session, setSession] = useState<CashSession | null>(null);
  const [liveSummary, setLiveSummary] = useState<any>(null);
  const [openCashAmount, setOpenCashAmount] = useState<number>(5000);
  const [openRemarks, setOpenRemarks] = useState('Morning drawer opening float');
  const [countedCash, setCountedCash] = useState<number>(0);
  const [closeRemarks, setCloseRemarks] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expRes, sessRes] = await Promise.all([
        api.get<{ expenses: any[] }>('/expenses'),
        api.get<{ session: CashSession | null; liveSummary: any }>('/expenses/cash-session/current')
      ]);
      setExpenses(expRes.expenses || []);
      setSession(sessRes.session);
      setLiveSummary(sessRes.liveSummary);
      if (sessRes.liveSummary?.expectedCash) {
        setCountedCash(sessRes.liveSummary.expectedCash);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expAmount <= 0) return;
    try {
      await api.post('/expenses', {
        expense_date: expDate,
        category: expCategory,
        amount: expAmount,
        payment_mode: expMode,
        description: expDesc
      });
      setShowAddExpense(false);
      setExpAmount(0);
      setExpDesc('');
      setMessage({ type: 'success', text: 'Expense logged successfully' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to record expense' });
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/expenses/cash-session/open', {
        opening_cash: openCashAmount,
        remarks: openRemarks
      });
      setMessage({ type: 'success', text: 'Cash session opened successfully' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to open session' });
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm('Are you sure you want to reconcile and close the drawer session?')) {
      try {
        const res = await api.post<{ expectedCash: number; counted: number; variance: number }>(
          '/expenses/cash-session/close',
          {
            actual_cash: countedCash,
            remarks: closeRemarks
          }
        );
        setMessage({
          type: 'success',
          text: `Cash session closed. Variance: ${formatINR(res.variance)}`
        });
        fetchData();
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to close session' });
      }
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8F5F0] min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
            Expenses & Cash Drawer Closing
          </h1>
          <p className="text-xs text-[#776C70]">
            Track store operating costs, alteration fees, packaging, and perform daily physical cash drawer reconciliation
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowAddExpense(true)}
            className="px-4 py-2 bg-[#681C32] hover:bg-[#451222] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E9DFE2] space-x-3">
        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'EXPENSES' ? 'border-[#681C32] text-[#681C32]' : 'border-transparent text-[#776C70]'
          }`}
        >
          Expense Ledger ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('DRAWER')}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'DRAWER' ? 'border-[#681C32] text-[#681C32]' : 'border-transparent text-[#776C70]'
          }`}
        >
          Daily Cash Drawer Session
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

      {/* EXPENSE LEDGER */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F5F0] border-b text-[10px] font-bold text-[#776C70] uppercase tracking-wider">
                <th className="p-3">Date</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3">Payment Mode</th>
                <th className="p-3">Recorded By</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9DFE2]">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-[#FDFBFA]">
                  <td className="p-3 font-mono text-[#776C70]">{e.expense_date}</td>
                  <td className="p-3">
                    <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-[#F6EBF0] text-[#681C32]">
                      {e.category}
                    </span>
                  </td>
                  <td className="p-3 text-[#30262A] font-medium">{e.description || '-'}</td>
                  <td className="p-3 font-semibold uppercase">{e.payment_mode}</td>
                  <td className="p-3 text-[#776C70]">{e.recorded_by_name || 'Staff'}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#B42332] text-sm">
                    {formatINR(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CASH DRAWER CLOSING VIEW */}
      {activeTab === 'DRAWER' && (
        <div className="space-y-6">
          {session ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Live Drawer Reconciliation Stats */}
              <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
                <div className="flex items-center space-x-2 text-[#28794B] font-bold text-sm">
                  <Unlock className="w-4 h-4" />
                  <span>Session Active (Opened by {session.opened_by_name})</span>
                </div>
                <div className="text-xs text-[#776C70]">
                  Opened at: {new Date(session.opened_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>

                <div className="divide-y divide-[#E9DFE2] text-xs pt-2">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-[#776C70]">Opening Cash Float:</span>
                    <span className="font-mono font-bold text-[#30262A]">{formatINR(liveSummary?.openingCash)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between text-[#28794B]">
                    <span>+ Cash Sales Collections:</span>
                    <span className="font-mono font-bold">{formatINR(liveSummary?.cashSales)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between text-[#B42332]">
                    <span>- Cash Refunds Given:</span>
                    <span className="font-mono font-bold">- {formatINR(liveSummary?.cashRefunds)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between text-[#B42332]">
                    <span>- Cash Expenses Paid:</span>
                    <span className="font-mono font-bold">- {formatINR(liveSummary?.cashExpenses)}</span>
                  </div>
                  <div className="py-3 flex justify-between font-bold text-sm text-[#681C32] bg-[#F6EBF0] px-3 rounded-lg mt-2">
                    <span>Expected Drawer Cash:</span>
                    <span className="font-mono text-base">{formatINR(liveSummary?.expectedCash)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#776C70] italic">
                  Note: Digital collections (UPI, Cards) are settled to the bank account and excluded from physical drawer balance.
                </p>
              </div>

              {/* End of Day Closing Form */}
              <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
                <h3 className="font-serif font-bold text-base text-[#30262A] flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-[#681C32]" />
                  <span>End-of-Day Physical Cash Drawer Closing</span>
                </h3>

                <form onSubmit={handleCloseSession} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-[#776C70] uppercase mb-1">
                      Actual Physical Cash Counted (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={countedCash}
                      onChange={(e) => setCountedCash(Number(e.target.value) || 0)}
                      className="w-full p-3 border-2 border-[#E9DFE2] focus:border-[#681C32] rounded-xl font-mono text-xl font-bold text-[#30262A] focus:outline-none"
                    />
                  </div>

                  {/* Live Variance */}
                  {liveSummary && (
                    <div className="p-3 rounded-xl border flex justify-between items-center text-xs">
                      <span className="font-bold text-[#776C70]">Drawer Variance:</span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          countedCash - liveSummary.expectedCash === 0
                            ? 'text-[#28794B]'
                            : countedCash - liveSummary.expectedCash < 0
                            ? 'text-[#B42332]'
                            : 'text-[#B7791F]'
                        }`}
                      >
                        {formatINR(countedCash - liveSummary.expectedCash)}
                        {countedCash - liveSummary.expectedCash === 0 ? ' (Balanced)' : countedCash - liveSummary.expectedCash < 0 ? ' (Shortage)' : ' (Surplus)'}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-[#776C70] mb-1">Manager / Cashier Remarks</label>
                    <textarea
                      rows={2}
                      value={closeRemarks}
                      onChange={(e) => setCloseRemarks(e.target.value)}
                      placeholder="Count verified by Manager Rajesh Sharma"
                      className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#681C32] hover:bg-[#451222] text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Close Session & Sign Off Drawer
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Open New Session Box */
            <div className="max-w-md mx-auto bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#F6EBF0] text-[#681C32] mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-lg text-[#30262A]">No Active Cash Session</h3>
              <p className="text-xs text-[#776C70]">
                Open a new drawer session with opening float to track cash flow throughout the retail shift.
              </p>

              <form onSubmit={handleOpenSession} className="space-y-3 text-xs text-left">
                <div>
                  <label className="block font-bold text-[#776C70] mb-1">Opening Cash Float (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={openCashAmount}
                    onChange={(e) => setOpenCashAmount(Number(e.target.value) || 0)}
                    className="w-full p-2.5 border border-[#E9DFE2] rounded-lg font-mono font-bold text-base"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#776C70] mb-1">Remarks</label>
                  <input
                    type="text"
                    value={openRemarks}
                    onChange={(e) => setOpenRemarks(e.target.value)}
                    className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-[#28794B] hover:bg-[#1E5D39] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Open Cash Drawer Session
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Record Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-[#E9DFE2]">
            <h3 className="font-serif font-bold text-base text-[#30262A] mb-4">Record Operating Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#776C70] mb-1">Category *</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg font-semibold"
                >
                  <option value="Packaging">Packaging (Carry bags, tags, ribbons)</option>
                  <option value="Alteration">Tailoring / Alteration Charges</option>
                  <option value="Staff Salary">Staff Daily Wage / Salary Advance</option>
                  <option value="Electricity">Electricity / Generator Fuel</option>
                  <option value="Rent">Store Rent</option>
                  <option value="Transport">Transport / Courier / Freight</option>
                  <option value="Marketing">Local Marketing / Social Media</option>
                  <option value="Refreshments">Tea / Snacks / Refreshments</option>
                  <option value="Maintenance">Store Cleaning & Maintenance</option>
                  <option value="Other">Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#776C70] mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={expAmount || ''}
                  onChange={(e) => setExpAmount(Number(e.target.value) || 0)}
                  className="w-full p-2 border border-[#E9DFE2] rounded-lg font-mono font-bold text-base text-[#B42332]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#776C70] mb-1">Payment Method</label>
                <select
                  value={expMode}
                  onChange={(e) => setExpMode(e.target.value)}
                  className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank Account</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#776C70] mb-1">Description / Bill Memo</label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Paid for 200 luxury boutique bags"
                  className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-3 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#681C32] text-white rounded-lg font-bold"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
