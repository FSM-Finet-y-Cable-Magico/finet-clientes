import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";

// La pagina es "use client" y no puede exportar metadata.
export const metadata: Metadata = metadataSeccion({
  path: "/restablecer-password",
  title: "Restablecer contraseña",
  description:
    "Crea una nueva contraseña para tu cuenta Finet con el enlace de recuperación que recibiste por correo.",
});

export default function RestablecerPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
