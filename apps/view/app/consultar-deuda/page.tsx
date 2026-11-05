import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import DeudaLookupForm from "../components/DeudaLookupForm";

export const metadata: Metadata = metadataSeccion({
  path: "/consultar-deuda",
  title: "Consultar deuda",
  description:
    "Verifica si tu servicio Finet tiene deudas pendientes sin necesidad de iniciar sesión.",
});

export default function ConsultarDeudaPage() {
  return (
    <main className="min-h-[calc(100vh-200px)] bg-surface py-12 px-4">
      <DeudaLookupForm />
    </main>
  );
}
