"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "../../../_lib/auth";
import { recordarMarca, useMarca } from "../../../_lib/marca";
import {
  enlaceAOtraMarca,
  MARCAS,
  separarMarca,
  type SlugMarca,
} from "../../../_lib/company";
import { irA } from "../../../_lib/navegar";

/**
 * Finet o Cable Mágico, como el selector de empresa de G3: lleva a la misma
 * página en el sitio de la otra empresa y la deja recordada (proxy.ts). Se ve
 * siempre (rama ppt, Emilio 15-11): con sesión, la empresa la fija el token,
 * así que para pasar a la otra primero se cierra la sesión.
 *
 * Es para la demostración. En producción cada empresa tiene su dominio y el
 * selector se apaga con `NEXT_PUBLIC_SELECTOR_EMPRESA=false` (se lee al
 * compilar), sin tocar código.
 */
export default function SelectorMarca() {
  const marca = useMarca();
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuth();

  if (process.env.NEXT_PUBLIC_SELECTOR_EMPRESA === "false") {
    return null;
  }

  async function elegir(slug: SlugMarca) {
    if (slug === marca.slug) return;
    if (isAuthenticated) await logout();
    recordarMarca(slug);
    const { ruta } = separarMarca(pathname);
    // Página completa a la ruta explícita de la empresa (/finet/… o
    // /cable-magico/…), que el proxy publica y deja recordada. Con
    // router.push, la caché del router podía servir una redirección vieja a
    // la otra empresa (15-11). Si cada empresa tiene su host, es la URL completa.
    irA(enlaceAOtraMarca(marca, MARCAS[slug], ruta as `/${string}`));
  }

  return (
    <div role="group" aria-label="Empresa" className="flex items-center gap-1">
      {Object.values(MARCAS).map((m) => {
        const activa = m.slug === marca.slug;
        return (
          <button
            key={m.slug}
            type="button"
            aria-pressed={activa}
            onClick={() => elegir(m.slug as SlugMarca)}
            className={
              activa
                ? "rounded-full bg-primary px-2.5 py-0.5 font-medium text-background"
                : "rounded-full px-2.5 py-0.5 text-muted hover:text-foreground transition-colors"
            }
          >
            {m.nombre}
          </button>
        );
      })}
    </div>
  );
}
