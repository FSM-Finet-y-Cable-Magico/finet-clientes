/**
 * CU-73: hueco de un dato que todavía no entrega Finet. Se ve como espacio
 * en blanco y el lector de pantalla anuncia "dato pendiente". La lista de
 * pendientes está en docs/CASOS-DE-USO.md.
 */
export function Pendiente() {
  return (
    <span className="inline-block h-[1.1em] w-24 border-b border-dashed border-muted align-text-bottom">
      <span className="sr-only">dato pendiente</span>
    </span>
  );
}

/** El dato si ya está, o su hueco. */
export function Dato({ valor }: { valor: string | null }) {
  return valor ?? <Pendiente />;
}

/** Correo como enlace si ya está, o su hueco. */
export function Correo({ valor }: { valor: string | null }) {
  return valor ? <a href={`mailto:${valor}`}>{valor}</a> : <Pendiente />;
}
