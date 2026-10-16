import React from 'react';
import { formatINR } from '../../lib/currency';
import { X, Clock, Play, Trash2 } from 'lucide-react';

interface HoldCartModalProps {
  heldCarts: any[];
  onClose: () => void;
  onResume: (cart: any) => void;
  onDelete: (id: number) => Promise<void>;
}

export const HoldCartModal: React.FC<HoldCartModalProps> = ({
  heldCarts,
  onClose,
  onResume,
  onDelete
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#E9DFE2] overflow-hidden">
        <div className="bg-[#681C32] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-white/80" />
            <h2 className="font-serif font-bold text-lg">Held Carts ({heldCarts.length})</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {heldCarts.length === 0 ? (
            <div className="text-center py-8 text-[#776C70] text-sm">
              No parked carts found.
            </div>
          ) : (
            heldCarts.map((c) => {
              const items = c.cart_data?.items || [];
              const total = items.reduce((sum: number, it: any) => sum + (it.unit_price * it.quantity), 0);

              return (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-[#E9DFE2] bg-[#F8F5F0] hover:border-[#681C32] transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-sm text-[#30262A]">
                      {c.customer_name || 'Walk-in Customer'}
                      {c.customer_phone ? ` (${c.customer_phone})` : ''}
                    </div>
                    <div className="text-xs text-[#776C70] mt-0.5">
                      {items.length} items • Held at {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="font-mono font-bold text-sm text-[#681C32] mt-1">
                      {formatINR(total)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onResume(c)}
                      className="px-3 py-1.5 bg-[#681C32] hover:bg-[#451222] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume</span>
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="p-1.5 text-[#776C70] hover:text-[#B42332] rounded-lg transition-colors cursor-pointer"
                      title="Discard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
