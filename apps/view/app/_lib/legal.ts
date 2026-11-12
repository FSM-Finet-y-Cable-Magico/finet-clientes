/**
 * CU-73: datos de Términos y Privacidad que tiene que entregar cada empresa.
 *
 * Solo va lo que exige una norma, citada en cada campo: lo que ninguna pide no
 * se publica (Emilio, 12-11). `null` es un dato pendiente: la página deja el
 * hueco marcado. Los datos de identidad (RUT, domicilio, representante legal
 * y correos) están en `company.ts`.
 */

import { esSlugMarca, type Marca, type SlugMarca } from "./company";

type Dato = string | null;

export const LEGAL_ACTUALIZACION = "12 de noviembre de 2026";

/**
 * Versión publicada en /privacidad. Viaja con cada aceptación (CU-75), así
 * que al cambiar el texto de la política hay que subirla.
 */
export const POLITICA_PRIVACIDAD_VERSION = "1.1";

/** CU-75, Excepción 1. El backend responde lo mismo si llega sin marcar. */
export const MENSAJE_POLITICA_REQUERIDA =
  "Debes aceptar la Política de Privacidad para continuar.";

/** Lo que cada empresa publica como proveedor de Internet. */
export type DatosLegales = {
  // Términos §4, lo que se ofrece en cada plan.
  /**
   * Ley 18.168, art. 24 K: el porcentaje garantizado de las velocidades
   * promedio, en horario de mayor y menor congestión, nacional e internacional.
   */
  readonly velocidadGarantizada: Dato;
  /** Decreto 368, art. 5 a). */
  readonly limiteDescarga: Dato;
  /** Decreto 368, art. 5 b): expresada como 1:XX. */
  readonly sobreventa: Dato;
  /** Decreto 368, art. 5 e): nacional e internacional. */
  readonly calidadEnlace: Dato;
  /**
   * Decreto 368, arts. 5 f) y 7: si las hay, sus características y efectos:
   * aplicaciones y protocolos afectados, períodos de alta demanda, si son
   * horarias o semanales y si son para tráfico nacional o internacional.
   */
  readonly gestionTrafico: Dato;
  /** Decreto 368, art. 9, y Ley 18.168, art. 24 H c): cómo funciona, cómo se usa y su costo. */
  readonly controlParental: Dato;

  // Términos §4, lo medido cada trimestre (Decreto 368, arts. 3, 4 y 5 c y d).
  readonly trimestre: Dato;
  readonly tiempoLogin: Dato;
  readonly velocidadConseguida: Dato;
  readonly transmisionesFallidas: Dato;
  readonly accesosExitosos: Dato;
  readonly retardo: Dato;
  readonly tiempoReposicion: Dato;
  /** El porcentaje, y el tiempo objetivo que define la propia empresa. */
  readonly reparadasEnTiempoObjetivo: Dato;

  // Términos §6, reclamos (Decreto 194 de 2012).
  /** Art. 6: el mes informado de la línea telefónica de reclamos. */
  readonly mesReclamos: Dato;
  readonly llamadasAtendidas: Dato;
  readonly tiempoEspera: Dato;
  readonly llamadasAbandonadas: Dato;
  /** Art. 33: la dirección del informativo de derechos que entrega Subtel. */
  readonly informativoSubtel: Dato;
};

const SIN_DATOS: DatosLegales = {
  velocidadGarantizada: null,
  limiteDescarga: null,
  sobreventa: null,
  calidadEnlace: null,
  gestionTrafico: null,
  controlParental: null,
  trimestre: null,
  tiempoLogin: null,
  velocidadConseguida: null,
  transmisionesFallidas: null,
  accesosExitosos: null,
  retardo: null,
  tiempoReposicion: null,
  reparadasEnTiempoObjetivo: null,
  mesReclamos: null,
  llamadasAtendidas: null,
  tiempoEspera: null,
  llamadasAbandonadas: null,
  informativoSubtel: null,
};

/**
 * Cada empresa con los suyos: son dos proveedores distintos. Al recibirlos,
 * `finet: { ...SIN_DATOS, sobreventa: "1:20" }`.
 */
const LEGALES: Record<SlugMarca, DatosLegales> = {
  finet: SIN_DATOS,
  "cable-magico": SIN_DATOS,
};

export function legalesDe(marca: Marca): DatosLegales {
  return esSlugMarca(marca.slug) ? LEGALES[marca.slug] : SIN_DATOS;
}

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
