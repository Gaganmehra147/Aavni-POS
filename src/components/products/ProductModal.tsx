import React, { useState, useEffect } from 'react';
import { Category, Supplier } from '../../types';
import { api } from '../../lib/api';
import { X, Plus, Trash2, Sparkles, Barcode, Percent, TrendingUp, Sparkle } from 'lucide-react';

interface ProductModalProps {
  product?: any;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  categories,
  suppliers,
  onClose,
  onSuccess
}) => {
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name || '');
  const [categoryId, setCategoryId] = useState<number | ''>(product?.category_id || '');
  const [brand, setBrand] = useState(product?.brand || 'Aavni Heritage');
  const [designCode, setDesignCode] = useState(product?.design_code || `AAV-${Math.floor(100 + Math.random() * 900)}`);
  const [fabric, setFabric] = useState(product?.fabric || 'Chanderi Silk');
  const [hsnCode, setHsnCode] = useState(product?.hsn_code || '6204');
  const [gstRate, setGstRate] = useState<number>(product?.gst_rate || 5.0);
  const [supplierId, setSupplierId] = useState<number | ''>(product?.supplier_id || '');
  const [description, setDescription] = useState(product?.description || '');

  // Margin calculation state (default 50% = 1.5x markup)
  const [globalMargin, setGlobalMargin] = useState<number>(() => {
    const saved = localStorage.getItem('aavni_default_margin_percent');
    return saved ? Number(saved) : 50;
  });
  const [customMarginInput, setCustomMarginInput] = useState<string>('50');

  // Variants state with auto-computed margin_percent
  const [variants, setVariants] = useState<any[]>(() => {
    const defaultVars = product?.variants || [
      {
        sku: '',
        barcode: '',
        size: 'M',
        color: 'Maroon',
        purchase_cost: 1200,
        selling_price: 2499,
        mrp: 3499,
        stock_quantity: 5,
        reorder_threshold: 3
      }
    ];

    const savedMargin = Number(localStorage.getItem('aavni_default_margin_percent')) || 50;

    return defaultVars.map((v: any) => {
      const cost = Number(v.purchase_cost) || 0;
      const selling = Number(v.selling_price) || 0;
      let margin = savedMargin;
      if (cost > 0 && selling > 0) {
        margin = Math.round(((selling - cost) / cost) * 100);
      }
      return {
        ...v,
        margin_percent: margin
      };
    });
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This product and its variants will be removed.`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/products/${product.id}`);
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  // Auto-generate SKU & Barcode for variants
  const generateCodes = (idx: number, size: string, color: string) => {
    const cleanCode = designCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanColor = color.slice(0, 3).toUpperCase();
    const genSku = `${cleanCode}-${size}-${cleanColor}`;
    const genBarcode = `890${Date.now().toString().slice(-6)}${idx + 1}`;
    return { genSku, genBarcode };
  };

  // Apply a margin % across all variants and recalculate selling prices
  const applyMarginToAll = (marginPct: number) => {
    setGlobalMargin(marginPct);
    setCustomMarginInput(marginPct.toString());
    try {
      localStorage.setItem('aavni_default_margin_percent', marginPct.toString());
    } catch (_) {}

    setVariants((prev) =>
      prev.map((v) => {
        const cost = Number(v.purchase_cost) || 0;
        const newSelling = cost > 0 ? Math.round(cost * (1 + marginPct / 100)) : v.selling_price;
        const newMrp = Math.max(Number(v.mrp) || 0, Math.round(newSelling * 1.3));
        return {
          ...v,
          margin_percent: marginPct,
          selling_price: newSelling,
          mrp: newMrp
        };
      })
    );
  };

  const addVariantRow = () => {
    const idx = variants.length;
    const { genSku, genBarcode } = generateCodes(idx, 'L', 'Maroon');
    const lastVar = variants[variants.length - 1];
    const cost = Number(lastVar?.purchase_cost) || 1200;
    const margin = lastVar?.margin_percent !== undefined && lastVar.margin_percent !== ''
      ? Number(lastVar.margin_percent)
      : globalMargin;
    const selling = Math.round(cost * (1 + margin / 100));
    const mrp = Math.max(Number(lastVar?.mrp) || 0, Math.round(selling * 1.3));

    setVariants([
      ...variants,
      {
        sku: genSku,
        barcode: genBarcode,
        size: 'L',
        color: lastVar?.color || 'Maroon',
        purchase_cost: cost,
        margin_percent: margin,
        selling_price: selling,
        mrp: mrp,
        stock_quantity: 5,
        reorder_threshold: 3
      }
    ]);
  };

  const removeVariantRow = (idx: number) => {
    if (variants.length <= 1) {
      alert('Product must have at least one variant');
      return;
    }
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const updateVariantField = (idx: number, field: string, value: any) => {
    setVariants((prev) => {
      const updated = [...prev];
      const current = { ...updated[idx], [field]: value };

      // 1. Direct Cost change: Auto-calculate Selling Price using variant's Margin %
      if (field === 'purchase_cost') {
        const cost = Number(value) || 0;
        const margin = current.margin_percent !== undefined && current.margin_percent !== ''
          ? Number(current.margin_percent)
          : globalMargin;
        if (cost > 0) {
          const newSelling = Math.round(cost * (1 + margin / 100));
          current.selling_price = newSelling;
          if (!current.mrp || current.mrp < newSelling) {
            current.mrp = Math.round(newSelling * 1.3);
          }
        }
      }

      // 2. Direct Margin % change: Auto-calculate Selling Price
      if (field === 'margin_percent') {
        const marginVal = value === '' ? '' : Number(value);
        current.margin_percent = marginVal;
        const cost = Number(current.purchase_cost) || 0;
        if (cost > 0 && marginVal !== '') {
          const newSelling = Math.round(cost * (1 + Number(marginVal) / 100));
          current.selling_price = newSelling;
          if (!current.mrp || current.mrp < newSelling) {
            current.mrp = Math.round(newSelling * 1.3);
          }
        }
      }

      // 3. Direct Selling Price change: Auto-calculate Margin %
      if (field === 'selling_price') {
        const selling = Number(value) || 0;
        const cost = Number(current.purchase_cost) || 0;
        if (cost > 0) {
          current.margin_percent = Math.round(((selling - cost) / cost) * 100);
        }
        if (!current.mrp || current.mrp < selling) {
          current.mrp = Math.round(selling * 1.3);
        }
      }

      // Auto update SKU if size or color changed and user hasn't explicitly customized
      if (field === 'size' || field === 'color') {
        const { genSku } = generateCodes(idx, field === 'size' ? value : current.size, field === 'color' ? value : current.color);
        if (!current.sku || current.sku.startsWith(designCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())) {
          current.sku = genSku;
        }
      }

      updated[idx] = current;
      return updated;
    });
  };

  // Quick multi-size variant generator
  const generateSizes = (sizes: string[]) => {
    const baseColor = variants[0]?.color || 'Maroon';
    const baseCost = Number(variants[0]?.purchase_cost) || 1200;
    const baseMargin = variants[0]?.margin_percent !== undefined && variants[0].margin_percent !== ''
      ? Number(variants[0].margin_percent)
      : globalMargin;
    const basePrice = Math.round(baseCost * (1 + baseMargin / 100));
    const baseMrp = variants[0]?.mrp && variants[0].mrp >= basePrice ? variants[0].mrp : Math.round(basePrice * 1.3);

    const newVars = sizes.map((sz, idx) => {
      const { genSku, genBarcode } = generateCodes(idx, sz, baseColor);
      return {
        sku: genSku,
        barcode: genBarcode,
        size: sz,
        color: baseColor,
        purchase_cost: baseCost,
        margin_percent: baseMargin,
        selling_price: basePrice,
        mrp: baseMrp,
        stock_quantity: 5,
        reorder_threshold: 3
      };
    });

    setVariants(newVars);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validate all variants have barcodes and SKUs
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.sku || !v.barcode) {
          const { genSku, genBarcode } = generateCodes(i, v.size, v.color);
          v.sku = v.sku || genSku;
          v.barcode = v.barcode || genBarcode;
        }
      }

      const payload = {
        name: name.trim(),
        category_id: categoryId || null,
        brand: brand.trim(),
        design_code: designCode.trim(),
        fabric: fabric.trim(),
        hsn_code: hsnCode.trim(),
        gst_rate: Number(gstRate) || 5.0,
        supplier_id: supplierId || null,
        description: description.trim(),
        variants
      };

      if (isEditing) {
        await api.put(`/products/${product.id}`, payload);
      } else {
        await api.post('/products', payload);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-[#E9DFE2] overflow-hidden my-8">
        <div className="bg-[#681C32] px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="font-serif font-bold text-lg">
              {isEditing ? 'Edit Ethnicwear Product' : 'Add New Ethnicwear Product'}
            </h2>
            <p className="text-xs text-white/80">Design master and size/color variants</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-[#B42332] rounded-lg">
              {error}
            </div>
          )}

          {/* Master Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gulbahar Chanderi Silk Saree"
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-sm focus:outline-none focus:border-[#681C32] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                Design / Style Code *
              </label>
              <input
                type="text"
                required
                value={designCode}
                onChange={(e) => setDesignCode(e.target.value.toUpperCase())}
                placeholder="e.g. AAV-SAR-01"
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-sm font-mono font-bold uppercase focus:outline-none focus:border-[#681C32] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                Brand / Collection
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Aavni Heritage"
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                Fabric / Material
              </label>
              <input
                type="text"
                value={fabric}
                onChange={(e) => setFabric(e.target.value)}
                placeholder="Pure Silk / Cotton"
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                HSN Code
              </label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="6204 / 5007"
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                GST Rate (%)
              </label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs font-semibold"
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5% (Garments & Sarees &lt; ₹1,000)</option>
                <option value={12}>12% (Garments &gt; ₹1,000 / Festive)</option>
                <option value={18}>18% (Accessories / Luxury)</option>
                <option value={28}>28%</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase mb-1">
                Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs"
              >
                <option value="">None / In-house</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Size Preset Buttons */}
          <div className="p-3 bg-[#F6EBF0] rounded-xl border border-[#E9DFE2] flex items-center justify-between">
            <span className="text-xs font-bold text-[#681C32]">Quick Generate Sizes:</span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => generateSizes(['Free Size'])}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] text-xs font-semibold rounded hover:bg-[#681C32] hover:text-white"
              >
                Saree / Unstitched (Free Size)
              </button>
              <button
                type="button"
                onClick={() => generateSizes(['S', 'M', 'L', 'XL', 'XXL'])}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] text-xs font-semibold rounded hover:bg-[#681C32] hover:text-white"
              >
                Kurti (S - XXL)
              </button>
              <button
                type="button"
                onClick={() => generateSizes(['M', 'L', 'XL'])}
                className="px-2.5 py-1 bg-white border border-[#E9DFE2] text-xs font-semibold rounded hover:bg-[#681C32] hover:text-white"
              >
                Standard (M, L, XL)
              </button>
            </div>
          </div>

          {/* Quick Auto Margin Bar */}
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50/60 rounded-xl border border-amber-200/90 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded-md bg-[#681C32] text-white">
                <Percent className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-[#681C32]">Auto Margin Setup:</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                    Active: {globalMargin}%
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Cost enter karte hi Selling Price par direct margin auto-apply ho jayega
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="text-[11px] text-stone-600 font-semibold mr-0.5">Presets:</span>
              {[25, 30, 40, 50, 60, 80, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyMarginToAll(pct)}
                  className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors cursor-pointer ${
                    globalMargin === pct
                      ? 'bg-[#681C32] text-white border-[#681C32] shadow-xs'
                      : 'bg-white text-stone-700 border-amber-200 hover:bg-amber-100'
                  }`}
                  title={`Sabhi variants par ${pct}% margin lagayein`}
                >
                  +{pct}%{pct === 100 ? ' (2x)' : ''}
                </button>
              ))}

              <div className="flex items-center ml-1.5 space-x-1">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    value={customMarginInput}
                    onChange={(e) => setCustomMarginInput(e.target.value)}
                    placeholder="50"
                    className="w-14 pl-1.5 pr-4 py-0.5 text-xs border border-amber-300 rounded bg-white font-mono font-bold text-center text-[#681C32] focus:outline-none focus:border-[#681C32]"
                  />
                  <span className="absolute right-1 text-[10px] font-bold text-amber-700 pointer-events-none">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const val = Number(customMarginInput);
                    if (val > 0) applyMarginToAll(val);
                  }}
                  className="px-2 py-0.5 bg-[#681C32] hover:bg-[#501426] text-white rounded text-xs font-bold cursor-pointer"
                  title="Sabhi variants par custom margin apply karein"
                >
                  Apply All
                </button>
              </div>
            </div>
          </div>

          {/* Variants Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-[#30262A] uppercase tracking-wider">
                Product Variants ({variants.length})
              </h3>
              <button
                type="button"
                onClick={addVariantRow}
                className="text-xs font-bold text-[#681C32] hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variant</span>
              </button>
            </div>

            <div className="rounded-xl border border-[#E9DFE2] overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F8F5F0] border-b border-[#E9DFE2] font-bold text-[#776C70]">
                    <th className="p-2">Size</th>
                    <th className="p-2">Color</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Barcode</th>
                    <th className="p-2">Cost (₹)</th>
                    <th className="p-2 text-center bg-amber-50/80 text-amber-900 border-x border-amber-200/80">Margin</th>
                    <th className="p-2">Selling (₹)</th>
                    <th className="p-2">MRP (₹)</th>
                    <th className="p-2">Stock</th>
                    <th className="p-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9DFE2]">
                  {variants.map((v, idx) => (
                    <tr key={idx} className="hover:bg-[#FDFBFA]">
                      <td className="p-2">
                        <select
                          value={v.size}
                          onChange={(e) => updateVariantField(idx, 'size', e.target.value)}
                          className="w-20 p-1 border border-[#E9DFE2] rounded bg-white font-semibold"
                        >
                          {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'].map((sz) => (
                            <option key={sz} value={sz}>{sz}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={v.color}
                          onChange={(e) => updateVariantField(idx, 'color', e.target.value)}
                          placeholder="Color"
                          className="w-24 p-1 border border-[#E9DFE2] rounded bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => updateVariantField(idx, 'sku', e.target.value.toUpperCase())}
                          placeholder="SKU"
                          className="w-28 p-1 border border-[#E9DFE2] rounded bg-white font-mono uppercase"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={v.barcode}
                          onChange={(e) => updateVariantField(idx, 'barcode', e.target.value)}
                          placeholder="Barcode"
                          className="w-28 p-1 border border-[#E9DFE2] rounded bg-white font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={v.purchase_cost}
                          onChange={(e) => updateVariantField(idx, 'purchase_cost', Number(e.target.value) || 0)}
                          placeholder="Cost"
                          className="w-20 p-1 border border-[#E9DFE2] rounded bg-white font-mono font-bold text-stone-800 focus:border-[#681C32]"
                          title="Cost Price (₹)"
                        />
                      </td>
                      <td className="p-2 bg-amber-50/40 border-x border-amber-200/60">
                        <div className="flex flex-col items-center">
                          <div className="relative flex items-center justify-center w-full">
                            <input
                              type="number"
                              value={v.margin_percent !== undefined ? v.margin_percent : ''}
                              onChange={(e) => updateVariantField(idx, 'margin_percent', e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="%"
                              className="w-16 p-1 pr-4 border border-amber-300 rounded bg-white font-mono font-bold text-center text-amber-950 focus:outline-none focus:border-[#681C32]"
                              title="Margin % over Cost (Enter karein ya badlein)"
                            />
                            <span className="absolute right-1 text-[11px] font-bold text-amber-600 pointer-events-none">%</span>
                          </div>
                          {v.purchase_cost > 0 && v.selling_price > v.purchase_cost && (
                            <span className="text-[10px] font-bold text-emerald-700 mt-0.5 whitespace-nowrap" title="Rupee Profit Margin">
                              +₹{(v.selling_price - v.purchase_cost).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={v.selling_price}
                          onChange={(e) => updateVariantField(idx, 'selling_price', Number(e.target.value) || 0)}
                          placeholder="Selling"
                          className="w-20 p-1 border border-[#681C32]/30 rounded bg-emerald-50/40 font-mono font-bold text-[#681C32] focus:bg-white focus:border-[#681C32]"
                          title="Selling Price (₹) - Auto-calculated from Cost + Margin"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={v.mrp || ''}
                          onChange={(e) => updateVariantField(idx, 'mrp', Number(e.target.value) || 0)}
                          className="w-20 p-1 border border-[#E9DFE2] rounded bg-white font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={v.stock_quantity}
                          onChange={(e) => updateVariantField(idx, 'stock_quantity', Number(e.target.value) || 0)}
                          className="w-16 p-1 border border-[#E9DFE2] rounded bg-white font-mono font-bold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeVariantRow(idx)}
                          className="text-[#776C70] hover:text-[#B42332] p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E9DFE2]">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting || deleting}
                className="px-4 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? 'Deleting...' : 'Delete Product'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || deleting}
                className="px-4 py-2 border border-[#E9DFE2] text-xs font-semibold text-[#776C70] rounded-lg hover:bg-[#F8F5F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || deleting}
                className="px-6 py-2.5 bg-[#681C32] hover:bg-[#451222] text-white font-semibold rounded-lg text-xs shadow-sm transition-all cursor-pointer"
              >
                {submitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product Master'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
