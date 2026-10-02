import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  REINTENTOS_G8,
  RUTA_FACTURAS_G8,
  TIMEOUT_G8_MS,
  rutaResultadoWifiG8,
} from './g8-integracion.constantes.js';

/**
 * Llama a la API server-to-server de Grupo 8 con los contratos de su respuesta
 * del 02-10. La clave de API vive solo en el backend (acuerdo v2.0 §12) y no
 * pasa por ningún mensaje ni log.
 */

/** Las facturas se piden siempre dentro de una empresa (§2). */
export type SelectorFacturasG8 = { idEmpresa: number } & (
  | { idCliente: number }
  | { idContrato: number }
);

/**
 * Lo que usamos de cada factura. `saldoExigible` es "el monto actualmente
 * cobrable" (§2): el saldo lo calcula G8, y el portal no lo reconstruye.
 */
export type FacturaG8 = { idFactura: number; saldoExigible: number };

const respuestaFacturas = z.object({
  items: z.array(
    z.object({ idFactura: z.number(), saldoExigible: z.number() }),
  ),
});

/**
 * §12: los tres resultados del cambio de clave WiFi. `APLICADO` cierra el ticket
 * (Resuelto); los otros dos lo dejan Escalado.
 */
export type ResultadoWifiG8 =
  | 'APLICADO'
  | 'REQUIERE_ATENCION_MANUAL'
  | 'ERROR_TECNICO';

/**
 * Lo que se le informa a G8 del ticket WiFi. Nunca lleva la clave, el ciphertext
 * ni nada técnico de G3 (§12 y acuerdo v2.0 §6.5).
 */
export type InformeResultadoWifi = {
  idTicket: number;
  idEmpresa: number;
  requestId: string;
  traceId: string;
  resultado: ResultadoWifiG8;
  detalleSaneado: string;
};

/**
 * G8 no respondió o rechazó el pedido. `status` es su código HTTP, o `null` si
 * no hubo respuesta (falta configuración, corte o timeout). El mensaje nunca
 * trae la clave de API.
 */
export class ErrorIntegracionG8 extends Error {
  constructor(
    readonly status: number | null,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorIntegracionG8';
  }
}

@Injectable()
export class G8IntegracionService {
  constructor(private readonly config: ConfigService) {}

  /** §2: `GET /api/integrations/g2/invoices?id_empresa=…&id_cliente=…` (o `id_contrato`). */
  async facturas(selector: SelectorFacturasG8): Promise<FacturaG8[]> {
    const { base, apiKey } = this.configuracion();
    const url = new URL(RUTA_FACTURAS_G8, base);
    url.searchParams.set('id_empresa', String(selector.idEmpresa));
    if ('idContrato' in selector) {
      url.searchParams.set('id_contrato', String(selector.idContrato));
    } else {
      url.searchParams.set('id_cliente', String(selector.idCliente));
    }

    const res = await this.pedir(url, { method: 'GET' }, apiKey);
    const json: unknown = await res.json().catch(() => null);
    const leido = respuestaFacturas.safeParse(json);
    if (!leido.success) {
      throw new ErrorIntegracionG8(
        res.status,
        `G8 respondió ${res.status} sin las facturas de su contrato`,
      );
    }
    return leido.data.items;
  }

  /** §12: `POST /api/integrations/g2/tickets/{idTicket}/wifi-result`. */
  async informarResultadoWifi(informe: InformeResultadoWifi): Promise<void> {
    const { base, apiKey } = this.configuracion();
    const url = new URL(rutaResultadoWifiG8(informe.idTicket), base);
    const body = JSON.stringify({
      request_id: informe.requestId,
      trace_id: informe.traceId,
      id_empresa: informe.idEmpresa,
      resultado: informe.resultado,
      detalle_saneado: informe.detalleSaneado,
    });
    await this.pedir(url, { method: 'POST', body }, apiKey);
  }

  /**
   * Un pedido con su reintento. Un 4xx no se arregla reintentando: se informa
   * con su código y sin el cuerpo, que podría repetir datos del pedido.
   */
  private async pedir(
    url: URL,
    init: RequestInit,
    apiKey: string,
  ): Promise<Response> {
    let ultimoError = new ErrorIntegracionG8(null, 'G8 no respondió');
    for (let intento = 0; intento <= REINTENTOS_G8; intento++) {
      let res: Response;
      try {
        res = await fetch(url, {
          ...init,
          headers: {
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            'X-API-KEY': apiKey,
          },
          // La clave de API no sigue redirecciones hacia otro host.
          redirect: 'error',
          signal: AbortSignal.timeout(TIMEOUT_G8_MS),
        });
      } catch (error) {
        ultimoError = new ErrorIntegracionG8(
          null,
          `G8 no respondió (${error instanceof Error ? error.name : 'error de red'})`,
        );
        continue;
      }

      if (res.status >= 500) {
        ultimoError = new ErrorIntegracionG8(
          res.status,
          `G8 respondió ${res.status}`,
        );
        continue;
      }
      if (!res.ok) {
        throw new ErrorIntegracionG8(res.status, `G8 respondió ${res.status}`);
      }
      return res;
    }
    throw ultimoError;
  }

  /**
   * Las dos variables de G8. Si falta alguna no se llama: se nombra la que
   * falta, nunca su valor.
   */
  private configuracion(): { base: string; apiKey: string } {
    const base = this.config.get<string>('INTEGRACION_G8_API_URL')?.trim();
    const apiKey = this.config.get<string>('INTEGRACION_G8_API_KEY')?.trim();
    if (!base || !apiKey) {
      const faltan = [
        !base && 'INTEGRACION_G8_API_URL',
        !apiKey && 'INTEGRACION_G8_API_KEY',
      ].filter(Boolean);
      throw new ErrorIntegracionG8(
        null,
        `Falta configurar ${faltan.join(', ')}`,
      );
    }
    return { base, apiKey };
  }
}
