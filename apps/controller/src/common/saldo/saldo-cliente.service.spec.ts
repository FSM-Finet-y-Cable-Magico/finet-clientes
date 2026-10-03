import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ErrorIntegracionG8,
  G8IntegracionService,
} from '../g8/g8-integracion.service.js';
import { SaldoClienteService } from './saldo-cliente.service.js';

/**
 * El saldo lo calcula G8 (acuerdo v2.0 §3 y §5) y lo entrega su
 * `GET /api/integrations/g2/invoices` (respuesta del 02-10, §2).
 */
describe('SaldoClienteService', () => {
  let service: SaldoClienteService;
  let prisma: { cliente: { findUnique: jest.Mock } };
  let g8: { facturas: jest.Mock };

  beforeEach(() => {
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({ id_empresa: 1 }),
      },
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
    await expect(
      service.saldoDe({ idCliente: 10, idContrato: null }),
    ).resolves.toBeNull();
    expect(g8.facturas).not.toHaveBeenCalled();
    expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
  });

  describe('con el deploy de G8 confirmado', () => {
    it('el saldo del cliente es la suma de su saldo exigible, en su empresa', async () => {
      await expect(
        service.saldoDe({ idCliente: 10, idContrato: null }, true),
      ).resolves.toBe(34980);
      expect(g8.facturas).toHaveBeenCalledWith({ idEmpresa: 1, idCliente: 10 });
    });

    it('facturasDe entrega las facturas de G8 tal cual, para el CU-67 y el CU-68', async () => {
      await expect(
        service.facturasDe({ idCliente: 10, idContrato: null }, true),
      ).resolves.toEqual([
        { idFactura: 101, saldoExigible: 14990 },
        { idFactura: 102, saldoExigible: 19990 },
      ]);
    });

    it('por código de abonado, solo el de ese contrato', async () => {
      await service.saldoDe({ idCliente: 10, idContrato: 456 }, true);

      expect(g8.facturas).toHaveBeenCalledWith({
        idEmpresa: 1,
        idContrato: 456,
      });
    });

    it('sin facturas con saldo, la deuda es cero', async () => {
      g8.facturas.mockResolvedValue([]);

      await expect(
        service.saldoDe({ idCliente: 10, idContrato: null }, true),
      ).resolves.toBe(0);
    });

    it('si G8 no responde, no se inventa un total: null', async () => {
      g8.facturas.mockRejectedValue(
        new ErrorIntegracionG8(503, 'G8 respondió 503'),
      );

      await expect(
        service.saldoDe({ idCliente: 10, idContrato: null }, true),
      ).resolves.toBeNull();
    });

    it('un cliente sin empresa no se puede consultar: null', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id_empresa: null });

      await expect(
        service.saldoDe({ idCliente: 10, idContrato: null }, true),
      ).resolves.toBeNull();
      expect(g8.facturas).not.toHaveBeenCalled();
    });
  });
});
