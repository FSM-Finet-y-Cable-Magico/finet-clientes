import type { Metadata } from "next";
import { metadataSeccion } from "../../../_lib/seo";
import { marcaPorSlug } from "../../../_lib/company";

// La pagina es "use client" y no puede exportar metadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ marca: string }>;
}): Promise<Metadata> {
  const marca = marcaPorSlug((await params).marca);
  return metadataSeccion({
    path: "/registro/confirmar",
    title: "Crear cuenta",
    description:
      `Crea la contraseña de tu cuenta ${marca.nombre} con el enlace que recibiste por correo.`,
  }, marca);
}

export default function ConfirmarRegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
