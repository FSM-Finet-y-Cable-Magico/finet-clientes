import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants, publicEncrypt } from 'node:crypto';
import {
  REINTENTOS_G3,
  RUTA_CLAVE_WIFI_G3,
  TIMEOUT_G3_MS,
} from './g3-wifi.constantes.js';

/**
 * Envía a Grupo 3 la nueva clave WiFi de un cliente: la llamada directa del
 * acuerdo v2.0 (§6.4, pasos 4 a 7). Lo que G3 hace después con ella es su CU-33.
 *
 * La clave se cifra con la llave pública de G3 (RSA-OAEP SHA-256, 3072 bits):
 * solo G3 puede leerla (§6.5). La clave y el ciphertext no se guardan ni pasan
 * por ningún log, y la clave de API de G3 vive solo en el backend (§12).
 *
 * El 201 de G3 dice que la solicitud quedó **registrada**: un técnico de G3 la
 * aplica después. Es justo la poscondición del CU-32.
 */

export type EnvioClaveWifi = {
  clave: string;
  idTicket: string;
  idContrato: number;
  idEmpresa: number;
  requestId: string;
  traceId: string;
};

/** Lo que devuelve G3. No trae secretos: se puede registrar en la auditoría. */
export type RespuestaClaveWifiG3 = {
  idSolicitud: number;
  estado: string;
  fecha: string;
  duplicado: boolean;
};

/**
 * La solicitud no llegó a G3 o G3 la rechazó. `status` es el código HTTP de G3,
 * o `null` si no hubo respuesta (falta configuración, corte o timeout). El
 * mensaje se puede llevar al log: nunca trae la clave, el ciphertext ni la
 * clave de API.
 */
export class ErrorClaveWifiG3 extends Error {
  constructor(
    readonly status: number | null,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorClaveWifiG3';
  }
}

@Injectable()
export class G3WifiService {
  constructor(private readonly config: ConfigService) {}

  async enviarClaveWifi(envio: EnvioClaveWifi): Promise<RespuestaClaveWifiG3> {
    const { url, apiKey, llave } = this.configuracion();

    // Se cifra una sola vez. OAEP es aleatorio: cifrar de nuevo da otro texto, y
    // G3 responde 409 si le llega el mismo request_id con otro contenido. Por eso
    // el reintento manda exactamente este mismo body.
    const body = JSON.stringify({
      ciphertext: this.cifrar(envio.clave, llave),
      id_ticket: envio.idTicket,
      id_contrato: envio.idContrato,
      id_empresa: envio.idEmpresa,
      request_id: envio.requestId,
      trace_id: envio.traceId,
    });

    let ultimoError = new ErrorClaveWifiG3(null, 'G3 no respondió');
    for (let intento = 0; intento <= REINTENTOS_G3; intento++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-API-KEY': apiKey,
          },
          body,
          // La clave de API no sigue redirecciones hacia otro host.
          redirect: 'error',
          signal: AbortSignal.timeout(TIMEOUT_G3_MS),
        });
      } catch (error) {
        // Corte o timeout: no se sabe si llegó. Se reintenta con el mismo body, y
        // si ya había llegado G3 responde 200 con `duplicado` sin reaplicarla.
        ultimoError = new ErrorClaveWifiG3(
          null,
          `G3 no respondió (${error instanceof Error ? error.name : 'error de red'})`,
        );
        continue;
      }

      if (res.status >= 500) {
        ultimoError = new ErrorClaveWifiG3(
          res.status,
          `G3 respondió ${res.status}`,
        );
        continue;
      }
      // 400, 401, 403 y 409 no se arreglan reintentando.
      if (res.status !== 200 && res.status !== 201) {
        throw new ErrorClaveWifiG3(
          res.status,
          `G3 respondió ${res.status}: ${await this.motivo(res)}`,
        );
      }
      return this.leerRespuesta(res);
    }
    throw ultimoError;
  }

  /** `{ success: true, data: { request_id, id_solicitud, estado, fecha, duplicado } }` */
  private async leerRespuesta(res: Response): Promise<RespuestaClaveWifiG3> {
    const json = (await res.json().catch(() => null)) as {
      success?: unknown;
      data?: Record<string, unknown>;
    } | null;
    const data = json?.data;
    if (
      json?.success !== true ||
      typeof data?.id_solicitud !== 'number' ||
      typeof data.estado !== 'string' ||
      typeof data.fecha !== 'string'
    ) {
      throw new ErrorClaveWifiG3(
        res.status,
        `G3 respondió ${res.status} sin los datos de su contrato`,
      );
    }
    return {
      idSolicitud: data.id_solicitud,
      estado: data.estado,
      fecha: data.fecha,
      duplicado: data.duplicado === true,
    };
  }

  /** El `message` de G3 (`ciphertext: no se pudo descifrar…`), acotado para el log. */
  private async motivo(res: Response): Promise<string> {
    const json = (await res.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const mensaje = Array.isArray(json?.message)
      ? json.message.join('; ')
      : json?.message;
    return typeof mensaje === 'string' ? mensaje.slice(0, 200) : 'sin detalle';
  }

  private cifrar(clave: string, llave: string): string {
    try {
      return publicEncrypt(
        {
          key: llave,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(clave, 'utf8'),
      ).toString('base64');
    } catch {
      throw new ErrorClaveWifiG3(
        null,
        'No se pudo cifrar la clave con la llave pública de G3',
      );
    }
  }

  /**
   * Las tres variables de G3. Si falta alguna no se envía nada: se nombra la que
   * falta, nunca su valor.
   */
  private configuracion(): { url: string; apiKey: string; llave: string } {
    const base = this.config.get<string>('G3_API_URL')?.trim();
    const apiKey = this.config.get<string>('G3_API_KEY')?.trim();
    const publica = this.config.get<string>('G3_WIFI_PUBLIC_KEY')?.trim();

    const faltan = [
      !base && 'G3_API_URL',
      !apiKey && 'G3_API_KEY',
      !publica && 'G3_WIFI_PUBLIC_KEY',
    ].filter(Boolean);
    if (!base || !apiKey || !publica) {
      throw new ErrorClaveWifiG3(null, `Falta configurar ${faltan.join(', ')}`);
    }

    // La llave viene en base64 de su PEM (una variable de entorno no admite
    // saltos de línea) o como PEM tal cual.
    const llave = publica.includes('-----BEGIN')
      ? publica
      : Buffer.from(publica, 'base64').toString('utf8');
    if (!llave.includes('-----BEGIN PUBLIC KEY-----')) {
      throw new ErrorClaveWifiG3(
        null,
        'G3_WIFI_PUBLIC_KEY no es un PEM ni un PEM en base64',
      );
    }

    return {
      url: `${base.replace(/\/+$/, '')}${RUTA_CLAVE_WIFI_G3}`,
      apiKey,
      llave,
    };
  }
}
