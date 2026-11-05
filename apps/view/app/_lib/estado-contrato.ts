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

/**
 * Lleva cualquier variante escrita en la base al valor canónico en MAYÚSCULAS
 * de la Tabla 11.15. El §11.6 del mismo documento deja explícito que el enum se
 * guarda `ACTIVO` y solo la etiqueta visible va capitalizada ("Activo"), así que
 * comparar contra minúsculas es comparar contra el formato de presentación.
 */
export function estadoContratoCanonico(estado: string): string {
  return estado?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
}

/**
 * Si el servicio está operativo. Es lo que habilita pedir el cambio de clave
 * WiFi (CU-32 Excepción 2 impide pedirlo sobre un servicio no activo).
 *
 * REACTIVADO queda fuera a propósito, igual que en el backend
 * (`common/constants/contrato.ts`): la tabla 11.15 lo lista como estado
 * distinto de ACTIVO.
 */
export function esContratoActivo(estado: string): boolean {
  return estadoContratoCanonico(estado) === "ACTIVO";
}

export function estadoContratoBadge(estado: string): {
  label: string;
  tone: StatusTone;
} {
  const clave = estadoContratoCanonico(estado);
  // Un estado que no conocemos se muestra tal cual en vez de dejar el hueco:
  // es preferible que el cliente lea algo raro a que no vea nada.
  return ESTADOS[clave] ?? { label: estado, tone: "neutral" };
}
