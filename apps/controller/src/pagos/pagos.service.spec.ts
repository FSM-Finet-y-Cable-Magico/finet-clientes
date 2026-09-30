import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PagosService, enmascararRut } from './pagos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnlacePagoService } from '../common/enlaces/enlace-pago.service.js';
import { SaldoClienteService } from '../common/saldo/saldo-cliente.service.js';
import { IdentificadorPagoDto, IniciarPagoDto } from './dto/pagos.dto.js';

const ANA = { id_cliente: 10, nombre_completo: 'Ana Pérez', rut: '123456785' };

/**
 * CU-42 / CU-43. Cada test nombra la condición del caso de uso que comprueba.
 */
describe('PagosService', () => {
  let service: PagosService;
  let prisma: {
    cliente: { findUnique: jest.Mock };
    contrato: { findUnique: jest.Mock };
  };
  let saldos: { saldoDe: jest.Mock };
  let enlaces: { verificarEnlacePago: jest.Mock };

  beforeEach(async () => {
    prisma = {
      cliente: { findUnique: jest.fn().mockResolvedValue(ANA) },
      contrato: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id_contrato: 100, cliente: ANA }),
      },
    };
    saldos = { saldoDe: jest.fn().mockResolvedValue(57980) };
    enlaces = { verificarEnlacePago: jest.fn().mockReturnValue(10) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: PrismaService, useValue: prisma },
        { provide: SaldoClienteService, useValue: saldos },
        { provide: EnlacePagoService, useValue: enlaces },
      ],
    }).compile();
    service = module.get(PagosService);
  });

  // ─── Resumen de la deuda (CU-43: "el cliente accede al resumen") ─────────

  describe('resumen', () => {
    it('por RUT: la cuenta del cliente y el saldo que da G8', async () => {
      const r = await service.resumen({ rut: '12345678-5' });

      expect(prisma.cliente.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { rut: '123456785' } }),
      );
      expect(saldos.saldoDe).toHaveBeenCalledWith(
        expect.objectContaining({ idCliente: 10, idContrato: null }),
      );
      expect(r).toEqual({
        encontrado: true,
        cliente: {
          nombre: 'Ana Pérez',
          rut: 'XX.XXX.678-5',
          codigo_abonado: null,
        },
        saldo: 57980,
        medios: [
          expect.objectContaining({ id: 'webpay', disponible: false }),
          expect.objectContaining({ id: 'mercadopago', disponible: false }),
        ],
      });
    });

    it('por código de abonado: el saldo de ese contrato', async () => {
      const r = await service.resumen({ abonado: '100' });

      expect(prisma.contrato.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_contrato: 100 } }),
      );
      expect(saldos.saldoDe).toHaveBeenCalledWith(
        expect.objectContaining({ idCliente: 10, idContrato: 100 }),
      );
      expect(r.cliente?.codigo_abonado).toBe(100);
    });

    it('por enlace firmado (aviso de corte o portal)', async () => {
      await service.resumen({ t: 'p.a.b.c.d' });

      expect(enlaces.verificarEnlacePago).toHaveBeenCalledWith('p.a.b.c.d');
      expect(prisma.cliente.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_cliente: 10 } }),
      );
    });

    it('un enlace alterado o vencido es como una cuenta que no existe', async () => {
      enlaces.verificarEnlacePago.mockReturnValue(null);

      const r = await service.resumen({ t: 'falso' });

      expect(r).toEqual({
        encontrado: false,
        cliente: null,
        saldo: null,
        medios: [],
      });
      expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
    });

    it('cuenta que no existe: no encontrado, sin saldo ni medios', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      const r = await service.resumen({ rut: '123456785' });

      expect(r.encontrado).toBe(false);
      expect(saldos.saldoDe).not.toHaveBeenCalled();
    });

    it('la deuda la calcula G8: mientras no diga dónde está, el saldo es null', async () => {
      const real = new SaldoClienteService();

      await expect(
        real.saldoDe({ idCliente: 10, idContrato: null }),
      ).resolves.toBeNull();
    });
  });

  // ─── Pagar: precondición y Excepción 1 ───────────────────────────────────

  describe('iniciar', () => {
    it('cuenta que no existe: 404', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      await expect(
        service.iniciar({ rut: '123456785' }, 'webpay'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sin el saldo de G8 no hay "deuda pendiente identificada": no se cobra nada', async () => {
      saldos.saldoDe.mockResolvedValue(null);

      await expect(
        service.iniciar({ rut: '123456785' }, 'webpay'),
      ).rejects.toThrow('No pudimos obtener tu deuda en este momento');
    });

    it('sin deuda: 409', async () => {
      saldos.saldoDe.mockResolvedValue(0);

      await expect(
        service.iniciar({ rut: '123456785' }, 'webpay'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('CU-42 Excepción 1: Webpay no puede utilizarse temporalmente', async () => {
      const intento = service.iniciar({ rut: '123456785' }, 'webpay');

      await expect(intento).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(intento).rejects.toThrow(
        'Webpay no puede utilizarse temporalmente',
      );
    });

    it('CU-43 Excepción 1: Mercado Pago se encuentra temporalmente indisponible', async () => {
      await expect(
        service.iniciar({ abonado: '100' }, 'mercadopago'),
      ).rejects.toThrow('Mercado Pago se encuentra temporalmente indisponible');
    });

    it('el total se pide de nuevo a G8, no se confía en el del navegador', async () => {
      await service.iniciar({ rut: '123456785' }, 'webpay').catch(() => {});

      expect(saldos.saldoDe).toHaveBeenCalled();
    });
  });

  // ─── Lo que se acepta desde afuera ───────────────────────────────────────

  describe('validación', () => {
    it('exige exactamente un identificador', () => {
      expect(IdentificadorPagoDto.safeParse({}).success).toBe(false);
      expect(
        IdentificadorPagoDto.safeParse({ rut: '123456785', abonado: '100' })
          .success,
      ).toBe(false);
      expect(IdentificadorPagoDto.safeParse({ abonado: '100' }).success).toBe(
        true,
      );
    });

    it('rechaza un RUT con dígito verificador incorrecto', () => {
      expect(IdentificadorPagoDto.safeParse({ rut: '123456780' }).success).toBe(
        false,
      );
    });

    it('rechaza un código de abonado que no es numérico', () => {
      expect(
        IdentificadorPagoDto.safeParse({ abonado: '1 OR 1' }).success,
      ).toBe(false);
    });

    it('sin abonos: no hay campo de monto, se paga el total', () => {
      const r = IniciarPagoDto.parse({
        rut: '123456785',
        medio: 'webpay',
        monto: 1000,
      });

      expect(r).not.toHaveProperty('monto');
    });

    it('solo acepta los medios del RF-31', () => {
      expect(
        IniciarPagoDto.safeParse({ rut: '123456785', medio: 'paypal' }).success,
      ).toBe(false);
    });
  });

  it('enmascara el RUT: lo justo para que el cliente reconozca su cuenta', () => {
    expect(enmascararRut('123456785')).toBe('XX.XXX.678-5');
    expect(enmascararRut('93456787')).toBe('X.XXX.678-7');
  });
});
