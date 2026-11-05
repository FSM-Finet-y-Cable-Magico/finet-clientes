import type { Metadata } from "next";
import { metadataSeccion } from "../../_lib/seo";

// La pagina es "use client" y no puede exportar metadata.
export const metadata: Metadata = metadataSeccion({
  path: "/registro/confirmar",
  title: "Crear cuenta",
  description:
    "Crea la contraseña de tu cuenta Finet con el enlace que recibiste por correo.",
});

export default function ConfirmarRegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
