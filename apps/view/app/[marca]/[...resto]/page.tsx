import { notFound } from "next/navigation";

/**
 * Una ruta que no existe dentro del sitio de una empresa: su 404 se muestra
 * con su barra y su pie (`app/[marca]/not-found.tsx`), no con los de Finet.
 */
export default function RutaInexistente() {
  notFound();
}
