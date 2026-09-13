import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/empresas/cotizador",
  title: "Cotizador Empresas",
});

export default function CotizadorPage() {
  return <ComingSoon title="Cotizador Empresas" />;
}
