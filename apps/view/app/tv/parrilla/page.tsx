import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/tv/parrilla",
  title: "Parrilla de programacion",
});

export default function ParrillaPage() {
  return <ComingSoon title="Parrilla de programacion" />;
}
