import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PerfilService } from './perfil.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentClient } from '../auth/decorators/current-client.decorator.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import {
  ActualizarEmailDto,
  ActualizarTelefonoDto,
  CambiarPasswordDto,
} from './dto/perfil.dto.js';
import type { cliente } from '../../generated/prisma/client.js';

/**
 * Todas las rutas requieren sesión activa (JwtAuthGuard).
 * El cliente autenticado se extrae del token via @CurrentClient().
 *
 * Base path: /api/auth/perfil
 */
@Controller('auth/perfil')
@UseGuards(JwtAuthGuard)
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  /**
   * CU-07: Consultar perfil del cliente autenticado
   *
   * Devuelve los datos personales del cliente: id, nombre, RUT, email,
   * teléfono y fecha de creación de la cuenta.
   *
   * GET /auth/perfil
   * Auth: Bearer <token>
   *
   * Errores:
   *   401 - Sesión expirada por inactividad
   *   401 - Token JWT inválido
   *   404 - Cliente no encontrado (raro si el token es válido)
   */
  @Get()
  getPerfil(@CurrentClient() cliente: cliente) {
    return this.perfilService.getPerfil(cliente.id_cliente);
  }

  /**
   * CU-08: Actualizar número de teléfono
   *
   * Cambia el teléfono del cliente autenticado. Requiere la contraseña actual
   * para autorizar el cambio. El cambio queda registrado en el log de auditoría.
   *
   * PATCH /auth/perfil/telefono
   * Auth: Bearer <token>
   *
   * @body {
   *   password_actual: string,  // contraseña actual del cliente
   *   telefono: string          // 8-20 caracteres, formato: dígitos, espacios, +, -, ()
   * }
   *
   * Errores:
   *   400 - Validación Zod (password_actual vacío, teléfono muy corto o formato inválido)
   *   401 - Sesión expirada por inactividad / Token JWT inválido
   *   401 - La contraseña actual es incorrecta
   *   404 - Cliente no encontrado
   */
  @Patch('telefono')
  actualizarTelefono(
    @CurrentClient() cliente: cliente,
    @Body(new ZodValidationPipe(ActualizarTelefonoDto)) body: unknown,
    @Req() req: Request,
  ) {
    return this.perfilService.actualizarTelefono(
      cliente.id_cliente,
      body as ActualizarTelefonoDto,
      req.ip ?? '0.0.0.0',
    );
  }

  /**
   * CU-09: Actualizar correo electrónico
   *
   * Cambia el email del cliente autenticado. Requiere la contraseña actual
   * para autorizar el cambio. Rechaza si el nuevo email ya está en uso por
   * otro cliente. El cambio queda registrado en el log de auditoría.
   *
   * PATCH /auth/perfil/email
   * Auth: Bearer <token>
   *
   * @body {
   *   password_actual: string,  // contraseña actual del cliente
   *   email: string             // formato válido, 120 char máx
   * }
   *
   * Errores:
   *   400 - Validación Zod (password_actual vacío, email inválido)
   *   400 - El nuevo email es igual al actual
   *   400 - El email ya está registrado por otro usuario
   *   401 - Sesión expirada por inactividad / Token JWT inválido
   *   401 - La contraseña actual es incorrecta
   *   404 - Cliente no encontrado
   */
  @Patch('email')
  actualizarEmail(
    @CurrentClient() cliente: cliente,
    @Body(new ZodValidationPipe(ActualizarEmailDto)) body: unknown,
    @Req() req: Request,
  ) {
    return this.perfilService.actualizarEmail(
      cliente.id_cliente,
      body as ActualizarEmailDto,
      req.ip ?? '0.0.0.0',
    );
  }

  /**
   * CU-10 / CU-11: Cambiar contraseña
   *
   * Actualiza la contraseña del cliente autenticado. Requiere la contraseña
   * actual para autorizar el cambio. La nueva contraseña debe cumplir requisitos
   * de complejidad (CU-11). No puede ser igual a la actual. El cambio queda
   * registrado en el log de auditoría (sin almacenar la contraseña).
   *
   * PATCH /auth/perfil/password
   * Auth: Bearer <token>
   *
   * @body {
   *   password_actual: string,        // contraseña actual del cliente
   *   password_nuevo: string,         // 8+ char, 1 mayúscula, 1 número
   *   password_confirmacion: string   // debe coincidir con password_nuevo
   * }
   *
   * Reglas de la nueva contraseña (CU-11 / RF-09):
   *   - Mínimo 8 caracteres
   *   - Al menos 1 letra mayúscula
   *   - Al menos 1 número
   *   - No puede ser igual a la actual
   *   - Debe coincidir con password_confirmacion
   *
   * Errores:
   *   400 - Validación Zod (password_actual vacío, contraseña muy corta, falta
   *         mayúscula/número, confirmación no coincide)
   *   400 - La nueva contraseña es igual a la actual
   *   401 - Sesión expirada por inactividad / Token JWT inválido
   *   401 - La contraseña actual es incorrecta
   *   404 - Cliente no encontrado
   */
  @Patch('password')
  cambiarPassword(
    @CurrentClient() cliente: cliente,
    @Body(new ZodValidationPipe(CambiarPasswordDto)) body: unknown,
    @Req() req: Request,
  ) {
    return this.perfilService.cambiarPassword(
      cliente.id_cliente,
      body as CambiarPasswordDto,
      req.ip ?? '0.0.0.0',
    );
  }
}
