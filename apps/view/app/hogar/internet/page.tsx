import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/hogar/internet",
  title: "Internet Hogar",
});

export default function HogarInternetPage() {
  return <ComingSoon title="Internet Hogar" />;
}
