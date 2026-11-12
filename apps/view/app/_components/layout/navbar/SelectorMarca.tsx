"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../../_lib/auth";
import { recordarMarca, useMarca } from "../../../_lib/marca";
import {
  enlaceEntreSitios,
  MARCAS,
  separarMarca,
  type SlugMarca,
} from "../../../_lib/company";

/**
 * Finet o Cable Mágico, como el selector de empresa de G3: lleva a la misma
 * página en el sitio de la otra empresa y la deja recordada (proxy.ts). Con
 * sesión no aparece: la empresa la fija el token, como en G8.
 *
 * Es para la demostración. En producción cada empresa tiene su dominio y el
 * selector se apaga con `NEXT_PUBLIC_SELECTOR_EMPRESA=false` (se lee al
 * compilar), sin tocar código.
 */
export default function SelectorMarca() {
  const marca = useMarca();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated || process.env.NEXT_PUBLIC_SELECTOR_EMPRESA === "false") {
    return null;
  }

  function elegir(slug: SlugMarca) {
    recordarMarca(slug);
    const { ruta } = separarMarca(pathname);
    const destino = enlaceEntreSitios(marca, MARCAS[slug], ruta as `/${string}`);
    // El sitio de la otra empresa puede estar en otro host.
    if (destino.startsWith("/")) router.push(destino);
    else window.location.assign(destino);
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
