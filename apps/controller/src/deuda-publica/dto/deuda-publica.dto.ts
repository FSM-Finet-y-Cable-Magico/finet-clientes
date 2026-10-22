import { z } from 'zod';
import { validateRut } from '../../common/utils/rut.js';

// CU-39: Consultar deuda pública por RUT
export const ConsultaDeudaRutDto = z.object({
  rut: z
    .string()
    .min(1, 'El RUT es requerido')
    .max(12)
    .refine((val) => /^\d{1,8}[\dkK]$/.test(val), {
      message: 'Formato inválido. Ej: 123456785',
    })
    .refine((val) => validateRut(val), {
      message: 'RUT inválido — dígito verificador incorrecto',
    }),
});
export type ConsultaDeudaRutDto = z.infer<typeof ConsultaDeudaRutDto>;

// ─── Respuesta compartida CU-39 / CU-41 ──────────────────────────────────────
export interface DeudaPublicaResponseDto {
  encontrado: boolean;
  cliente: {
    nombre_completo: string;
    rut: string | null;
  } | null;
  tiene_deuda: boolean;
  saldo_total: number;
  facturas: DetalleFacturaPublicaDto[];
  // Detalle del/los plan(es) contratado(s) por el cliente
  planes: PlanResumenPublicoDto[];
  // CU-41 Excepción 1: false si no fue posible obtener el detalle de facturación
  detalle_disponible: boolean;
  // CU-41 Excepción 2: false si hay montos o fechas inconsistentes en las facturas
  informacion_completa: boolean;
}

// Resumen del plan contratado para mostrar en la consulta pública de deuda
export interface PlanResumenPublicoDto {
  nombre_comercial: string;
  tipo_plan: string;
  velocidad_mbps: number | null;
  precio_mensual: number;
}

// CU-41: Detalle de deuda y fecha de vencimiento
export interface DetalleFacturaPublicaDto {
  id_factura: number;
  periodo: string;
  monto: number;
  fecha_limite_pago: string;
  estado: string;
  dias_vencida: number | null;
  dias_para_vencer: number | null; // null si ya está vencida
}
