import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from 'transbank-sdk';
import { TIMEOUT_WEBPAY_MS } from './pagos.constantes.js';

/**
 * CU-42: Webpay Plus con el SDK oficial de Transbank (RNF-31.1), que habla con
 * Webpay solo por HTTPS (RNF-31.2). Acá no hay reglas de negocio: crea, confirma,
 * consulta y anula transacciones, y valida lo que responde Transbank.
 *
 * El ambiente sale de `WEBPAY_AMBIENTE`:
 * - `integracion` (por defecto): las credenciales de prueba que trae el SDK;
 * - `produccion`: el código de comercio y la llave de Finet, solo en el `.env`
 *   del servidor (`WEBPAY_CODIGO_COMERCIO` y `WEBPAY_API_KEY`).
 */

/** Lo que el portal usa del SDK. Va detrás de un token para poder probarlo. */
export type TransaccionSdk = Pick<
  InstanceType<typeof WebpayPlus.Transaction>,
  'create' | 'commit' | 'status' | 'refund'
>;
export type SdkWebpay = (opciones: Options) => TransaccionSdk;
export const SDK_WEBPAY = Symbol('SDK_WEBPAY');
export const sdkWebpay: SdkWebpay = (opciones) =>
  new WebpayPlus.Transaction(opciones);

/** Una transacción tal como la informa Webpay (commit y status responden igual). */
export type TransaccionWebpay = {
  /** `INITIALIZED`, `AUTHORIZED`, `FAILED`, `REVERSED`, `NULLIFIED`… */
  estado: string;
  /** `0` es aprobada; cualquier otro, rechazada. */
  codigoRespuesta: number | null;
  monto: number;
  ordenCompra: string;
  sesion: string;
  codigoAutorizacion: string | null;
  /** Fecha y hora de la autorización (ISO 8601). */
  fecha: string | null;
};

/**
 * Webpay no respondió, respondió algo que no se entiende o falta configurarlo.
 * El mensaje nunca trae la llave.
 */
export class ErrorWebpay extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorWebpay';
  }
}

const respuestaCreacion = z.object({
  token: z.string().min(1),
  url: z.string().url(),
});

const respuestaTransaccion = z.object({
  status: z.string(),
  response_code: z.number().nullish(),
  amount: z.number(),
  buy_order: z.string(),
  session_id: z.string(),
  authorization_code: z.string().nullish(),
  transaction_date: z.string().nullish(),
});

const respuestaAnulacion = z.object({
  type: z.string(),
  response_code: z.number().nullish(),
});

@Injectable()
export class WebpayService {
  constructor(
    private readonly config: ConfigService,
    @Inject(SDK_WEBPAY) private readonly sdk: SdkWebpay,
  ) {}

  /** Inicia el pago. Webpay responde la URL de su formulario y el token. */
  async crear(
    ordenCompra: string,
    sesion: string,
    monto: number,
  ): Promise<{ url: string; token: string }> {
    const urlRetorno = this.urlRetorno();
    const respuesta = await this.llamar((tx) =>
      tx.create(ordenCompra, sesion, monto, urlRetorno),
    );
    const leida = respuestaCreacion.safeParse(respuesta);
    if (!leida.success) {
      throw new ErrorWebpay('Webpay respondió sin la URL ni el token');
    }
    return leida.data;
  }

  /** El commit: confirma el resultado una vez que el cliente vuelve. */
  async confirmar(token: string): Promise<TransaccionWebpay> {
    return this.leerTransaccion(await this.llamar((tx) => tx.commit(token)));
  }

  /** El estado, en cualquier momento (Webpay lo guarda siete días). */
  async estado(token: string): Promise<TransaccionWebpay> {
    return this.leerTransaccion(await this.llamar((tx) => tx.status(token)));
  }

  /**
   * Anula el cobro completo. El mismo día queda como reversa; después, como
   * anulación. `true` si Webpay lo aceptó.
   */
  async anular(token: string, monto: number): Promise<boolean> {
    const leida = respuestaAnulacion.safeParse(
      await this.llamar((tx) => tx.refund(token, monto)),
    );
    if (!leida.success) return false;
    return leida.data.type === 'REVERSED' || leida.data.response_code === 0;
  }

  private leerTransaccion(respuesta: unknown): TransaccionWebpay {
    const leida = respuestaTransaccion.safeParse(respuesta);
    if (!leida.success) {
      throw new ErrorWebpay('Webpay respondió una transacción incompleta');
    }
    const t = leida.data;
    return {
      estado: t.status,
      codigoRespuesta: t.response_code ?? null,
      monto: t.amount,
      ordenCompra: t.buy_order,
      sesion: t.session_id,
      codigoAutorizacion: t.authorization_code ?? null,
      fecha: t.transaction_date ?? null,
    };
  }

  /**
   * Una llamada al SDK. Su error trae el de axios, con los headers del pedido,
   * así que de él solo se usa el texto que respondió Transbank.
   */
  private async llamar(
    pedido: (tx: TransaccionSdk) => Promise<unknown>,
  ): Promise<unknown> {
    const tx = this.sdk(this.opciones());
    try {
      return await pedido(tx);
    } catch (error) {
      throw new ErrorWebpay(`Webpay respondió con un error: ${motivo(error)}`);
    }
  }

  private opciones(): Options {
    const ambiente =
      this.config.get<string>('WEBPAY_AMBIENTE')?.trim() || 'integracion';

    if (ambiente === 'integracion') {
      return new Options(
        IntegrationCommerceCodes.WEBPAY_PLUS,
        IntegrationApiKeys.WEBPAY,
        Environment.Integration,
        TIMEOUT_WEBPAY_MS,
      );
    }
    if (ambiente === 'produccion') {
      const codigo = this.config.get<string>('WEBPAY_CODIGO_COMERCIO')?.trim();
      const llave = this.config.get<string>('WEBPAY_API_KEY')?.trim();
      if (!codigo || !llave) {
        const faltan = [
          !codigo && 'WEBPAY_CODIGO_COMERCIO',
          !llave && 'WEBPAY_API_KEY',
        ].filter(Boolean);
        throw new ErrorWebpay(`Falta configurar ${faltan.join(', ')}`);
      }
      return new Options(
        codigo,
        llave,
        Environment.Production,
        TIMEOUT_WEBPAY_MS,
      );
    }
    throw new ErrorWebpay(
      'WEBPAY_AMBIENTE tiene que ser "integracion" o "produccion"',
    );
  }

  /** Adónde vuelve el cliente desde Webpay. En producción, solo por HTTPS. */
  private urlRetorno(): string {
    const url = this.config.get<string>('WEBPAY_URL_RETORNO')?.trim();
    if (!url) throw new ErrorWebpay('Falta configurar WEBPAY_URL_RETORNO');
    const produccion =
      this.config.get<string>('WEBPAY_AMBIENTE')?.trim() === 'produccion';
    if (produccion && !url.startsWith('https://')) {
      throw new ErrorWebpay(
        'En producción, WEBPAY_URL_RETORNO tiene que ser HTTPS',
      );
    }
    return url;
  }
}

/** El texto de un error del SDK en una línea, sin el objeto que lo causó. */
function motivo(error: unknown): string {
  if (!(error instanceof Error)) return 'error desconocido';
  return error.message.split('\n').filter(Boolean).join(' · ').slice(0, 200);
}
