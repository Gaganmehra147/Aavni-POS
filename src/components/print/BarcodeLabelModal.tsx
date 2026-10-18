import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { formatINR } from '../../lib/currency';
import { X, Printer, Copy, Layers, Trash2, Plus, Minus, Tag } from 'lucide-react';

export interface BarcodeItem {
  id?: number | string;
  name: string;
  design_code: string;
  size: string;
  color: string;
  barcode: string;
  selling_price: number;
  mrp?: number;
  stock_quantity?: number;
  quantity: number;
}

interface BarcodeLabelModalProps {
  items: BarcodeItem[];
  onClose: () => void;
}

type LayoutMode = 'a4-24' | 'a4-40' | 'thermal-roll';

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ items: initialItems, onClose }) => {
  const [labelList, setLabelList] = useState<BarcodeItem[]>(() =>
    initialItems.map((item) => ({
      ...item,
      quantity: Math.max(1, item.quantity || 1)
    }))
  );

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('a4-24');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showMrp, setShowMrp] = useState(true);

  // Compute total labels count
  const totalLabels = labelList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  // Re-generate Barcode SVGs whenever labelList changes
  useEffect(() => {
    // Generate barcode SVGs with slight timeout to allow DOM elements to render
    const timer = setTimeout(() => {
      let renderIndex = 0;
      labelList.forEach((item) => {
        const qty = Math.max(0, Number(item.quantity) || 0);
        for (let q = 0; q < qty; q++) {
          const svgId = `barcode-svg-${renderIndex}`;
          const el = document.getElementById(svgId);
          if (el) {
            try {
              JsBarcode(el, item.barcode || '0000000000', {
                format: 'CODE128',
                width: layoutMode === 'thermal-roll' ? 1.6 : 1.3,
                height: layoutMode === 'thermal-roll' ? 32 : 28,
                displayValue: true,
                fontSize: 9,
                font: 'monospace',
                margin: 0
              });
            } catch (e) {
              console.error('Barcode render error:', e);
            }
          }
          renderIndex++;
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [labelList, layoutMode]);

  const handleUpdateQty = (idx: number, newQty: number) => {
    setLabelList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity: Math.max(0, newQty) } : item))
    );
  };

  const handleSetAllQty = (qty: number) => {
    setLabelList((prev) => prev.map((item) => ({ ...item, quantity: qty })));
  };

  const handleMatchStock = () => {
    setLabelList((prev) =>
      prev.map((item) => ({
        ...item,
        quantity: Math.max(1, item.stock_quantity || 1)
      }))
    );
  };

  const handleRemoveItem = (idx: number) => {
    setLabelList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePrint = () => {
    window.print();
  };

  // Flatten items into individual printable tags
  const flattenedTags: Array<{ item: BarcodeItem; tagIndex: number }> = [];
  let tagCounter = 0;
  labelList.forEach((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    for (let q = 0; q < qty; q++) {
      flattenedTags.push({ item, tagIndex: tagCounter++ });
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-[#E9DFE2] overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="no-print bg-[#681C32] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg">Bulk Barcode & Price Tag Printing</h2>
              <p className="text-xs text-white/80">
                Total Labels to Print: <strong className="text-amber-300 font-mono text-sm">{totalLabels}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              disabled={totalLabels === 0}
              className="px-5 py-2.5 bg-[#28794B] hover:bg-[#1E5D39] text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              <span>Print {totalLabels} Labels</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Control Toolbar (Quantity Presets & Layout Options) */}
        <div className="no-print bg-[#FDFBFA] border-b border-[#E9DFE2] p-4 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Quick Bulk Presets */}
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#776C70] flex items-center space-x-1">
                <Copy className="w-3.5 h-3.5" />
                <span>Quick Bulk Qty:</span>
              </span>
              <button
                type="button"
                onClick={() => handleSetAllQty(1)}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#681C32] rounded-md font-mono font-bold text-[#30262A]"
              >
                1 Each
              </button>
              <button
                type="button"
                onClick={() => handleSetAllQty(5)}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#681C32] rounded-md font-mono font-bold text-[#30262A]"
              >
                5 Each
              </button>
              <button
                type="button"
                onClick={() => handleSetAllQty(10)}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#681C32] rounded-md font-mono font-bold text-[#30262A]"
              >
                10 Each
              </button>
              <button
                type="button"
                onClick={() => handleSetAllQty(20)}
                className="px-3 py-1 bg-[#681C32] text-white rounded-md font-mono font-bold shadow-xs hover:bg-[#451222]"
                title="Print 20 barcodes per item"
              >
                ★ 20 Each
              </button>
              <button
                type="button"
                onClick={handleMatchStock}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#28794B] text-[#28794B] rounded-md font-semibold"
                title="Set label quantity equal to current stock of each item"
              >
                Match Stock
              </button>
            </div>

            {/* Layout Options */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#776C70]" />
                <span className="font-bold text-[#776C70]">Layout:</span>
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
                  className="px-2.5 py-1 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#30262A]"
                >
                  <option value="a4-24">A4 Sheet — 24 Labels (3 × 8 Grid)</option>
                  <option value="a4-40">A4 Sheet — 40 Labels (4 × 10 Grid)</option>
                  <option value="thermal-roll">Thermal Roll — 50mm × 25mm (1 per page)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pl-2 border-l border-[#E9DFE2]">
                <label className="flex items-center space-x-1 cursor-pointer text-[#776C70]">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded text-[#681C32]"
                  />
                  <span>Store Header</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer text-[#776C70]">
                  <input
                    type="checkbox"
                    checked={showMrp}
                    onChange={(e) => setShowMrp(e.target.checked)}
                    className="rounded text-[#681C32]"
                  />
                  <span>Show MRP</span>
                </label>
              </div>
            </div>
          </div>

          {/* Item-by-Item Quantity Table (Collapsible / Compact) */}
          <div className="max-h-36 overflow-y-auto bg-white rounded-lg border border-[#E9DFE2] divide-y divide-[#E9DFE2] text-xs">
            {labelList.map((item, idx) => (
              <div key={idx} className="p-2 flex items-center justify-between hover:bg-[#F8F5F0]">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="font-bold text-[#30262A] truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-[#776C70] flex items-center space-x-2 font-mono">
                    <span className="font-bold text-[#681C32]">{item.size}</span>
                    <span>•</span>
                    <span>{item.color}</span>
                    <span>•</span>
                    <span>Code: {item.design_code}</span>
                    <span>•</span>
                    <span className="font-bold">{item.barcode}</span>
                    {item.stock_quantity !== undefined && (
                      <span className="text-gray-500">(In Stock: {item.stock_quantity})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="flex items-center space-x-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, (item.quantity || 1) - 1)}
                      className="w-6 h-6 rounded bg-white text-[#30262A] hover:bg-gray-100 flex items-center justify-center font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value, 10) || 0)}
                      className="w-12 text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, (item.quantity || 1) + 1)}
                      className="w-6 h-6 rounded bg-white text-[#30262A] hover:bg-gray-100 flex items-center justify-center font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Printable Label Sheet Container */}
        <div className="flex-1 p-6 bg-[#EFEBE9] overflow-y-auto">
          {totalLabels === 0 ? (
            <div className="p-12 text-center text-sm text-[#776C70]">
              No labels to print. Set quantity above.
            </div>
          ) : (
            <div
              className={`printable-barcode-sheet bg-white mx-auto shadow-sm p-4 ${
                layoutMode === 'thermal-roll'
                  ? 'max-w-xs space-y-4'
                  : layoutMode === 'a4-40'
                  ? 'max-w-4xl grid grid-cols-4 gap-2 border border-gray-200'
                  : 'max-w-4xl grid grid-cols-3 gap-3 border border-gray-200'
              }`}
            >
              {flattenedTags.map(({ item, tagIndex }) => (
                <div
                  key={tagIndex}
                  className={`barcode-tag bg-white border border-gray-300 rounded p-2 text-center font-sans space-y-1 relative ${
                    layoutMode === 'thermal-roll' ? 'w-full page-break-after' : ''
                  }`}
                >
                  {showStoreName && (
                    <div className="text-[10px] font-serif font-bold tracking-wider text-[#681C32] uppercase">
                      AAVNI ETHNICWEAR
                    </div>
                  )}

                  <div className="text-[10px] font-bold text-[#30262A] truncate leading-tight">
                    {item.name}
                  </div>

                  <div className="text-[9px] text-[#776C70] flex justify-center items-center space-x-1.5 leading-none">
                    <span className="font-bold text-[#681C32]">{item.size}</span>
                    <span>•</span>
                    <span className="truncate">{item.color}</span>
                    <span>•</span>
                    <span>{item.design_code}</span>
                  </div>

                  {/* SVG Barcode rendered via JsBarcode */}
                  <div className="flex justify-center my-0.5">
                    <svg id={`barcode-svg-${tagIndex}`} className="max-w-full"></svg>
                  </div>

                  {/* Price Tag Footer */}
                  <div className="pt-0.5 border-t border-dashed border-gray-300 leading-tight">
                    {showMrp && item.mrp && item.mrp > item.selling_price && (
                      <span className="text-[9px] text-gray-500 line-through mr-1 font-mono">
                        MRP:{formatINR(item.mrp)}
                      </span>
                    )}
                    <span className="text-xs font-bold font-mono text-[#681C32]">
                      ₹{item.selling_price}
                    </span>
                    <span className="text-[8px] text-gray-500 ml-1">
                      (Incl. Taxes)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Embedded Print CSS for exact label sizing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .printable-barcode-sheet,
          .printable-barcode-sheet * {
            visibility: visible;
          }
          .printable-barcode-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 5mm !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .barcode-tag {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px dashed #ccc !important;
          }
          .page-break-after {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
};
