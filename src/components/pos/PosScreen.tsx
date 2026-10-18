import React, { useState, useEffect, useRef } from 'react';
import { ProductVariant, Customer, CartItem, StoreSettings } from '../../types';
import { api } from '../../lib/api';
import { formatINR } from '../../lib/currency';
import { useAuth } from '../../context/AuthContext';
import { PaymentModal } from './PaymentModal';
import { HoldCartModal } from './HoldCartModal';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  PlayCircle,
  User,
  CreditCard,
  Printer,
  Sparkles,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface PosScreenProps {
  onPrintInvoice: (invoiceId: number, format: 'thermal' | 'a4') => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({ onPrintInvoice }) => {
  const { settings } = useAuth();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductVariant[]>([]);
  const [searching, setSearching] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [billDiscountType, setBillDiscountType] = useState<'percent' | 'flat'>('flat');
  const [billDiscountVal, setBillDiscountVal] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Modals & Held Carts
  const [heldCarts, setHeldCarts] = useState<any[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeHeldId, setActiveHeldId] = useState<number | null>(null);

  // Success dialog after sale
  const [lastSaleResult, setLastSaleResult] = useState<{ invoiceId: number; invoiceNumber: string; grandTotal: number } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Focus barcode input on mount and after actions
  const focusScanner = () => {
    barcodeInputRef.current?.focus();
  };

  useEffect(() => {
    focusScanner();
    loadHeldCarts();
  }, []);

  const loadHeldCarts = async () => {
    try {
      const data = await api.get<{ held_carts: any[] }>('/pos/held');
      setHeldCarts(data.held_carts || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Keyboard shortcut listener: F2 for checkout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (cartItems.length > 0) {
          setShowPaymentModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems]);

  // Search variants by name / SKU
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get<{ variants: ProductVariant[] }>(`/products/variants/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(data.variants || []);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Barcode Scan
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    try {
      const data = await api.get<{ variant: ProductVariant }>(`/products/variants/by-barcode/${encodeURIComponent(code)}`);
      if (data.variant) {
        addVariantToCart(data.variant);
        setBarcodeInput('');
      }
    } catch (err: any) {
      alert(`Barcode Scan Error: ${err.message || 'Variant not found'}`);
    }
    focusScanner();
  };

  const addVariantToCart = (variant: ProductVariant) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.variant_id === variant.id);
      if (existingIndex > -1) {
        // Increment quantity
        const updated = [...prev];
        const item = updated[existingIndex];
        const nextQty = item.quantity + 1;
        updated[existingIndex] = {
          ...item,
          quantity: nextQty
        };
        return updated;
      } else {
        // Add new
        const newItem: CartItem = {
          variant_id: variant.id,
          product_id: variant.product_id,
          product_name: variant.product_name || 'Ethnic Garment',
          design_code: variant.design_code || 'AAV-00',
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
          barcode: variant.barcode,
          hsn_code: variant.hsn_code || '6204',
          available_stock: variant.stock_quantity,
          quantity: 1,
          unit_price: variant.selling_price,
          selling_price: variant.selling_price,
          mrp: variant.mrp,
          purchase_cost: variant.purchase_cost,
          discount_type: 'flat',
          discount_value: 0,
          discount_amount: 0,
          gst_rate: variant.gst_rate || 5.0
        };
        return [newItem, ...prev];
      }
    });
  };

  const updateItemQty = (variantId: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.variant_id === variantId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (variantId: number) => {
    setCartItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const updateItemDiscount = (variantId: number, type: 'percent' | 'flat', val: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.variant_id === variantId) {
          const rawTotal = item.unit_price * item.quantity;
          let disc = 0;
          if (type === 'percent') {
            disc = (rawTotal * Math.min(100, Math.max(0, val))) / 100;
          } else {
            disc = Math.min(rawTotal, Math.max(0, val));
          }
          return {
            ...item,
            discount_type: type,
            discount_value: val,
            discount_amount: disc
          };
        }
        return item;
      })
    );
  };

  // Cart Totals Computation
  const subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const itemsDiscountTotal = cartItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0);

  let billLevelDiscount = 0;
  if (billDiscountType === 'percent') {
    billLevelDiscount = ((subtotal - itemsDiscountTotal) * Math.min(100, Math.max(0, billDiscountVal))) / 100;
  } else {
    billLevelDiscount = Math.min(subtotal - itemsDiscountTotal, Math.max(0, billDiscountVal));
  }
  const totalDiscounts = itemsDiscountTotal + billLevelDiscount;

  const isGstConfigured = Boolean(settings?.is_gst_registered && settings?.gstin);
  const taxMode = settings?.tax_calculation_mode || 'inclusive';

  const netPayablePreTax = Math.max(0, subtotal - totalDiscounts);
  const remainingBase = Math.max(1, subtotal - itemsDiscountTotal);

  let taxableTotal = 0;
  let taxTotal = 0;

  for (const item of cartItems) {
    const itemGross = item.unit_price * item.quantity;
    const itemDisc = item.discount_amount || 0;
    const allocatedBillDiscount = (subtotal - itemsDiscountTotal) > 0
      ? (billLevelDiscount * (itemGross - itemDisc)) / remainingBase
      : 0;
    const effectiveNet = Math.max(0, itemGross - itemDisc - allocatedBillDiscount);
    const rate = isGstConfigured ? item.gst_rate : 0;

    if (rate > 0) {
      if (taxMode === 'inclusive') {
        const taxable = effectiveNet / (1 + rate / 100);
        taxableTotal += taxable;
        taxTotal += (effectiveNet - taxable);
      } else {
        taxableTotal += effectiveNet;
        taxTotal += (effectiveNet * rate) / 100;
      }
    } else {
      taxableTotal += effectiveNet;
    }
  }

  const unroundedTotal = taxMode === 'inclusive'
    ? netPayablePreTax
    : Math.max(0, taxableTotal + taxTotal);

  const grandTotal = Math.round(unroundedTotal);
  const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

  // Customer search handler
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomers([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await api.get<{ customers: Customer[] }>(`/customers/search?q=${encodeURIComponent(customerSearch)}`);
        setCustomers(data.customers || []);
      } catch (e) {
        console.error(e);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.post<{ id: number; message: string }>('/customers', {
        name: newCustName,
        phone: newCustPhone
      });
      setSelectedCustomer({
        id: data.id,
        name: newCustName,
        phone: newCustPhone,
        credit_balance: 0
      });
      setShowAddCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    }
  };

  // Hold Cart
  const handleHoldCart = async () => {
    if (cartItems.length === 0) return;
    try {
      await api.post('/pos/hold', {
        customer_name: selectedCustomer?.name || 'Walk-in Customer',
        customer_phone: selectedCustomer?.phone || null,
        cart_data: {
          items: cartItems,
          customer: selectedCustomer,
          billDiscountVal,
          billDiscountType,
          notes: invoiceNotes
        }
      });
      setCartItems([]);
      setSelectedCustomer(null);
      setBillDiscountVal(0);
      setInvoiceNotes('');
      await loadHeldCarts();
      focusScanner();
    } catch (err: any) {
      alert(err.message || 'Failed to hold cart');
    }
  };

  // Resume Cart
  const handleResumeCart = (held: any) => {
    const data = held.cart_data;
    if (data?.items) {
      setCartItems(data.items);
      setSelectedCustomer(data.customer || null);
      setBillDiscountVal(data.billDiscountVal || 0);
      setBillDiscountType(data.billDiscountType || 'flat');
      setInvoiceNotes(data.notes || '');
      setActiveHeldId(held.id);
    }
    setShowHeldModal(false);
    focusScanner();
  };

  // Discard Cart
  const handleDiscardCart = () => {
    if (cartItems.length === 0) return;
    if (confirm('Are you sure you want to discard the active cart?')) {
      setCartItems([]);
      setSelectedCustomer(null);
      setBillDiscountVal(0);
      setActiveHeldId(null);
      focusScanner();
    }
  };

  // Checkout Payment Complete
  const handlePaymentSuccess = async (payments: any[]) => {
    const payload = {
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || 'Walk-in Customer',
      customer_phone: selectedCustomer?.phone || null,
      customer_gstin: selectedCustomer?.gstin || null,
      customer_state_code: selectedCustomer?.state_code || '23',
      items: cartItems.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        gst_rate: item.gst_rate
      })),
      discount_total: totalDiscounts,
      payments,
      notes: invoiceNotes,
      held_cart_id: activeHeldId
    };

    const res = await api.post<{ invoiceId: number; invoiceNumber: string; grandTotal: number }>('/pos/checkout', payload);

    setLastSaleResult(res);
    setShowPaymentModal(false);

    // Reset Cart
    setCartItems([]);
    setSelectedCustomer(null);
    setBillDiscountVal(0);
    setInvoiceNotes('');
    setActiveHeldId(null);
    loadHeldCarts();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden bg-[#F8F5F0]">
      {/* LEFT SECTION: Scanner, Product Search, and Cart Table */}
      <div className="flex-1 flex flex-col border-r border-[#E9DFE2] overflow-hidden">
        {/* Top Barcode and Search Header */}
        <div className="p-4 bg-white border-b border-[#E9DFE2] flex items-center space-x-3 shrink-0 shadow-xs">
          {/* Continuous Barcode Scanner Form */}
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <div className="relative">
              <Barcode className="w-5 h-5 text-[#681C32] absolute left-3 top-2.5" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan product barcode (USB scanner ready) or hit Enter..."
                className="w-full pl-10 pr-24 py-2 bg-[#F8F5F0] border-2 border-[#E9DFE2] focus:border-[#681C32] rounded-lg text-sm font-mono text-[#30262A] focus:outline-none focus:bg-white transition-all shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 px-3 py-1 bg-[#681C32] text-white text-xs font-semibold rounded-md hover:bg-[#451222] transition-colors"
              >
                Scan (Enter)
              </button>
            </div>
          </form>

          {/* Quick Product Search */}
          <div className="w-72 relative">
            <Search className="w-4 h-4 text-[#776C70] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Kurti, Saree, Size..."
              className="w-full pl-9 pr-3 py-2 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs text-[#30262A] focus:outline-none focus:border-[#681C32] focus:bg-white transition-all"
            />

            {/* Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-11 bg-white border border-[#E9DFE2] rounded-xl shadow-xl z-40 max-h-80 overflow-y-auto divide-y divide-[#E9DFE2]">
                {searchResults.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      addVariantToCart(v);
                      setSearchQuery('');
                      setSearchResults([]);
                      focusScanner();
                    }}
                    className="w-full p-2.5 text-left hover:bg-[#F6EBF0] flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-[#30262A]">{v.product_name}</div>
                      <div className="text-[11px] text-[#776C70] flex items-center space-x-2">
                        <span>Code: {v.design_code}</span>
                        <span>•</span>
                        <span className="font-semibold text-[#681C32]">Size: {v.size}</span>
                        <span>•</span>
                        <span>Color: {v.color}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#681C32]">{formatINR(v.selling_price)}</div>
                      <div className={`text-[10px] font-semibold ${v.stock_quantity > 0 ? 'text-[#28794B]' : 'text-[#B42332]'}`}>
                        Stock: {v.stock_quantity}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Central Cart Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#776C70]">
              <div className="w-16 h-16 rounded-full bg-[#F6EBF0] flex items-center justify-center text-[#681C32] mb-3">
                <Barcode className="w-8 h-8 opacity-60" />
              </div>
              <h3 className="font-serif font-bold text-lg text-[#30262A]">Counter is Ready to Bill</h3>
              <p className="text-xs text-[#776C70] max-w-sm mt-1">
                Scan barcode tags with the USB handheld scanner or search products to begin ringing up customer purchases.
              </p>
              <div className="mt-4 flex items-center space-x-3 text-xs text-[#681C32] bg-[#F6EBF0] px-3 py-1.5 rounded-lg border border-[#E9DFE2]">
                <Sparkles className="w-4 h-4" />
                <span>Shortcut: Press <strong>F2</strong> to Checkout</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E9DFE2] shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F5F0] border-b border-[#E9DFE2] text-[11px] font-bold text-[#776C70] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Item Details</th>
                    <th className="py-2.5 px-2 text-center">Size / Color</th>
                    <th className="py-2.5 px-2 text-right">Price</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-2 text-right">Disc</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9DFE2] text-xs">
                  {cartItems.map((item) => {
                    const lineTotal = Math.max(0, (item.unit_price * item.quantity) - item.discount_amount);
                    const isLowStock = item.available_stock <= 2;

                    return (
                      <tr key={item.variant_id} className="hover:bg-[#FDFBFA] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#30262A]">{item.product_name}</div>
                          <div className="text-[11px] text-[#776C70] flex items-center space-x-2">
                            <span>Code: {item.design_code}</span>
                            <span>•</span>
                            <span className="font-mono text-[10px]">{item.barcode}</span>
                            {item.available_stock !== undefined && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                item.available_stock > 0 ? 'bg-green-50 text-[#28794B]' : 'bg-red-50 text-[#B42332]'
                              }`}>
                                Avail: {item.available_stock}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#F6EBF0] text-[#681C32] font-semibold text-[11px] border border-[#E9DFE2]">
                            {item.size}
                          </span>
                          <div className="text-[10px] text-[#776C70] mt-0.5">{item.color}</div>
                        </td>

                        <td className="py-2.5 px-2 text-right font-mono font-medium">
                          {formatINR(item.unit_price)}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center space-x-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.variant_id, -1)}
                              className="w-6 h-6 rounded bg-white text-[#30262A] hover:bg-[#F6EBF0] flex items-center justify-center font-bold"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center font-mono font-bold text-xs">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.variant_id, 1)}
                              className="w-6 h-6 rounded bg-white text-[#30262A] hover:bg-[#F6EBF0] flex items-center justify-center font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            placeholder="₹"
                            value={item.discount_value || ''}
                            onChange={(e) => updateItemDiscount(item.variant_id, 'flat', Number(e.target.value) || 0)}
                            className="w-16 px-1.5 py-1 text-right text-xs bg-[#F8F5F0] border border-[#E9DFE2] rounded focus:bg-white font-mono"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#681C32]">
                          {formatINR(lineTotal)}
                        </td>

                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.variant_id)}
                            className="text-[#776C70] hover:text-[#B42332] p-1 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Customer, Bill Discount, Summary & Pay */}
      <div className="w-full lg:w-96 bg-white flex flex-col justify-between shrink-0 shadow-sm border-t lg:border-t-0">
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Customer Selection Block */}
          <div className="p-3 bg-[#F8F5F0] rounded-xl border border-[#E9DFE2]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#30262A] uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-[#681C32]" />
                <span>Customer</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddCustomer(!showAddCustomer)}
                className="text-[11px] font-bold text-[#681C32] hover:underline"
              >
                + New Customer
              </button>
            </div>

            {selectedCustomer ? (
              <div className="p-2 bg-white rounded-lg border border-[#E9DFE2] flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-[#30262A]">{selectedCustomer.name}</div>
                  <div className="text-[11px] text-[#776C70]">{selectedCustomer.phone}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-[10px] text-[#B42332] font-semibold hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Walk-in (or type mobile/name)..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#E9DFE2] rounded-lg text-xs focus:outline-none focus:border-[#681C32]"
                />
                {customers.length > 0 && (
                  <div className="absolute left-0 right-0 top-9 bg-white border border-[#E9DFE2] rounded-lg shadow-lg z-30 divide-y divide-[#E9DFE2]">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch('');
                          setCustomers([]);
                        }}
                        className="w-full p-2 text-left hover:bg-[#F6EBF0] text-xs flex justify-between"
                      >
                        <span className="font-semibold text-[#30262A]">{c.name}</span>
                        <span className="text-[#776C70] font-mono">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Add Customer inline */}
            {showAddCustomer && (
              <form onSubmit={handleCreateCustomer} className="mt-2 pt-2 border-t border-[#E9DFE2] space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-[#E9DFE2] rounded text-xs"
                />
                <input
                  type="tel"
                  required
                  placeholder="10-digit Phone"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-[#E9DFE2] rounded text-xs font-mono"
                />
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex-1 py-1 bg-[#681C32] text-white rounded text-xs font-semibold"
                  >
                    Save Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(false)}
                    className="px-2 py-1 bg-white border border-[#E9DFE2] rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Bill-level Discount */}
          <div className="p-3 bg-[#F8F5F0] rounded-xl border border-[#E9DFE2]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[#30262A] uppercase tracking-wider">
                Bill Discount
              </span>
              <div className="flex rounded-md border border-[#E9DFE2] overflow-hidden text-[10px]">
                <button
                  type="button"
                  onClick={() => setBillDiscountType('flat')}
                  className={`px-2 py-0.5 font-bold ${
                    billDiscountType === 'flat' ? 'bg-[#681C32] text-white' : 'bg-white text-[#776C70]'
                  }`}
                >
                  ₹ Flat
                </button>
                <button
                  type="button"
                  onClick={() => setBillDiscountType('percent')}
                  className={`px-2 py-0.5 font-bold ${
                    billDiscountType === 'percent' ? 'bg-[#681C32] text-white' : 'bg-white text-[#776C70]'
                  }`}
                >
                  % Off
                </button>
              </div>
            </div>
            <input
              type="number"
              min="0"
              placeholder={billDiscountType === 'flat' ? 'Enter flat discount ₹' : 'Enter percentage %'}
              value={billDiscountVal || ''}
              onChange={(e) => setBillDiscountVal(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-white border border-[#E9DFE2] rounded-lg text-xs font-mono focus:outline-none focus:border-[#681C32]"
            />
          </div>

          {/* Invoice Note */}
          <div>
            <input
              type="text"
              placeholder="Invoice remark / alteration notes (optional)..."
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-xs text-[#30262A]"
            />
          </div>
        </div>

        {/* Bottom Cart Financial Summary & Checkout Button */}
        <div className="p-4 border-t border-[#E9DFE2] bg-[#F8F5F0] space-y-3">
          <div className="space-y-1.5 text-xs text-[#776C70]">
            <div className="flex justify-between">
              <span>Gross Items Subtotal:</span>
              <span className="font-mono text-[#30262A]">{formatINR(subtotal)}</span>
            </div>
            {totalDiscounts > 0 && (
              <div className="flex justify-between text-[#28794B]">
                <span>Total Discounts Applied:</span>
                <span className="font-mono">- {formatINR(totalDiscounts)}</span>
              </div>
            )}
            {isGstConfigured && (
              <div className="flex justify-between text-[11px]">
                <span>{taxMode === 'inclusive' ? 'Included GST (Tax):' : 'GST Tax Breakdown:'}</span>
                <span className="font-mono">{formatINR(taxTotal)}</span>
              </div>
            )}
            {roundOff !== 0 && (
              <div className="flex justify-between text-[11px]">
                <span>Round Off:</span>
                <span className="font-mono">{roundOff > 0 ? `+${roundOff}` : roundOff}</span>
              </div>
            )}
          </div>

          {/* Grand Total Highlight */}
          <div className="p-3 bg-[#681C32] text-white rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-white/80">Net Payable</div>
              <div className="text-2xl font-bold font-mono tracking-tight">{formatINR(grandTotal)}</div>
            </div>
            <div className="text-right text-[11px] text-white/80">
              <div>{cartItems.reduce((s, i) => s + i.quantity, 0)} items</div>
              <div>{taxMode === 'inclusive' ? 'Prices Incl. GST' : 'Tax Applied'}</div>
            </div>
          </div>

          {/* Actions: Hold, Discard, Checkout */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={handleHoldCart}
              className="py-2.5 px-2 bg-white border border-[#E9DFE2] hover:bg-[#F6EBF0] text-[#30262A] rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 disabled:opacity-40 cursor-pointer"
            >
              <PauseCircle className="w-4 h-4 text-[#776C70]" />
              <span>Hold</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHeldModal(true)}
              className="py-2.5 px-2 bg-white border border-[#E9DFE2] hover:bg-[#F6EBF0] text-[#30262A] rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 text-[#681C32]" />
              <span>Held ({heldCarts.length})</span>
            </button>

            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={handleDiscardCart}
              className="py-2.5 px-2 bg-white border border-[#E9DFE2] hover:bg-red-50 text-[#B42332] rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>

          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={() => setShowPaymentModal(true)}
            className="w-full py-3.5 bg-[#28794B] hover:bg-[#1E5D39] text-white font-bold rounded-xl text-base shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-40 cursor-pointer"
          >
            <CreditCard className="w-5 h-5" />
            <span>Pay & Generate Bill (F2)</span>
          </button>
        </div>
      </div>

      {/* Payment Checkout Modal */}
      {showPaymentModal && (
        <PaymentModal
          grandTotal={grandTotal}
          customer={selectedCustomer}
          onClose={() => setShowPaymentModal(false)}
          onSubmit={handlePaymentSuccess}
        />
      )}

      {/* Held Carts Modal */}
      {showHeldModal && (
        <HoldCartModal
          heldCarts={heldCarts}
          onClose={() => setShowHeldModal(false)}
          onResume={handleResumeCart}
          onDelete={async (id) => {
            await api.delete(`/pos/held/${id}`);
            await loadHeldCarts();
          }}
        />
      )}

      {/* Success Dialog after sale */}
      {lastSaleResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 text-center shadow-2xl border border-[#E9DFE2] animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-green-100 text-[#28794B] rounded-full mx-auto flex items-center justify-center mb-3">
              <Printer className="w-7 h-7" />
            </div>
            <h3 className="font-serif font-bold text-xl text-[#30262A]">Sale Finalized Successfully!</h3>
            <p className="text-xs text-[#776C70] mt-1">
              Invoice <strong className="font-mono text-[#681C32]">{lastSaleResult.invoiceNumber}</strong> generated.
            </p>
            <div className="font-mono font-bold text-2xl text-[#681C32] my-3">
              {formatINR(lastSaleResult.grandTotal)}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  onPrintInvoice(lastSaleResult.invoiceId, 'thermal');
                  setLastSaleResult(null);
                }}
                className="py-2.5 bg-[#681C32] hover:bg-[#451222] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Thermal 80mm</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onPrintInvoice(lastSaleResult.invoiceId, 'a4');
                  setLastSaleResult(null);
                }}
                className="py-2.5 bg-[#F6EBF0] hover:bg-[#E9DFE2] text-[#681C32] border border-[#681C32] rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>A4 Color Tax Bill</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setLastSaleResult(null)}
              className="w-full mt-3 py-2 text-xs text-[#776C70] hover:text-[#30262A] font-semibold"
            >
              Start Next Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
