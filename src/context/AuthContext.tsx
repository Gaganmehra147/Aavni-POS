import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, StoreSettings } from '../types';
import { api, setAuthToken, getAuthToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  settings: StoreSettings | null;
  loading: boolean;
  needsSetup: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSettings: () => Promise<void>;
  checkSetupStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await api.get<{ settings: StoreSettings }>('/settings');
      setSettings(data.settings);
    } catch (e) {
      console.error('Failed to load store settings:', e);
    }
  };

  const checkSetupStatus = async (): Promise<boolean> => {
    try {
      const data = await api.get<{ needsAdminSetup: boolean }>('/auth/setup-status');
      setNeedsSetup(data.needsAdminSetup);
      return data.needsAdminSetup;
    } catch {
      return false;
    }
  };

  const loadUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchSettings();
      const needs = await checkSetupStatus();
      if (!needs) {
        await loadUser();
      } else {
        setLoading(false);
      }
    };

    init();

    const handleUnauthorized = () => {
      setAuthToken(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.post<{ user: User; token: string }>('/auth/login', { username, password });
    setAuthToken(data.token);
    setUser(data.user);
    await fetchSettings();
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        loading,
        needsSetup,
        login,
        logout,
        refreshSettings: fetchSettings,
        checkSetupStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
