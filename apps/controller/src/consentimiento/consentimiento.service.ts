import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { anonimizarIp } from '../common/utils/ip.js';
import type {
  ConsentimientoCookiesDto,
  ConsentimientoCookiesResponseDto,
} from './dto/consentimiento-cookies.dto.js';

/**
 * CU-76: registro de la decisión del banner de cookies.
 *
 * La tabla `consentimiento_cookies` ya existe en la base compartida, así que
 * esto no cambia el schema: solo inserta el registro de cada decisión.
 *
 * `id_cliente` queda en null a propósito. El CU-76 dice que la preferencia es
 * "una vez por dispositivo o navegador", y el banner aparece en el primer
 * ingreso al sitio, cuando casi nunca hay sesión. Vincularlo a una persona
 * agregaría un dato personal sin que ningún flujo lo necesite.
 */
@Injectable()
export class ConsentimientoService {
  private readonly logger = new Logger(ConsentimientoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrarCookies(
    dto: ConsentimientoCookiesDto,
    ip: string,
  ): Promise<ConsentimientoCookiesResponseDto> {
    try {
      await this.prisma.consentimiento_cookies.create({
        data: {
          acepto: dto.acepto,
          version_documento: dto.version_documento,
          fecha_aceptacion: new Date(),
          ip_anonimizada: anonimizarIp(ip),
        },
      });

      return { registrado: true };
    } catch (error) {
      // No se le tumba la navegación al visitante porque falló el registro: la
      // preferencia ya quedó en su cookie y el banner no va a volver a salir.
      this.logger.error(
        `[CU-76] no se pudo registrar el consentimiento de cookies: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { registrado: false };
    }
  }
}
