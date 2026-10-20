import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { formatINR } from '../../lib/currency';
import { X, Printer, Copy, Layers, Trash2, Plus, Minus, Tag, Palette, Info } from 'lucide-react';

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

export type LayoutMode = 'tvs-2up' | 'thermal-1up' | 'a4-24' | 'a4-40';

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ items: initialItems, onClose }) => {
  const [labelList, setLabelList] = useState<BarcodeItem[]>(() =>
    initialItems.map((item) => ({
      ...item,
      quantity: Math.max(1, item.quantity || 1)
    }))
  );

  // Default to user's TVS LP 46 NEO 2-UP roll (50mm x 25mm, 2 labels across)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tvs-2up');
  const [colorMode, setColorMode] = useState<'color' | 'mono'>('color');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showBorder, setShowBorder] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Compute total labels count
  const totalLabels = labelList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  // Re-generate Barcode SVGs whenever labelList, layoutMode, or colorMode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      let renderIndex = 0;
      labelList.forEach((item) => {
        const qty = Math.max(0, Number(item.quantity) || 0);
        for (let q = 0; q < qty; q++) {
          const svgId = `barcode-svg-${renderIndex}`;
          const el = document.getElementById(svgId);
          if (el) {
            try {
              // Barcode line sizing optimized for 50mm x 25mm label
              const isCompact = layoutMode === 'tvs-2up' || layoutMode === 'thermal-1up';
              JsBarcode(el, item.barcode || '0000000000', {
                format: 'CODE128',
                width: isCompact ? 1.15 : 1.25,
                height: isCompact ? 20 : 26,
                displayValue: true,
                fontSize: isCompact ? 8 : 9,
                font: 'monospace',
                textMargin: 1,
                margin: 0,
                background: '#ffffff',
                lineColor: '#000000' // Optical scanners require pure black bars
              });
            } catch (e) {
              console.error('Barcode render error:', e);
            }
          }
          renderIndex++;
        }
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [labelList, layoutMode, colorMode]);

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

  // For TVS 2-UP: group tags into pairs of 2 (left & right sticker)
  const tvsPairs: Array<Array<{ item: BarcodeItem; tagIndex: number }>> = [];
  for (let i = 0; i < flattenedTags.length; i += 2) {
    tvsPairs.push(flattenedTags.slice(i, i + 2));
  }

  // Tag renderer component
  const renderTagContent = (item: BarcodeItem, tagIndex: number, isTvs: boolean = false) => {
    const isColor = colorMode === 'color';
    return (
      <div
        className={`h-full w-full flex flex-col justify-between text-center select-none ${
          isColor ? 'bg-white' : 'bg-white'
        }`}
      >
        {/* Top Header: Brand Name */}
        {showStoreName && (
          <div
            className={`w-full py-0.5 px-1 rounded-xs tracking-wider font-serif uppercase font-bold ${
              isTvs ? 'text-[8px] leading-none' : 'text-[9px] leading-tight'
            } ${
              isColor
                ? 'bg-[#681C32] text-white'
                : 'border-b border-black text-black'
            }`}
          >
            AAVNI ETHNICWEAR
          </div>
        )}

        {/* Product Name */}
        <div
          className={`font-bold truncate px-0.5 leading-tight ${
            isTvs ? 'text-[8.5px] mt-0.5' : 'text-[10px]'
          } ${isColor ? 'text-[#30262A]' : 'text-black'}`}
          title={item.name}
        >
          {item.name}
        </div>

        {/* Variant Info: Size • Color • Design Code */}
        <div
          className={`flex items-center justify-center space-x-1 px-0.5 leading-none ${
            isTvs ? 'text-[7.5px]' : 'text-[8.5px]'
          }`}
        >
          <span
            className={`font-bold px-1 py-0.2 rounded ${
              isColor
                ? 'bg-[#FBF4F6] text-[#681C32] border border-[#E9DFE2]'
                : 'border border-black text-black'
            }`}
          >
            {item.size || 'Free'}
          </span>
          <span className="text-gray-400">•</span>
          <span className="truncate max-w-[55px] font-medium text-gray-700">
            {item.color || 'Standard'}
          </span>
          <span className="text-gray-400">•</span>
          <span className="font-mono text-gray-600 truncate max-w-[50px]">
            {item.design_code}
          </span>
        </div>

        {/* JsBarcode SVG Output (pure black & white for 100% optical scanner read) */}
        <div className="flex justify-center items-center my-0.5">
          <svg id={`barcode-svg-${tagIndex}`} className="max-w-full block"></svg>
        </div>

        {/* Price Tag Footer */}
        <div
          className={`pt-0.5 border-t flex items-center justify-center space-x-1 leading-tight ${
            isColor ? 'border-[#E9DFE2] bg-[#FDFBFA]' : 'border-dashed border-gray-400'
          }`}
        >
          {showMrp && item.mrp && item.mrp > item.selling_price && (
            <span
              className={`line-through font-mono ${
                isTvs ? 'text-[7.5px]' : 'text-[8.5px]'
              } text-gray-500`}
            >
              MRP:{formatINR(item.mrp)}
            </span>
          )}
          <span
            className={`font-extrabold font-mono ${
              isTvs ? 'text-[10.5px]' : 'text-xs'
            } ${
              isColor
                ? 'text-[#681C32] bg-[#FBF4F6] px-1 rounded'
                : 'text-black'
            }`}
          >
            ₹{item.selling_price}
          </span>
          <span
            className={`${
              isTvs ? 'text-[6.5px]' : 'text-[7.5px]'
            } text-gray-500`}
          >
            (Incl. Taxes)
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-[#E9DFE2] overflow-hidden my-4 flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="no-print bg-[#681C32] px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-inner">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg flex items-center space-x-2">
                <span>Barcode Label & Price Tag Printer</span>
                <span className="text-[11px] bg-amber-400 text-stone-900 font-sans font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  TVS LP 46 Ready
                </span>
              </h2>
              <p className="text-xs text-white/80">
                Total Labels to Print: <strong className="text-amber-300 font-mono text-sm">{totalLabels}</strong>
                {layoutMode === 'tvs-2up' && (
                  <span className="ml-2 text-white/70">
                    ({tvsPairs.length} roll passes / rows)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="TVS Printer Setup Instructions"
            >
              <Info className="w-4 h-4 text-amber-300" />
              <span>TVS Setup Guide</span>
            </button>
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

        {/* TVS LP 46 NEO Instructions Banner */}
        {showHelp && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs text-amber-950 flex items-start justify-between">
            <div className="space-y-1">
              <div className="font-bold text-amber-900 flex items-center space-x-1.5">
                <span>⚙️ TVS LP 46 NEO (6ips) Printer Settings (Windows Print Ctrl+P):</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900/90 pl-1">
                <li>
                  <strong>Destination / Printer:</strong> TVS LP 46 NEO
                </li>
                <li>
                  <strong>Paper Size:</strong> User-Defined / Custom <strong>104mm × 25mm</strong> (या 4.09" × 0.98", 2 Labels Across)
                </li>
                <li>
                  <strong>Margins:</strong> <strong>None (शून्य)</strong> — Zero margins set karein taaki border cut na ho
                </li>
                <li>
                  <strong>Scale:</strong> <strong>100% / Actual Size</strong> (Do NOT use 'Fit to printable area')
                </li>
                <li>
                  <strong>Color / Background Graphics:</strong> Browser print me <em>'More settings' → Check 'Background graphics' (पृष्ठभूमि ग्राफिक्स चालू रखें)</em> taaki brand color print ho!
                </li>
              </ul>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="text-amber-800 hover:text-amber-950 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Control Toolbar (Quantity Presets & Layout Options) */}
        <div className="no-print bg-[#FDFBFA] border-b border-[#E9DFE2] p-4 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Quick Bulk Presets */}
            <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
              <span className="font-bold text-[#776C70] flex items-center space-x-1">
                <Copy className="w-3.5 h-3.5" />
                <span>Bulk Qty:</span>
              </span>
              <button
                type="button"
                onClick={() => handleSetAllQty(1)}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#681C32] rounded-md font-mono font-bold text-[#30262A] cursor-pointer"
              >
                1 Each
              </button>
              <button
                type="button"
                onClick={() => handleSetAllQty(5)}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#681C32] rounded-md font-mono font-bold text-[#30262A] cursor-pointer"
              >
                5 Each
              </button>
              <button
                type="button"
                onClick={() => handleSetAllQty(10)}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#681C32] rounded-md font-mono font-bold text-[#30262A] cursor-pointer"
              >
                10 Each
              </button>
              <button
                type="button"
                onClick={() => handleSetAllQty(20)}
                className="px-3 py-1 bg-[#681C32] text-white rounded-md font-mono font-bold shadow-xs hover:bg-[#451222] cursor-pointer flex items-center space-x-1"
                title="Print 20 barcodes per item"
              >
                <span>★ 20 Each</span>
              </button>
              <button
                type="button"
                onClick={handleMatchStock}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] hover:border-[#28794B] text-[#28794B] rounded-md font-semibold cursor-pointer"
                title="Set label quantity equal to current stock of each item"
              >
                Match Stock
              </button>
            </div>

            {/* Layout Options */}
            <div className="flex items-center space-x-3 flex-wrap gap-y-1.5">
              <div className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#776C70]" />
                <span className="font-bold text-[#776C70]">Printer Roll:</span>
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
                  className="px-2.5 py-1 bg-white border border-[#681C32] rounded-lg text-xs font-bold text-[#681C32] shadow-xs cursor-pointer focus:ring-1 focus:ring-[#681C32]"
                >
                  <option value="tvs-2up">TVS LP 46 NEO — 2-UP Roll (50×25mm, 2 Across)</option>
                  <option value="thermal-1up">Single Label Roll (50×25mm, 1 Across)</option>
                  <option value="a4-24">A4 Sheet — 24 Labels (3 × 8 Grid)</option>
                  <option value="a4-40">A4 Sheet — 40 Labels (4 × 10 Grid)</option>
                </select>
              </div>

              {/* Color Mode Selector */}
              <div className="flex items-center space-x-1.5 pl-2 border-l border-[#E9DFE2]">
                <Palette className="w-3.5 h-3.5 text-[#776C70]" />
                <span className="font-bold text-[#776C70]">Theme:</span>
                <select
                  value={colorMode}
                  onChange={(e) => setColorMode(e.target.value as 'color' | 'mono')}
                  className="px-2 py-1 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#30262A] cursor-pointer"
                >
                  <option value="color">Full Color (Aavni Maroon)</option>
                  <option value="mono">Monochrome (B&W Thermal)</option>
                </select>
              </div>

              {/* Toggles */}
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
                  <span>MRP</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer text-[#776C70]">
                  <input
                    type="checkbox"
                    checked={showBorder}
                    onChange={(e) => setShowBorder(e.target.checked)}
                    className="rounded text-[#681C32]"
                  />
                  <span>Border</span>
                </label>
              </div>
            </div>
          </div>

          {/* Item-by-Item Quantity Table */}
          <div className="max-h-32 overflow-y-auto bg-white rounded-lg border border-[#E9DFE2] divide-y divide-[#E9DFE2] text-xs">
            {labelList.map((item, idx) => (
              <div key={idx} className="p-2 flex items-center justify-between hover:bg-[#F8F5F0]">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="font-bold text-[#30262A] truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-[#776C70] flex items-center space-x-2 font-mono">
                    <span className="font-bold text-[#681C32]">{item.size || 'Free'}</span>
                    <span>•</span>
                    <span>{item.color || 'Standard'}</span>
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
                      className="w-6 h-6 rounded bg-white text-[#30262A] hover:bg-gray-100 flex items-center justify-center font-bold cursor-pointer"
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
                      className="w-6 h-6 rounded bg-white text-[#30262A] hover:bg-gray-100 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Roll Preview & Print Surface Container */}
        <div className="flex-1 p-4 sm:p-6 bg-[#2B2326]/5 overflow-y-auto">
          {totalLabels === 0 ? (
            <div className="p-12 text-center text-sm text-[#776C70]">
              No labels to print. Set quantity above.
            </div>
          ) : (
            <div className="printable-barcode-sheet mx-auto">
              {/* TVS LP 46 NEO 2-UP Roll (2 Labels per row: 50mm x 25mm each) */}
              {layoutMode === 'tvs-2up' && (
                <div className="tvs-2up-sheet mx-auto space-y-3 sm:space-y-4 max-w-[420px]">
                  <div className="no-print text-center text-[11px] font-mono text-[#776C70] mb-2 flex items-center justify-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    <span>TVS LP 46 NEO Roll View (2 Stickers / Row • 50mm × 25mm Each)</span>
                  </div>

                  {tvsPairs.map((pair, pairIdx) => (
                    <div
                      key={pairIdx}
                      className="tvs-2up-row flex justify-between items-center gap-[3mm] mx-auto bg-stone-100 p-1 rounded-lg border border-dashed border-stone-300"
                      style={{
                        width: '104mm',
                        minHeight: '26mm',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Left Sticker */}
                      {pair[0] && (
                        <div
                          className={`tvs-2up-tag bg-white shadow-xs rounded-[3px] p-[1mm] flex flex-col justify-between ${
                            showBorder ? 'border border-gray-300' : 'border border-transparent'
                          }`}
                          style={{
                            width: '50mm',
                            height: '24.5mm',
                            minWidth: '50mm',
                            maxWidth: '50mm',
                            maxHeight: '24.5mm',
                            boxSizing: 'border-box'
                          }}
                        >
                          {renderTagContent(pair[0].item, pair[0].tagIndex, true)}
                        </div>
                      )}

                      {/* Right Sticker */}
                      {pair[1] ? (
                        <div
                          className={`tvs-2up-tag bg-white shadow-xs rounded-[3px] p-[1mm] flex flex-col justify-between ${
                            showBorder ? 'border border-gray-300' : 'border border-transparent'
                          }`}
                          style={{
                            width: '50mm',
                            height: '24.5mm',
                            minWidth: '50mm',
                            maxWidth: '50mm',
                            maxHeight: '24.5mm',
                            boxSizing: 'border-box'
                          }}
                        >
                          {renderTagContent(pair[1].item, pair[1].tagIndex, true)}
                        </div>
                      ) : (
                        /* Empty placeholder for odd label counts to maintain left alignment */
                        <div
                          className="tvs-2up-tag opacity-0 pointer-events-none"
                          style={{
                            width: '50mm',
                            height: '24.5mm',
                            minWidth: '50mm',
                            maxWidth: '50mm'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Single Column Thermal Roll (50mm x 25mm) */}
              {layoutMode === 'thermal-1up' && (
                <div className="thermal-1up-sheet mx-auto space-y-3 max-w-[240px]">
                  {flattenedTags.map(({ item, tagIndex }) => (
                    <div
                      key={tagIndex}
                      className={`thermal-1up-tag mx-auto bg-white shadow-xs rounded-[3px] p-[1mm] flex flex-col justify-between ${
                        showBorder ? 'border border-gray-300' : 'border border-transparent'
                      }`}
                      style={{
                        width: '50mm',
                        height: '24.5mm',
                        maxHeight: '24.5mm',
                        boxSizing: 'border-box'
                      }}
                    >
                      {renderTagContent(item, tagIndex, true)}
                    </div>
                  ))}
                </div>
              )}

              {/* A4 Sheet Grid Layouts */}
              {(layoutMode === 'a4-24' || layoutMode === 'a4-40') && (
                <div
                  className={`a4-sheet bg-white p-4 shadow-sm border border-gray-200 mx-auto ${
                    layoutMode === 'a4-40'
                      ? 'grid grid-cols-4 gap-2 max-w-4xl'
                      : 'grid grid-cols-3 gap-3 max-w-4xl'
                  }`}
                >
                  {flattenedTags.map(({ item, tagIndex }) => (
                    <div
                      key={tagIndex}
                      className={`a4-tag bg-white p-2 rounded flex flex-col justify-between ${
                        showBorder ? 'border border-gray-300' : 'border border-transparent'
                      }`}
                      style={{ minHeight: '32mm', boxSizing: 'border-box' }}
                    >
                      {renderTagContent(item, tagIndex, false)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Embedded Dynamic Print CSS for TVS LP 46 NEO & Label Roll Precision */}
      <style>{`
        @media print {
          @page {
            ${
              layoutMode === 'tvs-2up'
                ? 'size: 104mm 25mm; margin: 0mm;'
                : layoutMode === 'thermal-1up'
                ? 'size: 50mm 25mm; margin: 0mm;'
                : 'size: A4 portrait; margin: 5mm;'
            }
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 100% !important;
          }

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
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
          }

          /* TVS LP 46 NEO 2-UP ROLL PRINT RULES */
          .tvs-2up-sheet {
            width: 104mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }

          .tvs-2up-row {
            width: 104mm !important;
            height: 25mm !important;
            max-height: 25mm !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: stretch !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 0.5mm !important;
            background: transparent !important;
            border: none !important;
            box-sizing: border-box !important;
          }

          .tvs-2up-tag {
            width: 50mm !important;
            min-width: 50mm !important;
            max-width: 50mm !important;
            height: 24.5mm !important;
            max-height: 24.5mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 0.6mm 1mm !important;
            background: #ffffff !important;
            border-radius: 2mm !important;
            ${showBorder ? 'border: 0.5px solid #d1d5db !important;' : 'border: none !important;'}
          }

          /* SINGLE LABEL ROLL PRINT RULES */
          .thermal-1up-sheet {
            width: 50mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .thermal-1up-tag {
            width: 50mm !important;
            height: 25mm !important;
            max-height: 25mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            padding: 0.8mm 1.2mm !important;
            background: #ffffff !important;
            ${showBorder ? 'border: 0.5px solid #d1d5db !important;' : 'border: none !important;'}
          }

          /* A4 PRINT RULES */
          .a4-sheet {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }

          .a4-tag {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            ${showBorder ? 'border: 0.5px dashed #ccc !important;' : 'border: none !important;'}
          }
        }
      `}</style>
    </div>
  );
};
