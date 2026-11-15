import type { StatusTone } from "@/app/_components/ui/StatusBadge";

/** El nombre y el color con que se muestra el estado de un ticket. */
export function estadoBadge(estado: string): { label: string; tone: StatusTone } {
  const map: Record<string, { label: string; tone: StatusTone }> = {
    abierto: { label: "Abierto", tone: "info" },
    en_progreso: { label: "En progreso", tone: "warning" },
    escalado: { label: "Escalado", tone: "warning" },
    resuelto: { label: "Resuelto", tone: "success" },
    cerrado: { label: "Cerrado", tone: "success" },
  };
  // El CRM los guarda en mayúsculas y los tickets antiguos están en minúsculas.
  return map[estado.toLowerCase()] ?? { label: estado, tone: "neutral" };
}
