import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { anonimizarIp } from './utils/ip.js';

/**
 * CU-75: aceptacion explicita de la Politica de Privacidad en los formularios
 * que capturan datos (contratacion y registro de cuenta).
 */

export const ACCION_ACEPTAR_POLITICA = 'ACEPTAR_POLITICA_PRIVACIDAD';

/** Excepcion 1: sin la casilla marcada el backend tampoco procesa el formulario. */
export const MENSAJE_POLITICA_REQUERIDA =
  'Debes aceptar la Política de Privacidad para continuar';

/** Campos que se suman al DTO de cada formulario. */
export const aceptacionPoliticaShape = {
  acepta_politica_privacidad: z.literal(true, {
    error: MENSAJE_POLITICA_REQUERIDA,
  }),
  /** La version publicada en /privacidad que el cliente tenia a la vista. */
  version_politica_privacidad: z.string().trim().min(1).max(20),
};

/**
 * A quien pertenece la aceptacion. Hoy siempre 'cliente'; queda explicito
 * porque el acuerdo con G8 (v2.0, §4) obliga a que el formulario publico pase
 * a persistir solo Prospecto, y ese dia el registro debe seguirlo.
 */
export type EntidadConsentimiento = 'cliente' | 'prospecto';

type RegistroAceptacion = {
  formulario: 'CONTRATACION' | 'REGISTRO';
  entidad: EntidadConsentimiento;
  id_entidad: number;
  version: string;
  ip: string;
  /** Lo que el cliente envio junto con la aceptacion. Nunca la contrasena. */
  datos: Prisma.InputJsonObject;
};

/**
 * Registra la aceptacion en `log_auditoria` (sin cambios de schema en la base
 * compartida). Va dentro de la transaccion del formulario: si no queda
 * registrada, no se procesa nada. `fecha_hora` es la marca de tiempo.
 *
 * La IP se guarda anonimizada a la red (RNF-59.1). Es minimizacion, no
 * proteccion: `sesion_portal` e `intento_fallido` siguen con la IP completa
 * porque la necesitan para operar. Cifrarlas queda pendiente para el I3/I4,
 * junto con la tarea de la clave WiFi (ver docs/2026-09-28-...md).
 */
export async function registrarAceptacionPolitica(
  tx: Prisma.TransactionClient,
  { formulario, entidad, id_entidad, version, ip, datos }: RegistroAceptacion,
): Promise<void> {
  await tx.log_auditoria.create({
    data: {
      accion: ACCION_ACEPTAR_POLITICA,
      entidad_afectada: entidad,
      id_entidad_afectada: id_entidad,
      valor_nuevo: { formulario, version_politica: version, datos },
      ip_origen: anonimizarIp(ip),
    },
  });
}
