import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServidoresMedicionDto } from './dto/diagnostico.dto.js';

const CANTIDAD_TARGETS = 5;
const TIMEOUT_MS = 5_000;
/** Margen antes del vencimiento real, para no entregar una URL a punto de morir. */
const MARGEN_CACHE_MS = 5 * 60_000;

type RespuestaApiFast = {
  targets?: { url?: string }[];
};

type CacheServidores = {
  targets: string[];
  validoHasta: number;
};

/**
 * CU-34 / CU-35: entrega al navegador los servidores de medicion de fast.com.
 *
 * Existe este proxy porque `api.fast.com` responde con
 * `Access-Control-Allow-Origin` solo para `https://fast.com`: desde cualquier
 * otro origen el navegador no puede leer la respuesta. La transferencia en si
 * no necesita proxy — los CDN de Netflix responden con `*` — asi que el
 * navegador mide directo contra ellos y aca solo se resuelve el descubrimiento.
 *
 * Contrapartida conocida: Netflix elige los CDN por la IP de quien consulta e
 * ignora `X-Forwarded-For`, asi que los servidores quedan elegidos para la red
 * del servidor y no la del cliente. La medicion sigue siendo real, pero puede
 * quedar por debajo de la capacidad del cliente si el camino no es el optimo
 * para su ISP.
 */
@Injectable()
export class DiagnosticoService {
  private readonly logger = new Logger(DiagnosticoService.name);
  private cache: CacheServidores | null = null;

  // Se lee por ConfigService y no con `process.env` a nivel de modulo: las
  // constantes de modulo se evaluan antes de que Nest cargue el ConfigModule,
  // asi que ahi el token todavia no existe.
  constructor(private readonly configService: ConfigService) {}

  async getServidores(): Promise<ServidoresMedicionDto> {
    if (this.cache && Date.now() < this.cache.validoHasta) {
      return { targets: this.cache.targets };
    }

    const targets = await this.consultarFast();
    this.cache = {
      targets,
      validoHasta: this.calcularVencimiento(targets),
    };

    return { targets };
  }

  private async consultarFast(): Promise<string[]> {
    const token = this.configService.get<string>('FAST_TOKEN');
    const apiUrl =
      this.configService.get<string>('FAST_API_URL') ??
      'https://api.fast.com/netflix/speedtest/v2';

    if (!token) {
      this.logger.error('FAST_TOKEN no esta configurado');
      throw new ServiceUnavailableException(
        'El servicio de medicion no esta disponible',
      );
    }

    const url = `${apiUrl}?https=true&token=${token}&urlCount=${CANTIDAD_TARGETS}`;

    let data: RespuestaApiFast;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        throw new Error(`fast.com respondio ${res.status}`);
      }
      data = (await res.json()) as RespuestaApiFast;
    } catch (error) {
      this.logger.error(
        `No se pudo consultar fast.com: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de medicion no esta disponible',
      );
    }

    const targets = (data.targets ?? [])
      .map((t) => t.url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);

    if (targets.length === 0) {
      this.logger.error('fast.com no entrego servidores de medicion');
      throw new ServiceUnavailableException(
        'El servicio de medicion no esta disponible',
      );
    }

    return targets;
  }

  /**
   * Las URLs vienen firmadas y traen su vencimiento en el parametro `e=`
   * (epoch en segundos, alrededor de una hora). Se cachea hasta poco antes de
   * ese momento en vez de usar un TTL fijo, para no entregar una URL vencida.
   */
  private calcularVencimiento(targets: string[]): number {
    const epochs = targets
      .map((url) => /[?&]e=(\d+)/.exec(url)?.[1])
      .filter((e): e is string => Boolean(e))
      .map((e) => Number(e) * 1000);

    if (epochs.length === 0) {
      return Date.now() + MARGEN_CACHE_MS;
    }

    return Math.min(...epochs) - MARGEN_CACHE_MS;
  }
}
