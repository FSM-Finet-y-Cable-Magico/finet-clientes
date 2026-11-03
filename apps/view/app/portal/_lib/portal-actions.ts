'use server';

import { cookies } from 'next/headers';
import { apiUrl } from '@/app/_lib/api-servidor';
import {
  CLAVE_WIFI_MAX,
  CLAVE_WIFI_MIN,
  CLAVE_WIFI_REGEX,
} from '@/app/_lib/clave-wifi';

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
  if (password.length < CLAVE_WIFI_MIN || password.length > CLAVE_WIFI_MAX) {
    return {
      success: false,
      error: `La contraseña debe tener entre ${CLAVE_WIFI_MIN} y ${CLAVE_WIFI_MAX} caracteres`,
    };
  }
  if (!CLAVE_WIFI_REGEX.test(password)) {
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
