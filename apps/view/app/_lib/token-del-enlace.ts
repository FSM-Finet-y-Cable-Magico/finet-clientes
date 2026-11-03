"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth";

function getTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#token=(.+)$/);
  return match ? match[1] : null;
}

const noopSubscribe = () => () => {};

/**
 * Lo que comparten las páginas que abren un enlace del correo: restablecer la
 * contraseña (CU-03) y crear la cuenta (CU-04). Leen el token del fragmento
 * (`#token=…`, que no llega al servidor) y, con la sesión ya iniciada, mandan
 * al portal. `listo` es `false` mientras no se pueda mostrar nada.
 */
export function useTokenDelEnlace(): { listo: boolean; token: string | null } {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [token] = useState(getTokenFromHash);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/portal");
    }
  }, [isAuthenticated, isLoading, router]);

  return { listo: !isLoading && !isAuthenticated && hydrated, token };
}
