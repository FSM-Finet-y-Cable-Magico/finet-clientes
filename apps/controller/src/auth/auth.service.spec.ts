import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

jest.unstable_mockModule('bcrypt', () => ({
  default: { compare: jest.fn(), hash: jest.fn() },
  compare: jest.fn(),
  hash: jest.fn(),
}));

const { AuthService } = await import('./auth.service.js');
const bcrypt = await import('bcrypt');
const { MailService } = await import('../mail/mail.service.js');

describe('AuthService', () => {
  let authService: InstanceType<typeof AuthService>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockCliente = {
    id_cliente: 1,
    rut: '123456785',
    nombre_completo: 'Juan Pérez',
    email: 'juan@test.cl',
    telefono: '912345678',
    password_portal_hash: 'hashedpassword',
    estado: 'activo',
  };

  // El cliente se busca por RUT, en sus dos formas (variantesRut). Cada test
  // fija qué responde esa búsqueda.
  let porRut: jest.Mock;

  beforeEach(async () => {
    porRut = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            log_auditoria: { create: jest.fn() },
            cliente: {
              findFirst: jest.fn(
                (args: unknown): unknown => porRut(args) as unknown,
              ),
              update: jest.fn(),
              findUnique: jest.fn(),
              updateMany: jest.fn(),
            },
            sesion_portal: {
              create: jest.fn(),
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            intento_fallido: {
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordReset: jest.fn().mockResolvedValue(undefined),
            sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
            sendRegistroCuenta: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    // La transaccion del registro (CU-75) corre sobre el mismo mock.
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      (cb: (tx: unknown) => unknown) => cb(prisma),
    );
  });

  describe('login', () => {
    it('return token and cliente when credentials are valid', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      porRut.mockResolvedValue(mockCliente);
      (jwtService.signAsync as jest.Mock).mockResolvedValue('jwt-token');

      const result = await authService.login(
        '123456785',
        'password',
        '127.0.0.1',
      );

      expect(result).toHaveProperty('access_token', 'jwt-token');
      expect(result).toHaveProperty('cliente');
      expect(result.cliente.rut).toBe('123456785');
    });

    it('el token lleva la empresa del cliente: un token por empresa, como G8 (11-11)', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      porRut.mockResolvedValue({ ...mockCliente, id_empresa: 2 });

      await authService.login('123456785', 'password', '127.0.0.1');

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 1,
        rut: '123456785',
        type: 'access',
        id_empresa: 2,
      });
    });

    it('la respuesta del login dice de qué empresa es el cliente', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      porRut.mockResolvedValue({ ...mockCliente, id_empresa: 2 });

      const result = await authService.login(
        '123456785',
        'password',
        '127.0.0.1',
      );

      expect(result.cliente.id_empresa).toBe(2);
    });

    it('encuentra al cliente aunque su RUT esté guardado con guion (G3, 29-09)', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      porRut.mockResolvedValue({ ...mockCliente, rut: '12345678-5' });

      await authService.login('12.345.678-5', 'Password1', '127.0.0.1');

      expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
        where: { rut: { in: ['123456785', '12345678-5'] } },
      });
    });

    it('throw UnauthorizedException when cliente not found', async () => {
      porRut.mockResolvedValue(null);

      await expect(
        authService.login('999999999', 'password', '127.0.0.1'),
      ).rejects.toThrow('RUT o contraseña incorrectos');
    });

    it('throw UnauthorizedException when cliente has no password', async () => {
      porRut.mockResolvedValue({
        ...mockCliente,
        password_portal_hash: null,
      });

      await expect(
        authService.login('123456785', 'password', '127.0.0.1'),
      ).rejects.toThrow('RUT o contraseña incorrectos');
    });

    it('throw UnauthorizedException when password is wrong', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      porRut.mockResolvedValue(mockCliente);

      await expect(
        authService.login('123456785', 'wrongpassword', '127.0.0.1'),
      ).rejects.toThrow('RUT o contraseña incorrectos');
    });
  });

  describe('recuperarPassword', () => {
    it('return generic message when RUT exists with email', async () => {
      porRut.mockResolvedValue(mockCliente);
      (jwtService.signAsync as jest.Mock).mockResolvedValue('reset-token');

      const result = await authService.recuperarPassword('123456785');

      expect(result).toHaveProperty('message');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 1, type: 'reset', huella: expect.any(String) },
        { expiresIn: '30m' },
      );
    });

    it('return generic message when RUT not found', async () => {
      porRut.mockResolvedValue(null);

      const result = await authService.recuperarPassword('999999999');

      expect(result).toHaveProperty('message');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('restablecerPassword', () => {
    /** Pide un enlace y devuelve el payload firmado, como lo vería restablecer. */
    async function pedirEnlace(hashActual: string | null = 'hashedpassword') {
      porRut.mockResolvedValue({
        ...mockCliente,
        password_portal_hash: hashActual,
      });
      (jwtService.signAsync as jest.Mock).mockResolvedValue('reset-token');
      await authService.recuperarPassword('123456785');
      const [payload] = (jwtService.signAsync as jest.Mock).mock.calls.at(-1)!;
      (jwtService.verify as jest.Mock).mockReturnValue(payload);
    }

    function hashEnBase(hash: string | null) {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
        password_portal_hash: hash,
        email: 'juan@test.cl',
        nombre_completo: 'Juan Pérez',
      });
    }

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      (prisma.cliente.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    });

    it('update password and invalidate sessions on valid token', async () => {
      await pedirEnlace('hashedpassword');
      hashEnBase('hashedpassword');

      const result = await authService.restablecerPassword(
        'reset-token',
        'NewPass1',
      );

      expect(prisma.cliente.updateMany).toHaveBeenCalledWith({
        where: { id_cliente: 1, password_portal_hash: 'hashedpassword' },
        data: { password_portal_hash: 'new-hash' },
      });
      expect(prisma.sesion_portal.updateMany).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Contraseña restablecida exitosamente',
      });
    });

    it('RNF-04.1: el enlace no sirve una segunda vez', async () => {
      await pedirEnlace('hashedpassword');
      // La primera vez cambió la contraseña: en la base ya está el hash nuevo.
      hashEnBase('new-hash');

      await expect(
        authService.restablecerPassword('reset-token', 'OtraPass2'),
      ).rejects.toThrow('Este enlace ya fue usado');
      expect(prisma.cliente.updateMany).not.toHaveBeenCalled();
    });

    it('RNF-04.1: si la contraseña cambió por otro lado, el enlace tampoco sirve', async () => {
      await pedirEnlace('hashedpassword');
      hashEnBase('hash-cambiado-desde-el-perfil');

      await expect(
        authService.restablecerPassword('reset-token', 'OtraPass2'),
      ).rejects.toThrow('Este enlace ya fue usado');
    });

    it('RNF-04.1: dos envíos a la vez con el mismo enlace, solo uno cambia la contraseña', async () => {
      await pedirEnlace('hashedpassword');
      hashEnBase('hashedpassword');
      (prisma.cliente.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        authService.restablecerPassword('reset-token', 'OtraPass2'),
      ).rejects.toThrow('Este enlace ya fue usado');
      expect(prisma.sesion_portal.updateMany).not.toHaveBeenCalled();
    });

    it('sirve para un cliente que todavía no tenía contraseña', async () => {
      await pedirEnlace(null);
      hashEnBase(null);

      await expect(
        authService.restablecerPassword('reset-token', 'NewPass1'),
      ).resolves.toEqual({ message: 'Contraseña restablecida exitosamente' });
    });

    it('un token de recuperación sin huella no sirve', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 1,
        type: 'reset',
      });

      await expect(
        authService.restablecerPassword('reset-token', 'NewPass1'),
      ).rejects.toThrow('Token inválido');
    });

    it('throw BadRequestException on expired token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        authService.restablecerPassword('expired-token', 'NewPass1'),
      ).rejects.toThrow('Token inválido o expirado');
    });

    it('throw BadRequestException when token type is not reset', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 1,
        type: 'login',
      });

      await expect(
        authService.restablecerPassword('session-token', 'NewPass1'),
      ).rejects.toThrow('Token inválido');
    });
  });

  describe('CU-04: registro sobre un cliente que ya existe', () => {
    const sinCuenta = { ...mockCliente, password_portal_hash: null };

    function correo() {
      return (
        authService as unknown as {
          mailService: { sendRegistroCuenta: jest.Mock };
        }
      ).mailService;
    }

    describe('solicitarRegistro', () => {
      it('si el RUT no es cliente: NO_CLIENTE, sin correo', async () => {
        porRut.mockResolvedValue(null);

        await expect(
          authService.solicitarRegistro('123456785'),
        ).resolves.toEqual({ resultado: 'NO_CLIENTE' });
        expect(correo().sendRegistroCuenta).not.toHaveBeenCalled();
      });

      it('si el cliente no está activo: NO_CLIENTE, como el login, que tampoco lo deja entrar', async () => {
        porRut.mockResolvedValue({ ...sinCuenta, estado: 'inactivo' });

        await expect(
          authService.solicitarRegistro('123456785'),
        ).resolves.toEqual({ resultado: 'NO_CLIENTE' });
        expect(correo().sendRegistroCuenta).not.toHaveBeenCalled();
      });

      it('Excepción 4: si ya tiene contraseña, YA_REGISTRADO, sin correo', async () => {
        porRut.mockResolvedValue(mockCliente);

        await expect(
          authService.solicitarRegistro('123456785'),
        ).resolves.toEqual({ resultado: 'YA_REGISTRADO' });
        expect(correo().sendRegistroCuenta).not.toHaveBeenCalled();
      });

      it('G8 §6.2: sin correo registrado, SIN_CORREO; la activación es manual', async () => {
        porRut.mockResolvedValue({ ...sinCuenta, email: null });

        await expect(
          authService.solicitarRegistro('123456785'),
        ).resolves.toEqual({ resultado: 'SIN_CORREO' });
        expect(correo().sendRegistroCuenta).not.toHaveBeenCalled();
      });

      it('manda un enlace de un solo uso, de 30 minutos, al correo registrado', async () => {
        porRut.mockResolvedValue({ ...sinCuenta, id_empresa: 2 });
        (jwtService.signAsync as jest.Mock).mockResolvedValue('registro-token');

        await expect(
          authService.solicitarRegistro('123456785'),
        ).resolves.toEqual({ resultado: 'ENLACE_ENVIADO' });
        expect(jwtService.signAsync).toHaveBeenCalledWith(
          { sub: 1, type: 'registro', huella: expect.any(String) },
          { expiresIn: '30m' },
        );
        expect(correo().sendRegistroCuenta).toHaveBeenCalledWith(
          'juan@test.cl',
          'Juan Pérez',
          expect.stringContaining('/registro/confirmar#token=registro-token'),
          2,
        );
      });

      it('el enlace lleva al sitio de la empresa del cliente', async () => {
        porRut.mockResolvedValue({ ...sinCuenta, id_empresa: 2 });
        (jwtService.signAsync as jest.Mock).mockResolvedValue('registro-token');

        await authService.solicitarRegistro('123456785');

        const enlace = correo().sendRegistroCuenta.mock.calls[0][2] as string;
        expect(enlace).toMatch(
          /\/cable-magico\/registro\/confirmar#token=registro-token$/,
        );
      });

      it('el enlace de un cliente de Finet no lleva prefijo', async () => {
        porRut.mockResolvedValue({ ...sinCuenta, id_empresa: 1 });
        (jwtService.signAsync as jest.Mock).mockResolvedValue('registro-token');

        await authService.solicitarRegistro('123456785');

        const enlace = correo().sendRegistroCuenta.mock.calls[0][2] as string;
        expect(enlace).not.toContain('/cable-magico');
        expect(enlace).toMatch(/\/registro\/confirmar#token=registro-token$/);
      });

      it('si el correo no sale, lo dice en vez de decir que se envió', async () => {
        porRut.mockResolvedValue(sinCuenta);
        correo().sendRegistroCuenta.mockRejectedValueOnce(
          new Error('SMTP caído'),
        );

        await expect(
          authService.solicitarRegistro('123456785'),
        ).rejects.toThrow('No pudimos enviar el correo');
      });
    });

    describe('confirmarRegistro', () => {
      async function pedirEnlace() {
        porRut.mockResolvedValue(sinCuenta);
        (jwtService.signAsync as jest.Mock).mockResolvedValue('registro-token');
        await authService.solicitarRegistro('123456785');
        const [payload] = (jwtService.signAsync as jest.Mock).mock.calls.at(
          -1,
        )!;
        (jwtService.verify as jest.Mock).mockReturnValue(payload);
        (jwtService.signAsync as jest.Mock).mockResolvedValue('jwt-sesion');
      }

      function enBase(cambios: Record<string, unknown> = {}) {
        (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
          rut: '123456785',
          nombre_completo: 'Juan Pérez',
          email: 'juan@test.cl',
          telefono: '912345678',
          estado: 'activo',
          password_portal_hash: null,
          ...cambios,
        });
      }

      beforeEach(() => {
        (bcrypt.hash as jest.Mock).mockResolvedValue('nuevo-hash');
        (prisma.cliente.updateMany as jest.Mock).mockResolvedValue({
          count: 1,
        });
      });

      it('fija la contraseña, registra la aceptación (CU-75) y deja la sesión iniciada', async () => {
        await pedirEnlace();
        enBase();

        const r = await authService.confirmarRegistro(
          'registro-token',
          'Clave2026',
          '1.1',
          '127.0.0.1',
        );

        expect(prisma.cliente.updateMany).toHaveBeenCalledWith({
          where: { id_cliente: 1, password_portal_hash: null },
          data: { password_portal_hash: 'nuevo-hash' },
        });
        expect(prisma.log_auditoria.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            entidad_afectada: 'cliente',
            id_entidad_afectada: 1,
            valor_nuevo: expect.objectContaining({
              formulario: 'REGISTRO',
              version_politica: '1.1',
            }),
          }),
        });
        expect(jwtService.signAsync).toHaveBeenLastCalledWith({
          sub: 1,
          rut: '123456785',
          type: 'access',
        });
        expect(prisma.sesion_portal.create).toHaveBeenCalled();
        expect(r).toEqual({
          access_token: 'jwt-sesion',
          cliente: {
            id: 1,
            rut: '123456785',
            nombre_completo: 'Juan Pérez',
            email: 'juan@test.cl',
            telefono: '912345678',
          },
        });
      });

      it('RNF-04.1: el enlace no sirve una segunda vez', async () => {
        await pedirEnlace();
        enBase({ password_portal_hash: 'nuevo-hash' });

        await expect(
          authService.confirmarRegistro(
            'registro-token',
            'Otra2026',
            '1.1',
            '127.0.0.1',
          ),
        ).rejects.toThrow('Este enlace ya fue usado');
        expect(prisma.cliente.updateMany).not.toHaveBeenCalled();
        expect(prisma.sesion_portal.create).not.toHaveBeenCalled();
      });

      it('dos envíos a la vez con el mismo enlace: solo uno crea la contraseña', async () => {
        await pedirEnlace();
        enBase();
        (prisma.cliente.updateMany as jest.Mock).mockResolvedValue({
          count: 0,
        });

        await expect(
          authService.confirmarRegistro(
            'registro-token',
            'Clave2026',
            '1.1',
            '127.0.0.1',
          ),
        ).rejects.toThrow('Este enlace ya fue usado');
        expect(prisma.sesion_portal.create).not.toHaveBeenCalled();
      });

      it('si el cliente dejó de estar activo, no se le abre la sesión', async () => {
        await pedirEnlace();
        enBase({ estado: 'inactivo' });

        await expect(
          authService.confirmarRegistro(
            'registro-token',
            'Clave2026',
            '1.1',
            '127.0.0.1',
          ),
        ).rejects.toThrow('No encontramos una cuenta de cliente activa');
        expect(prisma.log_auditoria.create).not.toHaveBeenCalled();
        expect(prisma.sesion_portal.create).not.toHaveBeenCalled();
      });

      it('un enlace de recuperación (CU-03) no sirve para registrarse', async () => {
        (jwtService.verify as jest.Mock).mockReturnValue({
          sub: 1,
          type: 'reset',
          huella: 'x',
        });

        await expect(
          authService.confirmarRegistro(
            'reset-token',
            'Clave2026',
            '1.1',
            '127.0.0.1',
          ),
        ).rejects.toThrow('Token inválido');
      });

      it('un enlace de registro no sirve para restablecer la contraseña', async () => {
        await pedirEnlace();
        enBase();

        await expect(
          authService.restablecerPassword('registro-token', 'Clave2026'),
        ).rejects.toThrow('Token inválido');
      });
    });
  });

  describe('logout', () => {
    it('delete session from database', async () => {
      const deleteMany = jest
        .spyOn(prisma.sesion_portal, 'deleteMany')
        .mockResolvedValue({ count: 1 });

      await authService.logout(1, 'some-token');

      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          id_cliente: 1,
          token: 'some-token',
        },
      });
    });
  });

  describe('bloqueo por intentos fallidos', () => {
    it('bloquear RUT despues de 5 intentos en 10 minutos', async () => {
      (prisma.intento_fallido.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.intento_fallido.create as jest.Mock).mockResolvedValue({
        id_intento: 7n,
      });
      (prisma.intento_fallido.count as jest.Mock)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0);
      porRut.mockResolvedValue(null);

      await expect(
        authService.login('123456785', 'password', '127.0.0.1'),
      ).rejects.toThrow('RUT o contraseña incorrectos');

      const createCall = (prisma.intento_fallido.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.bloqueado_hasta).toBeDefined();
    });

    it('bloquear IP despues de 5 intentos en 5 minutos', async () => {
      (prisma.intento_fallido.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.intento_fallido.create as jest.Mock).mockResolvedValue({
        id_intento: 8n,
      });
      (prisma.intento_fallido.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(4);
      porRut.mockResolvedValue(null);

      await expect(
        authService.login('999999999', 'password', '192.168.1.1'),
      ).rejects.toThrow('RUT o contraseña incorrectos');

      const createCall = (prisma.intento_fallido.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.bloqueado_hasta).toBeDefined();
      expect(createCall.data.ip_address).toBe('192.168.1.1');
    });

    it('rechazar login cuando IP esta bloqueada', async () => {
      (prisma.intento_fallido.findFirst as jest.Mock).mockResolvedValue({
        id_intento: 1n,
        bloqueado_hasta: new Date(Date.now() + 600000),
        ip_address: '10.0.0.5',
      });

      await expect(
        authService.login('123456785', 'password', '10.0.0.5'),
      ).rejects.toThrow('IP bloqueada temporalmente');
    });

    it('rechazar login cuando RUT esta bloqueado', async () => {
      (prisma.intento_fallido.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id_intento: 2n,
          bloqueado_hasta: new Date(Date.now() + 600000),
          rut_intentado: '123456785',
        });

      await expect(
        authService.login('123456785', 'password', '127.0.0.1'),
      ).rejects.toThrow('RUT bloqueado temporalmente');
    });
  });

  describe('bloqueo con fallback en memoria (CU-05 Excepción 1)', () => {
    it('bloquear IP usando fallback cuando DB falla al verificar bloqueos', async () => {
      // Simular DB caída en findFirst
      (prisma.intento_fallido.findFirst as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );
      porRut.mockResolvedValue(null);
      // DB también caída al registrar intento
      (prisma.intento_fallido.create as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );

      // 5 intentos fallidos → el fallback en memoria debe bloquear la IP
      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login('111111111', 'wrong', '10.0.0.99'),
        ).rejects.toThrow('RUT o contraseña incorrectos');
      }

      // El 6to intento debe ser bloqueado por IP via fallback
      await expect(
        authService.login('222222222', 'wrong', '10.0.0.99'),
      ).rejects.toThrow('IP bloqueada temporalmente');
    });

    it('bloquear RUT usando fallback cuando DB falla al verificar bloqueos', async () => {
      (prisma.intento_fallido.findFirst as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );
      porRut.mockResolvedValue(null);
      (prisma.intento_fallido.create as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );

      // 5 intentos contra el mismo RUT desde IPs distintas
      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login('333333333', 'wrong', `10.0.0.${100 + i}`),
        ).rejects.toThrow('RUT o contraseña incorrectos');
      }

      // El 6to intento contra ese RUT debe ser bloqueado via fallback
      await expect(
        authService.login('333333333', 'wrong', '10.0.0.200'),
      ).rejects.toThrow('RUT bloqueado temporalmente');
    });

    it('fallback no produce falsos positivos — login exitoso cuando DB responde normalmente', async () => {
      // DB funcionando normalmente
      (prisma.intento_fallido.findFirst as jest.Mock).mockResolvedValue(null);
      porRut.mockResolvedValue(mockCliente);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock).mockResolvedValue('jwt-token');

      const result = await authService.login(
        '123456785',
        'password',
        '127.0.0.1',
      );
      expect(result).toHaveProperty('access_token', 'jwt-token');
      expect(result.cliente.rut).toBe('123456785');
    });

    it('fallback registra intento fallido cuando intento_fallido.create falla', async () => {
      // findFirst de bloqueos funciona (no hay bloqueos)
      (prisma.intento_fallido.findFirst as jest.Mock).mockResolvedValue(null);
      // Cliente no existe
      porRut.mockResolvedValue(null);
      // count funciona pero create falla
      (prisma.intento_fallido.count as jest.Mock).mockResolvedValue(0);
      (prisma.intento_fallido.create as jest.Mock).mockRejectedValue(
        new Error('connection refused'),
      );

      // El login debe fallar con credenciales incorrectas
      await expect(
        authService.login('555555555', 'wrong', '10.0.0.99'),
      ).rejects.toThrow('RUT o contraseña incorrectos');

      // El intento fue registrado en el fallback (no debería lanzar error)
      // Verificamos que create fue llamado (aunque falló)
      expect(prisma.intento_fallido.create).toHaveBeenCalled();
    });
  });

  // CU-06 como CU del sistema: no hay panel, pero el historial de las IPs
  // bloqueadas queda guardado, con su fecha, hora y cantidad de intentos.
  describe('CU-06: historial de bloqueos en el sistema', () => {
    const auditorias = () =>
      (prisma.log_auditoria.create as jest.Mock).mock.calls.map(
        (c) =>
          (c[0] as { data: { accion: string; valor_nuevo: unknown } }).data,
      );

    beforeEach(() => {
      (prisma.intento_fallido.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.intento_fallido.create as jest.Mock).mockResolvedValue({
        id_intento: 42n,
      });
      porRut.mockResolvedValue(null);
    });

    it('el quinto intento desde la misma IP queda en la bitácora con la cantidad de intentos (CU-05)', async () => {
      (prisma.intento_fallido.count as jest.Mock)
        .mockResolvedValueOnce(0) // RUT, 10 minutos
        .mockResolvedValueOnce(4); // IP, 5 minutos

      await expect(
        authService.login('999999999', 'mala', '192.168.1.50'),
      ).rejects.toThrow('RUT o contraseña incorrectos');

      expect(prisma.log_auditoria.create).toHaveBeenCalledWith({
        data: {
          accion: 'BLOQUEO_INTENTOS_FALLIDOS',
          entidad_afectada: 'intento_fallido',
          valor_nuevo: {
            id_intento: 42,
            bloquea_ip: true,
            bloquea_rut: false,
            intentos_ip: 5,
            intentos_rut: 1,
            bloqueado_hasta: expect.any(String),
            origen: 'PORTAL',
          },
          ip_origen: '192.168.1.50',
        },
      });
    });

    it('el bloqueo dura 15 minutos (RF-05)', async () => {
      (prisma.intento_fallido.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(4);
      const antes = Date.now();

      await authService
        .login('999999999', 'mala', '192.168.1.50')
        .catch(() => undefined);

      const { bloqueado_hasta } = auditorias()[0].valor_nuevo as {
        bloqueado_hasta: string;
      };
      const minutos = (new Date(bloqueado_hasta).getTime() - antes) / 60_000;
      expect(minutos).toBeGreaterThanOrEqual(14.9);
      expect(minutos).toBeLessThanOrEqual(15.1);
    });

    it('un intento que no bloquea no se audita', async () => {
      (prisma.intento_fallido.count as jest.Mock).mockResolvedValue(1);

      await expect(
        authService.login('999999999', 'mala', '192.168.1.50'),
      ).rejects.toThrow('RUT o contraseña incorrectos');

      expect(prisma.intento_fallido.create).toHaveBeenCalled();
      expect(prisma.log_auditoria.create).not.toHaveBeenCalled();
    });

    it('si la auditoría falla, el bloqueo se aplica igual', async () => {
      (prisma.intento_fallido.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(4);
      (prisma.log_auditoria.create as jest.Mock).mockRejectedValue(
        new Error('db caida a medias'),
      );

      await expect(
        authService.login('999999999', 'mala', '192.168.1.50'),
      ).rejects.toThrow('RUT o contraseña incorrectos');

      // La fila que bloquea quedó escrita: es la que el login consulta después.
      const { data } = (prisma.intento_fallido.create as jest.Mock).mock
        .calls[0][0] as { data: { bloqueado_hasta?: Date } };
      expect(data.bloqueado_hasta).toBeInstanceOf(Date);
    });

    it('el login exitoso reinicia el contador del RUT, pero conserva sus bloqueos', async () => {
      porRut.mockResolvedValue(mockCliente);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authService.login('123456785', 'buena', '127.0.0.1');

      expect(prisma.intento_fallido.deleteMany).toHaveBeenCalledWith({
        where: { rut_intentado: '123456785', bloqueado_hasta: null },
      });
    });
  });
});
