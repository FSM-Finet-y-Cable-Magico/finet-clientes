import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DeudaPublicaService } from './deuda-publica.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('DeudaPublicaService', () => {
  let service: DeudaPublicaService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      cliente: { findFirst: jest.fn() },
      contrato: { findUnique: jest.fn(), findMany: jest.fn() },
      factura: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeudaPublicaService,
        { provide: PrismaService, useValue: mockPrisma },
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

  it('retorna tiene_deuda:false cuando no hay facturas pendientes', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      nombre_completo: 'Juan Pérez',
      rut: '123456785',
      contrato: [{ id_contrato: 100 }],
    });
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([]);
    const r = await service.consultarPorRut('123456785');
    expect(r.encontrado).toBe(true);
    expect(r.tiene_deuda).toBe(false);
    expect(r.saldo_total).toBe(0);
    expect(r.facturas).toHaveLength(0);
  });

  it('calcula dias_vencida cuando la factura está vencida', async () => {
    const ayer = new Date(Date.now() - 86_400_000 * 3);
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      nombre_completo: 'Juan',
      rut: '123456785',
      contrato: [{ id_contrato: 100 }],
    });
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      {
        id_factura: 1,
        periodo_mes: 4,
        periodo_anio: 2026,
        monto: 23890,
        fecha_limite_pago: ayer,
        estado: 'vencida',
      },
    ]);
    const r = await service.consultarPorRut('123456785');
    expect(r.facturas[0].dias_vencida).toBeGreaterThanOrEqual(2);
    expect(r.facturas[0].dias_para_vencer).toBeNull();
  });

  it('calcula dias_para_vencer cuando la factura está pendiente', async () => {
    const futuro = new Date(Date.now() + 86_400_000 * 5);
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      nombre_completo: 'Juan',
      rut: '123456785',
      contrato: [{ id_contrato: 100 }],
    });
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      {
        id_factura: 2,
        periodo_mes: 5,
        periodo_anio: 2026,
        monto: 23890,
        fecha_limite_pago: futuro,
        estado: 'pendiente',
      },
    ]);
    const r = await service.consultarPorRut('123456785');
    expect(r.facturas[0].dias_para_vencer).toBeGreaterThanOrEqual(4);
    expect(r.facturas[0].dias_vencida).toBeNull();
  });

  it('consultarPorAbonado retorna deuda cuando el contrato existe', async () => {
    (prisma.contrato.findUnique as jest.Mock).mockResolvedValue({
      id_contrato: 100,
      cliente: { nombre_completo: 'Juan Pérez', rut: '123456785' },
    });
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([]);
    const r = await service.consultarPorAbonado(100);
    expect(r.encontrado).toBe(true);
    expect(r.cliente?.codigo_abonado).toBe(100);
  });

  it('consultarPorAbonado retorna encontrado:false si el contrato no existe', async () => {
    (prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null);
    const r = await service.consultarPorAbonado(99999);
    expect(r.encontrado).toBe(false);
  });

  it('marca detalle_disponible y informacion_completa en true en el camino feliz', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      nombre_completo: 'Juan',
      rut: '123456785',
      contrato: [{ id_contrato: 100 }],
    });
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      {
        id_factura: 1,
        periodo_mes: 4,
        periodo_anio: 2026,
        monto: 23890,
        fecha_limite_pago: new Date(),
        estado: 'pendiente',
      },
    ]);
    const r = await service.consultarPorRut('123456785');
    expect(r.detalle_disponible).toBe(true);
    expect(r.informacion_completa).toBe(true);
  });

  it('CU-41 Exc 1: detalle_disponible:false si la consulta de facturas falla', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      nombre_completo: 'Juan',
      rut: '123456785',
      contrato: [{ id_contrato: 100 }],
    });
    (prisma.factura.findMany as jest.Mock).mockRejectedValue(
      new Error('DB no disponible'),
    );
    const r = await service.consultarPorRut('123456785');
    expect(r.encontrado).toBe(true);
    expect(r.detalle_disponible).toBe(false);
    expect(r.tiene_deuda).toBe(false);
    expect(r.facturas).toHaveLength(0);
  });

  it('incluye el detalle del/los plan(es) contratado(s) sin duplicados', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      nombre_completo: 'Juan',
      rut: '123456785',
      contrato: [{ id_contrato: 100 }, { id_contrato: 101 }],
    });
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.contrato.findMany as jest.Mock).mockResolvedValue([
      {
        plan: {
          nombre_comercial: 'Plan 200 Mbps',
          tipo_plan: 'FIBRA',
          velocidad_mbps: 200,
          precio_mensual: 24990,
        },
      },
      // mismo plan en otro contrato → debe deduplicarse
      {
        plan: {
          nombre_comercial: 'Plan 200 Mbps',
          tipo_plan: 'FIBRA',
          velocidad_mbps: 200,
          precio_mensual: 24990,
        },
      },
    ]);
    const r = await service.consultarPorRut('123456785');
    expect(r.planes).toHaveLength(1);
    expect(r.planes[0]).toEqual({
      nombre_comercial: 'Plan 200 Mbps',
      tipo_plan: 'FIBRA',
      velocidad_mbps: 200,
      precio_mensual: 24990,
    });
  });

  it('CU-41 Exc 2: informacion_completa:false si una factura tiene monto null', async () => {
    (prisma.cliente.findFirst as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      nombre_completo: 'Juan',
      rut: '123456785',
      contrato: [{ id_contrato: 100 }],
    });
    (prisma.factura.findMany as jest.Mock).mockResolvedValue([
      {
        id_factura: 1,
        periodo_mes: 4,
        periodo_anio: 2026,
        monto: null,
        fecha_limite_pago: new Date(),
        estado: 'pendiente',
      },
    ]);
    const r = await service.consultarPorRut('123456785');
    expect(r.detalle_disponible).toBe(true);
    expect(r.informacion_completa).toBe(false);
  });
});
