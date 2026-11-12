import {
  jest,
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
} from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ComprobantePagoService,
  pagosDelCliente,
} from './comprobante-pago.service.js';

/** CU-52: el comprobante de un pago, para descargarlo o adjuntarlo al correo. */
const PAGO = {
  id_pago: 5,
  fecha_pago: new Date('2026-11-12T02:11:31Z'),
  monto: 50000,
  pasarela: 'webpay',
  codigo_transaccion: 'F7-abc',
  codigo_autorizacion: '1213',
  factura: { periodo_mes: 11, periodo_anio: 2026 },
};
const CLIENTE_CABLE = {
  nombre_completo: 'Benja Cable',
  rut: '222222222',
  id_empresa: 2,
};

describe('ComprobantePagoService', () => {
  let service: ComprobantePagoService;
  let prisma: {
    pago: { findFirst: jest.Mock; updateMany: jest.Mock };
    cliente: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    process.env.FRONTEND_URL_CABLE_MAGICO = 'https://cable.test';
    prisma = {
      pago: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
      },
      cliente: { findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        ComprobantePagoService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'https://finet.test' },
        },
      ],
    }).compile();
    service = module.get(ComprobantePagoService);
  });

  afterEach(() => {
    delete process.env.FRONTEND_URL_CABLE_MAGICO;
  });

  /** El interruptor de G8 (COMPROBANTE_EN_PAGO), prendido para la prueba. */
  function conPermisoDeG8() {
    jest
      .spyOn(
        service as unknown as { marcaEnPago: () => boolean },
        'marcaEnPago',
      )
      .mockReturnValue(true);
  }

  describe('delCliente (la descarga del portal)', () => {
    it('el pago de otro cliente responde 404, como si no existiera', async () => {
      prisma.pago.findFirst.mockResolvedValue(null as never);

      await expect(service.delCliente(1, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.pago.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_pago: 99, ...pagosDelCliente(1) },
        }),
      );
    });

    it('el propio devuelve el PDF con el nombre de su empresa', async () => {
      prisma.pago.findFirst.mockResolvedValue(PAGO as never);
      prisma.cliente.findUnique.mockResolvedValue(CLIENTE_CABLE as never);

      const r = await service.delCliente(2, 5);

      expect(r.nombreArchivo).toBe('comprobante-cable-magico-5.pdf');
      expect(r.archivo.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('un cliente de Finet recibe el de Finet', async () => {
      prisma.pago.findFirst.mockResolvedValue(PAGO as never);
      prisma.cliente.findUnique.mockResolvedValue({
        ...CLIENTE_CABLE,
        id_empresa: 1,
      } as never);

      const r = await service.delCliente(1, 5);
      expect(r.nombreArchivo).toBe('comprobante-finet-5.pdf');
    });

    it('Excepción 1: sin el monto del pago no se genera', async () => {
      prisma.pago.findFirst.mockResolvedValue({ ...PAGO, monto: 0 } as never);
      prisma.cliente.findUnique.mockResolvedValue(CLIENTE_CABLE as never);

      await expect(service.delCliente(2, 5)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('Excepción 2: si falla el PDF, responde que no está disponible', async () => {
      prisma.pago.findFirst.mockResolvedValue(PAGO as never);
      prisma.cliente.findUnique.mockResolvedValue(CLIENTE_CABLE as never);
      jest
        .spyOn(service as unknown as { pdf: () => Promise<Buffer> }, 'pdf')
        .mockRejectedValue(new Error('falló pdfkit'));

      await expect(service.delCliente(2, 5)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('delPago (el adjunto del correo de confirmación)', () => {
    it('arma el comprobante con el cliente del pago', async () => {
      prisma.pago.findFirst.mockResolvedValue({
        ...PAGO,
        cliente: CLIENTE_CABLE,
      } as never);

      const r = await service.delPago(5);

      expect(r?.nombreArchivo).toBe('comprobante-cable-magico-5.pdf');
      expect(prisma.pago.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_pago: 5 } }),
      );
    });

    it('si el pago no se encuentra o no se puede generar, no hay adjunto', async () => {
      prisma.pago.findFirst.mockResolvedValue(null as never);
      await expect(service.delPago(5)).resolves.toBeNull();

      prisma.pago.findFirst.mockResolvedValue({
        ...PAGO,
        monto: 0,
        cliente: CLIENTE_CABLE,
      } as never);
      await expect(service.delPago(5)).resolves.toBeNull();
    });
  });

  /**
   * Con el permiso de G8 (12-11), el pago queda marcado: su URL y GENERADO.
   * Solo esas dos columnas, y solo si nadie lo había marcado antes.
   */
  describe('marcar el comprobante en pago', () => {
    beforeEach(() => {
      prisma.pago.findFirst.mockResolvedValue(PAGO as never);
      prisma.cliente.findUnique.mockResolvedValue(CLIENTE_CABLE as never);
    });

    it('sin el permiso de G8 no escribe nada', async () => {
      await service.delCliente(2, 5);
      expect(prisma.pago.updateMany).not.toHaveBeenCalled();
    });

    it('con el permiso, escribe solo la URL y GENERADO, sobre un pago pendiente sin URL', async () => {
      conPermisoDeG8();

      await service.delCliente(2, 5);

      expect(prisma.pago.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.pago.updateMany).toHaveBeenCalledWith({
        where: {
          id_pago: 5,
          comprobante_estado: 'PENDIENTE',
          comprobante_pdf_url: null,
        },
        data: {
          comprobante_pdf_url:
            'https://cable.test/api/portal/pagos/5/comprobante',
          comprobante_estado: 'GENERADO',
        },
      });
    });

    it('si el PDF falla, no marca nada: queda PENDIENTE (Excepción 2)', async () => {
      conPermisoDeG8();
      jest
        .spyOn(service as unknown as { pdf: () => Promise<Buffer> }, 'pdf')
        .mockRejectedValue(new Error('falló pdfkit'));

      await expect(service.delCliente(2, 5)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.pago.updateMany).not.toHaveBeenCalled();
    });

    it('si la base rechaza la escritura, la descarga sale igual', async () => {
      conPermisoDeG8();
      prisma.pago.updateMany.mockRejectedValue(
        new Error('permission denied for table pago') as never,
      );

      const r = await service.delCliente(2, 5);
      expect(r.archivo.subarray(0, 5).toString()).toBe('%PDF-');
    });
  });
});
