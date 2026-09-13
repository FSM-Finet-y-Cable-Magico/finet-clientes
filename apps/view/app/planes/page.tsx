import type { Metadata } from "next";
import { metadataSeccion, resumenPlanes } from "../_lib/seo";
import { getLandingPlanes } from "../_lib/api";
import { itemListJsonLd } from "../_lib/jsonld";
import PlanesClient from "../_components/catalog/PlanesClient";

export async function generateMetadata(): Promise<Metadata> {
  const resumen = resumenPlanes(await getLandingPlanes());
  // Cantidad y precio en vez de los nombres: la lista puede crecer y la
  // descripcion no pasa de ~160 caracteres.
  const planes = resumen
    ? resumen.cantidad === 1
      ? `plan de Internet fibra optica desde ${resumen.precioDesde}`
      : `${resumen.cantidad} planes de Internet fibra optica desde ${resumen.precioDesde}`
    : "planes de Internet fibra optica";

  return metadataSeccion({
    path: "/planes",
    title: "Planes de Internet Fibra Optica",
    description: `Descubre ${resumen?.cantidad === 1 ? "nuestro" : "nuestros"} ${planes} en La Pintana, Puente Alto y La Florida. Contrata hoy.`,
    shareDescription:
      "Planes con fibra optica simetrica en La Pintana y Puente Alto.",
  });
}

export default async function PlanesPage() {
  const planes = await getLandingPlanes();
  const sorted = [...planes].sort((a, b) => a.precio_mensual - b.precio_mensual);

  return (
    <section className="px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: itemListJsonLd(sorted),
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Planes de Internet Fibra Optica</h1>
          <p className="text-muted mt-2 max-w-2xl mx-auto">
            Conexion simetrica de alta velocidad para tu hogar o empresa. Sin
            limites de datos, instalacion incluida y soporte local en La Pintana.
          </p>
        </div>
        <PlanesClient planes={sorted} />
      </div>
    </section>
  );
}
