import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";
import { marcaPorSlug } from "../../_lib/company";

// La pagina es "use client" y no puede exportar metadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ marca: string }>;
}): Promise<Metadata> {
  const marca = marcaPorSlug((await params).marca);
  return metadataSeccion({
    path: "/inicio-sesion",
    title: "Iniciar sesión",
    description:
      `Ingresa al portal de clientes ${marca.nombre} para ver tus servicios, tu deuda y tus tickets de soporte, o crea tu cuenta.`,
  }, marca);
}

export default function InicioSesionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
