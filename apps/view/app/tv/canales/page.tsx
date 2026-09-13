import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/tv/canales",
  title: "Canales",
});

export default function CanalesPage() {
  return <ComingSoon title="Canales" />;
}
