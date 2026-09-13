import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { loginSchema } from './dto/login.dto.js';
import { registerSchema } from './dto/register.dto.js';
import { recuperarPasswordSchema } from './dto/recuperar-password.dto.js';
import { restablecerPasswordSchema } from './dto/restablecer-password.dto.js';
import { ZodValidationPipe } from './pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentClient } from './decorators/current-client.decorator.js';

/**
 * Endpoints públicos (sin token) y protegidos (con JWT).
 * Las rutas con JwtAuthGuard requieren el header `Authorization: Bearer <token>`
 * o la cookie httpOnly `access_token`.
 *
 * Rate limiting global: 5 req/min para login, 3 req/min para register/recuperar/restablecer.
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  /**
   * RF-01: Iniciar sesión en el portal
   *
   * Valida RUT + contraseña. Si son correctos, devuelve el token JWT y los datos
   * del cliente. También setea una cookie httpOnly `access_token` (7 días).
   *
   * POST /auth/login
   *
   * @body { rut: string, password: string }
   *   - rut: formato 123456785 (sin puntos ni guion)
   *   - password: texto plano (mín 1 carácter)
   *
   * Rate limit: 5 intentos por minuto por IP.
   * Bloqueo: 5 intentos fallidos en 10 min → RUT bloqueado 15 min.
   *          5 intentos fallidos en 5 min desde misma IP → IP bloqueada 15 min.
   *
   * Errores:
   *   400 - RUT mal formateado o dígito verificador inválido
   *   401 - IP bloqueada temporalmente
   *   401 - RUT bloqueado temporalmente
   *   401 - RUT o contraseña incorrectos
   *   429 - Rate limit excedido (>5 req/min)
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema))
    body: {
      rut: string;
      password: string;
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      body.rut,
      body.password,
      req.ip ?? '0.0.0.0',
    );
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  /**
   * RF-10: Registrar una cuenta nueva en el portal
   *
   * Crea un cliente nuevo con los datos enviados. Si el registro es exitoso,
   * inicia sesión automáticamente (devuelve token JWT + cookie httpOnly).
   *
   * POST /auth/register
   *
   * @body {
   *   rut: string,              // formato 123456785 (sin puntos ni guion)
   *   nombre_completo: string,  // 2-120 caracteres
   *   email: string,            // formato válido, 120 char máx
   *   telefono?: string,        // opcional, 20 char máx
   *   password: string,         // 8-72 char, 1 mayúscula, 1 número
   *   password_confirmation: string
   * }
   *
   * Se asigna automáticamente id_empresa=1 y estado='activo'.
   *
   * Rate limit: 3 intentos por minuto por IP.
   *
   * Errores:
   *   400 - Validación Zod (campos requeridos, email inválido, contraseña débil,
   *         las contraseñas no coinciden)
   *   409 - El RUT ya está registrado
   *   409 - El email ya está registrado
   *   429 - Rate limit excedido (>3 req/min)
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema))
    body: {
      rut: string;
      nombre_completo: string;
      email: string;
      telefono?: string;
      password: string;
      password_confirmation: string;
      acepta_politica_privacidad: true;
      version_politica_privacidad: string;
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      body.rut,
      body.nombre_completo,
      body.password,
      req.ip ?? '0.0.0.0',
      body.email,
      body.telefono,
      body.version_politica_privacidad,
    );
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  /**
   * RF-03: Solicitar recuperación de contraseña
   *
   * Si el RUT existe y tiene email registrado, envía un enlace de recuperación
   * al correo del cliente. El enlace expira en 15 minutos.
   *
   * POST /auth/recuperar-password
   *
   * @body { rut: string }  // formato 123456785 (sin puntos ni guion)
   *
   * Por seguridad, siempre responde 200 con el mismo mensaje genérico,
   * sin revelar si el RUT existe o no.
   *
   * Rate limit: 3 intentos por minuto por IP.
   *
   * Errores:
   *   400 - RUT mal formateado o dígito verificador inválido
   *   429 - Rate limit excedido (>3 req/min)
   */
  @Post('recuperar-password')
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @HttpCode(200)
  async recuperarPassword(
    @Body(new ZodValidationPipe(recuperarPasswordSchema))
    body: { rut: string },
    @Req() req: Request,
  ) {
    return this.authService.recuperarPassword(body.rut, req.ip);
  }

  /**
   * RF-09: Restablecer contraseña con token
   *
   * El token se recibe por email (el link apunta a /restablecer-password?token=...).
   * Valida que el token sea de tipo 'reset' y no esté expirado (15 min).
   * Al cambiar la contraseña, invalida todas las sesiones activas del cliente.
   *
   * POST /auth/restablecer-password
   *
   * @body {
   *   token: string,     // JWT recibido en el email de recuperación
   *   password: string   // 8-72 char, 1 mayúscula, 1 número
   * }
   *
   * Rate limit: 3 intentos por minuto por IP.
   *
   * Errores:
   *   400 - Token inválido o expirado
   *   400 - Token no es de tipo 'reset'
   *   400 - Contraseña no cumple requisitos (mín 8, 1 mayúscula, 1 número)
   *   429 - Rate limit excedido (>3 req/min)
   */
  @Post('restablecer-password')
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @HttpCode(200)
  async restablecerPassword(
    @Body(new ZodValidationPipe(restablecerPasswordSchema))
    body: {
      token: string;
      password: string;
    },
  ) {
    return this.authService.restablecerPassword(body.token, body.password);
  }

  /**
   * RF-02: Cerrar sesión
   *
   * Requiere autenticación. Elimina la sesión de la base de datos y limpia
   * la cookie `access_token`.
   *
   * POST /auth/logout
   * Auth: Bearer <token>
   *
   * El token se extrae del header Authorization o de la cookie access_token.
   * Si no hay token o el cliente no está autenticado, igualmente limpia la cookie.
   *
   * CU-02 Excepción 1: si falla la conexión al sistema, se informa que no fue
   * posible cerrar la sesión y se invita a reintentar.
   *
   * Errores:
   *   401 - Sesión expirada por inactividad
   *   401 - Token JWT inválido
   *   503 - No se pudo cerrar la sesión (error de conexión)
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(
    @CurrentClient() cliente: { id_cliente: number } | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      (req.cookies as Record<string, string> | undefined)?.access_token;

    if (token && cliente?.id_cliente) {
      try {
        await this.authService.logout(cliente.id_cliente, token);
      } catch (error) {
        this.logger.error(
          `Error al cerrar sesión del cliente ${cliente.id_cliente}`,
          error,
        );
        res.clearCookie('access_token', { path: '/' });
        throw new ServiceUnavailableException(
          'No fue posible cerrar la sesión. Por favor, reintente.',
        );
      }
    }

    res.clearCookie('access_token', { path: '/' });
    return { message: 'Sesión cerrada exitosamente' };
  }
}
