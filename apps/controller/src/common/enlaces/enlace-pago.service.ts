import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Enlace directo para pagar, el que lleva el aviso de corte del CU-68.
 *
 * RF-50: "adjuntando el enlace directo a la pasarela de pagos".
 * RNF-50.1: "URL acortada y única, generada dinámicamente".
 *
 * Es corto, único y no necesita tabla: lo necesario para validarlo viaja dentro
 * del propio enlace, firmado con HMAC-SHA256. Nadie puede fabricarlo ni cambiarle
 * el cliente sin la clave.
 *
 * Reusarlo no hace daño —abrirlo dos veces muestra la misma deuda—, así que no se
 * lleva registro de los ya usados.
 *
 * Solo resuelve **a quién** le corresponde el pago. Cómo se paga depende de la
 * pasarela, que todavía no se elige.
 */

/** Siete días: una semana para pagar desde que llega el aviso. */
export const VIGENCIA_ENLACE_PAGO_MS = 7 * 24 * 60 * 60 * 1000;

const PREFIJO = 'p';
/** 16 bytes de HMAC: 128 bits, de sobra para que no se pueda adivinar. */
const BYTES_FIRMA = 16;
const BYTES_NONCE = 8;

@Injectable()
export class EnlacePagoService {
  constructor(private readonly config: ConfigService) {}

  /** Formato: `p.cliente.vence.nonce.firma`, en base36 y base64url. */
  crearEnlacePago(idCliente: number, ahora = new Date()): string {
    const vence = Math.floor(
      (ahora.getTime() + VIGENCIA_ENLACE_PAGO_MS) / 1000,
    );
    const cuerpo = [
      PREFIJO,
      this.num(idCliente),
      this.num(vence),
      randomBytes(BYTES_NONCE).toString('base64url'),
    ].join('.');
    return `${cuerpo}.${this.hmac(cuerpo)}`;
  }

  /** El `id_cliente` del enlace, o `null` si la firma no calza o ya venció. */
  verificarEnlacePago(token: string, ahora = new Date()): number | null {
    if (typeof token !== 'string' || token.length > 100) return null;
    const corte = token.lastIndexOf('.');
    if (corte <= 0) return null;

    const cuerpo = token.slice(0, corte);
    // Se compara el texto de la firma y no los bytes que decodifica: en base64
    // el último carácter lleva bits de relleno, y comparando bytes el mismo
    // enlace tendría varias escrituras válidas. Dejaría de ser único.
    const recibida = Buffer.from(token.slice(corte + 1));
    const esperada = Buffer.from(this.hmac(cuerpo));
    // En tiempo constante: si no, se podría adivinar la firma byte a byte
    // midiendo cuánto demora el rechazo.
    if (
      recibida.length !== esperada.length ||
      !timingSafeEqual(recibida, esperada)
    ) {
      return null;
    }

    const partes = cuerpo.split('.');
    if (partes.length !== 4 || partes[0] !== PREFIJO) return null;

    const idCliente = this.leerNum(partes[1]);
    const vence = this.leerNum(partes[2]);
    if (idCliente === null || vence === null) return null;
    if (vence * 1000 <= ahora.getTime()) return null;
    return idCliente;
  }

  /**
   * Falla si falta la clave. Para comprobarlo antes de despachar una tanda, y
   * no a mitad de camino con la mitad de los correos ya enviados.
   */
  verificarClave(): void {
    this.secreto();
  }

  private hmac(cuerpo: string): string {
    return createHmac('sha256', this.secreto())
      .update(cuerpo)
      .digest()
      .subarray(0, BYTES_FIRMA)
      .toString('base64url');
  }

  private secreto(): string {
    const secreto = this.config.get<string>('ENLACE_PAGO_SECRET');
    if (!secreto) {
      throw new Error(
        'ENLACE_PAGO_SECRET no está configurada en las variables de entorno',
      );
    }
    return secreto;
  }

  private num(n: number): string {
    return Math.trunc(n).toString(36);
  }

  private leerNum(texto: string | undefined): number | null {
    if (!texto || !/^[0-9a-z]+$/.test(texto)) return null;
    const n = parseInt(texto, 36);
    return Number.isSafeInteger(n) ? n : null;
  }
}
