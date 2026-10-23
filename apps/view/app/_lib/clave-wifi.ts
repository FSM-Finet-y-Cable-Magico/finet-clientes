/**
 * Formato de la clave WiFi (CU-31). Lo validan el formulario y, de nuevo, la
 * acción del servidor, porque la validación del navegador no es confiable.
 *
 * El CU-31, su Excepción 2 y el RF-24 dicen "únicamente alfanuméricos"; se
 * decidió permitir símbolos igual (pedido de Dani, confirmado por Emilio) —
 * diverge del CU escrito, ver docs/CAMBIOS-PARA-EQUIPO-DOCUMENTACION.md. Se
 * mantienen prohibidos los espacios en blanco. No se hace trim(): recortarla
 * cambiaría la clave que el cliente escribió.
 */
export const CLAVE_WIFI_REGEX = /^\S+$/;
export const CLAVE_WIFI_MIN = 8;
export const CLAVE_WIFI_MAX = 63; // WPA2 máximo
