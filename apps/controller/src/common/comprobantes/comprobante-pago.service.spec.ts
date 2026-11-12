import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
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
      ],
    }).compile();
    service = module.get(ComprobantePagoService);
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

    it('con el permiso, guarda el PDF en comprobante_pdf_url y GENERADO, sobre un pago pendiente sin comprobante', async () => {
      conPermisoDeG8();

      const r = await service.delCliente(2, 5);

      expect(prisma.pago.updateMany).toHaveBeenCalledTimes(1);
      const [args] = prisma.pago.updateMany.mock.calls[0] as [
        { where: unknown; data: Record<string, string> },
      ];
      expect(args.where).toEqual({
        id_pago: 5,
        comprobante_estado: 'PENDIENTE',
        comprobante_pdf_url: null,
      });
      // Solo esas dos columnas: el PDF entero y el estado.
      expect(Object.keys(args.data).sort()).toEqual([
        'comprobante_estado',
        'comprobante_pdf_url',
      ]);
      expect(args.data.comprobante_estado).toBe('GENERADO');
      expect(args.data.comprobante_pdf_url).toBe(
        `data:application/pdf;base64,${r.archivo.toString('base64')}`,
      );
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

  /**
   * El comprobante guardado en pago es el que se entrega: el mismo PDF cada
   * vez. Solo se acepta un PDF de verdad y de menos de 500 KB (RNF-38.1); lo
   * demás (otra URL, otro tipo) no se sigue ni se entrega: se rehace.
   */
  describe('el comprobante guardado en pago', () => {
    const GUARDADO = Buffer.from('%PDF-1.4 el guardado');
    const conValor = (valor: string) =>
      prisma.pago.findFirst.mockResolvedValue({
        ...PAGO,
        comprobante_pdf_url: valor,
      } as never);
    let rehecho: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      prisma.cliente.findUnique.mockResolvedValue(CLIENTE_CABLE as never);
      rehecho = jest.spyOn(
        service as unknown as { pdf: () => Promise<Buffer> },
        'pdf',
      );
    });

    it('se entrega tal cual, sin rehacerlo', async () => {
      conValor(`data:application/pdf;base64,${GUARDADO.toString('base64')}`);

      const r = await service.delCliente(2, 5);

      expect(r.archivo.equals(GUARDADO)).toBe(true);
      expect(r.nombreArchivo).toBe('comprobante-cable-magico-5.pdf');
      expect(rehecho).not.toHaveBeenCalled();
    });

    it.each([
      ['una URL de otro sitio', 'https://otro.example/boleta.pdf'],
      [
        'otro tipo de archivo',
        `data:text/html;base64,${Buffer.from('<script>').toString('base64')}`,
      ],
      [
        'algo que no es un PDF',
        `data:application/pdf;base64,${Buffer.from('<html>').toString('base64')}`,
      ],
      [
        'un archivo de más de 500 KB',
        `data:application/pdf;base64,${Buffer.concat([GUARDADO, Buffer.alloc(600 * 1024)]).toString('base64')}`,
      ],
    ])('%s no se entrega: se rehace el comprobante', async (_caso, valor) => {
      conValor(valor);

      const r = await service.delCliente(2, 5);

      expect(rehecho).toHaveBeenCalledTimes(1);
      expect(r.archivo.subarray(0, 5).toString()).toBe('%PDF-');
      expect(r.archivo.equals(GUARDADO)).toBe(false);
    });

    it('el correo de confirmación adjunta el mismo PDF guardado', async () => {
      prisma.pago.findFirst.mockResolvedValue({
        ...PAGO,
        comprobante_pdf_url: `data:application/pdf;base64,${GUARDADO.toString('base64')}`,
        cliente: CLIENTE_CABLE,
      } as never);

      const r = await service.delPago(5);

      expect(r?.archivo.equals(GUARDADO)).toBe(true);
    });
  });
});
