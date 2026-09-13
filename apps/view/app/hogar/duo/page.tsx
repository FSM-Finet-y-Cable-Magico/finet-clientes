import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/hogar/duo",
  title: "Internet + TV",
});

export default function HogarDuoPage() {
  return <ComingSoon title="Internet + TV" />;
}
