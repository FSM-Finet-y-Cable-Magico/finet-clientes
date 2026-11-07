import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DeudaPublicaService } from './deuda-publica.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  armarDeuda,
  SaldoClienteService,
} from '../common/saldo/saldo-cliente.service.js';
import type { FacturaG8 } from '../common/g8/g8-integracion.service.js';

const AHORA = new Date('2026-11-07T15:00:00Z');
const CLIENTE = {
  id_cliente: 1,
  nombre_completo: 'Juan',
  rut: '123456785',
  contrato: [{ id_contrato: 100 }],
};

/** Lo que entregaría G8, armado con la misma función que usa el servicio. */
function deudaG8(facturas: FacturaG8[], periodos: [number, string][] = []) {
  return armarDeuda(facturas, new Map(periodos), AHORA);
}

describe('DeudaPublicaService', () => {
  let service: DeudaPublicaService;
  let prisma: jest.Mocked<PrismaService>;
  let saldos: { deudaDe: jest.Mock };

  beforeEach(async () => {
    const mockPrisma = {
      cliente: { findFirst: jest.fn() },
      contrato: { findMany: jest.fn() },
    };
    saldos = { deudaDe: jest.fn().mockResolvedValue(deudaG8([])) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeudaPublicaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SaldoClienteService, useValue: saldos },
      ],
    }).compile();
    service = module.get(DeudaPublicaService);
    prisma = module.get(PrismaService);
    // Por defecto, sin planes asociados (los tests que lo necesiten lo sobreescriben)
    (prisma.contrato.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('busca el RUT en sus dos formas: hay clientes guardados con guion (G3, 29-09)', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(null);

    await service.consultarPorRut('12.345.678-5');

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rut: { in: ['123456785', '12345678-5'] } },
      }),
    );
  });

  it('retorna encontrado:false si el RUT no existe', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(null);
    const r = await service.consultarPorRut('123456785');
    expect(r.encontrado).toBe(false);
    expect(r.cliente).toBeNull();
  });

  it('retorna tiene_deuda:false cuando G8 no tiene facturas con saldo', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(CLIENTE);
    const r = await service.consultarPorRut('123456785');
    expect(r.encontrado).toBe(true);
    expect(r.tiene_deuda).toBe(false);
    expect(r.saldo_total).toBe(0);
    expect(r.facturas).toHaveLength(0);
    expect(saldos.deudaDe).toHaveBeenCalledWith({ idCliente: 1 });
  });

  it('el monto y el vencimiento son los de G8, y el periodo el de la base', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(CLIENTE);
    saldos.deudaDe.mockResolvedValue(
      deudaG8(
        [
          {
            idFactura: 1,
            saldoExigible: 23890,
            fechaVencimientoEfectiva: '2026-11-04',
            aceptaPagos: true,
          },
          {
            idFactura: 2,
            saldoExigible: 19990,
            fechaVencimientoEfectiva: '2026-11-12',
            aceptaPagos: true,
          },
          {
            idFactura: 3,
            saldoExigible: 0,
            fechaVencimientoEfectiva: '2026-10-05',
            aceptaPagos: false,
          },
        ],
        [
          [1, 'Octubre 2026'],
          [2, 'Noviembre 2026'],
        ],
      ),
    );
    const r = await service.consultarPorRut('123456785');
    expect(r.saldo_total).toBe(43880);
    expect(r.facturas).toEqual([
      {
        id_factura: 1,
        periodo: 'Octubre 2026',
        monto: 23890,
        fecha_limite_pago: '2026-11-04',
        estado: 'vencida',
        dias_vencida: 3,
        dias_para_vencer: null,
      },
      {
        id_factura: 2,
        periodo: 'Noviembre 2026',
        monto: 19990,
        fecha_limite_pago: '2026-11-12',
        estado: 'pendiente',
        dias_vencida: null,
        dias_para_vencer: 5,
      },
    ]);
    expect(r.detalle_disponible).toBe(true);
    expect(r.informacion_completa).toBe(true);
  });

  it('CU-41 Exc 1: detalle_disponible:false si G8 no entrega el saldo', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(CLIENTE);
    saldos.deudaDe.mockResolvedValue(null);
    const r = await service.consultarPorRut('123456785');
    expect(r.encontrado).toBe(true);
    expect(r.detalle_disponible).toBe(false);
    expect(r.tiene_deuda).toBe(false);
    expect(r.facturas).toHaveLength(0);
  });

  it('un saldo inconsistente de G8 tampoco se muestra como cuenta al día', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(CLIENTE);
    saldos.deudaDe.mockResolvedValue(
      deudaG8([
        {
          idFactura: 1,
          saldoExigible: -5000,
          fechaVencimientoEfectiva: '2026-11-04',
          aceptaPagos: true,
        },
      ]),
    );
    const r = await service.consultarPorRut('123456785');
    expect(r.detalle_disponible).toBe(false);
    expect(r.tiene_deuda).toBe(false);
  });

  it('CU-41 Exc 2: informacion_completa:false si una factura viene sin vencimiento', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue(CLIENTE);
    saldos.deudaDe.mockResolvedValue(
      deudaG8([
        {
          idFactura: 1,
          saldoExigible: 23890,
          fechaVencimientoEfectiva: null,
          aceptaPagos: true,
        },
      ]),
    );
    const r = await service.consultarPorRut('123456785');
    expect(r.detalle_disponible).toBe(true);
    expect(r.informacion_completa).toBe(false);
    expect(r.facturas[0].fecha_limite_pago).toBe('');
  });

  it('incluye el detalle del/los plan(es) contratado(s) sin duplicados', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      ...CLIENTE,
      contrato: [{ id_contrato: 100 }, { id_contrato: 101 }],
    });
    const plan = {
      nombre_comercial: 'Plan 200 Mbps',
      tipo_plan: 'FIBRA',
      velocidad_mbps: 200,
      precio_mensual: 24990,
    };
    // el mismo plan en dos contratos se muestra una vez
    (prisma.contrato.findMany as jest.Mock).mockResolvedValue([
      { plan },
      { plan },
    ]);
    const r = await service.consultarPorRut('123456785');
    expect(r.planes).toEqual([plan]);
  });
});
