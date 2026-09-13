import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import ComingSoon from "../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/faqs",
  title: "Preguntas frecuentes",
});

export default function FaqsPage() {
  return <ComingSoon title="Preguntas frecuentes" />;
}
