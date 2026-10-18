import React, { useState, useEffect } from 'react';
import { StoreSettings } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Settings,
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Trash2,
  Sparkles
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
  const { settings, refreshSettings } = useAuth();
  const [formData, setFormData] = useState<Partial<StoreSettings>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (field: keyof StoreSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/settings', formData);
      await refreshSettings();
      setMessage({ type: 'success', text: 'Store settings updated successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/settings/backup/download', '_blank');
  };

  const handleExportJSON = () => {
    window.open('/api/settings/backup/json', '_blank');
  };

  const handleSeedDemo = async () => {
    if (confirm('Load demo products, sample suppliers, and sample catalog?')) {
      try {
        await api.post('/settings/demo-data/seed');
        setMessage({ type: 'success', text: 'Demo data seeded successfully.' });
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to seed demo data' });
      }
    }
  };

  const handleClearDemo = async () => {
    if (confirm('Are you sure you want to clear DEMO items? Real business records will be preserved.')) {
      try {
        await api.post('/settings/demo-data/clear');
        setMessage({ type: 'success', text: 'Demo data cleared. Store is ready for live inventory.' });
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to clear demo data' });
      }
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8F5F0] min-h-[calc(100vh-4rem)] max-w-5xl">
      <div>
        <h1 className="font-serif font-bold text-2xl text-[#30262A] tracking-wide">
          Store Configuration & Database Maintenance
        </h1>
        <p className="text-xs text-[#776C70]">
          Manage legal identity, GSTIN settings, invoice sequence, printer defaults, and local backups
        </p>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-[#28794B]'
              : 'bg-red-50 border-red-200 text-[#B42332]'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Brand & Identity */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
          <h2 className="font-serif font-bold text-base text-[#30262A] border-b pb-2 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#681C32]"></span>
            <span>Store Brand & Contact Information</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Trade Brand Name *</label>
              <input
                type="text"
                required
                value={formData.brand_name || ''}
                onChange={(e) => handleChange('brand_name', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-bold text-sm"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Legal Business Name</label>
              <input
                type="text"
                value={formData.legal_name || ''}
                onChange={(e) => handleChange('legal_name', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold text-[#776C70] uppercase mb-1">Store Address *</label>
              <input
                type="text"
                required
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">City / District</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">State & Code</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="flex-1 p-2 bg-[#F8F5F0] border rounded-lg"
                />
                <input
                  type="text"
                  value={formData.state_code || ''}
                  onChange={(e) => handleChange('state_code', e.target.value)}
                  className="w-16 p-2 bg-[#F8F5F0] border rounded-lg font-mono text-center font-bold"
                  title="State Code (MP = 23)"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Store Contact Phone *</label>
              <input
                type="text"
                required
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Contact Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* GST Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
          <h2 className="font-serif font-bold text-base text-[#30262A] border-b pb-2 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#681C32]"></span>
            <span>Indian GST Invoicing Configuration</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">
                Store GSTIN (15 Digits)
              </label>
              <input
                type="text"
                maxLength={15}
                value={formData.gstin || ''}
                onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                placeholder="Leave blank if unregistered"
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-mono uppercase font-bold text-[#681C32]"
              />
              <p className="text-[10px] text-[#776C70] mt-1">
                {formData.gstin?.length === 15 ? (
                  <span className="text-[#28794B] font-bold">✓ Valid 15-character GST format</span>
                ) : (
                  <span>If unconfigured, store issues legal Non-GST Retail Bills of Supply.</span>
                )}
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Tax Calculation Mode</label>
              <select
                value={formData.tax_calculation_mode || 'inclusive'}
                onChange={(e) => handleChange('tax_calculation_mode', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-semibold"
              >
                <option value="inclusive">Inclusive (Prices include GST, reverse-calculated)</option>
                <option value="exclusive">Exclusive (Tax added on top of bill subtotal)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoice Numbering & Printer Defaults */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
          <h2 className="font-serif font-bold text-base text-[#30262A] border-b pb-2 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#681C32]"></span>
            <span>Invoice Numbering & Printing Preferences</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Invoice Prefix Series</label>
              <input
                type="text"
                value={formData.invoice_prefix || 'AE/24-25/'}
                onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Next Bill Sequence #</label>
              <input
                type="number"
                min="1"
                value={formData.invoice_next_seq || 1}
                onChange={(e) => handleChange('invoice_next_seq', Number(e.target.value))}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Default Receipt Format</label>
              <select
                value={formData.default_print_format || 'thermal-80'}
                onChange={(e) => handleChange('default_print_format', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-semibold"
              >
                <option value="thermal-80">80mm Thermal Receipt (Standard POS)</option>
                <option value="thermal-58">58mm Thermal Receipt (Compact POS)</option>
                <option value="a4">A4 Full Color Tax Invoice</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-[#776C70] uppercase mb-1">Store Return / Exchange Policy</label>
            <input
              type="text"
              value={formData.return_policy || ''}
              onChange={(e) => handleChange('return_policy', e.target.value)}
              className="w-full p-2 bg-[#F8F5F0] border rounded-lg"
            />
          </div>
        </div>

        {/* Banking & UPI */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
          <h2 className="font-serif font-bold text-base text-[#30262A] border-b pb-2 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#681C32]"></span>
            <span>Banking & Payment Coordinates</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Bank Name</label>
              <input
                type="text"
                value={formData.bank_name || ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">Account Number</label>
              <input
                type="text"
                value={formData.bank_account || ''}
                onChange={(e) => handleChange('bank_account', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">IFSC Code</label>
              <input
                type="text"
                value={formData.bank_ifsc || ''}
                onChange={(e) => handleChange('bank_ifsc', e.target.value.toUpperCase())}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-[#776C70] uppercase mb-1">UPI ID for QR</label>
              <input
                type="text"
                value={formData.upi_id || ''}
                onChange={(e) => handleChange('upi_id', e.target.value)}
                className="w-full p-2 bg-[#F8F5F0] border rounded-lg font-mono text-[#681C32] font-bold"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-[#681C32] hover:bg-[#451222] text-white font-bold rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
        >
          {saving ? 'Saving Settings...' : 'Save & Apply Configuration'}
        </button>
      </form>

      {/* Database Backup & Demo Management */}
      <div className="bg-white p-6 rounded-2xl border border-[#E9DFE2] shadow-xs space-y-4">
        <h2 className="font-serif font-bold text-base text-[#30262A] border-b pb-2 flex items-center space-x-2">
          <Database className="w-4 h-4 text-[#681C32]" />
          <span>Data Safety, Database Backups & Catalog Readiness</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-[#F8F5F0] rounded-xl border border-[#E9DFE2] space-y-2">
            <h3 className="font-bold text-sm text-[#30262A]">Local Database Backups</h3>
            <p className="text-[#776C70]">
              Download full SQLite database binary or structured JSON tables for accountant records.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="px-3 py-2 bg-[#681C32] text-white rounded-lg font-bold flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SQLite DB Backup</span>
              </button>
              <button
                type="button"
                onClick={handleExportJSON}
                className="px-3 py-2 bg-white border border-[#E9DFE2] text-[#30262A] rounded-lg font-bold flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON Export</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#F8F5F0] rounded-xl border border-[#E9DFE2] space-y-2">
            <h3 className="font-bold text-sm text-[#30262A]">Demo Inventory Management</h3>
            <p className="text-[#776C70]">
              Populate authentic sample sarees and kurtis for testing, or safely wipe all demo data before entering real stock.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={handleSeedDemo}
                className="px-3 py-2 bg-white border border-[#E9DFE2] text-[#681C32] font-bold rounded-lg flex items-center space-x-1 hover:bg-[#F6EBF0]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seed Demo Stock</span>
              </button>
              <button
                type="button"
                onClick={handleClearDemo}
                className="px-3 py-2 bg-white border border-red-200 text-[#B42332] font-bold rounded-lg flex items-center space-x-1 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Demo Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
