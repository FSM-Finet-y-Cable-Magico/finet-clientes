"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MARCA_POR_DEFECTO, marcaPorSlug, type Marca, type SlugMarca } from "./company";

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
