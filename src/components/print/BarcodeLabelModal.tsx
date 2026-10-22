import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { formatINR } from '../../lib/currency';
import { X, Printer, Copy, Layers, Trash2, Plus, Minus, Tag, Palette, Info, Sliders, Zap, CheckCircle2, RotateCw } from 'lucide-react';

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
export type LabelSize = '38x25' | '50x25' | '35x25';
export type ThemeMode = 'color' | 'thermal-sharp' | 'preprinted';

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ items: initialItems, onClose }) => {
  const [labelList, setLabelList] = useState<BarcodeItem[]>(() =>
    initialItems.map((item) => ({
      ...item,
      quantity: Math.max(1, item.quantity || 1)
    }))
  );

  // Default to user's exact roll from photo: 2-UP (38mm x 25mm per sticker, 2 across)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tvs-2up');
  const [labelSize, setLabelSize] = useState<LabelSize>('38x25');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [themeMode, setThemeMode] = useState<ThemeMode>('color');
  const [centerGap, setCenterGap] = useState<'2mm' | '3mm' | '4mm'>('2mm');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showBorder, setShowBorder] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Compute total labels count
  const totalLabels = labelList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  // Dimensions based on chosen label size
  const config = {
    '38x25': {
      labelWidth: '38mm',
      labelHeight: '24.5mm',
      rowWidth: centerGap === '2mm' ? '78mm' : centerGap === '3mm' ? '79mm' : '80mm',
      barcodeWidth: 0.95,
      barcodeHeight: 18,
      fontSize: 7.5,
      isCompact: true
    },
    '35x25': {
      labelWidth: '35mm',
      labelHeight: '24.5mm',
      rowWidth: centerGap === '2mm' ? '72mm' : centerGap === '3mm' ? '73mm' : '74mm',
      barcodeWidth: 0.9,
      barcodeHeight: 17,
      fontSize: 7,
      isCompact: true
    },
    '50x25': {
      labelWidth: '50mm',
      labelHeight: '24.5mm',
      rowWidth: centerGap === '2mm' ? '102mm' : centerGap === '3mm' ? '103mm' : '104mm',
      barcodeWidth: 1.15,
      barcodeHeight: 20,
      fontSize: 8,
      isCompact: false
    }
  }[labelSize];

  // Re-generate Barcode SVGs whenever labelList, layoutMode, labelSize or themeMode changes
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
              const isThermal = layoutMode === 'tvs-2up' || layoutMode === 'thermal-1up';
              JsBarcode(el, item.barcode || '0000000000', {
                format: 'CODE128',
                width: isThermal ? config.barcodeWidth : 1.25,
                height: isThermal ? config.barcodeHeight : 26,
                displayValue: true,
                fontSize: isThermal ? config.fontSize : 9,
                font: 'monospace',
                textMargin: 1,
                margin: 0,
                background: '#ffffff',
                lineColor: '#000000' // Optical scanners require 100% black bars
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
  }, [labelList, layoutMode, labelSize, themeMode, centerGap]);

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

  // Tag renderer component calibrated for TVS LP 46 NEO 203 DPI print head
  const renderTagContent = (item: BarcodeItem, tagIndex: number, isTvs: boolean = false) => {
    const isColor = themeMode === 'color';
    const isPreprinted = themeMode === 'preprinted';
    const isSmall = isTvs && (labelSize === '38x25' || labelSize === '35x25');

    return (
      <div className="h-full w-full flex flex-col justify-between text-center select-none bg-white">
        {/* Top Header: Brand Name */}
        {!isPreprinted && showStoreName && (
          <div
            className={`w-full py-0.5 px-0.5 rounded-xs tracking-wider font-serif uppercase font-bold ${
              isSmall ? 'text-[7px] leading-none' : isTvs ? 'text-[8px] leading-none' : 'text-[9px] leading-tight'
            } ${
              isColor
                ? 'bg-[#681C32] text-white'
                : 'bg-black text-white'
            }`}
          >
            AAVNI ETHNICWEAR
          </div>
        )}

        {/* Product Name */}
        <div
          className={`font-bold truncate px-0.5 leading-tight ${
            isSmall ? 'text-[7.5px] mt-0.5' : isTvs ? 'text-[8.5px] mt-0.5' : 'text-[10px]'
          } ${isColor ? 'text-[#30262A]' : 'text-black'}`}
          title={item.name}
        >
          {item.name}
        </div>

        {/* Variant Info: Size • Color • Design Code */}
        <div
          className={`flex items-center justify-center space-x-0.5 px-0.5 leading-none ${
            isSmall ? 'text-[6.5px]' : isTvs ? 'text-[7.5px]' : 'text-[8.5px]'
          }`}
        >
          <span
            className={`font-bold px-0.5 py-0.2 rounded ${
              isColor
                ? 'bg-[#FBF4F6] text-[#681C32] border border-[#E9DFE2]'
                : 'border border-black text-black'
            }`}
          >
            {item.size || 'Free'}
          </span>
          <span className="text-gray-400">•</span>
          <span className="truncate max-w-[45px] font-medium text-gray-800">
            {item.color || 'Std'}
          </span>
          <span className="text-gray-400">•</span>
          <span className="font-mono text-gray-700 truncate max-w-[45px] font-semibold">
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
            isColor ? 'border-[#E9DFE2] bg-[#FDFBFA]' : 'border-t border-black'
          }`}
        >
          {showMrp && item.mrp && item.mrp > item.selling_price && (
            <span
              className={`line-through font-mono ${
                isSmall ? 'text-[6.5px]' : isTvs ? 'text-[7.5px]' : 'text-[8.5px]'
              } text-gray-500`}
            >
              ₹{item.mrp}
            </span>
          )}
          <span
            className={`font-extrabold font-mono ${
              isSmall ? 'text-[9.5px]' : isTvs ? 'text-[10.5px]' : 'text-xs'
            } ${
              isColor
                ? 'text-[#681C32] bg-[#FBF4F6] px-1 rounded'
                : 'text-black font-black'
            }`}
          >
            ₹{item.selling_price}
          </span>
          <span
            className={`${
              isSmall ? 'text-[5.5px]' : isTvs ? 'text-[6.5px]' : 'text-[7.5px]'
            } text-gray-500 font-medium`}
          >
            (Incl.)
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
                <span>TVS Barcode Label Printer</span>
                <span className="text-[10.5px] bg-amber-400 text-stone-950 font-sans font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                  <Zap className="w-3 h-3 text-stone-950 fill-stone-950" />
                  <span>2-UP Roll Calibrated</span>
                </span>
              </h2>
              <p className="text-xs text-white/80 flex items-center space-x-2">
                <span>
                  Total Labels to Print: <strong className="text-amber-300 font-mono text-sm">{totalLabels}</strong>
                </span>
                {layoutMode === 'tvs-2up' && (
                  <span className="text-white/70">
                    • {tvsPairs.length} Roll Rows ({config.rowWidth} Web Width)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                showHelp
                  ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="TVS LP 46 NEO Hardware & Driver Setup Instructions"
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
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TVS LP 46 NEO Full Technical Hardware & Driver Guide Banner */}
        {showHelp && (
          <div className="no-print bg-stone-900 text-stone-100 border-b border-stone-800 px-6 py-4 text-xs space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>TVS LP 46 NEO Portrait Feed & Alignment Instructions</span>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-stone-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-stone-300">
              <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700">
                <div className="font-bold text-amber-300 mb-1">1. Chrome Print (Ctrl + P) - MOST IMPORTANT</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Destination:</strong> TVS LP 46 NEO</li>
                  <li><strong>Layout / Orientation:</strong> <span className="text-amber-300 font-bold">PORTRAIT (खड़ा / सीधा)</span> — Landscape mat rakhein!</li>
                  <li><strong>Paper Size:</strong> User-Defined <strong>{config.rowWidth} × 25mm</strong> (या 3.1" × 1")</li>
                  <li><strong>Margins:</strong> <strong>None (शून्य)</strong></li>
                  <li><strong>Scale:</strong> <strong>100% / Actual Size</strong></li>
                </ul>
              </div>

              <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700">
                <div className="font-bold text-amber-300 mb-1">2. Driver Printing Preferences (TVS Driver)</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Media Type:</strong> Label with Gaps (Transmissive Sensor)</li>
                  <li><strong>Print Method:</strong> Thermal Transfer (अगर Ribbon लगा है)</li>
                  <li><strong>Speed:</strong> 4 ips to 6 ips (100–150 mm/s)</li>
                  <li><strong>Darkness / Density:</strong> 9 to 11 (Deep black barcode)</li>
                </ul>
              </div>

              <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700">
                <div className="font-bold text-amber-300 mb-1">3. Gap Sensor Auto-Calibration (10 सेकंड में)</div>
                <p className="leading-relaxed">
                  अगर प्रिंटर लेबल के गैप को मिस कर रहा हो:<br/>
                  1. प्रिंटर का पावर <strong>OFF</strong> करें。<br/>
                  2. <strong>PAUSE/FEED</strong> बटन दबाए रखें और पावर <strong>ON</strong> करें。<br/>
                  3. <strong>3 बीप</strong> बजने पर बटन छोड़ें। प्रिंटर 25mm लेबल की हाइट auto detect कर लेगा!
                </p>
              </div>
            </div>
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
                title="Print 20 barcodes per item in 1 click"
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

            {/* Layout & Sticker Size Options */}
            <div className="flex items-center space-x-3 flex-wrap gap-y-1.5">
              <div className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#776C70]" />
                <span className="font-bold text-[#776C70]">Roll Type:</span>
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
                  className="px-2 py-1 bg-white border border-[#681C32] rounded-lg text-xs font-bold text-[#681C32] shadow-xs cursor-pointer focus:ring-1 focus:ring-[#681C32]"
                >
                  <option value="tvs-2up">TVS 2-UP Roll (2 Labels Side-by-Side)</option>
                  <option value="thermal-1up">Single Label Roll (1 Label Across)</option>
                  <option value="a4-24">A4 Sheet — 24 Labels (3 × 8 Grid)</option>
                  <option value="a4-40">A4 Sheet — 40 Labels (4 × 10 Grid)</option>
                </select>
              </div>

              {/* Exact Sticker Size for TVS 2-UP */}
              {layoutMode === 'tvs-2up' && (
                <div className="flex items-center space-x-1.5 pl-2 border-l border-[#E9DFE2]">
                  <span className="font-bold text-[#776C70]">Size:</span>
                  <select
                    value={labelSize}
                    onChange={(e) => setLabelSize(e.target.value as LabelSize)}
                    className="px-2 py-1 bg-white border border-emerald-600 rounded-lg text-xs font-bold text-emerald-800 shadow-xs cursor-pointer focus:ring-1 focus:ring-emerald-600"
                    title="Exact width and height of 1 sticker on your roll"
                  >
                    <option value="38x25">38mm × 25mm (Standard 2-Across Roll - Recommended)</option>
                    <option value="50x25">50mm × 25mm (Wide 4-Inch 2-Across Roll)</option>
                    <option value="35x25">35mm × 25mm (Compact 2-Across Roll)</option>
                  </select>
                </div>
              )}

              {/* Orientation Mode */}
              <div className="flex items-center space-x-1.5 pl-2 border-l border-[#E9DFE2]">
                <RotateCw className="w-3.5 h-3.5 text-[#776C70]" />
                <span className="font-bold text-[#776C70]">Orientation:</span>
                <select
                  value={printOrientation}
                  onChange={(e) => setPrintOrientation(e.target.value as 'portrait' | 'landscape')}
                  className="px-2 py-1 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#30262A] cursor-pointer"
                >
                  <option value="portrait">Portrait (सीधा / Upright)</option>
                  <option value="landscape">Landscape (आड़ा / 90°)</option>
                </select>
              </div>

              {/* Theme & Ribbon Style Selector */}
              <div className="flex items-center space-x-1.5 pl-2 border-l border-[#E9DFE2]">
                <Palette className="w-3.5 h-3.5 text-[#776C70]" />
                <span className="font-bold text-[#776C70]">Theme:</span>
                <select
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
                  className="px-2 py-1 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#30262A] cursor-pointer"
                >
                  <option value="color">Full Color (Aavni Maroon)</option>
                  <option value="thermal-sharp">TVS Ribbon B&W (203 DPI Crisp)</option>
                  <option value="preprinted">Pre-Printed Roll (Overlay)</option>
                </select>
              </div>

              {/* Gap Fine Tuning for TVS 2-UP */}
              {layoutMode === 'tvs-2up' && (
                <div className="flex items-center space-x-1.5 pl-2 border-l border-[#E9DFE2]">
                  <Sliders className="w-3.5 h-3.5 text-[#776C70]" />
                  <span className="font-bold text-[#776C70]">Center Gap:</span>
                  <select
                    value={centerGap}
                    onChange={(e) => setCenterGap(e.target.value as '2mm' | '3mm' | '4mm')}
                    className="px-2 py-1 bg-white border border-[#E9DFE2] rounded-lg text-xs font-mono font-semibold text-[#30262A] cursor-pointer"
                    title="Center gap between left and right sticker"
                  >
                    <option value="2mm">2 mm (Standard)</option>
                    <option value="3mm">3 mm</option>
                    <option value="4mm">4 mm</option>
                  </select>
                </div>
              )}

              {/* Toggles */}
              <div className="flex items-center space-x-2 pl-2 border-l border-[#E9DFE2]">
                {themeMode !== 'preprinted' && (
                  <label className="flex items-center space-x-1 cursor-pointer text-[#776C70]">
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => setShowStoreName(e.target.checked)}
                      className="rounded text-[#681C32]"
                    />
                    <span>Header</span>
                  </label>
                )}
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

          {/* Quick Notice Banner: Portrait vs Landscape Alert */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-[11px] text-emerald-900 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-700 font-bold">✓ TVS Roll Format:</span>
              <span>
                Sticker Size: <strong>{config.labelWidth} × {config.labelHeight}</strong> (2 stickers per row • Web Width: <strong>{config.rowWidth}</strong>)
              </span>
            </div>
            <div className="font-semibold text-emerald-800">
              Print Dialog me Layout: <strong>Portrait (सीधा)</strong> hi rakhein!
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
              {/* TVS LP 46 NEO 2-UP Roll (2 Labels per row) */}
              {layoutMode === 'tvs-2up' && (
                <div
                  className="tvs-2up-sheet mx-auto space-y-2.5 max-w-[420px]"
                  style={{ width: config.rowWidth }}
                >
                  <div className="no-print text-center text-[11px] font-mono text-[#776C70] mb-2 flex items-center justify-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    <span>TVS 2-UP Roll View ({config.labelWidth} × {config.labelHeight} • 2 Across • {centerGap} Gap)</span>
                  </div>

                  {tvsPairs.map((pair, pairIdx) => (
                    <div
                      key={pairIdx}
                      className="tvs-2up-row flex justify-between items-center mx-auto bg-stone-100 p-1 rounded border border-dashed border-stone-300"
                      style={{
                        width: config.rowWidth,
                        minHeight: '25mm',
                        gap: centerGap,
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
                            width: config.labelWidth,
                            height: config.labelHeight,
                            minWidth: config.labelWidth,
                            maxWidth: config.labelWidth,
                            maxHeight: config.labelHeight,
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
                            width: config.labelWidth,
                            height: config.labelHeight,
                            minWidth: config.labelWidth,
                            maxWidth: config.labelWidth,
                            maxHeight: config.labelHeight,
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
                            width: config.labelWidth,
                            height: config.labelHeight,
                            minWidth: config.labelWidth,
                            maxWidth: config.labelWidth
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

      {/* Embedded Dynamic Print CSS for TVS LP 46 NEO Strict Portrait Feed */}
      <style>{`
        @media print {
          @page {
            ${
              layoutMode === 'tvs-2up'
                ? `size: ${printOrientation}; margin: 0mm;`
                : layoutMode === 'thermal-1up'
                ? `size: ${printOrientation}; margin: 0mm;`
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
            width: ${config.rowWidth} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }

          .tvs-2up-row {
            width: ${config.rowWidth} !important;
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
            width: ${config.labelWidth} !important;
            min-width: ${config.labelWidth} !important;
            max-width: ${config.labelWidth} !important;
            height: ${config.labelHeight} !important;
            max-height: ${config.labelHeight} !important;
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
