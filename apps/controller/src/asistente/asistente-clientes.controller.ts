import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AsistenteClientesService } from './asistente-clientes.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { IdentificarClienteDto } from './dto/asistente.dto.js';
import { ChatbotApiKeyGuard } from './guards/chatbot-api-key.guard.js';

/**
 * CU-63: consultas internas de finet-chatbot sobre los clientes.
 * No es publica: la protege `ASISTENTE_API_KEY` (ver ChatbotApiKeyGuard).
 *
 * Base path: /api/asistente/clientes
 */
@Controller('asistente/clientes')
@UseGuards(ChatbotApiKeyGuard)
export class AsistenteClientesController {
  constructor(
    private readonly asistenteClientesService: AsistenteClientesService,
  ) {}

  /**
   * CU-63: POST /asistente/clientes/identificar
   *
   * Verifica que el RUT exista en los registros. POST y no GET para que el
   * RUT no quede en URLs ni en logs de acceso.
   *
   * Sin rate limit por IP: todas las llamadas salen de la IP del chatbot, y el
   * limite global (10/min) frenaria a todos los clientes a la vez. Contra
   * probar RUT al azar, el chatbot corta a los 3 intentos fallidos por
   * conversacion y /asistente/mensajes ya limita a 10 mensajes/min por IP.
   */
  @Post('identificar')
  @HttpCode(200)
  @SkipThrottle()
  identificar(
    @Body(new ZodValidationPipe(IdentificarClienteDto))
    dto: IdentificarClienteDto,
  ) {
    return this.asistenteClientesService.identificar(dto.rut);
  }
}
