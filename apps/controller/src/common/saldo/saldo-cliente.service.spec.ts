import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ErrorIntegracionG8,
  G8IntegracionService,
} from '../g8/g8-integracion.service.js';
import { armarDeuda, SaldoClienteService } from './saldo-cliente.service.js';

/**
 * El saldo lo calcula G8 (acuerdo v2.0 §3 y §5) y lo entrega su
 * `GET /api/integrations/g2/invoices` (respuesta del 02-10, §2).
 */
describe('SaldoClienteService', () => {
  let service: SaldoClienteService;
  let prisma: {
    cliente: { findUnique: jest.Mock };
    factura: { findMany: jest.Mock };
  };
  let g8: { facturas: jest.Mock };

  beforeEach(() => {
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({ id_empresa: 1 }),
      },
      factura: { findMany: jest.fn().mockResolvedValue([]) },
    };
    g8 = {
      facturas: jest.fn().mockResolvedValue([
        { idFactura: 101, saldoExigible: 14990 },
        { idFactura: 102, saldoExigible: 19990 },
      ]),
    };
    service = new SaldoClienteService(
      prisma as unknown as PrismaService,
      g8 as unknown as G8IntegracionService,
    );
  });

  it('mientras G8 no confirme su deploy, no se le pregunta y no hay saldo', async () => {
    await expect(service.saldoDe({ idCliente: 10 })).resolves.toBeNull();
    expect(g8.facturas).not.toHaveBeenCalled();
    expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
  });

  describe('con el deploy de G8 confirmado', () => {
    it('el saldo del cliente es la suma de su saldo exigible, en su empresa', async () => {
      await expect(service.saldoDe({ idCliente: 10 }, true)).resolves.toBe(
        34980,
      );
      expect(g8.facturas).toHaveBeenCalledWith({ idEmpresa: 1, idCliente: 10 });
    });

    it('facturasDe entrega las facturas de G8 tal cual, para el CU-67 y el CU-68', async () => {
      await expect(
        service.facturasDe({ idCliente: 10 }, true),
      ).resolves.toEqual([
        { idFactura: 101, saldoExigible: 14990 },
        { idFactura: 102, saldoExigible: 19990 },
      ]);
    });

    it('sin facturas con saldo, la deuda es cero', async () => {
      g8.facturas.mockResolvedValue([]);

      await expect(service.saldoDe({ idCliente: 10 }, true)).resolves.toBe(0);
    });

    it('si G8 no responde, no se inventa un total: null', async () => {
      g8.facturas.mockRejectedValue(
        new ErrorIntegracionG8(503, 'G8 respondió 503'),
      );

      await expect(
        service.saldoDe({ idCliente: 10 }, true),
      ).resolves.toBeNull();
    });

    it('un cliente sin empresa no se puede consultar: null', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id_empresa: null });

      await expect(
        service.saldoDe({ idCliente: 10 }, true),
      ).resolves.toBeNull();
      expect(g8.facturas).not.toHaveBeenCalled();
    });
  });
  describe('deudaDe: lo que ve el cliente (CU-27, 28, 39 y 41)', () => {
    const AHORA = new Date('2026-11-07T15:00:00Z');

    it('mientras G8 no confirme su deploy, no hay deuda que mostrar', async () => {
      await expect(service.deudaDe({ idCliente: 10 })).resolves.toBeNull();
      expect(g8.facturas).not.toHaveBeenCalled();
    });

    it('arma el detalle con el saldo de G8 y el periodo de la base', async () => {
      g8.facturas.mockResolvedValue([
        {
          idFactura: 101,
          saldoExigible: 14990,
          fechaVencimientoEfectiva: '2026-11-12',
          aceptaPagos: true,
        },
        {
          idFactura: 102,
          saldoExigible: 19990,
          fechaVencimientoEfectiva: '2026-11-04',
          aceptaPagos: true,
        },
      ]);
      prisma.factura.findMany.mockResolvedValue([
        { id_factura: 101, periodo_mes: 11, periodo_anio: 2026 },
      ]);

      const deuda = await service.deudaDe({ idCliente: 10 }, true, AHORA);

      expect(prisma.factura.findMany).toHaveBeenCalledWith({
        where: { id_factura: { in: [101, 102] } },
        select: { id_factura: true, periodo_mes: true, periodo_anio: true },
      });
      expect(deuda).toEqual({
        facturas: [
          {
            idFactura: 102,
            periodo: null,
            monto: 19990,
            fechaLimite: '2026-11-04',
            vencida: true,
            diasVencida: 3,
            diasParaVencer: null,
          },
          {
            idFactura: 101,
            periodo: 'Noviembre 2026',
            monto: 14990,
            fechaLimite: '2026-11-12',
            vencida: false,
            diasVencida: null,
            diasParaVencer: 5,
          },
        ],
        saldoTotal: 34980,
        completa: true,
        inconsistente: false,
      });
    });

    it('si no se puede leer el periodo, la deuda igual se muestra', async () => {
      g8.facturas.mockResolvedValue([
        {
          idFactura: 101,
          saldoExigible: 14990,
          fechaVencimientoEfectiva: '2026-11-12',
          aceptaPagos: true,
        },
      ]);
      prisma.factura.findMany.mockRejectedValue(new Error('base caída'));

      const deuda = await service.deudaDe({ idCliente: 10 }, true, AHORA);

      expect(deuda?.saldoTotal).toBe(14990);
      expect(deuda?.facturas[0].periodo).toBeNull();
    });

    it('si G8 no responde, no hay deuda que mostrar: null', async () => {
      g8.facturas.mockRejectedValue(
        new ErrorIntegracionG8(503, 'G8 respondió 503'),
      );

      await expect(
        service.deudaDe({ idCliente: 10 }, true),
      ).resolves.toBeNull();
    });
  });

  describe('armarDeuda', () => {
    const AHORA = new Date('2026-11-07T15:00:00Z');

    it('deja fuera las facturas sin saldo', () => {
      const deuda = armarDeuda(
        [
          {
            idFactura: 1,
            saldoExigible: 0,
            fechaVencimientoEfectiva: '2026-10-05',
            aceptaPagos: false,
          },
        ],
        new Map(),
        AHORA,
      );
      expect(deuda.facturas).toEqual([]);
      expect(deuda.saldoTotal).toBe(0);
      expect(deuda.inconsistente).toBe(false);
    });

    it('un saldo negativo o que no es un número es inconsistente', () => {
      expect(
        armarDeuda(
          [
            {
              idFactura: 1,
              saldoExigible: -1,
              fechaVencimientoEfectiva: null,
              aceptaPagos: null,
            },
          ],
          new Map(),
          AHORA,
        ).inconsistente,
      ).toBe(true);
      expect(
        armarDeuda(
          [
            {
              idFactura: 1,
              saldoExigible: Number.NaN,
              fechaVencimientoEfectiva: null,
              aceptaPagos: null,
            },
          ],
          new Map(),
          AHORA,
        ).inconsistente,
      ).toBe(true);
    });

    it('sin vencimiento, o con uno que no es fecha, la información está incompleta', () => {
      const deuda = armarDeuda(
        [
          {
            idFactura: 1,
            saldoExigible: 100,
            fechaVencimientoEfectiva: null,
            aceptaPagos: true,
          },
          {
            idFactura: 2,
            saldoExigible: 100,
            fechaVencimientoEfectiva: 'no-es-fecha',
            aceptaPagos: true,
          },
        ],
        new Map(),
        AHORA,
      );
      expect(deuda.completa).toBe(false);
      expect(deuda.facturas.map((f) => f.fechaLimite)).toEqual([null, null]);
      expect(deuda.facturas.every((f) => !f.vencida)).toBe(true);
    });

    it('la que vence hoy todavía no está vencida', () => {
      const deuda = armarDeuda(
        [
          {
            idFactura: 1,
            saldoExigible: 100,
            fechaVencimientoEfectiva: '2026-11-07',
            aceptaPagos: true,
          },
        ],
        new Map(),
        AHORA,
      );
      expect(deuda.facturas[0].vencida).toBe(false);
      expect(deuda.facturas[0].diasParaVencer).toBe(0);
    });
  });
});
