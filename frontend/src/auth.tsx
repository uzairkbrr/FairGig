import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "./types";
import { auth as authApi } from "./api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (p: { email: string; password: string; name: string; role: string; city?: string; category?: string }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

function saveTokens(access: string, refresh?: string) {
  localStorage.setItem("fg_access", access);
  if (refresh) localStorage.setItem("fg_refresh", refresh);
}

function clearTokens() {
  localStorage.removeItem("fg_access");
  localStorage.removeItem("fg_refresh");
  localStorage.removeItem("fg_user");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem("fg_user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const access = localStorage.getItem("fg_access");
    if (!access) { setLoading(false); return; }
    authApi.me()
      .then((u) => { setUser(u); localStorage.setItem("fg_user", JSON.stringify(u)); })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const r = await authApi.login(email, password);
    saveTokens(r.access_token, r.refresh_token);
    localStorage.setItem("fg_user", JSON.stringify(r.user));
    setUser(r.user);
    return r.user;
  };

  const register: AuthCtx["register"] = async (p) => {
    const r = await authApi.register(p);
    saveTokens(r.access_token, r.refresh_token);
    localStorage.setItem("fg_user", JSON.stringify(r.user));
    setUser(r.user);
    return r.user;
  };

  const logout = () => { clearTokens(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
