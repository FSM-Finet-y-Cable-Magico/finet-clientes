import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: {
    login: jest.Mock;
    logout: jest.Mock;
    register: jest.Mock;
    recuperarPassword: jest.Mock;
    restablecerPassword: jest.Mock;
  };

  const mockCliente = {
    id: 1,
    rut: '123456785',
    nombre_completo: 'Juan Pérez',
    email: 'juan@test.cl',
    telefono: '912345678',
    estado: 'activo',
  };

  beforeEach(async () => {
    mockAuthService = {
      login: jest.fn(),
      logout: jest.fn(),
      register: jest.fn(),
      recuperarPassword: jest.fn(),
      restablecerPassword: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    authController = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/login', () => {
    it('return access_token and cliente on valid credentials', async () => {
      const result = {
        access_token: 'jwt-token',
        cliente: mockCliente,
      };
      mockAuthService.login.mockResolvedValue(result);

      const response = await authController.login(
        {
          rut: '123456785',
          password: 'password',
        },
        { ip: '127.0.0.1' } as Request,
        { cookie: jest.fn() } as unknown as Response,
      );

      expect(response).toEqual(result);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        '123456785',
        'password',
        '127.0.0.1',
      );
    });
  });

  describe('POST /auth/register', () => {
    it('call register service and return access_token + cliente', async () => {
      const result = {
        access_token: 'register-jwt',
        cliente: {
          id: 2,
          rut: '123456785',
          nombre_completo: 'Nuevo',
          email: null,
          telefono: null,
        },
      };
      mockAuthService.register.mockResolvedValue(result);

      const response = await authController.register(
        {
          rut: '123456785',
          nombre_completo: 'Nuevo',
          password: 'Password1',
          password_confirmation: 'Password1',
          email: 'nuevo@test.cl',
          telefono: '',
          acepta_politica_privacidad: true,
          version_politica_privacidad: '1.1',
        },
        { ip: '127.0.0.1' } as Request,
        { cookie: jest.fn() } as unknown as Response,
      );

      expect(response).toEqual(result);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        '123456785',
        'Nuevo',
        'Password1',
        '127.0.0.1',
        'nuevo@test.cl',
        '',
        '1.1',
      );
    });
  });

  describe('POST /auth/recuperar-password', () => {
    it('call recuperarPassword service with RUT and IP', async () => {
      const result = {
        message:
          'Si el RUT está registrado, recibirás un enlace de recuperación',
      };
      mockAuthService.recuperarPassword.mockResolvedValue(result);

      const mockReq = { ip: '127.0.0.1' } as any;
      const response = await authController.recuperarPassword(
        {
          rut: '123456785',
        },
        mockReq,
      );

      expect(response).toEqual(result);
      expect(mockAuthService.recuperarPassword).toHaveBeenCalledWith(
        '123456785',
        '127.0.0.1',
      );
    });
  });

  describe('POST /auth/restablecer-password', () => {
    it('call restablecerPassword service with token and password', async () => {
      const result = { message: 'Contraseña restablecida exitosamente' };
      mockAuthService.restablecerPassword.mockResolvedValue(result);

      const response = await authController.restablecerPassword({
        token: 'reset-token',
        password: 'NewPass1',
      });

      expect(response).toEqual(result);
      expect(mockAuthService.restablecerPassword).toHaveBeenCalledWith(
        'reset-token',
        'NewPass1',
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('return success message and call logout', async () => {
      mockAuthService.logout.mockImplementation(async () => {
        // en la implementación real se invalida la sesión
      });

      const req = {
        headers: { authorization: 'Bearer test-token' },
        cookies: {},
      };
      const response = await authController.logout(
        { id_cliente: 1 },
        req as unknown as Request,
        { clearCookie: jest.fn() } as unknown as Response,
      );

      expect(response).toEqual({ message: 'Sesión cerrada exitosamente' });
      expect(mockAuthService.logout).toHaveBeenCalledWith(1, 'test-token');
    });

    it('lanza 503 y limpia cookie si falla la conexion a BD (CU-02 Excepción 1)', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('connection refused'));

      const clearCookie = jest.fn();
      const req = {
        headers: { authorization: 'Bearer test-token' },
        cookies: {},
      };

      await expect(
        authController.logout(
          { id_cliente: 1 },
          req as unknown as Request,
          { clearCookie, passthrough: true } as unknown as Response,
        ),
      ).rejects.toThrow(ServiceUnavailableException);

      await expect(
        authController.logout(
          { id_cliente: 1 },
          req as unknown as Request,
          { clearCookie, passthrough: true } as unknown as Response,
        ),
      ).rejects.toThrow('No fue posible cerrar la sesión');

      // La cookie se limpia incluso ante el error
      expect(clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
    });
  });
});
