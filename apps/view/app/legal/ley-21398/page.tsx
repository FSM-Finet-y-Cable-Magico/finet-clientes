import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import ComingSoon from "../../_components/ui/ComingSoon";

export const metadata: Metadata = metadataSeccion({
  path: "/legal/ley-21398",
  title: "Ley 21.398",
});

export default function Ley21398Page() {
  return <ComingSoon title="Ley 21.398" />;
}
