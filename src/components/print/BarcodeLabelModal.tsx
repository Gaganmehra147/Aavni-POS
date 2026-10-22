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
  HelpCircle
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

export type ThemeMode = 'color' | 'thermal-sharp' | 'preprinted';

// Storage key for persisting calibrated dimensions
const STORAGE_KEY = 'aavni_tvs_printer_dimensions_v3_confirmed';

export interface LabelDimensions {
  rollWidth: number;      // e.g. 80 (in mm total media width)
  labelWidth: number;     // e.g. 35 (in mm individual label width)
  labelHeight: number;    // e.g. 25 (in mm individual label height)
  columns: number;        // e.g. 2 (columns across)
  horizontalGap: number;  // e.g. 4 (in mm between columns)
  leftMargin: number;     // e.g. 3 (in mm left side margin/offset)
  verticalGap: number;    // e.g. 0 (in mm vertical gap between rows, reported 0mm / verify physically)
  topOffset: number;      // e.g. 0 (in mm top offset)
}

// Default initial values matching user's confirmed measurements
const DEFAULT_DIMENSIONS: LabelDimensions = {
  rollWidth: 80,
  labelWidth: 35,
  labelHeight: 25,
  columns: 2,
  horizontalGap: 4,
  leftMargin: 3,
  verticalGap: 0,
  topOffset: 0
};

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ items: initialItems, onClose }) => {
  const [labelList, setLabelList] = useState<BarcodeItem[]>(() =>
    initialItems.map((item) => ({
      ...item,
      quantity: Math.max(1, item.quantity || 1)
    }))
  );

  // Load saved dimensions or initialize with 35x25mm / 80mm roll defaults
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
  const [themeMode, setThemeMode] = useState<ThemeMode>('color');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
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

  const handleApplyPreset = (preset: 'tvs-80mm-35x25' | 'tvs-104mm-50x25' | 'tvs-single-50x25' | 'a4-sheet') => {
    let newDims: LabelDimensions;
    if (preset === 'tvs-80mm-35x25') {
      newDims = { rollWidth: 80, labelWidth: 35, labelHeight: 25, columns: 2, horizontalGap: 4, leftMargin: 3, verticalGap: 0, topOffset: 0 };
    } else if (preset === 'tvs-104mm-50x25') {
      newDims = { rollWidth: 104, labelWidth: 50, labelHeight: 25, columns: 2, horizontalGap: 3, leftMargin: 0.5, verticalGap: 2.5, topOffset: 0 };
    } else if (preset === 'tvs-single-50x25') {
      newDims = { rollWidth: 50, labelWidth: 50, labelHeight: 25, columns: 1, horizontalGap: 0, leftMargin: 0, verticalGap: 2.5, topOffset: 0 };
    } else {
      newDims = { rollWidth: 210, labelWidth: 65, labelHeight: 35, columns: 3, horizontalGap: 3, leftMargin: 5, verticalGap: 0, topOffset: 10 };
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

  // Auto-calculated barcode scaling based on label size
  const barcodeScale = {
    width: dims.labelWidth < 38 ? 0.88 : dims.labelWidth < 50 ? 1.0 : 1.2,
    height: Math.max(14, Math.min(22, Math.round(dims.labelHeight * 0.65))),
    fontSize: dims.labelWidth < 38 ? 7 : 8
  };

  // Re-generate Barcode SVGs whenever labelList or dimensions change
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
              JsBarcode(el, item.barcode || '0000000000', {
                format: 'CODE128',
                width: barcodeScale.width,
                height: barcodeScale.height,
                displayValue: true,
                fontSize: barcodeScale.fontSize,
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
    }, 100);

    return () => clearTimeout(timer);
  }, [labelList, dims, themeMode, isTestPrint]);

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

  // Tag renderer component calibrated to scale dynamically inside 35mm x 25mm
  const renderTagContent = (item: BarcodeItem, tagIndex: number) => {
    const isColor = themeMode === 'color';
    const isPreprinted = themeMode === 'preprinted';
    const isSmall = dims.labelWidth <= 38 || dims.labelHeight <= 25;

    return (
      <div className="h-full w-full flex flex-col justify-between text-center select-none bg-white box-border overflow-hidden p-[0.8mm]">
        {/* Top Header: Brand Name */}
        {!isPreprinted && showStoreName && (
          <div
            className={`w-full py-0.5 px-0.5 rounded-xs tracking-wider font-serif uppercase font-bold truncate ${
              isSmall ? 'text-[7px] leading-none' : 'text-[8.5px] leading-tight'
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
            isSmall ? 'text-[7.5px] mt-0.5' : 'text-[9px] mt-0.5'
          } ${isColor ? 'text-[#30262A]' : 'text-black'}`}
          title={item.name}
        >
          {item.name}
        </div>

        {/* Variant Info: Size • Color • Design Code */}
        <div
          className={`flex items-center justify-center space-x-0.5 px-0.5 leading-none ${
            isSmall ? 'text-[6.5px]' : 'text-[7.5px]'
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
          <span className="truncate max-w-[42px] font-medium text-gray-800">
            {item.color || 'Std'}
          </span>
          <span className="text-gray-400">•</span>
          <span className="font-mono text-gray-700 truncate max-w-[42px] font-semibold">
            {item.design_code}
          </span>
        </div>

        {/* JsBarcode SVG Output (pure black & white for 100% optical scanner read) */}
        <div className="flex justify-center items-center my-0.2 overflow-hidden">
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
                isSmall ? 'text-[6.5px]' : 'text-[7.5px]'
              } text-gray-500`}
            >
              ₹{item.mrp}
            </span>
          )}
          <span
            className={`font-extrabold font-mono ${
              isSmall ? 'text-[9.5px]' : 'text-[11px]'
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
              isSmall ? 'text-[5.5px]' : 'text-[6.5px]'
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
                  ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-sm font-bold'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Configure roll dimensions and alignment offsets"
            >
              <Settings2 className="w-4 h-4" />
              <span>Label Dimensions (80mm / 35×25)</span>
            </button>

            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`p-2 text-xs rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
                showHelp ? 'bg-amber-400 text-stone-950 border-amber-300' : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="TVS Driver & Calibration Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Test Print (1 Row Only) */}
            <button
              onClick={handlePrintTestRow}
              disabled={totalLabels === 0}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer transition-all disabled:opacity-40"
              title="Print just 1 row (2 labels) to verify alignment without wasting paper"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Test Print (1 Row)</span>
            </button>

            {/* Full Print */}
            <button
              onClick={handlePrintAll}
              disabled={totalLabels === 0}
              className="px-5 py-2 bg-[#28794B] hover:bg-[#1E5D39] text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              <span>Print All ({totalLabels})</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configurable Dimensions Panel */}
        {showConfigPanel && (
          <div className="no-print bg-[#FFFDF9] border-b-2 border-amber-300 p-4 shrink-0 shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-stone-800">
                <Sliders className="w-4 h-4 text-[#681C32]" />
                <span className="font-bold text-xs uppercase tracking-wider text-[#681C32]">
                  Exact Label Roll Measurements (in Millimeters)
                </span>
                <span className="text-[11px] text-stone-500">
                  (Changes are auto-saved to localStorage)
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-stone-500 font-semibold text-[11px]">Roll Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('tvs-80mm-35x25')}
                  className="px-2 py-0.5 bg-emerald-50 border border-emerald-400 text-emerald-900 rounded text-[11px] font-bold cursor-pointer"
                >
                  ★ 80mm Roll (35×25mm 2-UP)
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
                    max="110"
                    value={dims.rollWidth}
                    onChange={(e) => updateDim('rollWidth', parseFloat(e.target.value) || 80)}
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
                    onChange={(e) => updateDim('labelWidth', parseFloat(e.target.value) || 15)}
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
                    onChange={(e) => updateDim('labelHeight', parseFloat(e.target.value) || 10)}
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
                    onChange={(e) => updateDim('columns', parseInt(e.target.value, 10) || 1)}
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
                    max="20"
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
                    title="Vertical gap between consecutive rows (reported 0mm / verify physically on roll)"
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
                    title="Nudge print up/down"
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
                Reset to 80mm / 35×25mm
              </button>
            </div>
          </div>
        )}

        {/* TVS Driver & Gap Sensor Calibration Banner */}
        {showHelp && (
          <div className="no-print bg-stone-900 text-stone-100 border-b border-stone-800 px-6 py-4 text-xs space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>TVS New 46 IP / LP 46 Printer & Windows Driver Calibration Steps</span>
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
                <div className="font-bold text-amber-300 mb-1">1. Chrome / Edge Print Dialog (Ctrl + P)</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Destination:</strong> TVS New 46 IP / LP 46</li>
                  <li><strong>Layout:</strong> <span className="text-emerald-400 font-bold">PORTRAIT</span> (खड़ा / सीधा)</li>
                  <li><strong>Paper Size:</strong> User-Defined <strong>{dims.rollWidth}mm × {dims.labelHeight}mm</strong> (या 3.15" × 0.98")</li>
                  <li><strong>Margins:</strong> <strong>None (शून्य)</strong> — Zero margins ensure exact alignment</li>
                  <li><strong>Scale:</strong> <strong>100% / Actual Size</strong> (Do NOT use 'Fit to page')</li>
                </ul>
              </div>

              <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700">
                <div className="font-bold text-amber-300 mb-1">2. Windows Printer Preferences (TVS Driver)</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Media Type:</strong> Label with Gaps (Transmissive Sensor)</li>
                  <li><strong>Print Method:</strong> Thermal Transfer (Wax/Resin Ribbon) या Direct Thermal</li>
                  <li><strong>Print Speed:</strong> 4 ips to 6 ips (100–150 mm/s)</li>
                  <li><strong>Darkness / Density:</strong> 9 to 11 (Deep black barcode contrast)</li>
                </ul>
              </div>

              <div className="bg-stone-800/80 p-2.5 rounded-lg border border-stone-700">
                <div className="font-bold text-amber-300 mb-1">3. Gap Sensor Auto-Calibration (10 सेकंड में)</div>
                <p className="leading-relaxed">
                  अगर प्रिंटर लेबल के गैप को मिस कर रहा हो:<br/>
                  1. प्रिंटर का पावर <strong>OFF</strong> करें。<br/>
                  2. <strong>PAUSE/FEED</strong> बटन दबाए रखें और पावर <strong>ON</strong> करें。<br/>
                  3. <strong>3 बीप</strong> बजने पर बटन छोड़ें। प्रिंटर {dims.labelHeight}mm लेबल की हाइट ऑटो-कैलिब्रेट कर लेगा!
                </p>
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

            {/* Theme & Display Options */}
            <div className="flex items-center space-x-3 flex-wrap gap-y-1.5">
              {/* Theme Selector */}
              <div className="flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5 text-[#776C70]" />
                <span className="font-bold text-[#776C70]">Theme:</span>
                <select
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
                  className="px-2 py-1 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#30262A] cursor-pointer"
                >
                  <option value="color">Full Color (Aavni Maroon)</option>
                  <option value="thermal-sharp">TVS Ribbon B&W (203 DPI Crisp)</option>
                  <option value="preprinted">Pre-Printed Roll (Overlay Only)</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="flex items-center space-x-2.5 pl-2 border-l border-[#E9DFE2]">
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

          {/* Item-by-Item Quantity Table */}
          <div className="max-h-28 overflow-y-auto bg-white rounded-lg border border-[#E9DFE2] divide-y divide-[#E9DFE2] text-xs">
            {labelList.map((item, idx) => (
              <div key={idx} className="p-1.5 px-2.5 flex items-center justify-between hover:bg-[#F8F5F0]">
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
                      className="w-5 h-5 rounded bg-white text-[#30262A] hover:bg-gray-100 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value, 10) || 0)}
                      className="w-10 text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, (item.quantity || 1) + 1)}
                      className="w-5 h-5 rounded bg-white text-[#30262A] hover:bg-gray-100 flex items-center justify-center font-bold cursor-pointer"
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

        {/* Multi-Row Live Print Preview */}
        <div className="flex-1 p-4 sm:p-6 bg-[#2B2326]/5 overflow-y-auto">
          {totalLabels === 0 ? (
            <div className="p-12 text-center text-sm text-[#776C70]">
              No labels to print. Set quantity above.
            </div>
          ) : (
            <div className="printable-barcode-sheet mx-auto">
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

                {rows.map((rowItems, rowIdx) => (
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
                      boxSizing: 'border-box'
                    }}
                  >
                    {rowItems.map((cell, colIdx) => (
                      <div
                        key={colIdx}
                        className={`tvs-label ${
                          showBorder ? 'border border-gray-300' : 'border border-transparent'
                        } ${!cell ? 'opacity-0 pointer-events-none' : ''}`}
                        style={{
                          width: `${dims.labelWidth}mm`,
                          height: `${dims.labelHeight}mm`,
                          maxWidth: `${dims.labelWidth}mm`,
                          maxHeight: `${dims.labelHeight}mm`,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          borderRadius: '1.5mm'
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

      {/* Embedded Dynamic Print CSS - Strictly Configured to 80mm Roll & Exact Label Layout */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          html, body {
            margin: 0mm !important;
            padding: 0mm !important;
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
            left: 0mm !important;
            top: 0mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
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
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            margin: 0mm 0mm ${dims.verticalGap}mm 0mm !important;
            padding: 0mm !important;
            background: transparent !important;
            border: none !important;
            box-sizing: border-box !important;
          }

          /* Exact Column Positioning */
          .tvs-label {
            width: ${dims.labelWidth}mm !important;
            min-width: ${dims.labelWidth}mm !important;
            max-width: ${dims.labelWidth}mm !important;
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
