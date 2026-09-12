import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ESTADOS_CONTRATO_VIGENTES,
  normalizarEstadoContrato,
} from '../common/constants/contrato.js';
import { MailService } from '../mail/mail.service.js';
import type { CrearTicketDto } from './dto/crear-ticket.dto.js';
import type { SolicitarCambioContrasenaWifiDto } from './dto/solicitud-contrasena-wifi.dto.js';
import {
  CategoriaTicketDto,
  ContratoEstadoDto,
  ContratoResumenDto,
  CrearTicketResponseDto,
  FacturaPendienteDto,
  PanelPrincipalDto,
  ResumenDeudaDto,
  SolicitudContrasenaWifiResponseDto,
  TicketsResponseDto,
} from './dto/portal-response.dto.js';

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  //  CU-23: Consultar estado operativo del contrato
  // Retorna el estado de TODOS los contratos del cliente (puede tener varios) y se ve si esta activo, fechas e identificador ;3.
  async getEstadoContratos(idCliente: number): Promise<ContratoEstadoDto[]> {
    const contratos = await this.prisma.contrato.findMany({
      where: { id_cliente: idCliente },
      select: {
        id_contrato: true,
        estado: true,
        fecha_inicio: true,
        fecha_suspension: true,
      },
    });

    if (!contratos.length) {
      throw new NotFoundException(
        'No se encontraron contratos para este cliente',
      );
    }

    // CU-23 Excepción 3: estado no reconocido.
    //
    // Antes esto lanzaba un 400 y dejaba al cliente sin panel. No puede ser: la
    // base es compartida con los otros equipos y cualquiera puede escribir un
    // estado que todavía no conocemos. Un valor inesperado se registra para que
    // alguien lo revise, pero se devuelve tal cual y el portal sigue en pie.
    const noReconocidos: { id_contrato: number; estado: string }[] = [];

    const estados = contratos.map((c) => {
      const canonico = normalizarEstadoContrato(c.estado);

      if (!canonico) {
        noReconocidos.push({ id_contrato: c.id_contrato, estado: c.estado });
      }

      return {
        id_contrato: c.id_contrato,
        // El canónico de la tabla 11.15 cuando se reconoce; si no, el valor
        // crudo, para que el cliente vea algo y no un hueco.
        estado: canonico ?? c.estado,
        fecha_inicio: c.fecha_inicio.toISOString().split('T')[0],
        fecha_suspension: c.fecha_suspension
          ? c.fecha_suspension.toISOString().split('T')[0]
          : null,
      };
    });

    if (noReconocidos.length > 0) {
      const detalle = noReconocidos
        .map((e) => `#${e.id_contrato} (${e.estado})`)
        .join(', ');
      this.logger.warn(
        `Estados de contrato fuera de la tabla 11.15 para el cliente ${idCliente}: ${detalle}`,
      );

      // La auditoría no puede tumbar la consulta: si falla, se registra y sigue.
      try {
        await this.prisma.log_auditoria.create({
          data: {
            accion: 'ESTADO_CONTRATO_NO_RECONOCIDO',
            entidad_afectada: 'contrato',
            id_entidad_afectada: noReconocidos[0].id_contrato,
            valor_anterior: { estados_recibidos: noReconocidos },
            valor_nuevo: { estados_canonicos: ESTADOS_CONTRATO_VIGENTES },
          },
        });
      } catch (auditError) {
        this.logger.error(
          'No se pudo registrar la auditoría de estados no reconocidos',
          auditError,
        );
      }
    }

    return estados;
  }

  // ─── CU-24: Panel principal del Portal Cliente ─────────────────────────────
  // Agrega toda la información del dashboard en una sola consulta.
  async getPanelPrincipal(idCliente: number): Promise<PanelPrincipalDto> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: idCliente },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    let contratos: ContratoResumenDto[];
    let resumen_deuda: ResumenDeudaDto;
    let tickets_recientes: TicketsResponseDto;
    try {
      [contratos, resumen_deuda, tickets_recientes] = await Promise.all([
        this.getContratosVigentes(idCliente),
        this.getResumenDeuda(idCliente),
        this.getTickets(idCliente, 3),
      ]);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'El portal no está disponible temporalmente',
      );
    }

    return {
      cliente: {
        id_cliente: cliente.id_cliente,
        nombre_completo: cliente.nombre_completo,
        rut: cliente.rut,
        email: cliente.email,
        telefono: cliente.telefono,
      },
      contratos,
      resumen_deuda,
      tickets_recientes: tickets_recientes.tickets,
    };
  }

  //CU-25 / CU-26: Plan(es) vigente(s)
  // CU-25: si hay 1 contrato → devuelve el nombre del plan.
  // CU-26: si hay múltiples contratos → devuelve el array completo.
  async getContratosVigentes(idCliente: number): Promise<ContratoResumenDto[]> {
    const contratos = await this.prisma.contrato
      .findMany({
        where: {
          id_cliente: idCliente,
          // Se listan todos los estados en los que el servicio sigue siendo del
          // cliente, incluidos SUSPENDIDO y CORTADO: si el CRM corta por
          // morosidad, el cliente tiene que verlo en su portal. Queda fuera
          // solo BAJA. Se comparan ambas capitalizaciones porque en la base
          // conviven valores viejos en minúscula con los de la tabla 11.15.
          estado: {
            in: ESTADOS_CONTRATO_VIGENTES.flatMap((e) => [e, e.toLowerCase()]),
          },
        },
        include: {
          plan: {
            select: {
              id_plan: true,
              nombre_comercial: true,
              tipo_plan: true,
              velocidad_mbps: true,
              precio_mensual: true,
            },
          },
        },
        orderBy: { fecha_inicio: 'desc' },
      })
      .catch(() => {
        // CU-26 Excepción 2: error al recuperar planes vigentes
        throw new InternalServerErrorException(
          'No fue posible obtener la informacion de planes en este momento',
        );
      });

    return contratos.map((c) => ({
      id_contrato: c.id_contrato,
      estado: normalizarEstadoContrato(c.estado) ?? c.estado,
      fecha_inicio: c.fecha_inicio.toISOString().split('T')[0],
      dia_vencimiento: c.dia_vencimiento,
      plan: c.plan
        ? {
            id_plan: c.plan.id_plan,
            nombre_comercial: c.plan.nombre_comercial,
            tipo_plan: c.plan.tipo_plan,
            velocidad_mbps: c.plan.velocidad_mbps,
            precio_mensual: Number(c.plan.precio_mensual),
          }
        : null,
    }));
  }
  //CU-27 / CU-28: Estado de deuda //
  // tiene_deuda = false → el frontend muestra "cuenta al día" // tiene_deuda = true → el frontend muestra el saldo y detalle.
  async getResumenDeuda(idCliente: number): Promise<ResumenDeudaDto> {
    const contratos = await this.prisma.contrato.findMany({
      where: { id_cliente: idCliente },
      select: { id_contrato: true },
    });

    if (!contratos.length) {
      return {
        tiene_deuda: false,
        saldo_total: 0,
        saldo_confirmado: true,
        facturas_pendientes: [],
      };
    }

    const idContratos = contratos.map((c) => c.id_contrato);
    const hoy = new Date();

    const facturas = await this.prisma.factura.findMany({
      where: {
        id_contrato: { in: idContratos },
        estado: { in: ['pendiente', 'vencida'] },
      },
      orderBy: { fecha_limite_pago: 'asc' },
    });

    const facturasMapeadas: FacturaPendienteDto[] = facturas.map((f) => {
      const limite = new Date(f.fecha_limite_pago);
      const diasVencida =
        limite < hoy
          ? Math.floor((hoy.getTime() - limite.getTime()) / 86_400_000)
          : null;

      return {
        id_factura: f.id_factura,
        periodo: this.formatPeriodo(f.periodo_mes, f.periodo_anio),
        monto: Number(f.monto ?? 0),
        fecha_limite_pago: limite.toISOString().split('T')[0],
        estado: f.estado,
        dias_vencida: diasVencida,
      };
    });

    const saldo_total = facturasMapeadas.reduce((acc, f) => acc + f.monto, 0);

    // CU-27 Excepción 3: saldo inconsistente o inválido
    if (saldo_total < 0) {
      this.logger.error(
        `Saldo inconsistente (negativo: ${saldo_total}) para cliente ${idCliente}`,
      );
      try {
        await this.prisma.log_auditoria.create({
          data: {
            accion: 'SALDO_INCONSISTENTE',
            entidad_afectada: 'cliente',
            id_entidad_afectada: idCliente,
            valor_anterior: { saldo_total },
          },
        });
      } catch {
        this.logger.error(
          `No se pudo registrar auditoría de saldo inconsistente para cliente ${idCliente}`,
        );
      }

      return {
        tiene_deuda: false,
        saldo_total: 0,
        saldo_confirmado: false,
        facturas_pendientes: [],
      };
    }

    return {
      tiene_deuda: facturasMapeadas.length > 0,
      saldo_total,
      saldo_confirmado: true,
      facturas_pendientes: facturasMapeadas,
    };
  }

  async getCategoriasTicket(): Promise<CategoriaTicketDto[]> {
    return this.prisma.categoria_falla.findMany({
      select: { id_categoria: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearTicket(
    idCliente: number,
    dto: CrearTicketDto,
  ): Promise<CrearTicketResponseDto> {
    let ticketCreado: {
      id_ticket: number;
      codigo_seguimiento: string;
      cliente: {
        id_cliente: number;
        nombre_completo: string;
        email: string | null;
      };
      categoria: string;
    };

    try {
      ticketCreado = await this.prisma.$transaction(async (tx) => {
        const cliente = await tx.cliente.findUnique({
          where: { id_cliente: idCliente },
          select: {
            id_cliente: true,
            id_empresa: true,
            nombre_completo: true,
            email: true,
          },
        });

        if (!cliente) {
          throw new NotFoundException('Cliente no encontrado');
        }

        const categoria = await tx.categoria_falla.findUnique({
          where: { id_categoria: dto.id_categoria },
          select: { id_categoria: true, nombre: true },
        });

        if (!categoria) {
          throw new BadRequestException(
            'La categoria seleccionada no esta disponible',
          );
        }

        const ticket = await tx.ticket.create({
          data: {
            id_cliente: cliente.id_cliente,
            id_empresa: cliente.id_empresa,
            id_categoria: categoria.id_categoria,
            prioridad: 'media',
            estado: 'abierto',
            descripcion: dto.descripcion,
            origen: 'portal',
          },
          select: { id_ticket: true, fecha_creacion: true },
        });

        const anio =
          ticket.fecha_creacion?.getFullYear() ?? new Date().getFullYear();
        const codigoSeguimiento = `FIN-${anio}-${String(ticket.id_ticket).padStart(6, '0')}`;

        await tx.ticket.update({
          where: { id_ticket: ticket.id_ticket },
          data: { codigo_seguimiento: codigoSeguimiento },
        });

        await tx.log_auditoria.create({
          data: {
            accion: 'CREAR_TICKET_PORTAL',
            entidad_afectada: 'ticket',
            id_entidad_afectada: ticket.id_ticket,
            valor_nuevo: {
              codigo_seguimiento: codigoSeguimiento,
              id_categoria: categoria.id_categoria,
              estado: 'abierto',
              origen: 'portal',
            },
          },
        });

        return {
          id_ticket: ticket.id_ticket,
          codigo_seguimiento: codigoSeguimiento,
          cliente,
          categoria: categoria.nombre,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `No se pudo crear el ticket para el cliente ${idCliente}`,
        error,
      );
      throw new ServiceUnavailableException(
        'No fue posible registrar tu solicitud. Intenta nuevamente mas tarde.',
      );
    }

    await this.notificarTicketCreado(ticketCreado);
    return {
      id_ticket: ticketCreado.id_ticket,
      codigo_seguimiento: ticketCreado.codigo_seguimiento,
    };
  }

  // CU-29 / CU-30: Tickets de soporte :DDDDDDDDD AHGG AYUDA
  async getTickets(
    idCliente: number,
    limite?: number,
  ): Promise<TicketsResponseDto> {
    const tickets = await this.prisma.ticket.findMany({
      where: { id_cliente: idCliente },
      include: {
        categoria_falla: { select: { nombre: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
      ...(limite ? { take: limite } : {}),
    });

    const ticketsMapeados = tickets.map((t) => ({
      id_ticket: t.id_ticket,
      codigo_seguimiento: t.codigo_seguimiento,
      estado: t.estado,
      prioridad: t.prioridad,
      descripcion: t.descripcion,
      fecha_creacion: t.fecha_creacion ? t.fecha_creacion.toISOString() : '',
      fecha_cierre: t.fecha_cierre ? t.fecha_cierre.toISOString() : null,
      categoria: t.categoria_falla.nombre,
      origen: t.origen,
    }));

    return {
      total: ticketsMapeados.length,
      tiene_tickets: ticketsMapeados.length > 0,
      tickets: ticketsMapeados,
    };
  }

  private async notificarTicketCreado(ticket: {
    id_ticket: number;
    codigo_seguimiento: string;
    categoria: string;
    cliente: {
      id_cliente: number;
      nombre_completo: string;
      email: string | null;
    };
  }): Promise<void> {
    let estadoEnvio = 'omitido';

    if (ticket.cliente.email) {
      try {
        await this.mailService.sendTicketCreated(
          ticket.cliente.email,
          ticket.cliente.nombre_completo,
          ticket.codigo_seguimiento,
          ticket.categoria,
        );
        estadoEnvio = 'enviado';
      } catch (error) {
        estadoEnvio = 'fallido';
        this.logger.error(
          `No se pudo notificar la creacion del ticket ${ticket.id_ticket}`,
          error,
        );
      }
    }

    try {
      await this.prisma.log_notificacion.create({
        data: {
          id_cliente: ticket.cliente.id_cliente,
          canal: 'email',
          fecha_envio: new Date(),
          estado_envio: estadoEnvio,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la notificacion del ticket ${ticket.id_ticket}`,
        error,
      );
    }
  }

  //  CU-31 + CU-32: Solicitud de cambio de contrasena de la red WiFi
  //
  //  El portal NO cambia la clave: solo deja registrada la solicitud para que el
  //  CRM la ejecute contra el equipo del cliente (CU-33).
  //
  //  La clave se guarda hasheada con bcrypt, nunca en texto plano (pedido de
  //  Dani en el review de esta rama). Ojo con la consecuencia: bcrypt no es
  //  reversible, asi que CU-33 ya no puede leer de la tabla la clave que tiene
  //  que aplicar en el equipo — queda pendiente definir por donde la recibe
  //  quien la aplica. Lo que el hash permite es verificar despues que la clave
  //  aplicada es la que el cliente pidio.
  //
  //  El formato ya viene validado por Zod en el controller (CU-31 / RF-24).
  async solicitarCambioContrasenaWifi(
    idCliente: number,
    dto: SolicitarCambioContrasenaWifiDto,
  ): Promise<SolicitudContrasenaWifiResponseDto> {
    // El contrato tiene que ser del cliente autenticado. Si es de otro, se
    // responde 404 igual que si no existiera: no se confirma su existencia.
    const contrato = await this.prisma.contrato.findFirst({
      where: { id_contrato: dto.id_contrato, id_cliente: idCliente },
      select: { id_contrato: true, estado: true },
    });

    if (!contrato) {
      throw new NotFoundException('No encontramos el servicio seleccionado');
    }

    // CU-32 Excepcion 2: el plan no esta activo -> se impide crear la solicitud
    // y se informa la restriccion.
    //
    // El estado se normaliza a la Tabla 11.15 antes de comparar, igual que el
    // resto del servicio: la base compartida la escriben cuatro equipos y el CRM
    // guarda 'ACTIVO' en mayusculas, asi que comparar el string crudo contra
    // 'activo' le respondia 409 a un cliente con el servicio andando.
    //
    // REACTIVADO queda fuera a proposito: la tabla 11.15 lo lista como estado
    // distinto de ACTIVO y CU-32 pide "activo". Si tras CU-50 el CRM lo deja
    // fijo en vez de volver a ACTIVO, hay que sumarlo aca.
    if (normalizarEstadoContrato(contrato.estado) !== 'ACTIVO') {
      throw new ConflictException(
        'Solo puedes solicitar el cambio de clave en un servicio activo',
      );
    }

    try {
      // Se hashea recien aca: despues de validar el contrato, para no gastar el
      // cost de bcrypt en requests que terminan en 404/409, y antes de abrir la
      // transaccion, para no tenerla esperando el hash. Cost 10, el mismo que
      // usan auth y perfil.
      const passwordNuevaHash = await bcrypt.hash(dto.password, 10);

      const solicitud = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.solicitud_contrasena_wifi.create({
          data: {
            id_contrato: contrato.id_contrato,
            id_cliente: idCliente,
            password_nueva_hash: passwordNuevaHash,
            estado: 'pendiente',
          },
          select: {
            id_solicitud: true,
            id_contrato: true,
            estado: true,
            fecha_solicitud: true,
          },
        });

        // La clave nueva no se registra en la auditoria, ni hasheada: el log lo
        // lee mucha mas gente que la solicitud misma y no lo necesita.
        await tx.log_auditoria.create({
          data: {
            accion: 'SOLICITAR_CAMBIO_CONTRASENA_WIFI_PORTAL',
            entidad_afectada: 'solicitud_contrasena_wifi',
            id_entidad_afectada: creada.id_solicitud,
            valor_nuevo: {
              id_contrato: creada.id_contrato,
              estado: creada.estado,
              origen: 'portal',
            },
          },
        });

        return creada;
      });

      return {
        id_solicitud: solicitud.id_solicitud,
        id_contrato: solicitud.id_contrato,
        estado: solicitud.estado,
        fecha_solicitud: solicitud.fecha_solicitud?.toISOString() ?? null,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `No se pudo registrar la solicitud de cambio de contrasena WiFi del cliente ${idCliente}`,
        error,
      );
      throw new ServiceUnavailableException(
        'No fue posible registrar tu solicitud. Intenta nuevamente mas tarde.',
      );
    }
  }

  // variables meses xD
  private formatPeriodo(mes: number, anio: number): string {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    return `${meses[mes - 1]} ${anio}`;
  }
}
