import { formatPrecioMensual, getPlanById } from "../../_lib/api";
import { ogCard, OG_CARD_GENERICA, OG_SIZE } from "../../_lib/og-card";
import { SEO_DEFAULTS } from "../../_lib/seo";

export const alt = SEO_DEFAULTS.shareTitle;
export const size = OG_SIZE;
export const contentType = "image/png";

type Props = { params: Promise<{ planId: string }> };

/** CU-72: imagen para compartir con los datos del plan. */
export default async function Image({ params }: Props) {
  const { planId } = await params;
  const plan = await getPlanById(Number(planId));

  // Excepcion 1: sin plan, la misma tarjeta generica del sitio.
  if (!plan) return ogCard(OG_CARD_GENERICA);

  return ogCard({
    titulo: plan.nombre_comercial,
    destacado: `${formatPrecioMensual(plan.precio_mensual)}/mes`,
    bajada: plan.velocidad_mbps
      ? `${plan.velocidad_mbps} Mbps · Fibra optica en La Pintana y Puente Alto`
      : "Fibra optica en La Pintana y Puente Alto",
  });
}
