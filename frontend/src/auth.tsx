import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, User } from './api';

type AuthState = {
  user: User | null | undefined; // undefined = checking
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (!t) {
        setUser(null);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch {
        await setToken(null);
        setUser(null);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await setToken(data.access_token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const { data } = await api.post('/auth/register', { email, password, name });
    await setToken(data.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function formatApiError(e: any): string {
  const detail = e?.response?.data?.detail;
  if (!detail) return e?.message || 'Something went wrong';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(', ');
  if (typeof detail === 'object' && detail.msg) return detail.msg;
  return String(detail);
}
