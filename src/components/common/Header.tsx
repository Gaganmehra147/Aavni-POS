import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon, Clock, Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, settings, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }) + ' | ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="no-print h-16 bg-white border-b border-[#E9DFE2] px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center space-x-3">
        <img
          src="/aavni-logo.png"
          alt="Aavni Ethnicwear"
          className="h-10 max-w-[100px] object-contain rounded-md"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-serif font-bold text-lg text-[#30262A] tracking-wide">
              {settings?.brand_name || 'AAVNI ETHNICWEAR'}
            </h1>
            <span className="text-xs bg-[#F6EBF0] text-[#681C32] font-semibold px-2 py-0.5 rounded-full border border-[#E9DFE2]">
              Jabalpur Store
            </span>
          </div>
          <p className="text-xs text-[#776C70] hidden md:block">
            {settings?.tagline ? `${settings.tagline} • ` : 'Ethnic Wear For Every You • '}
            {settings?.address || '1673, Sadashiv Niwas, Gorakhpur, Jabalpur'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Live Clock */}
        <div className="hidden lg:flex items-center space-x-1.5 text-xs text-[#776C70] bg-[#F8F5F0] px-3 py-1.5 rounded-md border border-[#E9DFE2]">
          <Clock className="w-3.5 h-3.5 text-[#681C32]" />
          <span className="font-mono">{timeStr}</span>
        </div>

        {/* User Profile & Role */}
        <div className="flex items-center space-x-3 pl-2 border-l border-[#E9DFE2]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#F6EBF0] text-[#681C32] flex items-center justify-center font-semibold text-xs border border-[#E9DFE2]">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-[#30262A] leading-tight">{user?.name}</div>
              <div className="flex items-center space-x-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#28794B]"></span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#776C70]">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-[#776C70] hover:text-[#B42332] hover:bg-[#F6EBF0] rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
