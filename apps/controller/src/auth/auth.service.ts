import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { cleanRut, variantesRut } from '../common/utils/rut.js';
import { registrarAceptacionPolitica } from '../common/politica-privacidad.js';

/**
 * CU-05: "se registra el evento en la bitácora de auditoría". Y es lo que deja el
 * CU-06, que el sistema guarde el historial de las IPs bloqueadas con su fecha,
 * hora y cantidad de intentos, sin panel.
 */
export const ACCION_BLOQUEO_INTENTOS = 'BLOQUEO_INTENTOS_FALLIDOS';

/**
 * RNF-04.1: el enlace de recuperación es de un solo uso. El token lleva una
 * huella de la contraseña que el cliente tenía al pedirlo; cuando la contraseña
 * cambia (con ese enlace o de cualquier otra forma), la huella deja de coincidir
 * y el enlace ya no sirve. Así no hace falta una tabla de enlaces usados, que
 * sería un cambio de schema en la base compartida (acuerdo v2.0, §13).
 *
 * Es un SHA-256 del hash bcrypt: no permite recuperar ni el hash ni la clave.
 */
function huellaPassword(hash: string | null): string {
  return createHash('sha256')
    .update(hash ?? '')
    .digest('hex')
    .slice(0, 32);
}

/**
 * Los dos enlaces de un solo uso que manda el portal (RNF-04.1): el del CU-03,
 * para restablecer la contraseña, y el del CU-04, para que un cliente que ya
 * existe cree la suya. Un enlace de un tipo no sirve para el otro, y ninguno
 * sirve como sesión: la estrategia JWT solo acepta el tipo `access`.
 */
type TipoEnlace = 'reset' | 'registro';

/** Dónde abre cada enlace en la vista. */
const RUTA_ENLACE: Record<TipoEnlace, string> = {
  reset: '/restablecer-password',
  registro: '/registro/confirmar',
};

const MENSAJE_ENLACE_USADO: Record<TipoEnlace, string> = {
  reset:
    'Este enlace ya fue usado. Si necesitas cambiar tu contraseña, solicita uno nuevo',
  registro:
    'Este enlace ya fue usado. Si todavía no tienes contraseña, solicita uno nuevo',
};

/**
 * CU-04: qué pasó al pedir el registro. La vista muestra un mensaje por cada
 * uno. Dice si un RUT es cliente, como ya lo dice la consulta pública de deuda
 * (CU-39), porque la Excepción 4 del CU-04 pide informar que ya está
 * registrado.
 */
export type ResultadoRegistro =
  | 'NO_CLIENTE'
  | 'YA_REGISTRADO'
  | 'SIN_CORREO'
  | 'ENLACE_ENVIADO';

/** Solo un cliente activo entra al portal: lo exigen el login y el registro. */
function clienteActivo(estado: string): boolean {
  return estado.trim().toLowerCase() === 'activo';
}

/** Lo que el portal necesita del cliente para abrirle una sesión. */
type ClienteSesion = {
  id_cliente: number;
  id_empresa: number | null;
  rut: string | null;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
};

interface IntentoFallidoMemoria {
  rut_intentado: string;
  ip_address: string;
  timestamp: Date;
  bloqueado_hasta: Date | null;
}

/**
 * Fallback en memoria para mantener el control de bloqueo por fuerza bruta
 * cuando la base de datos no está disponible (CU-05 Excepción 1).
 *
 * Los registros expiran automáticamente después de 30 minutos.
 *
 * Cada intento se guarda una vez y se indexa por IP y por RUT, así que cada
 * consulta recorre solo los intentos de esa IP o ese RUT (O(k)), no todos los
 * de los últimos 30 minutos: durante un ataque, que es cuando se usa, la lista
 * completa crece con cada intento.
 */
export class BruteForceFallback {
  private readonly porIp = new Map<string, IntentoFallidoMemoria[]>();
  private readonly porRut = new Map<string, IntentoFallidoMemoria[]>();
  private readonly TTL = 30 * 60 * 1000; // 30 min
  /**
   * Cada consulta descarta lo vencido de su propia clave. Las claves que nadie
   * vuelve a consultar se barren cada tanto, para que no se acumulen.
   */
  private readonly BARRIDO = 60 * 1000; // 1 min
  private ultimoBarrido = 0;

  /** El reloj entra por parámetro para probar las ventanas sin esperar. */
  constructor(private readonly reloj: () => Date = () => new Date()) {}

  estaBloqueado(rut: string, ip: string): { ip: boolean; rut: boolean } {
    const ahora = this.reloj();
    this.barrer(ahora);
    const bloqueado = (intentos: IntentoFallidoMemoria[]) =>
      intentos.some((i) => i.bloqueado_hasta && i.bloqueado_hasta > ahora);
    return {
      ip: bloqueado(this.vigentes(this.porIp, ip, ahora)),
      rut: bloqueado(this.vigentes(this.porRut, rut, ahora)),
    };
  }

  registrarIntento(
    rut: string,
    ip: string,
  ): {
    bloquearRut: boolean;
    bloquearIp: boolean;
    bloquearHasta: Date | null;
  } {
    const ahora = this.reloj();
    this.barrer(ahora);

    const ventanaRut = new Date(ahora.getTime() - 10 * 60 * 1000);
    const intentosRut = this.vigentes(this.porRut, rut, ahora).filter(
      (i) => i.timestamp >= ventanaRut,
    ).length;

    const ventanaIp = new Date(ahora.getTime() - 5 * 60 * 1000);
    const intentosIp = this.vigentes(this.porIp, ip, ahora).filter(
      (i) => i.timestamp >= ventanaIp,
    ).length;

    const bloquearRut = intentosRut + 1 >= 5;
    const bloquearIp = intentosIp + 1 >= 5;
    const bloquearHasta =
      bloquearRut || bloquearIp
        ? new Date(ahora.getTime() + 15 * 60 * 1000)
        : null;

    // Un solo registro en los dos índices: el intento que bloquea deja
    // bloqueados su IP y su RUT.
    const intento: IntentoFallidoMemoria = {
      rut_intentado: rut,
      ip_address: ip,
      timestamp: ahora,
      bloqueado_hasta: bloquearHasta,
    };
    this.agregar(this.porIp, ip, intento);
    this.agregar(this.porRut, rut, intento);

    return { bloquearRut, bloquearIp, bloquearHasta };
  }

  /** Borra los intentos del RUT, también del conteo de las IPs desde donde se hicieron. */
  limpiarBloqueoRut(rut: string): void {
    const intentos = this.porRut.get(rut);
    if (!intentos) return;
    this.porRut.delete(rut);
    for (const ip of new Set(intentos.map((i) => i.ip_address))) {
      this.guardar(
        this.porIp,
        ip,
        (this.porIp.get(ip) ?? []).filter((i) => i.rut_intentado !== rut),
      );
    }
  }

  /** Los intentos de esa clave de los últimos 30 minutos; descarta los demás. */
  private vigentes(
    indice: Map<string, IntentoFallidoMemoria[]>,
    clave: string,
    ahora: Date,
  ): IntentoFallidoMemoria[] {
    const intentos = indice.get(clave);
    if (!intentos) return [];
    const limite = new Date(ahora.getTime() - this.TTL);
    const vivos = intentos.filter((i) => i.timestamp > limite);
    this.guardar(indice, clave, vivos);
    return vivos;
  }

  private barrer(ahora: Date): void {
    if (ahora.getTime() - this.ultimoBarrido < this.BARRIDO) return;
    this.ultimoBarrido = ahora.getTime();
    for (const indice of [this.porIp, this.porRut]) {
      for (const clave of [...indice.keys()])
        this.vigentes(indice, clave, ahora);
    }
  }

  private agregar(
    indice: Map<string, IntentoFallidoMemoria[]>,
    clave: string,
    intento: IntentoFallidoMemoria,
  ): void {
    const intentos = indice.get(clave);
    if (intentos) intentos.push(intento);
    else indice.set(clave, [intento]);
  }

  private guardar(
    indice: Map<string, IntentoFallidoMemoria[]>,
    clave: string,
    intentos: IntentoFallidoMemoria[],
  ): void {
    if (intentos.length > 0) indice.set(clave, intentos);
    else indice.delete(clave);
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly fallback = new BruteForceFallback();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async login(rut: string, password: string, ip: string) {
    const rutLimpio = cleanRut(rut);

    // Verificar bloqueo de IP y RUT — con fallback en memoria (CU-05 Excepción 1)
    try {
      const ipBloqueo = await this.prisma.intento_fallido.findFirst({
        where: {
          ip_address: ip,
          bloqueado_hasta: { gt: new Date() },
        },
        orderBy: { bloqueado_hasta: 'desc' },
      });

      if (ipBloqueo?.bloqueado_hasta) {
        this.logger.warn(
          `Login rejected: IP ${ip} blocked until ${ipBloqueo.bloqueado_hasta.toISOString()}`,
        );
        throw new UnauthorizedException('IP bloqueada temporalmente');
      }

      const bloqueo = await this.prisma.intento_fallido.findFirst({
        where: {
          rut_intentado: rutLimpio,
          bloqueado_hasta: { gt: new Date() },
        },
        orderBy: { bloqueado_hasta: 'desc' },
      });

      if (bloqueo?.bloqueado_hasta) {
        this.logger.warn(
          `Login rejected: RUT ${rutLimpio} blocked until ${bloqueo.bloqueado_hasta.toISOString()}`,
        );
        throw new UnauthorizedException('RUT bloqueado temporalmente');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      // CU-05 Excepción 1: DB no disponible → usar fallback en memoria
      this.logger.warn(
        `DB no disponible para verificar bloqueos — usando fallback en memoria`,
      );
      const bloqueoMemoria = this.fallback.estaBloqueado(rutLimpio, ip);

      if (bloqueoMemoria.ip) {
        this.logger.warn(`Login rejected (fallback): IP ${ip} bloqueada`);
        throw new UnauthorizedException('IP bloqueada temporalmente');
      }

      if (bloqueoMemoria.rut) {
        this.logger.warn(
          `Login rejected (fallback): RUT ${rutLimpio} bloqueado`,
        );
        throw new UnauthorizedException('RUT bloqueado temporalmente');
      }
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantesRut(rutLimpio) } },
    });

    if (!cliente) {
      this.logger.warn(`Login failed: RUT ${rutLimpio} not found, IP ${ip}`);
      await this.registrarIntentoFallido(rutLimpio, ip);
      throw new UnauthorizedException('RUT o contraseña incorrectos');
    }

    if (!clienteActivo(cliente.estado)) {
      this.logger.warn(
        `Login rejected: RUT ${rutLimpio} estado=${cliente.estado}, IP ${ip}`,
      );
      throw new UnauthorizedException('RUT o contraseña incorrectos');
    }

    if (!cliente.password_portal_hash) {
      this.logger.warn(
        `Login failed: RUT ${rutLimpio} has no password, IP ${ip}`,
      );
      await this.registrarIntentoFallido(
        rutLimpio,
        ip,
        cliente.id_empresa ?? null,
      );
      throw new UnauthorizedException('RUT o contraseña incorrectos');
    }

    const passwordValida = await bcrypt.compare(
      password,
      cliente.password_portal_hash,
    );

    if (!passwordValida) {
      this.logger.warn(
        `Login failed: RUT ${rutLimpio} wrong password, IP ${ip}`,
      );
      await this.registrarIntentoFallido(
        rutLimpio,
        ip,
        cliente.id_empresa ?? null,
      );
      throw new UnauthorizedException('RUT o contraseña incorrectos');
    }

    // Login exitoso: se reinicia el contador del RUT, pero las filas que
    // dispararon un bloqueo se conservan: son el historial del CU-06. No cambian
    // el control, porque un login exitoso solo llega con esos bloqueos ya vencidos
    // y fuera de las ventanas de conteo (5 y 10 minutos, contra 15 de bloqueo).
    try {
      await this.prisma.intento_fallido.deleteMany({
        where: { rut_intentado: rutLimpio, bloqueado_hasta: null },
      });
    } catch {
      this.fallback.limpiarBloqueoRut(rutLimpio);
    }

    const sesion = await this.abrirSesion(cliente, ip);
    this.logger.log(`Login success: RUT ${rutLimpio}, IP ${ip}`);
    return sesion;
  }

  async logout(idCliente: number, token: string) {
    await this.prisma.sesion_portal.deleteMany({
      where: {
        id_cliente: idCliente,
        token,
      },
    });
  }

  async recuperarPassword(rut: string, ip?: string) {
    const rutLimpio = cleanRut(rut);
    const mensajeGenerico = {
      message: 'Si el RUT está registrado, recibirás un enlace de recuperación',
    };

    const cliente = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantesRut(rutLimpio) } },
    });

    if (!cliente) {
      return mensajeGenerico;
    }

    if (!cliente.email) {
      await this.prisma.intento_fallido.create({
        data: {
          rut_intentado: rutLimpio,
          ip_address: ip ?? '0.0.0.0',
          id_empresa: cliente.id_empresa ?? undefined,
        },
      });
      return mensajeGenerico;
    }

    try {
      const link = await this.crearEnlace(cliente, 'reset');

      try {
        await this.mailService.sendPasswordReset(
          cliente.email,
          cliente.nombre_completo,
          link,
          cliente.id_empresa,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send password reset email to ${cliente.email}`,
          error,
        );
      }

      return mensajeGenerico;
    } catch {
      return mensajeGenerico;
    }
  }

  async restablecerPassword(token: string, password: string) {
    const cliente = await this.fijarPasswordConEnlace(token, 'reset', password);

    this.logger.log(
      `Password reset completed for cliente id=${cliente.id_cliente}`,
    );
    await this.invalidarSesionesAnteriores(cliente.id_cliente);

    if (cliente.email) {
      try {
        await this.mailService.sendPasswordChanged(
          cliente.email,
          cliente.nombre_completo,
          cliente.id_empresa,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send password changed email to ${cliente.email}`,
          error,
        );
      }
    }

    return { message: 'Contraseña restablecida exitosamente' };
  }

  /**
   * CU-04, paso 1: el cliente que ya existe pide crear su cuenta con su RUT
   * (G8, 01-10, §6). Conocer el RUT no basta: el enlace va a su correo ya
   * registrado. Sin correo, la activación es manual (§6.2).
   */
  async solicitarRegistro(
    rut: string,
  ): Promise<{ resultado: ResultadoRegistro }> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantesRut(cleanRut(rut)) } },
    });

    if (!cliente || !clienteActivo(cliente.estado)) {
      return { resultado: 'NO_CLIENTE' };
    }
    if (cliente.password_portal_hash) {
      return { resultado: 'YA_REGISTRADO' };
    }
    if (!cliente.email?.trim()) {
      return { resultado: 'SIN_CORREO' };
    }

    const link = await this.crearEnlace(cliente, 'registro');
    try {
      await this.mailService.sendRegistroCuenta(
        cliente.email,
        cliente.nombre_completo,
        link,
        cliente.id_empresa,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el enlace de registro al cliente id=${cliente.id_cliente}`,
        error,
      );
      throw new ServiceUnavailableException(
        'No pudimos enviar el correo. Intenta de nuevo en unos minutos',
      );
    }

    return { resultado: 'ENLACE_ENVIADO' };
  }

  /**
   * CU-04, paso 2: con el enlace del correo, el cliente crea su contraseña,
   * acepta la Política de Privacidad (CU-75) y queda con la sesión iniciada
   * (poscondición del CU-04).
   */
  async confirmarRegistro(
    token: string,
    password: string,
    versionPolitica: string,
    ip: string,
  ) {
    const cliente = await this.fijarPasswordConEnlace(
      token,
      'registro',
      password,
      async (tx, c) => {
        // Pudo dejar de ser cliente activo después de pedir el enlace. Si
        // lanza, la transacción se revierte y la contraseña no queda.
        if (!clienteActivo(c.estado)) {
          throw new BadRequestException(
            'No encontramos una cuenta de cliente activa para este enlace',
          );
        }
        await registrarAceptacionPolitica(tx, {
          formulario: 'REGISTRO',
          entidad: 'cliente',
          id_entidad: c.id_cliente,
          version: versionPolitica,
          ip,
          datos: { rut: c.rut },
        });
      },
    );

    this.logger.log(`Registro completado: cliente id=${cliente.id_cliente}`);
    return this.abrirSesion(cliente, ip);
  }

  /**
   * RNF-04.1: un enlace de un solo uso, de 30 minutos. Lleva la huella de la
   * contraseña que el cliente tiene ahora: cuando cambia, el enlace deja de
   * servir.
   */
  private async crearEnlace(
    cliente: { id_cliente: number; password_portal_hash: string | null },
    tipo: TipoEnlace,
  ): Promise<string> {
    const token = await this.jwtService.signAsync(
      {
        sub: cliente.id_cliente,
        type: tipo,
        huella: huellaPassword(cliente.password_portal_hash),
      },
      { expiresIn: '30m' },
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${frontendUrl}${RUTA_ENLACE[tipo]}#token=${token}`;
  }

  /**
   * Fija la contraseña con un enlace de un solo uso (RNF-04.1). El enlace tiene
   * que ser del tipo pedido y la contraseña de la base, la misma que cuando se
   * pidió. El cambio va condicionado al hash anterior: si llegan dos envíos con
   * el mismo enlace a la vez, solo uno la cambia. `enTransaccion` corre en la
   * misma transacción, después del cambio.
   */
  private async fijarPasswordConEnlace(
    token: string,
    tipo: TipoEnlace,
    password: string,
    enTransaccion?: (
      tx: Prisma.TransactionClient,
      cliente: ClienteSesion & { estado: string },
    ) => Promise<void>,
  ): Promise<ClienteSesion & { estado: string }> {
    let payload: { sub: number; type: string; huella?: string };

    try {
      payload = this.jwtService.verify<{
        sub: number;
        type: string;
        huella?: string;
      }>(token);
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    if (payload.type !== tipo || !payload.huella) {
      throw new BadRequestException('Token inválido');
    }

    const encontrado = await this.prisma.cliente.findUnique({
      where: { id_cliente: payload.sub },
      select: {
        rut: true,
        id_empresa: true,
        nombre_completo: true,
        email: true,
        telefono: true,
        estado: true,
        password_portal_hash: true,
      },
    });
    if (
      !encontrado ||
      huellaPassword(encontrado.password_portal_hash) !== payload.huella
    ) {
      throw new BadRequestException(MENSAJE_ENLACE_USADO[tipo]);
    }
    const { password_portal_hash: hashAnterior, ...datos } = encontrado;
    const cliente = { ...datos, id_cliente: payload.sub };

    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.cliente.updateMany({
        where: {
          id_cliente: payload.sub,
          password_portal_hash: hashAnterior,
        },
        data: { password_portal_hash: passwordHash },
      });
      if (count === 0) {
        throw new BadRequestException(MENSAJE_ENLACE_USADO[tipo]);
      }
      await enTransaccion?.(tx, cliente);
    });

    return cliente;
  }

  /**
   * La sesión del portal: el JWT de tipo `access`, la fila de `sesion_portal`
   * y los datos del cliente. Cierra las sesiones anteriores del cliente.
   *
   * El token lleva la empresa del cliente, como los de G8: cada empresa tiene
   * su token y la vista se arma según él. `JwtStrategy` la compara con la base
   * en cada petición, así que no se puede cambiar desde el navegador.
   */
  private async abrirSesion(cliente: ClienteSesion, ip: string) {
    const token = await this.jwtService.signAsync({
      sub: cliente.id_cliente,
      rut: cliente.rut,
      type: 'access',
      id_empresa: cliente.id_empresa,
    });

    await this.invalidarSesionesAnteriores(cliente.id_cliente);

    await this.prisma.sesion_portal.create({
      data: {
        id_cliente: cliente.id_cliente,
        token,
        fecha_inicio: new Date(),
        fecha_expiracion: this.calcularExpiracion(),
        ip_origen: ip,
      },
    });

    return {
      access_token: token,
      cliente: {
        id: cliente.id_cliente,
        id_empresa: cliente.id_empresa,
        rut: cliente.rut,
        nombre_completo: cliente.nombre_completo,
        email: cliente.email,
        telefono: cliente.telefono,
      },
    };
  }

  private async invalidarSesionesAnteriores(idCliente: number) {
    await this.prisma.sesion_portal.updateMany({
      where: {
        id_cliente: idCliente,
        fecha_expiracion: { gt: new Date() },
      },
      data: {
        fecha_expiracion: new Date(),
      },
    });
  }

  private calcularExpiracion(): Date {
    const timeout = parseInt(
      process.env.SESSION_INACTIVITY_MINUTES ?? '15',
      10,
    );
    const expiracion = new Date();
    expiracion.setMinutes(expiracion.getMinutes() + timeout);
    return expiracion;
  }

  private async registrarIntentoFallido(
    rutLimpio: string,
    ip: string,
    idEmpresa?: number | null,
  ) {
    const ahora = new Date();

    try {
      const ventanaRut = new Date(ahora.getTime() - 10 * 60 * 1000);
      const intentosRut = await this.prisma.intento_fallido.count({
        where: {
          rut_intentado: rutLimpio,
          timestamp: { gte: ventanaRut },
        },
      });

      const ventanaIp = new Date(ahora.getTime() - 5 * 60 * 1000);
      const intentosIp = await this.prisma.intento_fallido.count({
        where: {
          ip_address: ip,
          timestamp: { gte: ventanaIp },
        },
      });

      const bloquearRut = intentosRut + 1 >= 5;
      const bloquearIp = intentosIp + 1 >= 5;
      const bloquearHasta =
        bloquearRut || bloquearIp
          ? new Date(ahora.getTime() + 15 * 60 * 1000)
          : null;

      if (bloquearHasta) {
        const motivo = [
          bloquearRut && `RUT ${rutLimpio}`,
          bloquearIp && `IP ${ip}`,
        ]
          .filter(Boolean)
          .join(' y ');
        this.logger.warn(
          `Brute force block: ${motivo} bloqueado hasta ${bloquearHasta.toISOString()}`,
        );
      }

      const creado = await this.prisma.intento_fallido.create({
        data: {
          rut_intentado: rutLimpio,
          id_empresa: idEmpresa ?? undefined,
          ip_address: ip,
          timestamp: ahora,
          bloqueado_hasta: bloquearHasta ?? undefined,
        },
        select: { id_intento: true },
      });

      if (bloquearHasta) {
        await this.auditarBloqueo(creado, ip, {
          bloquea_ip: bloquearIp,
          bloquea_rut: bloquearRut,
          intentos_ip: intentosIp + 1,
          intentos_rut: intentosRut + 1,
          bloqueado_hasta: bloquearHasta.toISOString(),
        });
      }
    } catch {
      // CU-05 Excepción 1: DB no disponible → registrar en fallback en memoria
      this.logger.warn(
        `DB no disponible para registrar intento fallido — usando fallback en memoria`,
      );
      const resultado = this.fallback.registrarIntento(rutLimpio, ip);

      if (resultado.bloquearHasta) {
        const motivo = [
          resultado.bloquearRut && `RUT ${rutLimpio}`,
          resultado.bloquearIp && `IP ${ip}`,
        ]
          .filter(Boolean)
          .join(' y ');
        this.logger.warn(
          `Brute force block (fallback): ${motivo} bloqueado hasta ${resultado.bloquearHasta.toISOString()}`,
        );
      }
    }
  }

  /**
   * El evento del bloqueo en la bitácora de auditoría (CU-05), que además es el
   * historial que guarda el CU-06: la IP, la fecha y hora, y la cantidad de
   * intentos.
   *
   * No va en una transacción con el intento a propósito: el bloqueo ya quedó
   * aplicado con esa fila, y si la auditoría fallara junto con ella, el bloqueo
   * se perdería con la base arriba (el respaldo en memoria solo se consulta con
   * la base caída). Por eso nunca lanza.
   */
  private async auditarBloqueo(
    intento: { id_intento: bigint },
    ip: string,
    detalle: {
      bloquea_ip: boolean;
      bloquea_rut: boolean;
      intentos_ip: number;
      intentos_rut: number;
      bloqueado_hasta: string;
    },
  ): Promise<void> {
    try {
      await this.prisma.log_auditoria.create({
        data: {
          accion: ACCION_BLOQUEO_INTENTOS,
          entidad_afectada: 'intento_fallido',
          valor_nuevo: {
            // Número JSON, como pide el §10 del acuerdo v2.0 para los IDs
            // internos. El BigInt no pasa a JSON tal cual, y los ids están muy
            // lejos de 2^53. No va en id_entidad_afectada, que es Int.
            id_intento: Number(intento.id_intento),
            ...detalle,
            origen: 'PORTAL',
          },
          ip_origen: ip,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo auditar el bloqueo del intento ${String(intento?.id_intento)}`,
        error,
      );
    }
  }
}
