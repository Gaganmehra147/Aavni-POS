import React, { useState, useEffect } from 'react';
import { Product, Category, Supplier } from '../../types';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import { ProductModal } from './ProductModal';
import { BarcodeLabelModal } from '../print/BarcodeLabelModal';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Barcode,
  Edit,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Upload
} from 'lucide-react';

export const ProductCatalog: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [labelItems, setLabelItems] = useState<any[] | null>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      let url = `/products?1=1`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      if (lowStockFilter) url += `&low_stock=true`;

      const data = await api.get<{ products: Product[] }>(url);
      setProducts(data.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [catData, supData] = await Promise.all([
        api.get<{ categories: Category[] }>('/products/categories'),
        api.get<{ suppliers: Supplier[] }>('/purchases/suppliers')
      ]);
      setCategories(catData.categories || []);
      setSuppliers(supData.suppliers || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchCatalog, 200);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, lowStockFilter]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrintLabelsForProduct = (prod: Product) => {
    const items = prod.variants.map((v) => ({
      name: prod.name,
      design_code: prod.design_code,
      size: v.size,
      color: v.color,
      barcode: v.barcode,
      selling_price: v.selling_price,
      mrp: v.mrp,
      quantity: 1
    }));
    setLabelItems(items);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (products.length === 0) return;
    const rows = [
      ['Product Name', 'Design Code', 'Category', 'Fabric', 'HSN', 'Size', 'Color', 'SKU', 'Barcode', 'Cost', 'Selling Price', 'MRP', 'Stock']
    ];

    products.forEach((p) => {
      p.variants.forEach((v) => {
        rows.push([
          p.name,
          p.design_code,
          p.category_name || '',
          p.fabric || '',
          p.hsn_code,
          v.size,
          v.color,
          v.sku,
          v.barcode,
          String(v.purchase_cost),
          String(v.selling_price),
          String(v.mrp || v.selling_price),
          String(v.stock_quantity)
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aavni_inventory_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-5 bg-[#F8F5F0] min-h-[calc(100vh-4rem)]">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
            Product Master & Clothing Variants
          </h1>
          <p className="text-xs text-[#776C70]">
            Manage ethnicwear categories, styles, sizes, barcodes, and inventory thresholds
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#776C70] hover:bg-[#F6EBF0] flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setShowProductModal(true);
            }}
            className="px-4 py-2 bg-[#681C32] hover:bg-[#451222] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-xl border border-[#E9DFE2] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#776C70] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, design code, HSN..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs text-[#30262A] focus:outline-none focus:border-[#681C32]"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs text-[#30262A]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setLowStockFilter(!lowStockFilter)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
            lowStockFilter
              ? 'bg-amber-50 text-[#B7791F] border-[#B7791F]'
              : 'bg-white text-[#776C70] border-[#E9DFE2] hover:bg-[#F8F5F0]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low Stock Alert</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-semibold text-[#776C70]">
            Loading catalog...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#776C70]">
            No products found matching filters.
          </div>
        ) : (
          <div className="divide-y divide-[#E9DFE2]">
            {products.map((prod) => {
              const isExpanded = expandedIds[prod.id];
              const totalStock = prod.variants.reduce((sum, v) => sum + v.stock_quantity, 0);
              const hasLowStock = prod.variants.some((v) => v.stock_quantity <= v.reorder_threshold);

              return (
                <div key={prod.id} className="transition-colors">
                  {/* Master row */}
                  <div className="p-4 flex items-center justify-between hover:bg-[#FDFBFA]">
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(prod.id)}
                        className="p-1 text-[#776C70] hover:text-[#681C32]"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-sm text-[#30262A]">{prod.name}</h3>
                          <span className="text-[10px] font-mono font-bold bg-[#F6EBF0] text-[#681C32] px-2 py-0.5 rounded border border-[#E9DFE2]">
                            {prod.design_code}
                          </span>
                          {prod.category_name && (
                            <span className="text-[11px] text-[#776C70] bg-[#F8F5F0] px-2 py-0.5 rounded">
                              {prod.category_name}
                            </span>
                          )}
                          {hasLowStock && (
                            <span className="text-[10px] bg-amber-50 text-[#B7791F] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                              Low Stock
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#776C70] mt-0.5 flex items-center space-x-3">
                          <span>Fabric: {prod.fabric || 'N/A'}</span>
                          <span>•</span>
                          <span>HSN: {prod.hsn_code}</span>
                          <span>•</span>
                          <span>GST: {prod.gst_rate}%</span>
                          {prod.supplier_name && <span>• Supplier: {prod.supplier_name}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-xs text-[#776C70]">Total Stock:</div>
                        <div className={`font-mono font-bold text-sm ${totalStock > 0 ? 'text-[#28794B]' : 'text-[#B42332]'}`}>
                          {totalStock} units ({prod.variants.length} variants)
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handlePrintLabelsForProduct(prod)}
                          title="Print Barcode Labels"
                          className="p-2 border border-[#E9DFE2] hover:bg-[#F6EBF0] hover:border-[#681C32] rounded-lg text-[#776C70] hover:text-[#681C32] transition-colors"
                        >
                          <Barcode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(prod);
                            setShowProductModal(true);
                          }}
                          title="Edit Product"
                          className="p-2 border border-[#E9DFE2] hover:bg-[#F6EBF0] hover:border-[#681C32] rounded-lg text-[#776C70] hover:text-[#681C32] transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Variants Table */}
                  {isExpanded && (
                    <div className="bg-[#F8F5F0] px-10 py-3 border-t border-[#E9DFE2]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-[#776C70] text-[10px] font-bold uppercase tracking-wider">
                            <th className="py-1.5">Size</th>
                            <th className="py-1.5">Color</th>
                            <th className="py-1.5">SKU</th>
                            <th className="py-1.5">Barcode</th>
                            <th className="py-1.5 text-right">Cost Price</th>
                            <th className="py-1.5 text-right">Selling Price</th>
                            <th className="py-1.5 text-right">MRP</th>
                            <th className="py-1.5 text-center">In Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E9DFE2]/60">
                          {prod.variants.map((v) => (
                            <tr key={v.id} className="text-[#30262A]">
                              <td className="py-2">
                                <span className="font-bold text-[#681C32] bg-white px-2 py-0.5 rounded border border-[#E9DFE2]">
                                  {v.size}
                                </span>
                              </td>
                              <td className="py-2 font-medium">{v.color}</td>
                              <td className="py-2 font-mono text-[11px] text-[#776C70]">{v.sku}</td>
                              <td className="py-2 font-mono text-[11px] font-bold">{v.barcode}</td>
                              <td className="py-2 text-right font-mono text-[#776C70]">{formatINR(v.purchase_cost)}</td>
                              <td className="py-2 text-right font-mono font-bold text-[#681C32]">{formatINR(v.selling_price)}</td>
                              <td className="py-2 text-right font-mono text-[#776C70]">{v.mrp ? formatINR(v.mrp) : '-'}</td>
                              <td className="py-2 text-center">
                                <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                                  v.stock_quantity <= 0
                                    ? 'bg-red-100 text-[#B42332]'
                                    : v.stock_quantity <= v.reorder_threshold
                                    ? 'bg-amber-100 text-[#B7791F]'
                                    : 'bg-green-100 text-[#28794B]'
                                }`}>
                                  {v.stock_quantity}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Add/Edit Modal */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setShowProductModal(false)}
          onSuccess={() => {
            setShowProductModal(false);
            fetchCatalog();
          }}
        />
      )}

      {/* Barcode Labels Modal */}
      {labelItems && (
        <BarcodeLabelModal
          items={labelItems}
          onClose={() => setLabelItems(null)}
        />
      )}
    </div>
  );
};
