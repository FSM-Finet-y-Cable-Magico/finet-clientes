import type { Metadata } from "next";
import { metadataSeccion } from "../../../_lib/seo";
import ComingSoon from "../../../_components/ui/ComingSoon";
import { marcaPorSlug } from "../../../_lib/company";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ marca: string }>;
}): Promise<Metadata> {
  const marca = marcaPorSlug((await params).marca);
  return metadataSeccion({
    path: "/tv/parrilla",
    title: "Parrilla de programacion",
  }, marca);
}

export default function ParrillaPage() {
  return <ComingSoon title="Parrilla de programacion" />;
}
