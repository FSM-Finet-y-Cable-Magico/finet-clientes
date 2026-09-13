import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/legal/terminos",
  title: "Terminos y condiciones",
});

export default function TerminosPage() {
  return <ComingSoon title="Terminos y condiciones" />;
}
