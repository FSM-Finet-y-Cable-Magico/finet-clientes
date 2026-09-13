import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import ComingSoon from "../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/pagar",
  title: "Pagar cuenta",
});

export default function PagarPage() {
  return <ComingSoon title="Pagar cuenta" />;
}
