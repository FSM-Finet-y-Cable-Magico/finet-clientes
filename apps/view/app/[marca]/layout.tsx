import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import MarcaShell from "../_components/layout/MarcaShell";
import { esSlugMarca, SLUGS_MARCA } from "../_lib/company";

/**
 * El sitio de cada empresa (Documento 0, §6.6): las mismas páginas, una vez
 * por marca. `proxy.ts` sirve `/planes` desde `/finet/planes` y
 * `/cable-magico/planes` tal cual. Se generan en el build para las dos, así
 * que las páginas estáticas e ISR (RNF-56.1) lo siguen siendo.
 */
export function generateStaticParams() {
  return SLUGS_MARCA.map((marca) => ({ marca }));
}

export default async function MarcaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ marca: string }>;
}) {
  const { marca } = await params;
  if (!esSlugMarca(marca)) notFound();

  return <MarcaShell slug={marca}>{children}</MarcaShell>;
}
