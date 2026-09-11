import { z } from 'zod';

// ─── CU-31: Validando formato de nueva clave de red inalambrica ──────────────
// CU-31, su Excepcion 2 y RF-24 dicen textual "unicamente caracteres
// alfanumericos". Se decidio permitir simbolos igual (pedido de Dani en el
// PR #6/#9 de incremento-2/autogestion, retomado y confirmado por Emilio) por
// sobre lo que dice el CU escrito. Se mantiene la prohibicion de espacios en
// blanco porque una passphrase WPA2 con espacios sin comillas no es valida en
// la mayoria de los equipos.
//
// Esto es una divergencia respecto del documento fuente: queda registrada en
// docs/CAMBIOS-PARA-EQUIPO-DOCUMENTACION.md para que se actualice CU-31 y
// RF-24 alla, no solo aca.
export const WIFI_PASSWORD_REGEX = /^\S+$/;
export const WIFI_PASSWORD_MIN = 8;
export const WIFI_PASSWORD_MAX = 63;

export const solicitarCambioWifiSchema = z
  .object({
    id_contrato: z.number().int().positive('Selecciona un servicio valido'),
    password: z
      .string()
      .min(WIFI_PASSWORD_MIN, `Minimo ${WIFI_PASSWORD_MIN} caracteres`)
      .max(WIFI_PASSWORD_MAX, `Maximo ${WIFI_PASSWORD_MAX} caracteres`)
      .regex(WIFI_PASSWORD_REGEX, 'No se permiten espacios en blanco'),
  })
  .strict();

export type SolicitarCambioWifiDto = z.infer<typeof solicitarCambioWifiSchema>;
