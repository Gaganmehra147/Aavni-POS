export interface User {
  id: number;
  name: string;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  is_active: number;
}

export interface StoreSettings {
  id: number;
  brand_name: string;
  legal_name: string;
  address: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  phone: string;
  email: string;
  tagline?: string;
  logo_url?: string;
  gstin: string;
  is_gst_registered: number;
  gst_type: string;
  invoice_prefix: string;
  invoice_next_seq: number;
  return_policy: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  upi_id: string;
  default_print_format: 'thermal-80' | 'thermal-58' | 'a4';
  tax_calculation_mode: 'exclusive' | 'inclusive';
  allow_negative_stock: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  state_code?: string;
  gstin?: string;
  balance: number;
  is_active: number;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  purchase_cost: number;
  selling_price: number;
  mrp?: number;
  stock_quantity: number;
  reorder_threshold: number;
  is_active: number;
  // Attached in search:
  product_name?: string;
  design_code?: string;
  brand?: string;
  fabric?: string;
  hsn_code?: string;
  gst_rate?: number;
  category_name?: string;
}

export interface Product {
  id: number;
  name: string;
  category_id?: number;
  category_name?: string;
  brand: string;
  design_code: string;
  description?: string;
  fabric?: string;
  hsn_code: string;
  gst_rate: number;
  supplier_id?: number;
  supplier_name?: string;
  image_url?: string;
  total_stock?: number;
  variant_count?: number;
  variants: ProductVariant[];
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  state_code?: string;
  gstin?: string;
  credit_balance: number;
  total_bills?: number;
  total_spent?: number;
}

export interface CartItem {
  variant_id: number;
  product_id: number;
  product_name: string;
  design_code: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  hsn_code: string;
  available_stock: number;
  quantity: number;
  unit_price: number;
  selling_price: number;
  mrp?: number;
  purchase_cost: number;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  discount_amount: number;
  gst_rate: number;
}

export interface PaymentItem {
  payment_mode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT';
  amount: number;
  tendered_amount?: number;
  change_returned?: number;
  reference_no?: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  product_name: string;
  design_code: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  hsn_code: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
  line_total: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  customer_id?: number;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  customer_state_code?: string;
  cashier_id: number;
  cashier_name: string;
  invoice_type: string;
  is_interstate: number;
  subtotal: number;
  discount_total: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_total: number;
  round_off: number;
  grand_total: number;
  status: string;
  notes?: string;
  created_at: string;
  payment_modes?: string;
  item_count?: number;
}

export interface StockMovement {
  id: number;
  variant_id: number;
  movement_type: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_id?: string;
  reason?: string;
  user_name?: string;
  sku?: string;
  barcode?: string;
  size?: string;
  color?: string;
  product_name?: string;
  design_code?: string;
  created_at: string;
}

export interface CashSession {
  id: number;
  session_date: string;
  opened_by: number;
  opened_by_name?: string;
  opening_cash: number;
  opened_at: string;
  closed_by?: number;
  closing_cash_actual?: number;
  expected_closing_cash?: number;
  variance?: number;
  closed_at?: string;
  status: 'OPEN' | 'CLOSED';
  remarks?: string;
}
