import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { cleanRut } from '../common/utils/rut.js';

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
 */
class BruteForceFallback {
  private intentos: IntentoFallidoMemoria[] = [];
  private readonly TTL = 30 * 60 * 1000; // 30 min

  limpiarExpirados(): void {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() - this.TTL);
    this.intentos = this.intentos.filter((i) => i.timestamp > limite);
  }

  estaBloqueado(rut: string, ip: string): { ip: boolean; rut: boolean } {
    this.limpiarExpirados();
    const ahora = new Date();
    const ipBloqueada = this.intentos.some(
      (i) =>
        i.ip_address === ip && i.bloqueado_hasta && i.bloqueado_hasta > ahora,
    );
    const rutBloqueado = this.intentos.some(
      (i) =>
        i.rut_intentado === rut &&
        i.bloqueado_hasta &&
        i.bloqueado_hasta > ahora,
    );
    return { ip: ipBloqueada, rut: rutBloqueado };
  }

  registrarIntento(
    rut: string,
    ip: string,
  ): {
    bloquearRut: boolean;
    bloquearIp: boolean;
    bloquearHasta: Date | null;
  } {
    this.limpiarExpirados();
    const ahora = new Date();

    const ventanaRut = new Date(ahora.getTime() - 10 * 60 * 1000);
    const intentosRut = this.intentos.filter(
      (i) => i.rut_intentado === rut && i.timestamp >= ventanaRut,
    ).length;

    const ventanaIp = new Date(ahora.getTime() - 5 * 60 * 1000);
    const intentosIp = this.intentos.filter(
      (i) => i.ip_address === ip && i.timestamp >= ventanaIp,
    ).length;

    const bloquearRut = intentosRut + 1 >= 5;
    const bloquearIp = intentosIp + 1 >= 5;
    const bloquearHasta =
      bloquearRut || bloquearIp
        ? new Date(ahora.getTime() + 15 * 60 * 1000)
        : null;

    this.intentos.push({
      rut_intentado: rut,
      ip_address: ip,
      timestamp: ahora,
      bloqueado_hasta: bloquearHasta,
    });

    return { bloquearRut, bloquearIp, bloquearHasta };
  }

  limpiarBloqueoRut(rut: string): void {
    this.intentos = this.intentos.filter((i) => !(i.rut_intentado === rut));
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

    const cliente = await this.prisma.cliente.findUnique({
      where: { rut: rutLimpio },
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

    // Login exitoso: limpiar intentos fallidos del RUT
    try {
      await this.prisma.intento_fallido.deleteMany({
        where: { rut_intentado: rutLimpio },
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
    telefono?: string | null,
  ) {
    const rutLimpio = cleanRut(rut);

    const existenteRut = await this.prisma.cliente.findUnique({
      where: { rut: rutLimpio },
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

    const cliente = await this.prisma.cliente.create({
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

    const cliente = await this.prisma.cliente.findUnique({
      where: { rut: rutLimpio },
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
      const payload = { sub: cliente.id_cliente, type: 'reset' };
      const token = await this.jwtService.signAsync(payload, {
        expiresIn: '15m',
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
    let payload: { sub: number; type: string };

    try {
      payload = this.jwtService.verify<{ sub: number; type: string }>(token);
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    if (payload.type !== 'reset') {
      throw new BadRequestException('Token inválido');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const cliente = await this.prisma.cliente.update({
      where: { id_cliente: payload.sub },
      data: { password_portal_hash: passwordHash },
    });

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

      await this.prisma.intento_fallido.create({
        data: {
          rut_intentado: rutLimpio,
          id_empresa: idEmpresa ?? undefined,
          ip_address: ip,
          timestamp: ahora,
          bloqueado_hasta: bloquearHasta ?? undefined,
        },
      });
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
}
