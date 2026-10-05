/**
 * Anonimización de direcciones IP (RNF-59.1).
 *
 * Solo la usa el registro de consentimiento (CU-75): ahí la IP es evidencia de
 * origen, no un dato operativo, así que basta la red. El resto del sistema
 * guarda la IP completa **a propósito** — `intento_fallido.ip_address` porque
 * el RF-05 bloquea una IP exacta y el CU-06 guarda el historial de esos
 * bloqueos, y `sesion_portal` y la auditoría de perfil porque son rastro de
 * seguridad.
 *
 * Es una medida de minimización: quien pueda leer la base sigue viendo IPs
 * completas en esas otras tablas. Cifrarlas se descartó el 01-10-2026: ningún
 * CU ni RNF lo pide, y el CU-06 ya no las muestra en ningún panel.
 */

/** Se conserva la red y se descarta el equipo. */
export const MASCARA_IPV4 = 24;
export const MASCARA_IPV6 = 48;

/** IPv4 mapeada en IPv6: `::ffff:1.2.3.4` y la forma con grupo extra de RFC 2765. */
const IPV4_MAPEADA = /^::ffff:(?:0:)?(\d{1,3}(?:\.\d{1,3}){3})$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Las que usan los controllers cuando Express no pudo determinar el origen. */
const SIN_ORIGEN = new Set(['0.0.0.0', '::']);

function anonimizarIpv4(ip: string): string | null {
  const partes = IPV4.exec(ip);
  if (!partes) return null;

  const octetos = partes.slice(1).map(Number);
  if (octetos.some((o) => o > 255)) return null;

  return `${octetos[0]}.${octetos[1]}.${octetos[2]}.0/${MASCARA_IPV4}`;
}

/** Expande la abreviación `::` para poder quedarse con los primeros 3 grupos. */
function expandirIpv6(ip: string): string[] | null {
  const mitades = ip.split('::');
  if (mitades.length > 2) return null;

  const grupo = /^[0-9a-f]{1,4}$/;
  const izquierda = mitades[0] ? mitades[0].split(':') : [];
  const derecha = mitades[1] ? mitades[1].split(':') : [];
  if (![...izquierda, ...derecha].every((g) => grupo.test(g))) return null;

  if (mitades.length === 1) {
    return izquierda.length === 8 ? izquierda : null;
  }

  const faltantes = 8 - izquierda.length - derecha.length;
  if (faltantes < 1) return null;

  const ceros: string[] = new Array<string>(faltantes).fill('0');
  return [...izquierda, ...ceros, ...derecha];
}

function anonimizarIpv6(ip: string): string | null {
  const grupos = expandirIpv6(ip);
  if (!grupos) return null;

  // Los 3 primeros grupos son los 48 bits que se conservan.
  const red = grupos.slice(0, 3).map((g) => g.replace(/^0+(?=.)/, ''));
  while (red.length > 0 && red[red.length - 1] === '0') red.pop();

  return `${red.join(':')}::/${MASCARA_IPV6}`;
}

/**
 * Devuelve la red de la IP (`203.0.113.0/24`, `2001:db8:85a3::/48`), o `null`
 * si no se puede determinar el origen.
 *
 * `null` y no una excepción: la columna destino es `inet` y Postgres rechaza un
 * valor inválido, así que una IP rara reventaría la transacción completa del
 * formulario. Sin IP el consentimiento se registra igual.
 */
export function anonimizarIp(ip: string): string | null {
  const limpia = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');

  if (!limpia || SIN_ORIGEN.has(limpia)) return null;

  const mapeada = IPV4_MAPEADA.exec(limpia);
  if (mapeada) return anonimizarIpv4(mapeada[1]);

  return limpia.includes(':') ? anonimizarIpv6(limpia) : anonimizarIpv4(limpia);
}
