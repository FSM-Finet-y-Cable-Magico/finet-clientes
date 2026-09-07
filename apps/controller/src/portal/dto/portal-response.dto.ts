// ─── CU-23: Estado operativo del contrato ─────────────────────────────────────
export interface ContratoEstadoDto {
  id_contrato: number;
  estado: string; // 'activo' | 'suspendido' | 'cortado' | 'inactivo'
  fecha_inicio: string;
  fecha_suspension: string | null;
}

// ─── CU-24: Panel principal del Portal Cliente ────────────────────────────────
export interface PanelPrincipalDto {
  cliente: {
    id_cliente: number;
    nombre_completo: string;
    rut: string | null;
    email: string | null;
    telefono: string | null;
  };
  contratos: ContratoResumenDto[];
  resumen_deuda: ResumenDeudaDto;
  tickets_recientes: TicketResumenDto[];
}

// ─── CU-25 / CU-26: Plan(es) vigente(s) ──────────────────────────────────────
export interface ContratoResumenDto {
  id_contrato: number;
  estado: string;
  fecha_inicio: string;
  dia_vencimiento: number;
  plan: {
    id_plan: number;
    nombre_comercial: string;
    tipo_plan: string;
    velocidad_mbps: number | null;
    precio_mensual: number;
  } | null;
}

// ─── CU-27 / CU-28: Estado de deuda ──────────────────────────────────────────
export interface ResumenDeudaDto {
  tiene_deuda: boolean;
  saldo_total: number; // suma de facturas pendientes
  saldo_confirmado: boolean; // false si el saldo es inconsistente o inválido (CU-27 Excepción 3)
  facturas_pendientes: FacturaPendienteDto[];
}

export interface FacturaPendienteDto {
  id_factura: number;
  periodo: string; // ej: "Mayo 2026"
  monto: number;
  fecha_limite_pago: string;
  estado: string;
  dias_vencida: number | null; // null si aún no vence
}

// ─── CU-29 / CU-30: Tickets de soporte ───────────────────────────────────────
export interface TicketsResponseDto {
  total: number;
  tiene_tickets: boolean; // false → CU-29 estado vacío
  tickets: TicketResumenDto[];
}

export interface TicketResumenDto {
  id_ticket: number;
  codigo_seguimiento: string | null;
  estado: string;
  prioridad: string;
  descripcion: string | null;
  fecha_creacion: string;
  fecha_cierre: string | null;
  categoria: string;
  origen: string | null;
}

// CU-71: Registro de solicitud de soporte desde el portal.
export interface CategoriaTicketDto {
  id_categoria: number;
  nombre: string;
}

export interface CrearTicketResponseDto {
  id_ticket: number;
  codigo_seguimiento: string;
}
