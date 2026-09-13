import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/empresas/internet",
  title: "Internet Empresas",
});

export default function EmpresasInternetPage() {
  return <ComingSoon title="Internet Empresas" />;
}
