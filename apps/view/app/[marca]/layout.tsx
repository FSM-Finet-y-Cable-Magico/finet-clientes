import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import MarcaShell from "../_components/layout/MarcaShell";
import { esSlugMarca, marcaPorSlug, SLUGS_MARCA } from "../_lib/company";
import { metadataCompartir, seoDe } from "../_lib/seo";
import { organizacionJsonLd } from "../_lib/jsonld";

type Props = {
  children: ReactNode;
  params: Promise<{ marca: string }>;
};

/**
 * El sitio de cada empresa (Documento 0, §6.6): las mismas páginas, una vez
 * por marca. `proxy.ts` sirve `/planes` desde `/finet/planes` y
 * `/cable-magico/planes` tal cual. Se generan en el build para las dos, así
 * que las páginas estáticas e ISR (RNF-56.1) lo siguen siendo.
 */
export function generateStaticParams() {
  return SLUGS_MARCA.map((marca) => ({ marca }));
}

/** Título, descripción, autor e imagen para compartir de cada empresa (CU-72). */
export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const marca = marcaPorSlug((await params).marca);
  const seo = seoDe(marca);
  return {
    title: {
      template: `%s | ${marca.nombre} — Fibra Optica en ${marca.comunaSoporte}`,
      default: seo.title,
    },
    description: seo.description,
    keywords: [
      "internet fibra optica",
      ...marca.comunas,
      "TV digital",
      "planes internet hogar",
      `fibra optica ${marca.zonaRegion.replace(/^(la|el) /, "")}`,
      marca.nombre,
    ],
    authors: [{ name: marca.razonSocial }],
    creator: marca.razonSocial,
    publisher: marca.razonSocial,
    appleWebApp: { title: marca.nombre },
    ...metadataCompartir(marca),
  };
}

export default async function MarcaLayout({ children, params }: Props) {
  const { marca } = await params;
  if (!esSlugMarca(marca)) notFound();

  return (
    <MarcaShell slug={marca}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizacionJsonLd(marcaPorSlug(marca)) }}
      />
      {children}
    </MarcaShell>
  );
}
