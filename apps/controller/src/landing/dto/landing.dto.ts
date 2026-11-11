import { z } from 'zod';
import { esEmpresaConocida } from '../../common/constants/empresas.js';

export const ConsultaPlanesDto = z.object({
  tipo_cliente: z.string().max(20).optional(),
  /** Cada sitio (Finet o Cable Mágico) pide solo sus planes. */
  id_empresa: z.coerce
    .number()
    .int()
    .refine(esEmpresaConocida, { message: 'Empresa desconocida' })
    .optional(),
});
export type ConsultaPlanesDto = z.infer<typeof ConsultaPlanesDto>;

export interface PlanResponseDto {
  id_plan: number;
  /** De qué empresa es el plan: la contratación lo usa para el prospecto. */
  id_empresa: number | null;
  nombre_comercial: string;
  tipo_plan: string;
  tipo_cliente: string;
  velocidad_mbps: number | null;
  precio_mensual: number;
  descripcion: string | null;
}
