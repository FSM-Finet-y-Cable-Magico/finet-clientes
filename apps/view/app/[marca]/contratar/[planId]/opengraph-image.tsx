import { getPlanById } from "../../../_lib/api";
import { formatPrecio } from "../../../_lib/formato";
import { ogCard, ogCardGenerica, OG_ALT, OG_SIZE } from "../../../_lib/og-card";
import { marcaPorSlug } from "../../../_lib/company";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

type Props = { params: Promise<{ marca: string; planId: string }> };

/** CU-72: imagen para compartir con los datos del plan. */
export default async function Image({ params }: Props) {
  const { marca: slug, planId } = await params;
  const marca = marcaPorSlug(slug);
  const plan = await getPlanById(Number(planId));

  // Excepcion 1: sin plan, la misma tarjeta generica del sitio.
  if (!plan) return ogCard(ogCardGenerica(marca), marca);

  return ogCard({
    titulo: plan.nombre_comercial,
    destacado: `${formatPrecio(plan.precio_mensual)}/mes`,
    bajada: plan.velocidad_mbps
      ? `${plan.velocidad_mbps} Mbps · Fibra optica en ${marca.zonaCorta}`
      : `Fibra optica en ${marca.zonaCorta}`,
  }, marca);
}
