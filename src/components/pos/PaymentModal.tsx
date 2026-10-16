import React, { useState } from 'react';
import { Customer, PaymentItem } from '../../types';
import { formatINR } from '../../lib/currency';
import { X, Check, QrCode, CreditCard, Banknote, Split, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  grandTotal: number;
  customer: Customer | null;
  onClose: () => void;
  onSubmit: (payments: PaymentItem[]) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  grandTotal,
  customer,
  onClose,
  onSubmit
}) => {
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'CREDIT'>('CASH');
  const [tenderedCash, setTenderedCash] = useState<string>(String(grandTotal));
  const [upiRef, setUpiRef] = useState('');
  const [cardRef, setCardRef] = useState('');

  // Split payment state
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [splitCard, setSplitCard] = useState<number>(0);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const numTendered = Number(tenderedCash) || 0;
  const changeDue = Math.max(0, numTendered - grandTotal);

  const handleQuickCash = (amount: number) => {
    setTenderedCash(String(amount));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payments: PaymentItem[] = [];

      if (mode === 'CASH') {
        if (numTendered < grandTotal) {
          throw new Error(`Tendered cash (${formatINR(numTendered)}) is less than total (${formatINR(grandTotal)})`);
        }
        payments.push({
          payment_mode: 'CASH',
          amount: grandTotal,
          tendered_amount: numTendered,
          change_returned: changeDue
        });
      } else if (mode === 'UPI') {
        payments.push({
          payment_mode: 'UPI',
          amount: grandTotal,
          reference_no: upiRef || undefined
        });
      } else if (mode === 'CARD') {
        payments.push({
          payment_mode: 'CARD',
          amount: grandTotal,
          reference_no: cardRef || undefined
        });
      } else if (mode === 'CREDIT') {
        if (!customer) {
          throw new Error('Credit sales require an identified customer profile');
        }
        payments.push({
          payment_mode: 'CREDIT',
          amount: grandTotal
        });
      } else if (mode === 'SPLIT') {
        const totalSplit = (Number(splitCash) || 0) + (Number(splitUpi) || 0) + (Number(splitCard) || 0);
        if (Math.abs(totalSplit - grandTotal) > 0.05) {
          throw new Error(`Split sum (${formatINR(totalSplit)}) must equal invoice total (${formatINR(grandTotal)})`);
        }
        if (splitCash > 0) payments.push({ payment_mode: 'CASH', amount: splitCash });
        if (splitUpi > 0) payments.push({ payment_mode: 'UPI', amount: splitUpi });
        if (splitCard > 0) payments.push({ payment_mode: 'CARD', amount: splitCard });
      }

      await onSubmit(payments);
    } catch (err: any) {
      setError(err.message || 'Payment processing error');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-[#E9DFE2] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#681C32] px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="font-serif font-bold text-lg">Complete Payment</h2>
            <p className="text-xs text-white/80">Select payment method and finalize invoice</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Banner */}
        <div className="bg-[#F6EBF0] px-6 py-3 border-b border-[#E9DFE2] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#681C32]">Amount Payable</span>
          <span className="text-2xl font-bold font-mono text-[#681C32]">{formatINR(grandTotal)}</span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-[#B42332] rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Mode Tabs */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'CASH', label: 'Cash', icon: Banknote },
              { id: 'UPI', label: 'UPI / QR', icon: QrCode },
              { id: 'CARD', label: 'Card', icon: CreditCard },
              { id: 'SPLIT', label: 'Split', icon: Split },
              { id: 'CREDIT', label: 'Store Credit', icon: Check }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSel = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id as any);
                    if (tab.id === 'SPLIT') {
                      setSplitCash(grandTotal);
                      setSplitUpi(0);
                      setSplitCard(0);
                    }
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                    isSel
                      ? 'border-[#681C32] bg-[#F6EBF0] text-[#681C32] shadow-xs'
                      : 'border-[#E9DFE2] text-[#776C70] hover:bg-[#F8F5F0]'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* CASH Mode Fields */}
          {mode === 'CASH' && (
            <div className="space-y-4 bg-[#F8F5F0] p-4 rounded-xl border border-[#E9DFE2]">
              <div>
                <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                  Cash Tendered by Customer
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-[#776C70]">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={tenderedCash}
                    onChange={(e) => setTenderedCash(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-white border border-[#E9DFE2] rounded-lg text-lg font-mono font-bold text-[#30262A] focus:outline-none focus:border-[#681C32]"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2">
                {[grandTotal, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500, 2000, 5000].map(
                  (amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickCash(amt)}
                      className="px-2.5 py-1 text-xs bg-white border border-[#E9DFE2] rounded-md font-mono hover:bg-[#F6EBF0] hover:border-[#681C32] text-[#30262A]"
                    >
                      {formatINR(amt)}
                    </button>
                  )
                )}
              </div>

              {/* Change Returned Display */}
              <div className="flex items-center justify-between pt-2 border-t border-[#E9DFE2]">
                <span className="text-xs font-semibold text-[#776C70]">Change to Return:</span>
                <span
                  className={`text-lg font-mono font-bold ${
                    changeDue > 0 ? 'text-[#28794B]' : 'text-[#776C70]'
                  }`}
                >
                  {formatINR(changeDue)}
                </span>
              </div>
            </div>
          )}

          {/* UPI Mode Fields */}
          {mode === 'UPI' && (
            <div className="space-y-3 bg-[#F8F5F0] p-4 rounded-xl border border-[#E9DFE2] text-center">
              <div className="w-24 h-24 bg-white mx-auto rounded-lg border border-[#E9DFE2] p-2 flex flex-col items-center justify-center shadow-xs">
                <QrCode className="w-16 h-16 text-[#681C32]" />
              </div>
              <div className="text-xs font-mono font-bold text-[#681C32]">
                UPI ID: 9516331531@upi
              </div>
              <p className="text-[11px] text-[#776C70]">
                Scan QR with Google Pay, PhonePe, Paytm, or BHIM
              </p>
              <div>
                <input
                  type="text"
                  placeholder="Optional UTR / Ref No."
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E9DFE2] rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* CARD Mode Fields */}
          {mode === 'CARD' && (
            <div className="space-y-3 bg-[#F8F5F0] p-4 rounded-xl border border-[#E9DFE2]">
              <p className="text-xs text-[#776C70]">Swipe or tap card on POS terminal.</p>
              <input
                type="text"
                placeholder="Card Authorization / Last 4 digits (optional)"
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E9DFE2] rounded-lg text-xs"
              />
            </div>
          )}

          {/* SPLIT Mode Fields */}
          {mode === 'SPLIT' && (
            <div className="space-y-3 bg-[#F8F5F0] p-4 rounded-xl border border-[#E9DFE2]">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#776C70] block mb-1">Cash</label>
                  <input
                    type="number"
                    value={splitCash}
                    onChange={(e) => setSplitCash(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E9DFE2] rounded-md text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#776C70] block mb-1">UPI</label>
                  <input
                    type="number"
                    value={splitUpi}
                    onChange={(e) => setSplitUpi(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E9DFE2] rounded-md text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#776C70] block mb-1">Card</label>
                  <input
                    type="number"
                    value={splitCard}
                    onChange={(e) => setSplitCard(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E9DFE2] rounded-md text-sm font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs font-semibold pt-1">
                <span>Sum: {formatINR((Number(splitCash) || 0) + (Number(splitUpi) || 0) + (Number(splitCard) || 0))}</span>
                <span>Target: {formatINR(grandTotal)}</span>
              </div>
            </div>
          )}

          {/* CREDIT Mode Fields */}
          {mode === 'CREDIT' && (
            <div className="bg-[#F8F5F0] p-4 rounded-xl border border-[#E9DFE2] text-xs">
              {customer ? (
                <div>
                  <p className="font-semibold text-[#30262A]">Customer: {customer.name} ({customer.phone})</p>
                  <p className="text-[#776C70] mt-1">Current Balance: {formatINR(customer.credit_balance)}</p>
                  <p className="text-[#B7791F] mt-1">
                    Invoice will be posted to customer credit ledger.
                  </p>
                </div>
              ) : (
                <p className="text-[#B42332]">
                  ⚠️ Please select or add a customer to allow store credit billing.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E9DFE2]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#776C70] hover:bg-[#F8F5F0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (mode === 'CREDIT' && !customer)}
              className="px-6 py-2.5 bg-[#681C32] hover:bg-[#451222] text-white font-semibold rounded-lg text-sm shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Finalizing Sale...' : 'Confirm & Generate Bill'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
