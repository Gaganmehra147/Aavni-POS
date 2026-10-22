import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { LoginScreen } from './components/auth/LoginScreen';
import { PosScreen } from './components/pos/PosScreen';
import { ProductCatalog } from './components/products/ProductCatalog';
import { StockMovementScreen } from './components/inventory/StockMovementScreen';
import { PurchaseScreen } from './components/purchases/PurchaseScreen';
import { ReturnsScreen } from './components/returns/ReturnsScreen';
import { InvoicesList } from './components/invoices/InvoicesList';
import { ExpensesCashScreen } from './components/expenses/ExpensesCashScreen';
import { ReportsScreen } from './components/reports/ReportsScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { ThermalReceiptModal } from './components/print/ThermalReceiptModal';
import { A4InvoiceModal } from './components/print/A4InvoiceModal';
import { MobileScannerView } from './components/pos/MobileScannerView';
import { Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  // Check if opened from smartphone camera as a wireless scanner
  const urlParams = new URLSearchParams(window.location.search);
  const isMobileScanner = urlParams.get('view') === 'mobile-scanner';

  if (isMobileScanner) {
    return <MobileScannerView />;
  }

  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('pos');

  // Print modal state
  const [printModal, setPrintModal] = useState<{
    invoiceId: number;
    type: 'thermal' | 'a4';
  } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5F0] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#681C32] text-white flex items-center justify-center font-serif font-bold text-3xl shadow-xl animate-pulse">
          A
        </div>
        <div className="text-center">
          <h2 className="font-serif font-bold text-xl text-[#30262A] tracking-wider">AAVNI ETHNICWEAR</h2>
          <p className="text-xs text-[#776C70] mt-1 font-sans">Loading retail management suite...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex flex-col font-sans">
      {/* Top Boutique Navigation Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Dynamic Workspace Tab Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'pos' && (
            <PosScreen
              onPrintInvoice={(id, format) => setPrintModal({ invoiceId: id, type: format })}
            />
          )}

          {activeTab === 'products' && <ProductCatalog />}

          {activeTab === 'inventory' && <StockMovementScreen />}

          {activeTab === 'purchases' && <PurchaseScreen />}

          {activeTab === 'returns' && <ReturnsScreen />}

          {activeTab === 'invoices' && (
            <InvoicesList
              onPrintThermal={(id) => setPrintModal({ invoiceId: id, type: 'thermal' })}
              onPrintA4={(id) => setPrintModal({ invoiceId: id, type: 'a4' })}
            />
          )}

          {activeTab === 'expenses' && <ExpensesCashScreen />}

          {activeTab === 'reports' && <ReportsScreen />}

          {activeTab === 'settings' && <SettingsScreen />}
        </main>
      </div>

      {/* Global Invoice / Receipt Print Overlays */}
      {printModal && printModal.type === 'thermal' && (
        <ThermalReceiptModal
          invoiceId={printModal.invoiceId}
          onClose={() => setPrintModal(null)}
        />
      )}

      {printModal && printModal.type === 'a4' && (
        <A4InvoiceModal
          invoiceId={printModal.invoiceId}
          onClose={() => setPrintModal(null)}
        />
      )}
    </div>
  );
};
