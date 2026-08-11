import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { APIClient } from "../platform/api/api-client";
import type {
  AuthSession,
  LoginInput,
  RegisterInput,
} from "../platform/auth/auth-schemas";

interface AuthContextValue {
  api: APIClient;
  session: AuthSession | null;
  authenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  invalidateSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ api, children }: { api: APIClient; children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => api.session);

  const login = useCallback(
    async (input: LoginInput) => {
      await api.login(input);
      setSession(api.session);
    },
    [api],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await api.register(input);
      setSession(api.session);
    },
    [api],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setSession(null);
    }
  }, [api]);

  const invalidateSession = useCallback(() => {
    api.setSession(null);
    setSession(null);
  }, [api]);

  const value = useMemo<AuthContextValue>(
    () => ({
      api,
      session,
      authenticated: session !== null,
      login,
      register,
      logout,
      invalidateSession,
    }),
    [api, invalidateSession, login, logout, register, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  return context;
}
