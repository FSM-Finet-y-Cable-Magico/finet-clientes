import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { cleanRut } from '../common/utils/rut.js';
import type { ClienteIdentificadoDto } from './dto/asistente.dto.js';
import type {
  CrearSolicitudSoporteDto,
  EscalarConversacionDto,
} from './dto/asistente.dto.js';
import { JwtService } from '@nestjs/jwt';

export interface CategoriaSoporteDto {
  id_categoria: number;
  nombre: string;
}

export interface SolicitudSoporteCreadaDto {
  id_ticket: number;
  codigo_seguimiento: string;
}

/**
 * CU-77: categoria de los tickets que abre el asistente al derivar. El ticket
 * exige una; el operador la cambia desde el CRM si corresponde otra.
 */
export const CATEGORIA_ESCALAMIENTO = 'Asistente virtual';

/** Descripcion del ticket cuando el asistente no mando un motivo. */
const DESCRIPCION_ESCALAMIENTO =
  'Conversacion derivada a una persona desde el asistente virtual.';

/** `FIN-2026-000123`: el codigo que se le da al cliente. */
function codigoSeguimiento(idTicket: number, creado: Date | null): string {
  const anio = creado?.getFullYear() ?? new Date().getFullYear();
  return `FIN-${anio}-${String(idTicket).padStart(6, '0')}`;
}

/**
 * CU-63: verifica el RUT que el cliente le da al asistente y devuelve los
 * datos con que se personalizan las respuestas.
 *
 * Lo consulta finet-chatbot y no el widget, porque el mismo flujo tiene que
 * funcionar en WhatsApp (via Chatwoot), donde no pasa por este backend.
 */
@Injectable()
export class AsistenteClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async identificar(rut: string): Promise<ClienteIdentificadoDto> {
    const limpio = cleanRut(rut);

    // Como en deuda-publica (CU-39) se busca el RUT limpio. Se prueba la K en
    // ambas cajas: el chatbot la manda en mayuscula y no hay garantia de como
    // quedo guardada.
    const variantes = [
      ...new Set([limpio, limpio.toUpperCase(), limpio.toLowerCase()]),
    ];

    const cliente = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantes } },
      select: {
        nombre_completo: true,
        contrato: {
          select: {
            estado: true,
            plan: {
              select: {
                nombre_comercial: true,
                tipo_plan: true,
                velocidad_mbps: true,
              },
            },
          },
        },
      },
    });

    if (!cliente) {
      return { encontrado: false, cliente: null };
    }

    return {
      encontrado: true,
      cliente: {
        nombre_completo: cliente.nombre_completo,
        planes: cliente.contrato.flatMap((contrato) =>
          contrato.plan
            ? [
                {
                  nombre_comercial: contrato.plan.nombre_comercial,
                  tipo_plan: contrato.plan.tipo_plan,
                  velocidad_mbps: contrato.plan.velocidad_mbps,
                  estado_contrato: contrato.estado,
                },
              ]
            : [],
        ),
      },
    };
  }

  async obtenerCategorias(): Promise<CategoriaSoporteDto[]> {
    return this.prisma.categoria_falla.findMany({
      select: { id_categoria: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearSolicitud(
    dto: CrearSolicitudSoporteDto,
  ): Promise<SolicitudSoporteCreadaDto> {
    let clienteAutenticado: number;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: number;
        type?: string;
      }>(dto.access_token);
      if (payload.type && payload.type !== 'access') {
        throw new UnauthorizedException('Sesion de portal invalida');
      }
      if (typeof payload.sub !== 'number') {
        throw new UnauthorizedException('Sesion de portal invalida');
      }
      const sesion = await this.prisma.sesion_portal.findFirst({
        where: {
          token: dto.access_token,
          fecha_expiracion: { gt: new Date() },
        },
        select: { id_cliente: true },
      });
      if (!sesion || sesion.id_cliente !== payload.sub) {
        throw new UnauthorizedException('Sesion de portal expirada');
      }
      clienteAutenticado = payload.sub;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Sesion de portal invalida');
    }

    const limpio = cleanRut(dto.rut);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const cliente = await tx.cliente.findFirst({
          where: {
            rut: {
              in: [limpio, limpio.toUpperCase(), limpio.toLowerCase()],
            },
          },
          select: { id_cliente: true, id_empresa: true },
        });
        if (!cliente) {
          throw new BadRequestException('Cliente no encontrado');
        }
        if (cliente.id_cliente !== clienteAutenticado) {
          throw new UnauthorizedException(
            'La sesion no corresponde al cliente',
          );
        }

        const categoria = await tx.categoria_falla.findUnique({
          where: { id_categoria: dto.id_categoria },
          select: { id_categoria: true },
        });
        if (!categoria) {
          throw new BadRequestException('Categoria no encontrada');
        }

        const conversacion = await tx.conversacion_bot.create({
          data: {
            id_cliente: cliente.id_cliente,
            plataforma: 'web',
            fecha_inicio: new Date(),
            fecha_fin: new Date(),
          },
          select: { id_conversacion: true },
        });

        const ticket = await tx.ticket.create({
          data: {
            id_cliente: cliente.id_cliente,
            id_empresa: cliente.id_empresa,
            id_categoria: categoria.id_categoria,
            id_conversacion_bot: conversacion.id_conversacion,
            prioridad: 'media',
            estado: 'abierto',
            descripcion: dto.descripcion,
            origen: 'asistente',
          },
          select: { id_ticket: true, fecha_creacion: true },
        });

        const codigo = codigoSeguimiento(
          ticket.id_ticket,
          ticket.fecha_creacion,
        );

        await tx.ticket.update({
          where: { id_ticket: ticket.id_ticket },
          data: { codigo_seguimiento: codigo },
        });

        await tx.log_auditoria.create({
          data: {
            accion: 'CREAR_TICKET_ASISTENTE',
            entidad_afectada: 'ticket',
            id_entidad_afectada: ticket.id_ticket,
            valor_nuevo: {
              codigo_seguimiento: codigo,
              id_categoria: categoria.id_categoria,
              id_sesion: dto.id_sesion,
              origen: 'asistente',
            },
          },
        });

        return {
          id_ticket: ticket.id_ticket,
          codigo_seguimiento: codigo,
        };
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'No fue posible registrar el reporte de soporte',
        { cause: error },
      );
    }
  }

  /**
   * CU-77: el asistente no pudo resolver la consulta y derivo al cliente a una
   * persona. Deja la conversacion con su historial y un ticket abierto
   * vinculado al cliente del RUT, para que lo tome el equipo desde el CRM.
   *
   * No asigna operador ni notifica: eso lo resuelve el CRM con los tickets
   * abiertos (`id_usuario_asignado` queda vacio).
   *
   * No pide sesion del portal, a diferencia de CU-66: el ticket no lo pide el
   * cliente, lo abre el sistema al derivar, y tiene que funcionar tambien por
   * WhatsApp (via Chatwoot), donde no hay sesion.
   */
  async escalar(
    dto: EscalarConversacionDto,
  ): Promise<SolicitudSoporteCreadaDto> {
    const limpio = cleanRut(dto.rut);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const cliente = await tx.cliente.findFirst({
          where: {
            rut: {
              in: [
                ...new Set([
                  limpio,
                  limpio.toUpperCase(),
                  limpio.toLowerCase(),
                ]),
              ],
            },
          },
          select: { id_cliente: true, id_empresa: true },
        });
        if (!cliente) {
          throw new BadRequestException('Cliente no encontrado');
        }

        // Se crea la primera vez para no depender de una migracion de datos.
        const categoria =
          (await tx.categoria_falla.findFirst({
            where: { nombre: CATEGORIA_ESCALAMIENTO },
            select: { id_categoria: true },
          })) ??
          (await tx.categoria_falla.create({
            data: { nombre: CATEGORIA_ESCALAMIENTO },
            select: { id_categoria: true },
          }));

        const ahora = new Date();
        const conversacion = await tx.conversacion_bot.create({
          data: {
            id_cliente: cliente.id_cliente,
            plataforma: dto.plataforma,
            fecha_inicio: ahora,
            fecha_fin: ahora,
            derivada_humano: true,
            mensaje_bot: {
              create: dto.historial.map((turno) => ({
                rol: turno.rol === 'user' ? 'cliente' : 'asistente',
                contenido: turno.contenido,
              })),
            },
          },
          select: { id_conversacion: true },
        });

        const ticket = await tx.ticket.create({
          data: {
            id_cliente: cliente.id_cliente,
            id_empresa: cliente.id_empresa,
            id_categoria: categoria.id_categoria,
            id_conversacion_bot: conversacion.id_conversacion,
            prioridad: 'media',
            estado: 'abierto',
            descripcion: dto.motivo ?? DESCRIPCION_ESCALAMIENTO,
            origen: 'asistente',
          },
          select: { id_ticket: true, fecha_creacion: true },
        });

        const codigo = codigoSeguimiento(
          ticket.id_ticket,
          ticket.fecha_creacion,
        );
        await tx.ticket.update({
          where: { id_ticket: ticket.id_ticket },
          data: { codigo_seguimiento: codigo },
        });

        await tx.log_auditoria.create({
          data: {
            accion: 'ESCALAR_CONVERSACION_ASISTENTE',
            entidad_afectada: 'ticket',
            id_entidad_afectada: ticket.id_ticket,
            valor_nuevo: {
              codigo_seguimiento: codigo,
              id_conversacion_bot: conversacion.id_conversacion,
              id_sesion: dto.id_sesion,
              plataforma: dto.plataforma,
              origen: 'asistente',
            },
          },
        });

        return { id_ticket: ticket.id_ticket, codigo_seguimiento: codigo };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // CU-77, excepcion 1: el chatbot le dice al cliente que lo atenderan en breve.
      throw new ServiceUnavailableException(
        'No fue posible registrar el ticket de la derivacion',
        { cause: error },
      );
    }
  }
}
