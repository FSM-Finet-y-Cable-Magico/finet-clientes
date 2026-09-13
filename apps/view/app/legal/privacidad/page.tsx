import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/legal/privacidad",
  title: "Politica de privacidad",
});

export default function PrivacidadPage() {
  return <ComingSoon title="Politica de privacidad" />;
}
