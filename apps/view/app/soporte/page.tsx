import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import ComingSoon from "../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/soporte",
  title: "Soporte tecnico",
});

export default function SoportePage() {
  return <ComingSoon title="Soporte tecnico" />;
}
