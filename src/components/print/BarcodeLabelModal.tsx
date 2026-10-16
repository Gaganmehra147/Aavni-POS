import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { formatINR } from '../../lib/currency';
import { X, Printer } from 'lucide-react';

interface BarcodeLabelModalProps {
  items: Array<{
    name: string;
    design_code: string;
    size: string;
    color: string;
    barcode: string;
    selling_price: number;
    mrp?: number;
    quantity: number;
  }>;
  onClose: () => void;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ items, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate barcode SVGs
    items.forEach((item, itemIdx) => {
      for (let q = 0; q < (item.quantity || 1); q++) {
        const svgId = `barcode-${itemIdx}-${q}`;
        const el = document.getElementById(svgId);
        if (el) {
          try {
            JsBarcode(el, item.barcode, {
              format: 'CODE128',
              width: 1.5,
              height: 35,
              displayValue: true,
              fontSize: 10,
              font: 'monospace',
              margin: 0
            });
          } catch (e) {
            console.error(e);
          }
        }
      }
    });
  }, [items]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-[#E9DFE2] overflow-hidden my-8">
        {/* Controls */}
        <div className="no-print bg-[#681C32] px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="font-serif font-bold text-lg">Barcode & Price Tag Labels</h2>
            <p className="text-xs text-white/80">Printable adhesive apparel tags</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white text-[#681C32] hover:bg-[#F6EBF0] text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Labels</span>
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Label Grid */}
        <div ref={containerRef} className="p-6 bg-[#F8F5F0] overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {items.flatMap((item, itemIdx) =>
              Array.from({ length: item.quantity || 1 }).map((_, q) => (
                <div
                  key={`${itemIdx}-${q}`}
                  className="bg-white p-3 rounded-lg border border-[#E9DFE2] shadow-xs text-center font-sans space-y-1"
                >
                  <div className="text-[11px] font-serif font-bold tracking-wider text-[#681C32] uppercase">
                    AAVNI ETHNICWEAR
                  </div>
                  <div className="text-[10px] font-bold text-[#30262A] truncate">
                    {item.name}
                  </div>
                  <div className="text-[9px] text-[#776C70] flex justify-center space-x-2">
                    <span>Code: {item.design_code}</span>
                    <span>•</span>
                    <span className="font-bold text-[#681C32]">Size: {item.size}</span>
                  </div>
                  <div className="text-[9px] text-[#776C70]">Color: {item.color}</div>

                  {/* Barcode SVG container */}
                  <div className="flex justify-center my-1">
                    <svg id={`barcode-${itemIdx}-${q}`} className="max-w-full"></svg>
                  </div>

                  {/* Price */}
                  <div className="pt-1 border-t border-dashed border-[#E9DFE2]">
                    {item.mrp && item.mrp > item.selling_price && (
                      <span className="text-[10px] text-[#776C70] line-through mr-1.5 font-mono">
                        MRP: {formatINR(item.mrp)}
                      </span>
                    )}
                    <span className="text-xs font-bold font-mono text-[#681C32]">
                      ₹{item.selling_price}
                    </span>
                    <div className="text-[8px] text-[#776C70] uppercase">
                      (Incl. of all taxes)
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
