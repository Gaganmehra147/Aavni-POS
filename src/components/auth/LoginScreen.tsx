import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, User as UserIcon, AlertCircle, Sparkles } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, settings } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setQuickRole = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-[#E9DFE2] overflow-hidden">
        {/* Top Brand Banner */}
        <div className="bg-[#681C32] p-8 text-center text-white relative">
          <div className="w-14 h-14 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-3 border border-white/20 shadow-inner">
            <span className="font-serif text-3xl font-bold tracking-wider">A</span>
          </div>
          <h1 className="font-serif font-bold text-2xl tracking-wider">
            {settings?.brand_name || 'AAVNI ETHNICWEAR'}
          </h1>
          <p className="text-xs text-white/80 mt-1">Retail POS & Inventory Management System</p>
          <p className="text-[11px] text-white/60 mt-0.5">Jabalpur, Madhya Pradesh</p>
        </div>

        {/* Login Form */}
        <div className="p-8">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#B42332] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#776C70] absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-sm text-[#30262A] focus:outline-none focus:border-[#681C32] focus:bg-white transition-all"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30262A] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#776C70] absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F8F5F0] border border-[#E9DFE2] rounded-lg text-sm text-[#30262A] focus:outline-none focus:border-[#681C32] focus:bg-white transition-all"
                  placeholder="Enter password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#681C32] hover:bg-[#451222] text-white font-semibold rounded-lg text-sm shadow-sm transition-all duration-150 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Signing in...' : 'Sign In to Counter'}</span>
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-8 pt-6 border-t border-[#E9DFE2]">
            <div className="text-xs font-bold text-[#776C70] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Quick Login Credentials:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setQuickRole('admin', 'Admin@123')}
                className="px-2 py-2 text-xs border border-[#E9DFE2] rounded-lg text-[#30262A] hover:bg-[#F6EBF0] hover:border-[#681C32] font-medium text-center transition-colors"
              >
                <div className="font-bold text-[#681C32]">Admin</div>
                <div className="text-[10px] text-[#776C70]">Store Owner</div>
              </button>
              <button
                type="button"
                onClick={() => setQuickRole('manager', 'Manager@123')}
                className="px-2 py-2 text-xs border border-[#E9DFE2] rounded-lg text-[#30262A] hover:bg-[#F6EBF0] hover:border-[#681C32] font-medium text-center transition-colors"
              >
                <div className="font-bold text-[#681C32]">Manager</div>
                <div className="text-[10px] text-[#776C70]">Supervisor</div>
              </button>
              <button
                type="button"
                onClick={() => setQuickRole('cashier', 'Cashier@123')}
                className="px-2 py-2 text-xs border border-[#E9DFE2] rounded-lg text-[#30262A] hover:bg-[#F6EBF0] hover:border-[#681C32] font-medium text-center transition-colors"
              >
                <div className="font-bold text-[#681C32]">Cashier</div>
                <div className="text-[10px] text-[#776C70]">Billing Staff</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
