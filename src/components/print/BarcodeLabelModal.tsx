import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { formatINR } from '../../lib/currency';
import {
  X,
  Printer,
  Copy,
  Layers,
  Trash2,
  Plus,
  Minus,
  Tag,
  Palette,
  Info,
  Sliders,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  HelpCircle,
  Sparkles
} from 'lucide-react';

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

// Storage key for persisting calibrated dimensions
const STORAGE_KEY = 'aavni_tvs_printer_dimensions_v4_simple_sharp';

export interface LabelDimensions {
  rollWidth: number;      // e.g. 103.5 (in mm total media width)
  labelWidth: number;     // e.g. 41 (in mm individual label width)
  labelHeight: number;    // e.g. 23 (in mm individual label height)
  columns: number;        // e.g. 2 (columns across)
  horizontalGap: number;  // e.g. 0 (in mm between columns)
  leftMargin: number;     // e.g. 12 (in mm left side margin/offset)
  verticalGap: number;    // e.g. 2.5 (in mm vertical gap between rows)
  topOffset: number;      // e.g. 0 (in mm top offset)
}

// Default initial values matching user's confirmed measurements from image
const DEFAULT_DIMENSIONS: LabelDimensions = {
  rollWidth: 103.5,
  labelWidth: 41,
  labelHeight: 23,
  columns: 2,
  horizontalGap: 0,
  leftMargin: 12,
  verticalGap: 2.5,
  topOffset: 0
};

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ items: initialItems, onClose }) => {
  const [labelList, setLabelList] = useState<BarcodeItem[]>(() =>
    initialItems.map((item) => ({
      ...item,
      quantity: Math.max(1, item.quantity || 1)
    }))
  );

  // Load saved dimensions or initialize with 103.5mm / 41x23mm defaults
  const [dims, setDims] = useState<LabelDimensions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_DIMENSIONS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to parse saved label dimensions:', e);
    }
    return DEFAULT_DIMENSIONS;
  });

  // Settings & Toggles
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showBorder, setShowBorder] = useState(true);

  // Test Print mode (1 row only = columns labels)
  const [isTestPrint, setIsTestPrint] = useState(false);

  // Save dimensions to localStorage whenever changed
  const updateDim = (key: keyof LabelDimensions, value: number) => {
    setDims((prev) => {
      const updated = { ...prev, [key]: Number(value) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save printer dimensions:', e);
      }
      return updated;
    });
  };

  const handleApplyPreset = (preset: 'tvs-103.5mm-41x23' | 'tvs-80mm-35x25' | 'tvs-104mm-50x25' | 'tvs-single-50x25') => {
    let newDims: LabelDimensions;
    if (preset === 'tvs-103.5mm-41x23') {
      newDims = { rollWidth: 103.5, labelWidth: 41, labelHeight: 23, columns: 2, horizontalGap: 0, leftMargin: 12, verticalGap: 2.5, topOffset: 0 };
    } else if (preset === 'tvs-80mm-35x25') {
      newDims = { rollWidth: 80, labelWidth: 35, labelHeight: 25, columns: 2, horizontalGap: 4, leftMargin: 3, verticalGap: 0, topOffset: 0 };
    } else if (preset === 'tvs-104mm-50x25') {
      newDims = { rollWidth: 104, labelWidth: 50, labelHeight: 25, columns: 2, horizontalGap: 3, leftMargin: 0.5, verticalGap: 2.5, topOffset: 0 };
    } else {
      newDims = { rollWidth: 50, labelWidth: 50, labelHeight: 25, columns: 1, horizontalGap: 0, leftMargin: 0, verticalGap: 2.5, topOffset: 0 };
    }
    setDims(newDims);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newDims));
    } catch (e) {
      console.error(e);
    }
  };

  // Compute total labels count
  const totalLabels = labelList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  // Calculations for media boundaries
  const totalColumnsWidth = (dims.columns * dims.labelWidth) + ((dims.columns - 1) * dims.horizontalGap);
  const rightMargin = Number((dims.rollWidth - (dims.leftMargin + totalColumnsWidth)).toFixed(2));
  const isWidthExceeded = rightMargin < 0;

  // Auto-calculated compact barcode scaling for razor-sharp 203 DPI thermal print
  const barcodeScale = {
    width: 1, // Integer 1px module width prevents fractional antialiasing blur
    height: Math.max(10, Math.min(13, Math.round(dims.labelHeight * 0.44))) // Compact height (10-13px)
  };

  // Re-generate Barcode SVGs with crispEdges whenever labelList or dimensions change
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
              // Compact Code128 with NO SVG text (avoids fuzzy text rendering)
              JsBarcode(el, item.barcode || item.design_code || '0000000000', {
                format: 'CODE128',
                width: barcodeScale.width,
                height: barcodeScale.height,
                displayValue: false, // Pure bars - keeps barcode compact and crisp
                margin: 0,
                background: '#ffffff',
                lineColor: '#000000'
              });

              // Force crispEdges on SVG root and all rect bars
              el.setAttribute('shape-rendering', 'crispEdges');
              const rects = el.querySelectorAll('rect');
              rects.forEach((r) => r.setAttribute('shape-rendering', 'crispEdges'));
            } catch (e) {
              console.error('Barcode render error:', e);
            }
          }
          renderIndex++;
        }
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [labelList, dims, isTestPrint]);

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

  // Print execution: Full or 1-Row Test Print
  const handlePrintAll = () => {
    setIsTestPrint(false);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintTestRow = () => {
    setIsTestPrint(true);
    setTimeout(() => {
      window.print();
    }, 50);
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

  // If in Test Print mode, only print 1 row (number of labels = dims.columns)
  const printableTags = isTestPrint ? flattenedTags.slice(0, dims.columns) : flattenedTags;

  // Group tags into rows of `dims.columns`
  const rows: Array<Array<{ item: BarcodeItem; tagIndex: number } | null>> = [];
  for (let i = 0; i < printableTags.length; i += dims.columns) {
    const chunk = printableTags.slice(i, i + dims.columns);
    const paddedRow: Array<{ item: BarcodeItem; tagIndex: number } | null> = [...chunk];
    while (paddedRow.length < dims.columns) {
      paddedRow.push(null);
    }
    rows.push(paddedRow);
  }

  // Helper to format Size cleanly: L, M, XL, XXL, FREE SIZE
  const formatSize = (raw: string) => {
    const s = (raw || '').trim().toUpperCase();
    if (!s || s === 'FREE' || s === 'STD' || s === 'FREESIZE' || s === 'STANDARD') {
      return 'FREE SIZE';
    }
    return s;
  };

  // Tag renderer: Minimalist, Simple & Razor-Sharp layout
  const renderTagContent = (item: BarcodeItem, tagIndex: number) => {
    const sizeDisplay = formatSize(item.size);
    const skuDisplay = item.design_code || item.barcode || 'SKU-001';

    return (
      <div className="h-full w-full flex flex-col justify-between select-none bg-white box-border overflow-hidden px-[1.2mm] py-[0.8mm] text-black">
        {/* Top Header: Brand (Aavni) & Size (e.g. L, M, XL, XXL, FREE SIZE) */}
        <div className="flex items-center justify-between border-b border-black pb-0.5 leading-none">
          <span className="font-serif font-black tracking-wider text-[9.5px] uppercase text-black">
            Aavni
          </span>
          <span className="font-sans font-black text-[9px] bg-black text-white px-1 py-0.5 rounded-xs tracking-wide">
            {sizeDisplay}
          </span>
        </div>

        {/* Center: Compact, Crisp 100% Monochrome Barcode */}
        <div className="flex items-center justify-center my-auto py-0.5 overflow-hidden">
          <svg
            id={`barcode-svg-${tagIndex}`}
            className="max-w-full block"
            style={{ shapeRendering: 'crispEdges' }}
          ></svg>
        </div>

        {/* Bottom Footer: SKU ID on Left & Price on Right */}
        <div className="flex items-center justify-between border-t border-black pt-0.5 leading-none text-black">
          <span className="font-mono font-bold text-[8.5px] truncate max-w-[62%] text-left" title={skuDisplay}>
            SKU: {skuDisplay}
          </span>
          <span className="font-mono font-black text-[10.5px] text-right whitespace-nowrap">
            ₹{item.selling_price}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl border border-[#E9DFE2] overflow-hidden my-4 flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="no-print bg-[#681C32] px-6 py-3.5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-inner">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg flex items-center space-x-2">
                <span>TVS New 46 IP Barcode Printer</span>
                <span className="text-[10px] bg-emerald-500 text-white font-sans font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {dims.rollWidth}mm Roll • {dims.labelWidth}×{dims.labelHeight}mm ({dims.columns} Across)
                </span>
              </h2>
              <p className="text-xs text-white/80 flex items-center space-x-2">
                <span>
                  Total Labels: <strong className="text-amber-300 font-mono text-sm">{totalLabels}</strong>
                </span>
                <span className="text-white/60">•</span>
                <span>
                  L-Margin: {dims.leftMargin}mm • Gap: {dims.horizontalGap}mm • R-Margin: {rightMargin}mm
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                showConfigPanel
                  ? 'bg-amber-400 text-stone-900 border-amber-300 shadow-md'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
              title="Calibrate millimeter dimensions, roll width, margins and gaps"
            >
              <Sliders className="w-4 h-4" />
              <span>Label Dimensions ({dims.rollWidth}mm / {dims.labelWidth}×{dims.labelHeight})</span>
            </button>

            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/20"
              title="TVS Driver & Anti-Blur Sharpness Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* 1-Row Test Print Button */}
            <button
              onClick={handlePrintTestRow}
              disabled={totalLabels === 0}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              title="Print only 1 row (2 labels) to verify alignment before printing entire roll"
            >
              <Eye className="w-4 h-4" />
              <span>Test Print (1 Row)</span>
            </button>

            {/* Print All Button */}
            <button
              onClick={handlePrintAll}
              disabled={totalLabels === 0}
              className="px-5 py-2 bg-[#28794B] hover:bg-[#1E5C38] disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              title="Print all labels"
            >
              <Printer className="w-4 h-4" />
              <span>Print All ({totalLabels})</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configurable Label Roll Dimensions Panel */}
        {showConfigPanel && (
          <div className="no-print bg-[#FAF7F2] border-b border-[#E9DFE2] p-4 text-xs transition-all animate-in slide-in-from-top-2">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center space-x-2 text-[#681C32] font-bold">
                <Settings2 className="w-4 h-4" />
                <span className="uppercase tracking-wider">Exact Label Roll Measurements (in Millimeters)</span>
                <span className="text-stone-500 font-normal text-[11px]">
                  (Changes are auto-saved to localStorage)
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-stone-500 font-semibold text-[11px]">Roll Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('tvs-103.5mm-41x23')}
                  className="px-2 py-0.5 bg-emerald-50 border border-emerald-400 text-emerald-900 rounded text-[11px] font-bold cursor-pointer"
                >
                  ★ 103.5mm Roll (41×23mm 2-UP)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('tvs-80mm-35x25')}
                  className="px-2 py-0.5 bg-white border border-stone-300 hover:border-[#681C32] rounded text-[11px] font-semibold text-stone-700 cursor-pointer"
                >
                  80mm Roll (35×25mm 2-UP)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('tvs-104mm-50x25')}
                  className="px-2 py-0.5 bg-white border border-stone-300 hover:border-[#681C32] rounded text-[11px] font-semibold text-stone-700 cursor-pointer"
                >
                  104mm Roll (50×25mm 2-UP)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('tvs-single-50x25')}
                  className="px-2 py-0.5 bg-white border border-stone-300 hover:border-[#681C32] rounded text-[11px] font-semibold text-stone-700 cursor-pointer"
                >
                  Single (50×25mm 1-UP)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 text-xs">
              {/* Total Roll Width */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Total Roll Width
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="30"
                    max="115"
                    value={dims.rollWidth}
                    onChange={(e) => updateDim('rollWidth', parseFloat(e.target.value) || 103.5)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs text-[#681C32]"
                  />
                  <span className="text-stone-400 text-[10px]">mm</span>
                </div>
              </div>

              {/* Individual Label Width */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Label Width
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="15"
                    max="108"
                    value={dims.labelWidth}
                    onChange={(e) => updateDim('labelWidth', parseFloat(e.target.value) || 41)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs text-[#681C32]"
                  />
                  <span className="text-stone-400 text-[10px]">mm</span>
                </div>
              </div>

              {/* Individual Label Height */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Label Height
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="10"
                    max="150"
                    value={dims.labelHeight}
                    onChange={(e) => updateDim('labelHeight', parseFloat(e.target.value) || 23)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs text-[#681C32]"
                  />
                  <span className="text-stone-400 text-[10px]">mm</span>
                </div>
              </div>

              {/* Columns Count */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Columns
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={dims.columns}
                    onChange={(e) => updateDim('columns', parseInt(e.target.value, 10) || 2)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs"
                  />
                  <span className="text-stone-400 text-[10px]">col</span>
                </div>
              </div>

              {/* Horizontal Center Gap */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Horizontal Gap
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={dims.horizontalGap}
                    onChange={(e) => updateDim('horizontalGap', parseFloat(e.target.value) || 0)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs"
                  />
                  <span className="text-stone-400 text-[10px]">mm</span>
                </div>
              </div>

              {/* Left Margin / Offset */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Left Margin
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="30"
                    value={dims.leftMargin}
                    onChange={(e) => updateDim('leftMargin', parseFloat(e.target.value) || 0)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs"
                  />
                  <span className="text-stone-400 text-[10px]">mm</span>
                </div>
              </div>

              {/* Vertical Gap between rows */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Vertical Gap
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={dims.verticalGap}
                    onChange={(e) => updateDim('verticalGap', parseFloat(e.target.value) || 0)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs"
                  />
                  <span className="text-stone-400 text-[10px]">mm</span>
                </div>
              </div>

              {/* Top Offset */}
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Top Offset
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.5"
                    min="-10"
                    max="20"
                    value={dims.topOffset}
                    onChange={(e) => updateDim('topOffset', parseFloat(e.target.value) || 0)}
                    className="w-full p-1 border border-stone-300 rounded font-mono font-bold text-center text-xs"
                  />
                  <span className="text-stone-400 text-[10px]">mm</span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between text-[11px] text-stone-600 gap-2">
              <div className="flex items-center space-x-3">
                <span className={`flex items-center space-x-1 font-semibold ${isWidthExceeded ? 'text-red-600' : 'text-emerald-700'}`}>
                  {isWidthExceeded ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  <span>
                    Columns Width: <strong>{totalColumnsWidth}mm</strong> | Left Margin: <strong>{dims.leftMargin}mm</strong> | Calculated Right Margin: <strong>{rightMargin}mm</strong>
                  </span>
                </span>
                {isWidthExceeded && (
                  <span className="text-red-600 font-bold">
                    ⚠️ Total width exceeds roll width ({dims.rollWidth}mm)! Reduce label width or gap.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setDims(DEFAULT_DIMENSIONS);
                  localStorage.removeItem(STORAGE_KEY);
                }}
                className="text-stone-500 hover:text-red-600 underline cursor-pointer"
              >
                Reset to 103.5mm / 41×23mm
              </button>
            </div>
          </div>
        )}

        {/* TVS Driver & Anti-Blur Sharpness Guide */}
        {showHelp && (
          <div className="no-print bg-stone-900 text-stone-100 border-b border-stone-800 px-6 py-4 text-xs space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Fix Blurry Thermal Barcodes (TVS New 46 IP / LP 46 Driver Calibration)</span>
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
                <div className="font-bold text-amber-300 mb-1">1. Why Was Print Blurry? (Blur Kyo Aa Raha Tha)</div>
                <p className="leading-relaxed text-stone-300">
                  Thermal printers (203 DPI) me sirf Black ya White dots hote hain. Browser anti-aliasing (gray pixels) aur TVS driver ka Halftone/Dithering barcode ki lines ko dhundla (fuzzy/blurry) bana deta hai. Software me ab 100% solid black 1-bit crisp vector render ho raha hai!
                </p>
              </div>

              <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700">
                <div className="font-bold text-amber-300 mb-1">2. Windows TVS Driver Preferences (Must Set)</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Dithering / Halftone:</strong> Set to <span className="text-emerald-400 font-bold">NONE</span> (Threshold / 1-bit Monochrome)</li>
                  <li><strong>Darkness / Density:</strong> Set to <span className="text-emerald-400 font-bold">10 – 12</span> (Solid black ribbon burn)</li>
                  <li><strong>Print Speed:</strong> Set to <span className="text-emerald-400 font-bold">2.5 to 3 ips</span> (Never use 5 ips)</li>
                  <li><strong>Media Type:</strong> Label with Gaps (Transmissive Sensor)</li>
                </ul>
              </div>

              <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700">
                <div className="font-bold text-amber-300 mb-1">3. Chrome / Edge Print Dialog (Ctrl + P)</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Destination:</strong> TVS New 46 IP / LP 46</li>
                  <li><strong>Layout:</strong> <span className="text-emerald-400 font-bold">PORTRAIT</span> (खड़ा / सीधा)</li>
                  <li><strong>Scale:</strong> <span className="text-emerald-400 font-bold">100% / Actual Size</span> (Do NOT use 'Fit to page')</li>
                  <li><strong>Margins:</strong> <span className="text-emerald-400 font-bold">None (शून्य)</span></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Control Toolbar */}
        <div className="no-print bg-[#FDFBFA] border-b border-[#E9DFE2] p-3.5 shrink-0 space-y-2.5">
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

            {/* Display Options */}
            <div className="flex items-center space-x-3 flex-wrap gap-y-1.5">
              <label className="flex items-center space-x-1.5 cursor-pointer text-[#30262A]">
                <input
                  type="checkbox"
                  checked={showBorder}
                  onChange={(e) => setShowBorder(e.target.checked)}
                  className="rounded text-[#681C32] focus:ring-0"
                />
                <span className="font-medium text-xs">Label Border</span>
              </label>

              <div className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                Simple Layout: Aavni • Size • SKU • Price
              </div>
            </div>
          </div>

          {/* Items Quantity Adjuster Bar */}
          <div className="space-y-1.5 pt-1 border-t border-[#E9DFE2]/60">
            {labelList.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-[#E9DFE2] shadow-2xs"
              >
                <div className="flex-1 truncate mr-3">
                  <span className="font-bold text-[#30262A]">{item.name}</span>
                  <span className="text-[#776C70] ml-2 font-mono">
                    [{formatSize(item.size)}] • SKU: {item.design_code} • ₹{item.selling_price}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <div className="flex items-center border border-[#E9DFE2] rounded-md overflow-hidden bg-[#FDFBFA]">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                      className="px-2 py-1 text-stone-600 hover:bg-[#E9DFE2] transition-colors cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value, 10) || 0)}
                      className="w-12 text-center text-xs font-mono font-bold py-1 bg-transparent border-x border-[#E9DFE2] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                      className="px-2 py-1 text-stone-600 hover:bg-[#E9DFE2] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 text-stone-400 hover:text-red-600 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Row Live Print Preview */}
        <div className="flex-1 p-4 sm:p-6 bg-[#2B2326]/5 overflow-y-auto">
          {totalLabels === 0 ? (
            <div className="p-12 text-center text-sm text-[#776C70]">
              No labels to print. Set label quantity above.
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="tvs-roll-sheet mx-auto"
                style={{
                  width: `${dims.rollWidth}mm`,
                  paddingLeft: dims.leftMargin > 0 ? `${dims.leftMargin}mm` : '0mm',
                  paddingTop: dims.topOffset > 0 ? `${dims.topOffset}mm` : '0mm'
                }}
              >
                <div className="no-print text-center text-[11px] font-mono text-[#776C70] mb-2.5 flex items-center justify-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>
                    Roll Media: {dims.rollWidth}mm Web • Labels: {dims.labelWidth}×{dims.labelHeight}mm ({dims.columns} Across) • Gaps: H-{dims.horizontalGap}mm, V-{dims.verticalGap}mm
                  </span>
                </div>

                {rows.map((rowCells, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="tvs-row"
                    style={{
                      width: `${dims.rollWidth}mm`,
                      height: `${dims.labelHeight}mm`,
                      marginBottom: dims.verticalGap > 0 ? `${dims.verticalGap}mm` : '0mm',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${dims.columns}, ${dims.labelWidth}mm)`,
                      columnGap: `${dims.horizontalGap}mm`,
                      alignItems: 'stretch'
                    }}
                  >
                    {rowCells.map((cell, colIdx) => (
                      <div
                        key={colIdx}
                        className={`tvs-label ${showBorder ? 'border border-dashed border-stone-300' : ''}`}
                        style={{
                          width: `${dims.labelWidth}mm`,
                          height: `${dims.labelHeight}mm`,
                          maxHeight: `${dims.labelHeight}mm`,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          borderRadius: '1.5mm',
                          background: '#ffffff'
                        }}
                      >
                        {cell ? renderTagContent(cell.item, cell.tagIndex) : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Dynamic Print CSS - Strictly Configured to 103.5mm Roll & Exact Label Layout */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm !important;
          }

          html, body {
            margin: 0mm !important;
            padding: 0mm !important;
            background: #ffffff !important;
            width: ${dims.rollWidth}mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            image-rendering: -webkit-optimize-contrast !important;
            image-rendering: pixelated !important;
            image-rendering: crisp-edges !important;
          }

          /* Force razor-sharp 1-bit rendering on barcodes */
          svg, svg * {
            shape-rendering: crispEdges !important;
            image-rendering: pixelated !important;
            image-rendering: crisp-edges !important;
          }

          /* Hide Everything outside the printable roll */
          .no-print,
          header,
          aside,
          nav,
          button,
          .fixed,
          .backdrop-blur-xs {
            display: none !important;
          }

          /* Reset all parent wrappers */
          body > div,
          main,
          div {
            box-shadow: none !important;
            background: transparent !important;
          }

          .max-w-6xl {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            width: ${dims.rollWidth}mm !important;
          }

          .tvs-roll-sheet {
            width: ${dims.rollWidth}mm !important;
            margin: 0mm !important;
            padding-left: ${dims.leftMargin}mm !important;
            padding-top: ${dims.topOffset}mm !important;
            background: transparent !important;
          }

          /* Exact Row Progression: One Physical Feed per Row */
          .tvs-row {
            width: ${dims.rollWidth}mm !important;
            height: ${dims.labelHeight}mm !important;
            max-height: ${dims.labelHeight}mm !important;
            display: grid !important;
            grid-template-columns: repeat(${dims.columns}, ${dims.labelWidth}mm) !important;
            column-gap: ${dims.horizontalGap}mm !important;
            margin-bottom: ${dims.verticalGap}mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .tvs-row:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
            margin-bottom: 0mm !important;
          }

          /* Individual Label Precision Box */
          .tvs-label {
            width: ${dims.labelWidth}mm !important;
            height: ${dims.labelHeight}mm !important;
            max-height: ${dims.labelHeight}mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 0.6mm 0.8mm !important;
            background: #ffffff !important;
            border-radius: 1.5mm !important;
            ${showBorder ? 'border: 0.5px solid #d1d5db !important;' : 'border: none !important;'}
          }
        }
      `}</style>
    </div>
  );
};
