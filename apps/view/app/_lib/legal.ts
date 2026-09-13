/**
 * CU-73: datos de Términos y Privacidad que tiene que entregar Finet.
 *
 * `null` es un dato pendiente: la página deja el hueco marcado y el dato
 * figura en "Pendientes del CU-73" de docs/CASOS-DE-USO.md. Al recibirlo se
 * completa acá y se saca de esa lista. Los datos de identidad (RUT,
 * domicilio, correos) están en `company.ts`.
 */

type Dato = string | null;

export const LEGAL_ACTUALIZACION = "13 de septiembre de 2026";

/** Términos §4: calidad del servicio (Decreto 368). Los entrega el área técnica. */
export const CALIDAD_SERVICIO = {
  velocidadMinimaGarantizada: null,
  sobreventa: null,
  disponibilidad: null,
  latenciaYPerdida: null,
  direccionamientoIp: null,
  /** Medidas de seguridad de red, p. ej. bloqueo de puertos de abuso. */
  medidasSeguridadRed: null,
  /** Fecha de la primera medición trimestral del tiempo de reposición. */
  primeraMedicionReposicion: null,
} satisfies Record<string, Dato>;

/** Términos §7 y §10. Los entrega administración. */
export const CONDICIONES_CONTRATO = {
  mecanismoCompensacion: null,
  comunaTribunales: null,
} satisfies Record<string, Dato>;

/** Privacidad §3, §7 y §9: proveedores que tratan datos por cuenta de Finet. */
export const PROVEEDORES = {
  pasarelaPago: null,
  facturacionElectronica: null,
  correo: null,
  /** Región de Railway donde se aloja la base de datos. */
  regionAlojamiento: null,
} satisfies Record<string, Dato>;

/** Privacidad §6 y §12: plazos que define administración. */
export const PLAZOS_DATOS = {
  registrosTecnicosRed: null,
  logsPortal: null,
  tickets: null,
  solicitudesSinContrato: null,
  respuestaDerechos: null,
} satisfies Record<string, Dato>;
