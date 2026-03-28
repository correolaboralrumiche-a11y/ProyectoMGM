import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi.js';
import { authStorage, setUnauthorizedHandler } from '../services/api.js';

const AuthContext = createContext(null);

function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const forceLogout = useCallback(() => {
    authStorage.clearToken();
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(forceLogout);
    return () => setUnauthorizedHandler(null);
  }, [forceLogout]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = authStorage.getToken();
      if (!token) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        const data = await authApi.me();
        if (!cancelled) {
          setUser(data?.user || null);
        }
      } catch {
        authStorage.clearToken();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await authApi.login({ identifier, password });
    setUser(data?.user || null);
    return data?.user || null;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const rolesSet = useMemo(
    () => new Set((user?.roles || []).map(normalizeCode).filter(Boolean)),
    [user]
  );
  const permissionsSet = useMemo(
    () => new Set((user?.permissions || []).map(normalizeCode).filter(Boolean)),
    [user]
  );

  const hasRole = useCallback(
    (roleCode) => {
      const expected = normalizeCode(roleCode);
      if (!expected) return false;
      return rolesSet.has(expected);
    },
    [rolesSet]
  );

  const isAdmin = hasRole('admin');

  const can = useCallback(
    (permissionCode) => {
      const expected = normalizeCode(permissionCode);
      if (!expected) return false;
      if (isAdmin) return true;
      return permissionsSet.has(expected);
    },
    [isAdmin, permissionsSet]
  );

  const canAny = useCallback(
    (...permissionCodes) => permissionCodes.flat().some((code) => can(code)),
    [can]
  );

  const canAll = useCallback(
    (...permissionCodes) => permissionCodes.flat().every((code) => can(code)),
    [can]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin,
      login,
      logout,
      hasRole,
      can,
      canAny,
      canAll,
    }),
    [user, loading, isAdmin, login, logout, hasRole, can, canAny, canAll]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
