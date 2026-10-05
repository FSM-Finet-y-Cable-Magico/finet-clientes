import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AsistenteClientesService } from './asistente-clientes.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import {
  CrearSolicitudSoporteDto,
  EscalarConversacionDto,
  IdentificarClienteDto,
} from './dto/asistente.dto.js';
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
   * probar RUT al azar, /asistente/mensajes limita a 10 mensajes/min por IP,
   * lo mismo que la consulta publica de deuda (CU-39).
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

  @Get('soporte/categorias')
  @HttpCode(200)
  @SkipThrottle()
  categorias() {
    return this.asistenteClientesService.obtenerCategorias();
  }

  @Post('soporte')
  @HttpCode(201)
  @SkipThrottle()
  crearSolicitud(
    @Body(new ZodValidationPipe(CrearSolicitudSoporteDto))
    dto: CrearSolicitudSoporteDto,
  ) {
    return this.asistenteClientesService.crearSolicitud(dto);
  }

  /**
   * CU-77: POST /asistente/clientes/escalamientos
   *
   * El asistente derivo la conversacion a una persona: registra el historial
   * y abre un ticket para el cliente del RUT. Lo atiende el equipo desde el
   * CRM; aca no se asigna operador.
   */
  @Post('escalamientos')
  @HttpCode(201)
  @SkipThrottle()
  escalar(
    @Body(new ZodValidationPipe(EscalarConversacionDto))
    dto: EscalarConversacionDto,
  ) {
    return this.asistenteClientesService.escalar(dto);
  }
}
