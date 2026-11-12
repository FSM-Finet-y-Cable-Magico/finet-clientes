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
    path: "/restablecer-password",
    title: "Restablecer contraseña",
    description:
      `Crea una nueva contraseña para tu cuenta ${marca.nombre} con el enlace de recuperación que recibiste por correo.`,
  }, marca);
}

export default function RestablecerPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
