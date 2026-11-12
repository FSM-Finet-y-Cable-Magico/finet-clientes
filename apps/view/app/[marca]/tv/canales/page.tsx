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
    path: "/tv/canales",
    title: "Canales",
  }, marca);
}

export default function CanalesPage() {
  return <ComingSoon title="Canales" />;
}
