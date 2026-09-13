import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";

// La pagina es "use client" y no puede exportar metadata.
export const metadata: Metadata = metadataSeccion({
  path: "/recuperar-password",
  title: "Recuperar contraseña",
  description:
    "Ingresa tu RUT y te enviaremos a tu correo un enlace para recuperar la contraseña de tu cuenta Finet.",
});

export default function RecuperarPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
