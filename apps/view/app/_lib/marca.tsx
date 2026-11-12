"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MARCA_POR_DEFECTO, marcaPorSlug, type Marca, type SlugMarca } from "./company";
import { COOKIE_MARCA } from "./enrutar-marca";

const UN_ANIO_S = 60 * 60 * 24 * 365;

/**
 * La marca de la página (Finet o Cable Mágico) para los componentes de
 * cliente. Los de servidor la reciben del layout de `app/[marca]`. Sin
 * provider, Finet: así funcionaban todos antes de que hubiera dos empresas.
 */
const MarcaContexto = createContext<Marca>(MARCA_POR_DEFECTO);

export function MarcaProvider({
  slug,
  children,
}: {
  slug: SlugMarca;
  children: ReactNode;
}) {
  return (
    <MarcaContexto.Provider value={marcaPorSlug(slug)}>
      {children}
    </MarcaContexto.Provider>
  );
}

export function useMarca(): Marca {
  return useContext(MarcaContexto);
}

/**
 * Deja recordada la empresa que eligió el visitante, para que `proxy.ts` lo
 * mantenga en su sitio. Es solo una preferencia: no da acceso a nada.
 */
export function recordarMarca(slug: SlugMarca): void {
  document.cookie = `${COOKIE_MARCA}=${slug}; path=/; max-age=${UN_ANIO_S}; samesite=lax`;
}
