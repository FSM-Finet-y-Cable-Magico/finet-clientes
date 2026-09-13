import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import ComingSoon from "../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/reportar",
  title: "Reportar problema",
});

export default function ReportarPage() {
  return <ComingSoon title="Reportar problema" />;
}
