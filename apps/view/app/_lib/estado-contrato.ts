import type { StatusTone } from "@/app/_components/ui/StatusBadge";

/**
 * Etiqueta y color con que se muestra el estado de un contrato.
 *
 * Los valores vienen de la Tabla 11.15 del Documento 0 ("Enumeraciones
 * Consolidadas"): ACTIVO | SUSPENDIDO | CORTADO | BAJA | PENDIENTE | REACTIVADO.
 *
 * El backend ya los normaliza, pero acá se compara en mayúsculas igual: la base
 * es compartida con los otros equipos y todavía conviven valores antiguos en
 * minúscula.
 */
const ESTADOS: Record<string, { label: string; tone: StatusTone }> = {
  ACTIVO: { label: "Activo", tone: "success" },
  REACTIVADO: { label: "Reactivado", tone: "success" },
  PENDIENTE: { label: "En trámite", tone: "neutral" },
  SUSPENDIDO: { label: "Suspendido", tone: "warning" },
  CORTADO: { label: "Cortado", tone: "error" },
  BAJA: { label: "De baja", tone: "neutral" },
  // Valores heredados que siguen en la base.
  EN_TRAMITE: { label: "En trámite", tone: "neutral" },
  INACTIVO: { label: "De baja", tone: "neutral" },
};

export function estadoContratoBadge(estado: string): {
  label: string;
  tone: StatusTone;
} {
  const clave = estado?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  // Un estado que no conocemos se muestra tal cual en vez de dejar el hueco:
  // es preferible que el cliente lea algo raro a que no vea nada.
  return ESTADOS[clave] ?? { label: estado, tone: "neutral" };
}
