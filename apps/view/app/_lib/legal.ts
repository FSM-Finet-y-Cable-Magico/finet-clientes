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
export const POLITICA_PRIVACIDAD_VERSION = "1.2";

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

  // Privacidad: Ley 19.628, art. 14 ter, según la Ley 21.719 (desde el 1-12-2026).
  /** Letra d), los destinatarios: dónde se aloja el Portal en producción. */
  readonly alojamiento: Dato;
  /** Letra d): el servicio que envía los correos del Portal. */
  readonly servicioCorreo: Dato;
  /** Letra d): el proveedor de boletas y facturas electrónicas, si lo usan. */
  readonly facturacionElectronica: Dato;
  /** Letra h): los proveedores que guardan datos fuera de Chile, el país y sus garantías. */
  readonly transferenciasInternacionales: Dato;
  /** Letra i): los plazos de conservación que define la empresa. */
  readonly conservacionRegistrosRed: Dato;
  readonly conservacionAccesosPortal: Dato;
  readonly conservacionTickets: Dato;
  readonly conservacionSolicitudes: Dato;
};

/** Privacidad, letra d): la pasarela del Portal (CU-42) es la misma para las dos. */
export const PASARELA_PAGO = "Transbank (Webpay)";

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
  alojamiento: null,
  servicioCorreo: null,
  facturacionElectronica: null,
  transferenciasInternacionales: null,
  conservacionRegistrosRed: null,
  conservacionAccesosPortal: null,
  conservacionTickets: null,
  conservacionSolicitudes: null,
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
