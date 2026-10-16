# 🌸 AAVNI ETHNICWEAR — Retail POS & Inventory Management Software

> **Production-grade Retail POS, Inventory, and GST Billing System** tailored specifically for **AAVNI ETHNICWEAR**, Jabalpur, Madhya Pradesh.

---

## 🏛️ 1. Store Identity & Brand Specifications

- **Brand Name:** AAVNI ETHNICWEAR
- **Flagship Location:** 1673, Sadashiv Niwas, Gorakhpur, Gurudwara Road, Jabalpur, Madhya Pradesh — 482001
- **Contact:** +91 9516331531 | contact@aavniethnicwear.com
- **State Jurisdiction:** Madhya Pradesh (State Code: `23`)
- **Aesthetics & Palette:**
  - **Royal Maroon (`#681C32`):** Primary brand accent, boutique header, and primary CTAs.
  - **Deep Maroon (`#451222`):** Contrasting hover and sidebar accents.
  - **Off-White Warm Parchment (`#F8F5F0`):** Soft, non-glare background for counter terminals.
  - **Clean White (`#FFFFFF`):** High-readability card and table surfaces.
  - **Rose Neutral Borders (`#E9DFE2`):** Subtle dividers and card outlines.
  - **Charcoal Text (`#30262A`):** Sharp, legible typographic hierarchy.

---

## 🚀 2. System Architecture

The application is engineered as an offline-first, high-performance, single-instance client-server architecture designed to run reliably on Windows retail counter machines with zero external cloud dependencies.

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│   React 18 + TypeScript + Vite + Tailwind CSS v4 + Lucide    │
│  - USB / Bluetooth Barcode Scanner Keyboard Emulation       │
│  - 80mm / 58mm Thermal Receipt Driver CSS                   │
│  - A4 Color GST Tax Invoice Layout with Amount in Words     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API
┌──────────────────────────────▼──────────────────────────────┐
│                  Express 5.x Backend API                    │
│  - Port 5000 (also serves production frontend build)        │
│  - JWT Authentication & Role-based Authorization (RBAC)     │
│  - ACID Transactional Processing (Stock & Ledger Safety)    │
│  - GST Engine (MP 23 Intra-State CGST+SGST vs Inter-State)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ LibSQL Engine
┌──────────────────────────────▼──────────────────────────────┐
│                    SQLite Local Database                    │
│   `data/aavni_pos.sqlite` (WAL Mode enabled)                │
│  - Foreign Key Constraints & Immutable Stock Audit Ledger   │
│  - Instant 1-Click Database & JSON Backup & Restore         │
└─────────────────────────────────────────────────────────────┘
```

---

## 💎 3. Key Functional Modules

### 1. Point of Sale (POS) Billing Terminal
- **Fast Barcode Input:** Built-in listener tuned for standard USB / Bluetooth handheld barcode scanners (Enter key emulation) with automatic buffer clearing.
- **Instant Product Search:** Live search across product names, categories, fabric types, SKUs, and variant barcodes.
- **Cart & Discounts:**
  - Item-level quantity controls and inline discount (Percentage or Flat ₹).
  - Bill-level cart discount with automatic subtotal re-computation.
  - Tax computation for GST registered or unregistered stores (Intra-state MP CGST+SGST 50:50 or Inter-state IGST).
- **Hold & Resume Carts:** Park transactions when customers need to pick more items, and resume anytime without losing cart state.
- **Customer CRM:** Instant search by phone or name, inline customer creation, and automatic purchase tracking.
- **Flexible Settlement:** Supports Cash (with tendered & change-due calculation), UPI (with auto-generated QR code & store VPA), Card, Split Payments, and Store Credit.

### 2. Products & Variant Matrix
- **Parent & Variant Hierarchy:** Each design has multiple Size (`XS`, `S`, `M`, `L`, `XL`, `XXL`, `Free Size`) and Color combinations.
- **Auto-SKU & Barcode Generation:** Automatically generates standardized boutique SKUs (`AAV-CHND-GLB-01-M`) and unique EAN/Code-128 barcodes.
- **Barcode Label Printing:** Built-in sticker sheet generator (65-label, 40-label, or 24-label formats) with scannable Code128 barcodes, product name, size, and MRP.
- **Low Stock Alarms:** Visual badges and filters for variants with stock below threshold.

### 3. Inventory & Stock Movement Ledger
- **Continuous Stock-In:** Barcode scan mode for rapid incoming shipments.
- **Stock-Out & Quarantine:** Record damaged items, showroom display samples, or missing inventory with mandatory reason notes.
- **Physical Stock Reconciliation:** Enter physical counts per variant; the system automatically calculates variances and posts adjusting ledger movements.
- **Immutable Audit Trail:** Every stock change creates a timestamped ledger entry (`PURCHASE_RECEIPT`, `POS_SALE`, `SALES_RETURN`, `DAMAGE_WRITE_OFF`, `INVENTORY_AUDIT`).

### 4. Purchases & Supplier Management
- **Vendor Directory:** Maintain textile manufacturers and distributors from Surat, Chanderi, Banaras, Jaipur, and Jabalpur.
- **Goods Received Notes (GRN):** Record shipments with supplier invoice numbers, batch rates, and received quantities.
- **Cost Averaging:** Updates variant purchase cost and instantly increases available stock upon posting.
- **Supplier Payment Ledger:** Track cash, bank transfer, and cheque payments against vendor balances.

### 5. Sales Returns & Exchanges
- **Invoice-Linked Returns:** Look up past invoices to verify purchase validity and eligible return quantities (prevents double returns).
- **Condition-Based Routing:**
  - `SALEABLE`: Restocks the variant immediately back into inventory.
  - `DAMAGED`: Quarantines the item to the damage ledger without inflating saleable stock.
- **Refund Modes:** Process refunds via Cash, UPI, or Store Credit voucher.

### 6. Expense Ledger & Daily Cash Management
- **Expense Book:** Log petty cash expenses (Tea/Refreshments, Store Maintenance, Courier/Logistics, Staff Lunch, Utilities).
- **Cash Drawer Session:**
  - Cashier enters morning opening float.
  - Tracks expected cash: `Opening Cash + Cash Sales - Cash Refunds - Cash Expenses`.
  - Cashier counts actual drawer cash at closing; system records exact drawer discrepancy/variance.

### 7. Invoices & Printing
- **80mm & 58mm Thermal Receipts:** Designed for thermal receipt printers (EPSON, TVS, NGX, Everycom). Includes store contact, HSN summary, payment mode, and return policy.
- **A4 Full-Color Tax Invoice:** Luxury boutique format featuring brand emblem, customer details, HSN/SAC table, CGST/SGST/IGST breakdown, and Indian Rupee amount in words.
- **Reprint Tracking:** Automatically audits and increments reprint counter to prevent unauthorized duplicate bills.

### 8. Analytics & Financial Reports
- **Executive Dashboard:** Today's Sales, Month-to-Date revenue, average basket size, units sold, and stock alerts.
- **GST Rate-Wise Breakdown:** 0%, 5%, 12%, 18%, and 28% taxable turnovers and tax collected.
- **HSN / SAC Summary:** Mandatory GST format grouping by HSN code.
- **Profit & Loss (P&L):** Net revenue minus true Cost of Goods Sold (COGS) yielding Gross Profit and Margin %.
- **Inventory Valuation:** Total inventory cost value vs total retail realization potential.

### 9. System Settings & Backup
- **Store Configuration:** Update boutique address, phone, GSTIN, and receipt footer notes.
- **1-Click Backup:**
  - Download raw `.sqlite` binary database file.
  - Download full JSON export of all core database tables.
- **Demo Data Control:** Seed realistic Jabalpur ethnicwear inventory or wipe and start fresh.

---

## 🔑 4. Default Login Credentials

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Store Owner (Admin)** | `admin` | `Admin@123` | Full access to all modules, settings, backups, and user management |
| **Store Manager** | `manager` | `Manager@123` | POS, Inventory, Purchases, Returns, Invoices, Expenses, Reports |
| **Billing Cashier** | `cashier` | `Cashier@123` | POS Billing, Product Lookup, and Reprinting own invoices |

---

## 🛠️ 5. Installation & Launch Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ or v22+ recommended)
- **NPM**: v9.0.0 or higher
- **OS**: Windows 10 / 11, macOS, or Linux

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Client Bundle
```bash
npm run build
```

### Step 3: Run the Server
```bash
npm start
```
The server will start at:
👉 **`http://localhost:5000`**

Open your web browser (Chrome, Edge, or Firefox) and navigate to `http://localhost:5000`.

### Development Mode (with Live Hot-Reloading)
To run frontend and backend with hot reload:
```bash
npm run dev
```
- Backend runs on `http://localhost:5000`
- Vite frontend runs on `http://localhost:3000` (automatically proxies `/api` calls to port 5000)

---

## 🧪 6. Automated Acceptance Testing

A comprehensive test suite is included in `test/pos.test.ts` verifying all 15 acceptance criteria:
1. Product and variant creation with unique SKU, barcode, and GST rate.
2. Supplier purchase GRN stock posting.
3. POS atomic checkout stock deduction.
4. Prevention of duplicate/invalid cart submissions.
5. Rejection of sales exceeding available stock.
6. Exact calculation of taxable amounts, discounts, GST, and totals.
7. Thermal receipt and A4 tax invoice layout verification.
8. Re-stocking of saleable returned merchandise.
9. Handling of remaining returnable quantities.
10. Quarantine of damaged returns without inflating saleable stock.
11. P&L and analytics transaction reconciliation.
12. Database JSON backup export integrity.
13. RBAC role permission enforcement (blocking Cashier from admin endpoints).
14. Duplicate barcode constraint rejection.
15. Database persistence across server restarts.

### Running the Test Suite:
```bash
npm test
```
*Expected Output: `tests 15, pass 15, fail 0 (100% passed)`*

---

## 🖨️ 7. Retail Hardware Configuration (Windows POS)

### USB / Bluetooth Barcode Scanners
- Ensure your handheld scanner is set to **Keyboard Emulation Mode** (the default factory setting on Honeywell, TVS, Zebra, and Eyoyo scanners).
- Ensure the scanner transmits a trailing **`CR` (Carriage Return / Enter key)** after scanning the barcode.
- In the POS screen, simply scan any barcode; the scanner emulation automatically detects the item and adds it to the cart.

### 80mm / 58mm Thermal Receipt Printers
- Install the manufacturer's Windows printer driver (e.g. POS-80 or TVS RP 3200).
- In the browser print dialog:
  - Select your Thermal Printer.
  - Set Paper Size to **`80mm x Receipt`** or **`58mm x Receipt`**.
  - Set Margins to **`None`**.
  - Uncheck **`Headers and footers`**.

---

## 📂 8. Project Structure

```
Aavni POS/
├── data/
│   └── aavni_pos.sqlite          # SQLite ACID Database (WAL Mode)
├── server/
│   ├── db.ts                     # Schema definitions, migrations & transaction runner
│   ├── seed.ts                   # Jabalpur ethnicwear demo products & suppliers
│   ├── index.ts                  # Express server & static asset host
│   ├── middleware/
│   │   └── auth.ts               # JWT verification & RBAC middleware
│   └── routes/
│       ├── auth.ts               # Login, users, setup
│       ├── products.ts           # Product & variant catalog CRUD
│       ├── inventory.ts          # Stock in, stock out, physical count
│       ├── pos.ts                # Checkout, cart holds, stock validation
│       ├── invoices.ts           # Sales register & reprint tracking
│       ├── returns.ts            # Invoice-linked returns & quarantine
│       ├── purchases.ts          # Suppliers & GRN goods receiving
│       ├── customers.ts          # Customer CRM & order history
│       ├── expenses.ts           # Petty cash & cash drawer closing
│       ├── reports.ts            # Analytics, GST reports, P&L
│       └── settings.ts           # Store details, GSTIN, DB backups
├── src/
│   ├── components/
│   │   ├── auth/                 # Login & 1-click credential selector
│   │   ├── common/               # Boutique header & role-based sidebar
│   │   ├── pos/                  # POS terminal, payment modal, cart holds
│   │   ├── products/             # Product catalog & multi-variant generator
│   │   ├── inventory/            # Stock movements & audit ledger
│   │   ├── purchases/            # Supplier directory & purchase orders
│   │   ├── returns/              # Invoice lookup & condition return flow
│   │   ├── invoices/             # Invoice listing & reprinting
│   │   ├── expenses/             # Expense vouchers & drawer reconciliation
│   │   ├── reports/              # Executive dashboard, GST & P&L
│   │   ├── settings/             # Store profile & database backup
│   │   └── print/                # 80mm/58mm thermal receipts & A4 invoice
│   ├── context/
│   │   └── AuthContext.tsx       # Global session & store settings state
│   ├── lib/
│   │   ├── api.ts                # HTTP API client with auth headers
│   │   └── currency.ts           # Indian Rupee format & amount in words
│   ├── App.tsx                   # Main layout container
│   ├── main.tsx                  # React DOM mount point
│   └── index.css                 # Aavni design system & print styling
├── test/
│   └── pos.test.ts               # Acceptance test suite (TEST 1 to 15)
├── package.json
└── vite.config.ts
```

---

## 📜 9. License & Store Copyright

© 2026 **AAVNI ETHNICWEAR**, Jabalpur, Madhya Pradesh. All rights reserved.  
Built for high-reliability retail counter operations.
