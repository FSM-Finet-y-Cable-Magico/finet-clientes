import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/hogar/tv",
  title: "TV Digital Hogar",
});

export default function HogarTvPage() {
  return <ComingSoon title="TV Digital Hogar" />;
}
