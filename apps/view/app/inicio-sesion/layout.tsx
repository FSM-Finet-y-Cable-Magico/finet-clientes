import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";

// La pagina es "use client" y no puede exportar metadata.
export const metadata: Metadata = metadataSeccion({
  path: "/inicio-sesion",
  title: "Iniciar sesión",
  description:
    "Ingresa al portal de clientes Finet para ver tus servicios, tu deuda y tus tickets de soporte, o crea tu cuenta.",
});

export default function InicioSesionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
