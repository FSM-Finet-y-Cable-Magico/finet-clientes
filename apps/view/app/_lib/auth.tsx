"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { API_URL, EVENTO_SESION_EXPIRADA } from "./consts";
import { securityLogger } from "./logger";

export type Cliente = {
  id_cliente: number;
  nombre_completo: string;
  rut: string;
  email: string;
  telefono: string;
};

type AuthState = {
  cliente: Cliente | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (cliente: Cliente) => void;
  logout: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState | null>(null);

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("unreachable");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetchWithRetry(`${API_URL}/auth/perfil`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (mountedRef.current) {
            setCliente(data);
          }
        }
      } catch {
        if (mountedRef.current) {
          securityLogger.apiError("/auth/perfil", 0, "Auth check failed after retries");
        }
      }
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      securityLogger.sessionExpired();
      setCliente(null);
      router.push("/inicio-sesion?expired=1");
    }

    window.addEventListener(EVENTO_SESION_EXPIRADA, handleSessionExpired);
    return () =>
      window.removeEventListener(EVENTO_SESION_EXPIRADA, handleSessionExpired);
  }, [router]);

  const login = useCallback((clienteData: Cliente) => {
    setCliente(clienteData);
  }, []);

  const logout = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setCliente(null);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        cliente,
        isLoading,
        isAuthenticated: !!cliente,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return ctx;
}
