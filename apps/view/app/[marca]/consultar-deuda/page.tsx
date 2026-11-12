import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import DeudaLookupForm from "../../components/DeudaLookupForm";
import { marcaPorSlug } from "../../_lib/company";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ marca: string }>;
}): Promise<Metadata> {
  const marca = marcaPorSlug((await params).marca);
  return metadataSeccion({
    path: "/consultar-deuda",
    title: "Consultar deuda",
    description:
      `Verifica si tu servicio ${marca.nombre} tiene deudas pendientes sin necesidad de iniciar sesión.`,
  }, marca);
}

export default function ConsultarDeudaPage() {
  return (
    <main className="min-h-[calc(100vh-200px)] bg-surface py-12 px-4">
      <DeudaLookupForm />
    </main>
  );
}
