import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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

const MENSAJE_ENLACE_USADO =
  'Este enlace ya fue usado. Si necesitas cambiar tu contraseña, solicita uno nuevo';

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

    if (cliente.estado.trim().toLowerCase() !== 'activo') {
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

    const payload = {
      sub: cliente.id_cliente,
      rut: cliente.rut,
      type: 'access',
    };
    const token = await this.jwtService.signAsync(payload);

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

    this.logger.log(`Login success: RUT ${rutLimpio}, IP ${ip}`);

    return {
      access_token: token,
      cliente: {
        id: cliente.id_cliente,
        rut: cliente.rut,
        nombre_completo: cliente.nombre_completo,
        email: cliente.email,
        telefono: cliente.telefono,
      },
    };
  }

  async register(
    rut: string,
    nombreCompleto: string,
    password: string,
    ip: string,
    email: string,
    telefono: string | null | undefined,
    versionPolitica: string,
  ) {
    const rutLimpio = cleanRut(rut);

    const existenteRut = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantesRut(rutLimpio) } },
    });

    if (existenteRut) {
      this.logger.warn(
        `Register failed: RUT ${rutLimpio} already exists, IP ${ip}`,
      );
      throw new ConflictException('No se pudo completar el registro');
    }

    const existenteEmail = await this.prisma.cliente.findFirst({
      where: { email },
    });

    if (existenteEmail) {
      this.logger.warn(`Register failed: email already in use, IP ${ip}`);
      throw new ConflictException('No se pudo completar el registro');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // CU-75: el cliente y su aceptacion de la Politica de Privacidad se
    // registran juntos, o no se registra ninguno.
    const cliente = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.cliente.create({
        data: {
          rut: rutLimpio,
          nombre_completo: nombreCompleto,
          email: email,
          telefono: telefono || null,
          password_portal_hash: passwordHash,
          id_empresa: 1,
          estado: 'activo',
        },
      });

      await registrarAceptacionPolitica(tx, {
        formulario: 'REGISTRO',
        entidad: 'cliente',
        id_entidad: creado.id_cliente,
        version: versionPolitica,
        ip,
        datos: {
          rut: rutLimpio,
          nombre_completo: nombreCompleto,
          email,
          telefono: telefono || null,
        },
      });

      return creado;
    });

    const payload = { sub: cliente.id_cliente, rut: cliente.rut };
    const token = await this.jwtService.signAsync(payload);

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
        rut: cliente.rut,
        nombre_completo: cliente.nombre_completo,
        email: cliente.email,
        telefono: cliente.telefono,
      },
    };
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
      const payload = {
        sub: cliente.id_cliente,
        type: 'reset',
        huella: huellaPassword(cliente.password_portal_hash),
      };
      // RNF-04.1: el enlace de recuperación dura 30 minutos y es de un solo uso.
      const token = await this.jwtService.signAsync(payload, {
        expiresIn: '30m',
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = `${frontendUrl}/restablecer-password#token=${token}`;

      try {
        await this.mailService.sendPasswordReset(
          cliente.email,
          cliente.nombre_completo,
          link,
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

    if (payload.type !== 'reset' || !payload.huella) {
      throw new BadRequestException('Token inválido');
    }

    // RNF-04.1, un solo uso: la contraseña tiene que ser la misma que cuando se
    // pidió el enlace.
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: payload.sub },
      select: {
        password_portal_hash: true,
        email: true,
        nombre_completo: true,
      },
    });
    if (
      !cliente ||
      huellaPassword(cliente.password_portal_hash) !== payload.huella
    ) {
      throw new BadRequestException(MENSAJE_ENLACE_USADO);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Condicionada al hash anterior: si llegan dos envíos con el mismo enlace a
    // la vez, solo uno cambia la contraseña.
    const { count } = await this.prisma.cliente.updateMany({
      where: {
        id_cliente: payload.sub,
        password_portal_hash: cliente.password_portal_hash,
      },
      data: { password_portal_hash: passwordHash },
    });
    if (count === 0) {
      throw new BadRequestException(MENSAJE_ENLACE_USADO);
    }

    this.logger.log(`Password reset completed for cliente id=${payload.sub}`);
    await this.invalidarSesionesAnteriores(payload.sub);

    if (cliente.email) {
      try {
        await this.mailService.sendPasswordChanged(
          cliente.email,
          cliente.nombre_completo,
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
