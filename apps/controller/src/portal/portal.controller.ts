import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PortalService } from './portal.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentClient } from '../auth/decorators/current-client.decorator.js';
import type { cliente } from '../../generated/prisma/client.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { crearTicketSchema } from './dto/crear-ticket.dto.js';
import type { CrearTicketDto } from './dto/crear-ticket.dto.js';

/**
 * Todas las rutas requieren sesión activa (JwtAuthGuard).
 * El cliente autenticado se extrae del token via @CurrentClient().
 *
 * Base path: /api/portal
 *
 * Autenticación: Enviar header `Authorization: Bearer <token>`
 * o confiar en la cookie httpOnly `access_token`.
 *
 * Sesión: 15 min de inactividad (ventana deslizante, se extiende en cada request).
 * Si expira → 401 "Sesión expirada por inactividad".
 */
@Controller('portal')
@UseGuards(JwtAuthGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  /**
   * CU-24: Panel principal del Portal Cliente
   *
   * Dashboard unificado que devuelve cliente, contratos vigentes, estado de
   * deuda y los últimos 3 tickets en una sola llamada.
   *
   * GET /portal/panel
   * Auth: Bearer <token>
   *
   * Respuesta: PanelPrincipalDto
   *   - cliente: datos personales (id, nombre, RUT, email, teléfono)
   *   - contratos: array de contratos con plan asociado
   *   - resumen_deuda: tiene_deuda, saldo_total, facturas_pendientes
   *   - tickets_recientes: últimos 3 tickets del cliente
   *
   * Errores:
   *   401 - Sesión expirada por inactividad / Token JWT inválido
   *   404 - Cliente no encontrado
   *   500 - El portal no está disponible temporalmente
   */
  @Get('panel')
  getPanelPrincipal(@CurrentClient() cliente: cliente) {
    return this.portalService.getPanelPrincipal(cliente.id_cliente);
  }

  /**
   * CU-23: Consultar estado operativo del contrato
   *
   * Retorna el estado de TODOS los contratos del cliente (puede tener varios).
   * Incluye id, estado, fecha de inicio y fecha de suspensión (si aplica).
   *
   * GET /portal/contratos/estado
   * Auth: Bearer <token>
   *
   * Respuesta: ContratoEstadoDto[]
   *   - id_contrato, estado, fecha_inicio, fecha_suspension
   *
   * Estados posibles: activo, suspendido, cortado, inactivo.
   * Estados no reconocidos se registran en log de auditoría.
   *
   * Errores:
   *   401 - Sesión expirada por inactividad / Token JWT inválido
   *   404 - No se encontraron contratos para este cliente
   */
  @Get('contratos/estado')
  getEstadoContratos(@CurrentClient() cliente: cliente) {
    return this.portalService.getEstadoContratos(cliente.id_cliente);
  }

  /**
   * CU-25 + CU-26: Plan(es) vigente(s)
   *
   * Devuelve los contratos activos o suspendidos con su plan asociado.
   *
   * GET /portal/contratos/vigentes
   * Auth: Bearer <token>
   *
   * Si el cliente tiene 1 contrato → CU-25 (vista de plan único).
   * Si tiene varios → CU-26 (vista de múltiples planes).
   * Mismo endpoint, el frontend decide la vista según el largo del array.
   *
   * Respuesta: ContratoResumenDto[]
   *   - id_contrato, estado, fecha_inicio, dia_vencimiento
   *   - plan: { id_plan, nombre_comercial, tipo_plan, velocidad_mbps, precio_mensual }
   *
   * Errores:
   *   401 - Sesión expirada por inactividad / Token JWT inválido (CU-26 Excepción 1)
   *   500 - No fue posible obtener la información de planes (CU-26 Excepción 2)
   */
  @Get('contratos/vigentes')
  getContratosVigentes(@CurrentClient() cliente: cliente) {
    return this.portalService.getContratosVigentes(cliente.id_cliente);
  }

  /**
   * CU-27 + CU-28: Estado de deuda
   *
   * Consulta las facturas pendientes y vencidas de todos los contratos del cliente.
   *
   * GET /portal/deuda
   * Auth: Bearer <token>
   *
   * Si tiene_deuda = false → CU-27 (cuenta al día, saldo $0).
   * Si tiene_deuda = true → CU-28 (muestra saldo total y detalle de facturas).
   *
   * Respuesta: ResumenDeudaDto
   *   - tiene_deuda: boolean
   *   - saldo_total: number (suma de todas las facturas pendientes)
   *   - facturas_pendientes: FacturaPendienteDto[]
   *     - id_factura, periodo (ej: "Mayo 2026"), monto, fecha_limite_pago,
   *       estado ("pendiente" | "vencida"), dias_vencida (null si no ha vencido)
   *
   * Errores:
   *   401 - Sesión expirada por inactividad / Token JWT inválido
   *   500 - Saldo inconsistente (saldo negativo → error interno)
   */
  @Get('deuda')
  getResumenDeuda(@CurrentClient() cliente: cliente) {
    return this.portalService.getResumenDeuda(cliente.id_cliente);
  }

  @Get('tickets/categorias')
  getCategoriasTicket() {
    return this.portalService.getCategoriasTicket();
  }

  @Post('tickets')
  crearTicket(
    @CurrentClient() cliente: cliente,
    @Body(new ZodValidationPipe(crearTicketSchema)) body: CrearTicketDto,
  ) {
    return this.portalService.crearTicket(cliente.id_cliente, body);
  }

  /**
   * CU-29 + CU-30: Tickets de soporte
   *
   * Devuelve el historial de tickets del cliente, ordenados del más reciente
   * al más antiguo.
   *
   * GET /portal/tickets
   * Auth: Bearer <token>
   *
   * @query limite?: number — opcional. Si se envía, trae solo los N tickets
   *        más recientes. Si se omite, devuelve todos.
   *
   * Si tiene_tickets = false → CU-29 (estado vacío).
   * Si tiene_tickets = true → CU-30 (historial completo).
   *
   * Respuesta: TicketsResponseDto
   *   - total: number (cantidad devuelta en esta llamada)
   *   - tiene_tickets: boolean
   *   - tickets: TicketResumenDto[]
   *     - id_ticket, codigo_seguimiento, estado, prioridad, descripcion,
   *       fecha_creacion, fecha_cierre, categoria, origen
   *
   * Errores:
   *   401 - Sesión expirada por inactividad / Token JWT inválido
   */
  @Get('tickets')
  getTickets(
    @CurrentClient() cliente: cliente,
    @Query('limite') limite?: string,
  ) {
    const limiteNum = limite ? parseInt(limite, 10) : undefined;
    return this.portalService.getTickets(cliente.id_cliente, limiteNum);
  }
}
