import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import ComingSoon from "../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/hogar",
  title: "Planes Hogar",
});

export default function HogarPage() {
  return <ComingSoon title="Planes Hogar" />;
}
