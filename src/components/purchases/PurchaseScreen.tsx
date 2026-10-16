import React, { useState, useEffect } from 'react';
import { Supplier, ProductVariant } from '../../types';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import { Truck, Plus, Search, DollarSign, Eye, X, Check } from 'lucide-react';

export const PurchaseScreen: React.FC = () => {
  const [tab, setTab] = useState<'PURCHASES' | 'SUPPLIERS'>('PURCHASES');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // New Supplier Modal
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [suppContact, setSuppContact] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppGstin, setSuppGstin] = useState('');
  const [suppCity, setSuppCity] = useState('');

  // New Purchase Modal
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [supplierInvNo, setSupplierInvNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchVariantQuery, setSearchVariantQuery] = useState('');
  const [foundVariants, setFoundVariants] = useState<ProductVariant[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<Array<{ variant: ProductVariant; quantity: number; unit_cost: number; gst_rate: number }>>([]);
  const [freight, setFreight] = useState<number>(0);
  const [paidNow, setPaidNow] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState('BANK');

  // Supplier Pay Modal
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState('BANK');
  const [payRef, setPayRef] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        api.get<{ purchases: any[] }>('/purchases'),
        api.get<{ suppliers: Supplier[] }>('/purchases/suppliers')
      ]);
      setPurchases(pRes.purchases || []);
      setSuppliers(sRes.suppliers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Search variants for new purchase
  useEffect(() => {
    if (!searchVariantQuery.trim()) {
      setFoundVariants([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ variants: ProductVariant[] }>(`/products/variants/search?q=${encodeURIComponent(searchVariantQuery)}`);
        setFoundVariants(data.variants || []);
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchVariantQuery]);

  const addVariantToPurchase = (v: ProductVariant) => {
    if (purchaseItems.some((it) => it.variant.id === v.id)) return;
    setPurchaseItems([
      ...purchaseItems,
      {
        variant: v,
        quantity: 10,
        unit_cost: v.purchase_cost,
        gst_rate: v.gst_rate || 5.0
      }
    ]);
    setSearchVariantQuery('');
    setFoundVariants([]);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/purchases/suppliers', {
        name: suppName,
        contact_person: suppContact,
        phone: suppPhone,
        gstin: suppGstin,
        city: suppCity
      });
      setShowAddSupplier(false);
      setSuppName('');
      setSuppContact('');
      setSuppPhone('');
      setSuppGstin('');
      setSuppCity('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create supplier');
    }
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert('Please select a supplier');
      return;
    }
    if (purchaseItems.length === 0) {
      alert('Add at least one item');
      return;
    }

    try {
      await api.post('/purchases', {
        supplier_id: selectedSupplierId,
        supplier_invoice_no: supplierInvNo,
        purchase_date: purchaseDate,
        items: purchaseItems.map((it) => ({
          variant_id: it.variant.id,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          gst_rate: it.gst_rate
        })),
        freight_charges: freight,
        paid_amount: paidNow,
        payment_mode: paymentMode
      });
      setShowNewPurchase(false);
      setPurchaseItems([]);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create purchase');
    }
  };

  const handleSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || payAmount <= 0) return;
    try {
      await api.post('/purchases/supplier-payments', {
        supplier_id: payingSupplier.id,
        amount: payAmount,
        payment_mode: payMode,
        reference_no: payRef
      });
      setPayingSupplier(null);
      setPayAmount(0);
      setPayRef('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    }
  };

  const purchaseSubtotal = purchaseItems.reduce((s, it) => s + (it.unit_cost * it.quantity), 0);
  const purchaseTax = purchaseItems.reduce((s, it) => s + ((it.unit_cost * it.quantity * it.gst_rate) / 100), 0);
  const purchaseGrand = purchaseSubtotal + purchaseTax + Number(freight || 0);

  return (
    <div className="p-6 space-y-6 bg-[#F8F5F0] min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
            Purchases & Supplier Ledger
          </h1>
          <p className="text-xs text-[#776C70]">
            Manage fabric & ethnicwear vendors, goods received notes, and payments
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowAddSupplier(true)}
            className="px-3 py-2 bg-white border border-[#E9DFE2] rounded-lg text-xs font-semibold text-[#776C70] hover:bg-[#F6EBF0] flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewPurchase(true)}
            className="px-4 py-2 bg-[#681C32] hover:bg-[#451222] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <Truck className="w-4 h-4" />
            <span>Record Goods Receipt (PO)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E9DFE2] space-x-3">
        <button
          onClick={() => setTab('PURCHASES')}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            tab === 'PURCHASES' ? 'border-[#681C32] text-[#681C32]' : 'border-transparent text-[#776C70]'
          }`}
        >
          Purchase Invoices ({purchases.length})
        </button>
        <button
          onClick={() => setTab('SUPPLIERS')}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
            tab === 'SUPPLIERS' ? 'border-[#681C32] text-[#681C32]' : 'border-transparent text-[#776C70]'
          }`}
        >
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* PURCHASES TABLE */}
      {tab === 'PURCHASES' && (
        <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#776C70]">Loading purchases...</div>
          ) : purchases.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#776C70]">No purchases recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F5F0] border-b border-[#E9DFE2] text-[10px] font-bold text-[#776C70] uppercase tracking-wider">
                    <th className="p-3">PO Number</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Supplier Bill No.</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9DFE2]">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-[#FDFBFA]">
                      <td className="p-3 font-mono font-bold text-[#681C32]">{p.purchase_number}</td>
                      <td className="p-3 font-semibold text-[#30262A]">{p.supplier_name}</td>
                      <td className="p-3 font-mono text-[#776C70]">{p.supplier_invoice_no || '-'}</td>
                      <td className="p-3 text-[#776C70]">{p.purchase_date}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#30262A]">{formatINR(p.grand_total)}</td>
                      <td className="p-3 text-right font-mono text-[#28794B]">{formatINR(p.paid_amount)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.payment_status === 'PAID' ? 'bg-green-100 text-[#28794B]' : 'bg-amber-100 text-[#B7791F]'
                        }`}>
                          {p.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUPPLIERS TABLE */}
      {tab === 'SUPPLIERS' && (
        <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F5F0] border-b border-[#E9DFE2] text-[10px] font-bold text-[#776C70] uppercase tracking-wider">
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">GSTIN</th>
                  <th className="p-3">City / State</th>
                  <th className="p-3 text-right">Outstanding Debt</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9DFE2]">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FDFBFA]">
                    <td className="p-3 font-semibold text-[#30262A]">{s.name}</td>
                    <td className="p-3 text-[#776C70]">
                      <div>{s.contact_person || '-'}</div>
                      <div className="font-mono text-[11px]">{s.phone}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px] font-bold text-[#681C32]">{s.gstin || 'Unregistered'}</td>
                    <td className="p-3 text-[#776C70]">{s.city}, {s.state}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#B42332]">
                      {formatINR(s.balance)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setPayingSupplier(s);
                          setPayAmount(s.balance > 0 ? s.balance : 0);
                        }}
                        className="px-2.5 py-1 bg-[#F6EBF0] hover:bg-[#681C32] hover:text-white text-[#681C32] rounded text-xs font-semibold transition-colors"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-[#E9DFE2]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif font-bold text-base text-[#30262A]">Add New Supplier</h3>
              <button onClick={() => setShowAddSupplier(false)}><X className="w-5 h-5 text-[#776C70]" /></button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#776C70] font-bold mb-1">Supplier Business Name *</label>
                <input
                  type="text"
                  required
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  placeholder="e.g. Chanderi Weavers Association"
                  className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[#776C70] font-bold mb-1">Contact Person</label>
                <input
                  type="text"
                  value={suppContact}
                  onChange={(e) => setSuppContact(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[#776C70] font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={suppPhone}
                  onChange={(e) => setSuppPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[#776C70] font-bold mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={suppGstin}
                  onChange={(e) => setSuppGstin(e.target.value.toUpperCase())}
                  placeholder="15-character GSTIN"
                  className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-[#776C70] font-bold mb-1">City</label>
                <input
                  type="text"
                  value={suppCity}
                  onChange={(e) => setSuppCity(e.target.value)}
                  placeholder="Varanasi / Chanderi / Surat"
                  className="w-full px-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(false)}
                  className="px-3 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#681C32] text-white rounded-lg font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Purchase Modal */}
      {showNewPurchase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl border border-[#E9DFE2] my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-serif font-bold text-lg text-[#30262A]">Record Goods Received (Purchase)</h3>
              <button onClick={() => setShowNewPurchase(false)}><X className="w-5 h-5 text-[#776C70]" /></button>
            </div>
            <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#776C70] mb-1">Supplier *</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                    className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#776C70] mb-1">Supplier Invoice No.</label>
                  <input
                    type="text"
                    value={supplierInvNo}
                    onChange={(e) => setSupplierInvNo(e.target.value)}
                    placeholder="e.g. INV-889"
                    className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#776C70] mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                  />
                </div>
              </div>

              {/* Add Variant to purchase */}
              <div className="relative">
                <label className="block font-bold text-[#776C70] mb-1">Search & Add Product Variants</label>
                <input
                  type="text"
                  value={searchVariantQuery}
                  onChange={(e) => setSearchVariantQuery(e.target.value)}
                  placeholder="Type product name or barcode to add..."
                  className="w-full p-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg"
                />
                {foundVariants.length > 0 && (
                  <div className="absolute left-0 right-0 top-16 bg-white border border-[#E9DFE2] rounded-lg shadow-xl z-30 divide-y max-h-48 overflow-y-auto">
                    {foundVariants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => addVariantToPurchase(v)}
                        className="w-full p-2 text-left hover:bg-[#F6EBF0] flex justify-between"
                      >
                        <div>
                          <strong className="text-[#30262A]">{v.product_name}</strong>
                          <span className="text-[#776C70] text-[10px] ml-2 font-mono">({v.size}/{v.color})</span>
                        </div>
                        <span className="font-mono text-[#681C32]">Cost: {formatINR(v.purchase_cost)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border border-[#E9DFE2] rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8F5F0] border-b text-[10px] font-bold text-[#776C70]">
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Unit Cost</th>
                      <th className="p-2 text-right">GST %</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E9DFE2]">
                    {purchaseItems.map((it, idx) => (
                      <tr key={it.variant.id}>
                        <td className="p-2">
                          <div className="font-semibold">{it.variant.product_name}</div>
                          <div className="text-[10px] text-[#776C70]">{it.variant.size} • {it.variant.color}</div>
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => {
                              const q = Math.max(1, Number(e.target.value) || 1);
                              setPurchaseItems((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, quantity: q } : item))
                              );
                            }}
                            className="w-16 p-1 text-center font-mono border rounded"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={it.unit_cost}
                            onChange={(e) => {
                              const c = Number(e.target.value) || 0;
                              setPurchaseItems((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, unit_cost: c } : item))
                              );
                            }}
                            className="w-20 p-1 text-right font-mono border rounded"
                          />
                        </td>
                        <td className="p-2 text-right font-mono">{it.gst_rate}%</td>
                        <td className="p-2 text-right font-mono font-bold text-[#681C32]">
                          {formatINR(it.unit_cost * it.quantity)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))}
                            className="text-[#B42332]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Payments */}
              <div className="p-3 bg-[#F8F5F0] rounded-lg grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#776C70] mb-1">Freight / Transport (₹)</label>
                  <input
                    type="number"
                    value={freight}
                    onChange={(e) => setFreight(Number(e.target.value) || 0)}
                    className="w-full p-1.5 bg-white border rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#776C70] mb-1">Amount Paid Now (₹)</label>
                  <input
                    type="number"
                    value={paidNow}
                    onChange={(e) => setPaidNow(Number(e.target.value) || 0)}
                    className="w-full p-1.5 bg-white border rounded font-mono font-bold text-[#28794B]"
                  />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#776C70]">Grand Total:</div>
                  <div className="font-mono font-bold text-lg text-[#681C32]">{formatINR(purchaseGrand)}</div>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewPurchase(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#681C32] text-white rounded-lg font-bold"
                >
                  Commit Goods Receipt & Increase Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Supplier Payment Modal */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-[#E9DFE2]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif font-bold text-base text-[#30262A]">Record Supplier Payment</h3>
              <button onClick={() => setPayingSupplier(null)}><X className="w-5 h-5 text-[#776C70]" /></button>
            </div>
            <form onSubmit={handleSupplierPayment} className="space-y-3 text-xs">
              <div className="p-3 bg-[#F8F5F0] rounded-lg">
                <div className="font-bold text-[#30262A]">{payingSupplier.name}</div>
                <div className="text-[#B42332] font-mono mt-0.5">
                  Outstanding Balance: {formatINR(payingSupplier.balance)}
                </div>
              </div>

              <div>
                <label className="block text-[#776C70] font-bold mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                  className="w-full p-2 border rounded font-mono font-bold text-base text-[#28794B]"
                />
              </div>

              <div>
                <label className="block text-[#776C70] font-bold mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-[#776C70] font-bold mb-1">Reference No. / UTR / Cheque No.</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full p-2 border rounded font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-3 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#28794B] text-white rounded-lg font-bold"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
