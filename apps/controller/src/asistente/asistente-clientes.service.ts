import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { variantesRut } from '../common/utils/rut.js';
import {
  CATEGORIA_ESCALAMIENTO,
  ROL_OPERADOR,
  TICKET_ASISTENTE,
} from '../common/constants/ticket.js';
import { FILTRO_CATEGORIAS_CLIENTE } from '../common/constants/categorias-ticket.js';
import { crearTicket } from '../common/tickets/crear-ticket.js';
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

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Descripcion del ticket cuando el asistente no mando un motivo. */
const DESCRIPCION_ESCALAMIENTO =
  'Conversacion derivada a una persona desde el asistente virtual.';

/**
 * CU-63: verifica el RUT que el cliente le da al asistente y devuelve los
 * datos con que se personalizan las respuestas.
 *
 * Lo consulta finet-chatbot y no el widget, porque el mismo flujo tiene que
 * funcionar en WhatsApp (via Chatwoot), donde no pasa por este backend.
 */
@Injectable()
export class AsistenteClientesService {
  private readonly logger = new Logger(AsistenteClientesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * El RUT identifica pero no autentica: los planes solo van si ademas viene
   * la sesion del portal de ese mismo cliente. El nombre y la deuda siguen como
   * los piden el CU-63 y el CU-64.
   */
  async identificar(
    rut: string,
    accessToken?: string,
  ): Promise<ClienteIdentificadoDto> {
    // Con y sin guion, y la K en ambas cajas: la base es compartida y no hay
    // garantia de como quedo guardado (ver variantesRut).
    const cliente = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantesRut(rut) } },
      select: {
        id_cliente: true,
        id_empresa: true,
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

    const conSesion =
      accessToken !== undefined &&
      (await this.esSesionDe(accessToken, cliente.id_cliente));

    return {
      encontrado: true,
      cliente: {
        nombre_completo: cliente.nombre_completo,
        id_empresa: cliente.id_empresa,
        planes: conSesion
          ? cliente.contrato.flatMap((contrato) =>
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
            )
          : null,
      },
    };
  }

  /** Si no se puede comprobar, cuenta como que no es: no se muestran los planes. */
  private async esSesionDe(
    accessToken: string,
    idCliente: number,
  ): Promise<boolean> {
    try {
      return (await this.clienteDeLaSesion(accessToken)) === idCliente;
    } catch {
      return false;
    }
  }

  /**
   * CU-66: categorias entre las que elige el cliente al reportar una falla.
   * La categoria es la que dirige el ticket al equipo que corresponde en el
   * CRM. Son las mismas siete del portal (CU-71, §11.9): las internas de otros
   * grupos y la del CU-77, que pone el sistema al derivar, no se ofrecen.
   * 503 si la base no responde: para el chatbot es la excepcion 1 del CU.
   */
  async obtenerCategorias(): Promise<CategoriaSoporteDto[]> {
    try {
      return await this.prisma.categoria_falla.findMany({
        where: FILTRO_CATEGORIAS_CLIENTE,
        select: { id_categoria: true, nombre: true },
        orderBy: { nombre: 'asc' },
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'No fue posible obtener las categorias de soporte',
        { cause: error },
      );
    }
  }

  /**
   * CU-66: el cliente dueño de la sesion del portal que reenvia el chatbot.
   * 401 si el token no es valido o la sesion ya no existe; si la base no
   * responde es 503, para que el chatbot no le pida volver a iniciar sesion
   * por una falla que no es suya.
   */
  private async clienteDeLaSesion(accessToken: string): Promise<number> {
    let payload: { sub?: unknown; type?: unknown };
    try {
      payload = await this.jwtService.verifyAsync(accessToken);
    } catch {
      throw new UnauthorizedException('Sesion de portal invalida');
    }
    if (
      (payload.type !== undefined && payload.type !== 'access') ||
      typeof payload.sub !== 'number'
    ) {
      throw new UnauthorizedException('Sesion de portal invalida');
    }

    let sesion: { id_cliente: number | null } | null;
    try {
      sesion = await this.prisma.sesion_portal.findFirst({
        where: { token: accessToken, fecha_expiracion: { gt: new Date() } },
        select: { id_cliente: true },
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'No fue posible registrar el reporte de soporte',
        { cause: error },
      );
    }
    if (!sesion || sesion.id_cliente !== payload.sub) {
      throw new UnauthorizedException('Sesion de portal expirada');
    }
    return payload.sub;
  }

  /**
   * CU-66: registra la solicitud de soporte que el cliente reporto en el
   * asistente y devuelve el identificador que se le informa.
   *
   * Exige la sesion del portal ademas del RUT: el RUT identifica pero no
   * autentica, y la solicitud es del propio cliente. 401 si la sesion no es
   * valida o es de otro cliente; 503 si no se pudo registrar (excepcion 1).
   */
  async crearSolicitud(
    dto: CrearSolicitudSoporteDto,
  ): Promise<SolicitudSoporteCreadaDto> {
    const clienteAutenticado = await this.clienteDeLaSesion(dto.access_token);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const cliente = await tx.cliente.findFirst({
          where: { rut: { in: variantesRut(dto.rut) } },
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

        // Una categoria interna no se acepta aunque llegue su id.
        const categoria = await tx.categoria_falla.findFirst({
          where: {
            id_categoria: dto.id_categoria,
            ...FILTRO_CATEGORIAS_CLIENTE,
          },
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

        return crearTicket(tx, {
          cliente,
          idCategoria: categoria.id_categoria,
          idConversacionBot: conversacion.id_conversacion,
          valores: TICKET_ASISTENTE,
          descripcion: dto.descripcion,
          auditoria: {
            accion: 'CREAR_TICKET_ASISTENTE',
            detalle: {
              id_categoria: categoria.id_categoria,
              id_sesion: dto.id_sesion,
            },
          },
        });
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
   * No asigna operador: eso lo resuelve el CRM (G8) con los tickets abiertos
   * (`id_usuario_asignado` queda vacio). Si el ticket no se puede crear
   * (excepcion 1), avisa por correo a Soporte.
   *
   * No pide sesion del portal, a diferencia de CU-66: el ticket no lo pide el
   * cliente, lo abre el sistema al derivar, y tiene que funcionar tambien por
   * WhatsApp (via Chatwoot), donde no hay sesion.
   */
  async escalar(
    dto: EscalarConversacionDto,
  ): Promise<SolicitudSoporteCreadaDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const cliente = await tx.cliente.findFirst({
          where: { rut: { in: variantesRut(dto.rut) } },
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

        // Esta ruta no pide sesion, asi que con un RUT ajeno se podria abrir un
        // ticket tras otro a nombre de ese cliente. Mientras tenga uno abierto
        // del ultimo dia, se le informa ese mismo.
        const abierto = await tx.ticket.findFirst({
          where: {
            id_cliente: cliente.id_cliente,
            id_categoria: categoria.id_categoria,
            origen: TICKET_ASISTENTE.origen,
            estado: TICKET_ASISTENTE.estado,
            codigo_seguimiento: { not: null },
            fecha_creacion: { gte: new Date(Date.now() - UN_DIA_MS) },
          },
          orderBy: { id_ticket: 'desc' },
          select: { id_ticket: true, codigo_seguimiento: true },
        });
        if (abierto?.codigo_seguimiento) {
          return {
            id_ticket: abierto.id_ticket,
            codigo_seguimiento: abierto.codigo_seguimiento,
          };
        }

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

        return crearTicket(tx, {
          cliente,
          idCategoria: categoria.id_categoria,
          idConversacionBot: conversacion.id_conversacion,
          valores: TICKET_ASISTENTE,
          descripcion: dto.motivo ?? DESCRIPCION_ESCALAMIENTO,
          auditoria: {
            accion: 'ESCALAR_CONVERSACION_ASISTENTE',
            detalle: {
              id_conversacion_bot: conversacion.id_conversacion,
              id_sesion: dto.id_sesion,
              plataforma: dto.plataforma,
            },
          },
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // CU-77, excepcion 1: el chatbot le dice al cliente que lo atenderan en
      // breve, y aca se avisa a los operadores. Sin esperar el correo: el
      // chatbot espera 5 s y el cliente tiene que enterarse igual.
      void this.avisarEscalamientoSinTicket(dto, error);
      throw new ServiceUnavailableException(
        'No fue posible registrar el ticket de la derivacion',
        { cause: error },
      );
    }
  }

  /**
   * CU-77, excepcion 1: el ticket no se pudo crear, asi que se avisa por
   * correo a los operadores de Soporte con lo que habria llevado, para que
   * tomen el caso a mano.
   *
   * Lo mas probable es que haya fallado la base, y con ella la lista de
   * operadores: por eso existe `SOPORTE_EMAIL`, que no depende de la base.
   * Nunca lanza: un aviso que falla queda en el log y nada mas.
   */
  private async avisarEscalamientoSinTicket(
    dto: EscalarConversacionDto,
    causa: unknown,
  ): Promise<void> {
    const motivo = causa instanceof Error ? causa.message : String(causa);
    this.logger.error(`Escalamiento sin ticket (${dto.plataforma}): ${motivo}`);

    let destinatarios: string[] = [];
    try {
      const operadores = await this.prisma.usuario.findMany({
        where: {
          activo: true,
          email: { not: null },
          usuario_rol: {
            some: {
              rol: {
                nombre_rol: { equals: ROL_OPERADOR, mode: 'insensitive' },
              },
            },
          },
        },
        select: { email: true },
      });
      destinatarios = operadores.flatMap((o) => (o.email ? [o.email] : []));
    } catch (error) {
      this.logger.warn(
        `No se pudieron leer los operadores: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!destinatarios.length) {
      const respaldo = this.configService.get<string>('SOPORTE_EMAIL')?.trim();
      if (respaldo) destinatarios = [respaldo];
    }
    if (!destinatarios.length) {
      this.logger.error(
        'Escalamiento sin ticket y sin a quien avisar: no hay operadores de Soporte ni SOPORTE_EMAIL',
      );
      return;
    }

    try {
      await this.mailService.sendEscalamientoSinTicket(destinatarios, {
        rut: dto.rut,
        plataforma: dto.plataforma,
        motivo: dto.motivo,
        historial: dto.historial,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo avisar el escalamiento a Soporte: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
