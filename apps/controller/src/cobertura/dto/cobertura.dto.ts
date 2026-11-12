import { z } from 'zod';
import { esEmpresaConocida } from '../../common/constants/empresas.js';

/** Cada sitio (Finet o Cable Mágico) pide el visor de su red; sin él, Finet. */
export const consultaVisorCoberturaSchema = z.object({
  id_empresa: z.coerce
    .number()
    .int()
    .refine(esEmpresaConocida, { message: 'Empresa desconocida' })
    .optional(),
});
export type ConsultaVisorCoberturaDto = z.infer<
  typeof consultaVisorCoberturaSchema
>;

/**
 * CU-60: filtro opcional de la capa de calor por tipo de cobertura.
 */
export const consultaPuntosCoberturaSchema =
  consultaVisorCoberturaSchema.extend({
    tipo_cobertura: z.string().max(20).optional(),
  });
export type ConsultaPuntosCoberturaDto = z.infer<
  typeof consultaPuntosCoberturaSchema
>;

/**
 * Celda del mapa de calor público. No lleva id a propósito: es una celda de la
 * grilla derivada del trazado de la red, no una fila de la base, así que un id
 * sería inventado.
 */
export interface PuntoMapaDto {
  latitud: number;
  longitud: number;
  densidad_cobertura: number;
  tipo_cobertura: string | null;
}

/**
 * CU-59 / CU-61 / CU-62: parámetros de inicialización del visor.
 * `zoom_min`/`zoom_max` acotan el rango de escala (CU-61) y `limites`
 * define el borde geográfico más allá del cual no se puede panear (CU-62).
 */
export interface VisorCoberturaConfigDto {
  centro: { latitud: number; longitud: number };
  zoom_inicial: number;
  zoom_min: number;
  zoom_max: number;
  limites: {
    sur_oeste: { latitud: number; longitud: number };
    nor_este: { latitud: number; longitud: number };
  };
}
