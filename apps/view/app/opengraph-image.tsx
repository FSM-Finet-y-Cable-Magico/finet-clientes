import { ogCard, OG_CARD_GENERICA, OG_SIZE } from "./_lib/og-card";
import { SEO_DEFAULTS } from "./_lib/seo";

export const alt = SEO_DEFAULTS.shareTitle;
export const size = OG_SIZE;
export const contentType = "image/png";

/** Imagen generica del sitio (Excepcion 1 del CU-72). */
export default function Image() {
  return ogCard(OG_CARD_GENERICA);
}
