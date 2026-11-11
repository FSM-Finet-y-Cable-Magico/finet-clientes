import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import PlanCard from "../../_components/catalog/PlanCard";
import { getLandingPlanes, ordenarPorPrecio } from "../../_lib/api";
import { marcaPorSlug } from "../../_lib/company";

export const metadata: Metadata = metadataSeccion({
  path: "/empresas",
  title: "Planes Empresa",
  description:
    "Soluciones de Internet fibra optica y conectividad para empresas y pymes en La Pintana, Puente Alto, La Florida y La Granja. Facturacion empresa y soporte comercial.",
  shareTitle: "Planes Empresa — Finet Fibra Optica",
  shareDescription:
    "Internet fibra optica corporativa para empresas en la zona sur de Santiago.",
});

export default async function EmpresasPage({
  params,
}: {
  params: Promise<{ marca: string }>;
}) {
  const marca = marcaPorSlug((await params).marca);
  const planes = await getLandingPlanes("EMPRESARIAL", marca.idEmpresa);
  const sorted = ordenarPorPrecio(planes);

  return (
    <section className="px-4 py-12">
      <div className="mx-auto grid max-w-7xl gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Ofertas y servicios corporativos</h1>
          <p className="text-muted mt-2 max-w-2xl mx-auto">
            Internet fibra optica de alta disponibilidad para empresas, pymes e
            instituciones. Facturacion empresa, soporte comercial dedicado y
            SLA garantizado.
          </p>
        </div>
        {sorted.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {sorted.map((plan) => (
              <PlanCard key={plan.id_plan} plan={plan} marca={marca} />
            ))}
          </div>
        ) : (
          <div className="text-center border border-border rounded-xl p-10 max-w-lg mx-auto">
            <p className="text-muted">
              El contenido corporativo no esta disponible temporalmente.
            </p>
            <p className="text-sm text-muted mt-3">
              Contactanos directamente para recibir una cotizacion personalizada
              para tu empresa.
            </p>
            <p className="mt-4 text-sm font-medium text-foreground">
              WhatsApp:{" "}
              <a
                href={marca.whatsappUrl}
                className="text-primary hover:underline"
              >
                {marca.telefono.display}
              </a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
