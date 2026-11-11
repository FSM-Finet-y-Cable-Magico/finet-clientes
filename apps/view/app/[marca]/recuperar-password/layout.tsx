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
    path: "/recuperar-password",
    title: "Recuperar contraseña",
    description:
      `Ingresa tu RUT y te enviaremos a tu correo un enlace para recuperar la contraseña de tu cuenta ${marca.nombre}.`,
  }, marca);
}

export default function RecuperarPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
