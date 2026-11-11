import { ogCard, ogCardGenerica, OG_ALT, OG_SIZE } from "../_lib/og-card";
import { marcaPorSlug } from "../_lib/company";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

/** Imagen generica del sitio de cada empresa (Excepcion 1 del CU-72). */
export default async function Image({
  params,
}: {
  params: Promise<{ marca: string }>;
}) {
  const marca = marcaPorSlug((await params).marca);
  return ogCard(ogCardGenerica(marca), marca);
}
