import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { CambiarPasswordDto } from './dto/perfil.dto.js';

jest.unstable_mockModule('bcrypt', () => ({
  default: { compare: jest.fn(), hash: jest.fn() },
  compare: jest.fn(),
  hash: jest.fn(),
}));

const { PerfilService } = await import('./perfil.service.js');
const bcrypt = await import('bcrypt');

const CLIENTE_DB_MOCK = {
  id_cliente: 1,
  nombre_completo: 'Juan Perez',
  rut: '123456789',
  email: 'juan@test.cl',
  telefono: '+56912345678',
  password_portal_hash: 'hashed-password',
  fecha_creacion: new Date('2024-01-01'),
};

describe('PerfilService', () => {
  let service: InstanceType<typeof PerfilService>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PerfilService,
        {
          provide: PrismaService,
          useValue: {
            cliente: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            log_auditoria: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(PerfilService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getPerfil', () => {
    it('CU-07: retorna los datos del perfil del cliente', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );

      const result = await service.getPerfil(1);

      expect(result).toMatchObject({
        id_cliente: 1,
        nombre_completo: 'Juan Perez',
        rut: '123456789',
        email: 'juan@test.cl',
        telefono: '+56912345678',
      });
      expect(result.fecha_creacion).toBe('2024-01-01T00:00:00.000Z');
    });

    it('CU-07: lanza NotFoundException si el cliente no existe', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getPerfil(999)).rejects.toThrow(
        'Cliente no encontrado',
      );
    });
  });

  describe('actualizarTelefono', () => {
    const dto = {
      password_actual: 'Password1',
      telefono: '+56987654321',
    };

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.cliente.update as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        telefono: '+56987654321',
      });
    });

    it('CU-08: actualiza telefono y retorna perfil', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );

      const result = await service.actualizarTelefono(1, dto, '127.0.0.1');

      expect(result.telefono).toBe('+56987654321');
      expect(prisma.cliente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_cliente: 1 },
          data: { telefono: '+56987654321' },
        }),
      );
    });

    it('CU-08: verifica contraseña actual con bcrypt', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );

      await service.actualizarTelefono(1, dto, '127.0.0.1');

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password1',
        'hashed-password',
      );
    });

    it('CU-08 Excepción 2: lanza UnauthorizedException si contraseña incorrecta', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.actualizarTelefono(1, dto, '127.0.0.1'),
      ).rejects.toThrow('La contraseña actual es incorrecta');
    });

    it('CU-08: crea registro en log_auditoria', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );

      await service.actualizarTelefono(1, dto, '127.0.0.1');

      expect(prisma.log_auditoria.create).toHaveBeenCalledWith({
        data: {
          accion: 'ACTUALIZAR_TELEFONO',
          entidad_afectada: 'cliente',
          id_entidad_afectada: 1,
          valor_anterior: { telefono: '+56912345678' },
          valor_nuevo: { telefono: '+56987654321', origen: 'PORTAL' },
          ip_origen: '127.0.0.1',
        },
      });
    });

    it('CU-08: valor_anterior es undefined cuando no habia telefono previo', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        telefono: null,
      });

      await service.actualizarTelefono(1, dto, '127.0.0.1');

      const auditCall = (prisma.log_auditoria.create as jest.Mock).mock
        .calls[0][0];
      expect(auditCall.data.valor_anterior).toBeUndefined();
    });

    it('CU-08: lanza NotFoundException si no tiene password_hash', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        password_portal_hash: null,
      });

      await expect(
        service.actualizarTelefono(1, dto, '127.0.0.1'),
      ).rejects.toThrow('Cliente no encontrado');
    });
  });

  describe('actualizarEmail', () => {
    const dto = {
      password_actual: 'Password1',
      email: 'nuevo@test.cl',
    };

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.cliente.update as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        email: 'nuevo@test.cl',
      });
      (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('CU-09: actualiza email, verifica contraseña y retorna perfil', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );

      const result = await service.actualizarEmail(1, dto, '127.0.0.1');

      expect(result.email).toBe('nuevo@test.cl');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password1',
        'hashed-password',
      );
    });

    it('CU-09 Excepción 2: lanza UnauthorizedException si contraseña incorrecta', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.actualizarEmail(1, dto, '127.0.0.1'),
      ).rejects.toThrow('La contraseña actual es incorrecta');
    });

    it('CU-09: lanza BadRequestException si nuevo email igual al actual', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        email: 'nuevo@test.cl',
      });

      await expect(
        service.actualizarEmail(1, dto, '127.0.0.1'),
      ).rejects.toThrow(
        'El nuevo correo electrónico no puede ser igual al actual',
      );
    });

    it('CU-09: lanza BadRequestException si email en uso por otro cliente', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );
      (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
        id_cliente: 2,
        email: 'nuevo@test.cl',
      });

      await expect(
        service.actualizarEmail(1, dto, '127.0.0.1'),
      ).rejects.toThrow(
        'El correo electronico ya esta registrado por otro usuario',
      );
    });

    it('CU-09: crea registro en log_auditoria con valor_anterior y valor_nuevo', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );

      await service.actualizarEmail(1, dto, '192.168.1.1');

      expect(prisma.log_auditoria.create).toHaveBeenCalledWith({
        data: {
          accion: 'ACTUALIZAR_EMAIL',
          entidad_afectada: 'cliente',
          id_entidad_afectada: 1,
          valor_anterior: { email: 'juan@test.cl' },
          valor_nuevo: { email: 'nuevo@test.cl', origen: 'PORTAL' },
          ip_origen: '192.168.1.1',
        },
      });
    });

    it('CU-09: valor_anterior es undefined cuando no habia email previo', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        email: null,
      });

      await service.actualizarEmail(1, dto, '127.0.0.1');

      const auditCall = (prisma.log_auditoria.create as jest.Mock).mock
        .calls[0][0];
      expect(auditCall.data.valor_anterior).toBeUndefined();
    });

    it('CU-09: lanza NotFoundException si no tiene password_hash', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        password_portal_hash: null,
      });

      await expect(
        service.actualizarEmail(1, dto, '127.0.0.1'),
      ).rejects.toThrow('Cliente no encontrado');
    });
  });

  describe('cambiarPassword', () => {
    const dto = {
      password_actual: 'OldPass1',
      password_nuevo: 'NewPass2!',
      password_confirmacion: 'NewPass2!',
    };

    it('CU-10/11: actualiza password con bcrypt y crea auditoria', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );
      (bcrypt.compare as jest.Mock).mockClear();
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockClear();
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await service.cambiarPassword(1, dto, '127.0.0.1');

      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass2!', 10);
      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id_cliente: 1 },
        data: { password_portal_hash: 'new-hash' },
      });
      expect(prisma.log_auditoria.create).toHaveBeenCalledWith({
        data: {
          accion: 'CAMBIO_PASSWORD',
          entidad_afectada: 'cliente',
          id_entidad_afectada: 1,
          ip_origen: '127.0.0.1',
        },
      });
      expect(result).toEqual({
        mensaje: 'Contrasena actualizada correctamente',
      });
    });

    it('CU-10: lanza UnauthorizedException si password actual incorrecta', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.cambiarPassword(1, dto, '127.0.0.1'),
      ).rejects.toThrow('La contrasena actual es incorrecta');
    });

    it('CU-10: lanza BadRequestException si nueva password igual a actual', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue(
        CLIENTE_DB_MOCK,
      );
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        service.cambiarPassword(1, dto, '127.0.0.1'),
      ).rejects.toThrow('La nueva contrasena no puede ser igual a la actual');
    });

    it('CU-10: lanza NotFoundException si no tiene password_hash', async () => {
      (prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
        ...CLIENTE_DB_MOCK,
        password_portal_hash: null,
      });

      await expect(
        service.cambiarPassword(1, dto, '127.0.0.1'),
      ).rejects.toThrow('Cliente no encontrado');
    });

    it('CU-10 Excepción 3: lanza error si contraseñas no coinciden', () => {
      const result = CambiarPasswordDto.safeParse({
        password_actual: 'OldPass1',
        password_nuevo: 'NewPass2!',
        password_confirmacion: 'NewPass3!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password_confirmacion');
      }
    });
  });
});
