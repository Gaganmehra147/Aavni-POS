import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingCart,
  Package,
  ArrowLeftRight,
  Truck,
  RotateCcw,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  ShieldCheck
} from 'lucide-react';

export type NavTab =
  | 'pos'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'returns'
  | 'invoices'
  | 'expenses'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  heldCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, heldCount = 0 }) => {
  const { user } = useAuth();
  const role = user?.role || 'cashier';

  const navItems = [
    {
      id: 'pos' as NavTab,
      label: 'POS Billing',
      icon: ShoppingCart,
      roles: ['admin', 'manager', 'cashier'],
      badge: heldCount > 0 ? `${heldCount} held` : null
    },
    {
      id: 'products' as NavTab,
      label: 'Products & Variants',
      icon: Package,
      roles: ['admin', 'manager', 'cashier']
    },
    {
      id: 'inventory' as NavTab,
      label: 'Stock Movements',
      icon: ArrowLeftRight,
      roles: ['admin', 'manager']
    },
    {
      id: 'purchases' as NavTab,
      label: 'Purchases & Suppliers',
      icon: Truck,
      roles: ['admin', 'manager']
    },
    {
      id: 'returns' as NavTab,
      label: 'Returns & Exchange',
      icon: RotateCcw,
      roles: ['admin', 'manager', 'cashier']
    },
    {
      id: 'invoices' as NavTab,
      label: 'Sales Register',
      icon: Receipt,
      roles: ['admin', 'manager', 'cashier']
    },
    {
      id: 'expenses' as NavTab,
      label: 'Expenses & Cash',
      icon: Wallet,
      roles: ['admin', 'manager', 'cashier']
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports & GST',
      icon: BarChart3,
      roles: ['admin', 'manager']
    },
    {
      id: 'settings' as NavTab,
      label: 'Store Settings',
      icon: Settings,
      roles: ['admin']
    }
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="no-print w-64 bg-white border-r border-[#E9DFE2] flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      <div className="p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-bold tracking-wider uppercase text-[#776C70]">
          Main Navigation
        </div>

        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#681C32] text-white shadow-xs font-semibold'
                  : 'text-[#30262A] hover:bg-[#F6EBF0] hover:text-[#681C32]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#776C70]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white text-[#681C32]' : 'bg-[#F6EBF0] text-[#681C32]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-[#E9DFE2] bg-[#F8F5F0]">
        <div className="flex items-center space-x-2 text-xs text-[#776C70]">
          <ShieldCheck className="w-4 h-4 text-[#28794B]" />
          <span>Local SQLite Secured</span>
        </div>
        <div className="text-[11px] text-[#776C70] mt-1">
          GST Ready (MP State 23)
        </div>
      </div>
    </aside>
  );
};
