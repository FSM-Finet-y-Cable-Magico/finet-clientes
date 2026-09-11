'use server';

import { cookies } from 'next/headers';

// CU-31, su Excepción 2 y RF-24 dicen "únicamente alfanuméricos"; se decidió
// permitir símbolos igual (pedido de Dani, confirmado por Emilio) — diverge
// del CU escrito, ver docs/CAMBIOS-PARA-EQUIPO-DOCUMENTACION.md. Se mantienen
// prohibidos los espacios en blanco. No se hace trim() de la clave: recortarla
// cambiaría la clave que el cliente escribió.
const WIFI_PASSWORD_REGEX = /^\S+$/;
const WIFI_PASSWORD_MIN = 8;
const WIFI_PASSWORD_MAX = 63; // WPA2 máximo

function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) throw new Error('API_URL no está configurada en las variables de entorno');
  return `${base}${path}`;
}

async function authHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * CU-31 + CU-32: solicitud de cambio de clave de red inalambrica.
 *
 * No cambia la clave: deja registrada la solicitud para que el CRM la ejecute
 * despues contra el equipo del cliente (CU-33). El formato se revalida aca
 * porque la validacion del componente corre en el navegador y no es confiable.
 */
export async function changeWifiPassword(
  idContrato: number,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(idContrato) || idContrato <= 0) {
    return { success: false, error: 'Selecciona el servicio al que aplicar el cambio' };
  }
  if (typeof password !== 'string' || password.length === 0) {
    return { success: false, error: 'Ingresa la nueva contraseña' };
  }
  if (password.length < WIFI_PASSWORD_MIN || password.length > WIFI_PASSWORD_MAX) {
    return {
      success: false,
      error: `La contraseña debe tener entre ${WIFI_PASSWORD_MIN} y ${WIFI_PASSWORD_MAX} caracteres`,
    };
  }
  if (!WIFI_PASSWORD_REGEX.test(password)) {
    return {
      success: false,
      error: 'No se permiten espacios en blanco',
    };
  }

  try {
    const res = await fetch(apiUrl('/portal/wifi/password'), {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ id_contrato: idContrato, password }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const mensaje = (data as { message?: string | string[] }).message;
      return {
        success: false,
        error:
          (Array.isArray(mensaje) ? mensaje[0] : mensaje) ??
          'No se pudo registrar la solicitud',
      };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'No se pudo conectar con el servidor' };
  }
}

export async function initiatePayment(): Promise<{
  success: boolean;
  redirectUrl?: string;
  error?: string;
}> {
  try {
    const res = await fetch(apiUrl('/portal/payment/initiate'), {
      method: 'POST',
      headers: await authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return { success: false, error: 'No se pudo iniciar el proceso de pago' };
    const data = (await res.json()) as { redirectUrl: string };
    return { success: true, redirectUrl: data.redirectUrl };
  } catch {
    return { success: false, error: 'No se pudo conectar con el servidor' };
  }
}
