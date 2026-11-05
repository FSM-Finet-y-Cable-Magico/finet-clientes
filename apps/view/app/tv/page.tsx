import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import ComingSoon from "../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/tv",
  title: "TV Digital",
});

export default function TvPage() {
  return <ComingSoon title="TV Digital" />;
}
