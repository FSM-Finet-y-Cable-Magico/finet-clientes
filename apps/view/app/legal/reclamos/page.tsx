import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/legal/reclamos",
  title: "Reglamento de reclamos",
});

export default function ReclamosPage() {
  return <ComingSoon title="Reglamento de reclamos" />;
}
