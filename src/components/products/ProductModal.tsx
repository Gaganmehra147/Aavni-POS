import React, { useState, useEffect } from 'react';
import { Category, Supplier } from '../../types';
import { api } from '../../lib/api';
import { X, Plus, Trash2, Sparkles, Barcode } from 'lucide-react';

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

  // Variants state
  const [variants, setVariants] = useState<any[]>(
    product?.variants || [
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
    ]
  );

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-generate SKU & Barcode for variants
  const generateCodes = (idx: number, size: string, color: string) => {
    const cleanCode = designCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanColor = color.slice(0, 3).toUpperCase();
    const genSku = `${cleanCode}-${size}-${cleanColor}`;
    const genBarcode = `890${Date.now().toString().slice(-6)}${idx + 1}`;
    return { genSku, genBarcode };
  };

  const addVariantRow = () => {
    const idx = variants.length;
    const { genSku, genBarcode } = generateCodes(idx, 'L', 'Maroon');
    setVariants([
      ...variants,
      {
        sku: genSku,
        barcode: genBarcode,
        size: 'L',
        color: 'Maroon',
        purchase_cost: variants[0]?.purchase_cost || 1200,
        selling_price: variants[0]?.selling_price || 2499,
        mrp: variants[0]?.mrp || 3499,
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
      updated[idx] = { ...updated[idx], [field]: value };

      // Auto update SKU if size or color changed and user hasn't explicitly customized
      if (field === 'size' || field === 'color') {
        const { genSku } = generateCodes(idx, field === 'size' ? value : updated[idx].size, field === 'color' ? value : updated[idx].color);
        if (!updated[idx].sku || updated[idx].sku.startsWith(designCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())) {
          updated[idx].sku = genSku;
        }
      }

      return updated;
    });
  };

  // Quick multi-size variant generator
  const generateSizes = (sizes: string[]) => {
    const baseColor = variants[0]?.color || 'Maroon';
    const baseCost = variants[0]?.purchase_cost || 1200;
    const basePrice = variants[0]?.selling_price || 2499;
    const baseMrp = variants[0]?.mrp || 3499;

    const newVars = sizes.map((sz, idx) => {
      const { genSku, genBarcode } = generateCodes(idx, sz, baseColor);
      return {
        sku: genSku,
        barcode: genBarcode,
        size: sz,
        color: baseColor,
        purchase_cost: baseCost,
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
                Saree (Free Size)
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
                          className="w-20 p-1 border border-[#E9DFE2] rounded bg-white font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={v.selling_price}
                          onChange={(e) => updateVariantField(idx, 'selling_price', Number(e.target.value) || 0)}
                          className="w-20 p-1 border border-[#E9DFE2] rounded bg-white font-mono font-bold text-[#681C32]"
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
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E9DFE2]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#E9DFE2] text-xs font-semibold text-[#776C70] rounded-lg hover:bg-[#F8F5F0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#681C32] hover:bg-[#451222] text-white font-semibold rounded-lg text-xs shadow-sm transition-all"
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
