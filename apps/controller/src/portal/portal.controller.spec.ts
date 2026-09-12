import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

const CLIENTE_MOCK = {
  id_cliente: 1,
  nombre_completo: 'Juan Pérez',
  rut: '123456789',
  email: 'juan@example.com',
  telefono: '+56912345678',
  estado: 'activo',
};

const PANEL_MOCK = {
  cliente: CLIENTE_MOCK,
  contratos: [],
  resumen_deuda: {
    tiene_deuda: false,
    saldo_total: 0,
    facturas_pendientes: [],
  },
  tickets_recientes: [],
};

describe('PortalController', () => {
  let controller: PortalController;
  let service: jest.Mocked<PortalService>;

  beforeEach(async () => {
    const mockService = {
      getPanelPrincipal: jest.fn().mockResolvedValue(PANEL_MOCK),
      getEstadoContratos: jest.fn().mockResolvedValue([]),
      getContratosVigentes: jest.fn().mockResolvedValue([]),
      getResumenDeuda: jest.fn().mockResolvedValue({
        tiene_deuda: false,
        saldo_total: 0,
        facturas_pendientes: [],
      }),
      getTickets: jest
        .fn()
        .mockResolvedValue({ total: 0, tiene_tickets: false, tickets: [] }),
      getCategoriasTicket: jest.fn().mockResolvedValue([]),
      solicitarCambioContrasenaWifi: jest.fn().mockResolvedValue({
        id_solicitud: 7,
        id_contrato: 1,
        estado: 'PENDIENTE',
        fecha_solicitud: '2024-01-15T00:00:00.000Z',
      }),
      crearTicket: jest.fn().mockResolvedValue({
        id_ticket: 42,
        codigo_seguimiento: 'FIN-2026-000042',
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [{ provide: PortalService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PortalController);
    service = module.get(PortalService);
  });

  it('GET /portal/panel llama getPanelPrincipal con el id del cliente autenticado', async () => {
    await controller.getPanelPrincipal(CLIENTE_MOCK as any);
    expect(service.getPanelPrincipal).toHaveBeenCalledWith(1);
  });

  it('GET /portal/contratos/estado llama getEstadoContratos con el id del cliente', async () => {
    await controller.getEstadoContratos(CLIENTE_MOCK as any);
    expect(service.getEstadoContratos).toHaveBeenCalledWith(1);
  });

  it('GET /portal/contratos/vigentes llama getContratosVigentes con el id del cliente', async () => {
    await controller.getContratosVigentes(CLIENTE_MOCK as any);
    expect(service.getContratosVigentes).toHaveBeenCalledWith(1);
  });

  it('GET /portal/deuda llama getResumenDeuda con el id del cliente', async () => {
    await controller.getResumenDeuda(CLIENTE_MOCK as any);
    expect(service.getResumenDeuda).toHaveBeenCalledWith(1);
  });

  it('GET /portal/tickets sin query llama getTickets con limite undefined', async () => {
    await controller.getTickets(CLIENTE_MOCK as any, undefined);
    expect(service.getTickets).toHaveBeenCalledWith(1, undefined);
  });

  it('GET /portal/tickets?limite=3 parsea el string a número y llama getTickets con 3', async () => {
    await controller.getTickets(CLIENTE_MOCK as any, '3');
    expect(service.getTickets).toHaveBeenCalledWith(1, 3);
  });

  it('GET /portal/tickets/categorias lista las categorias disponibles', async () => {
    await controller.getCategoriasTicket();
    expect(service.getCategoriasTicket).toHaveBeenCalledTimes(1);
  });

  it('POST /portal/tickets registra la solicitud del cliente autenticado', async () => {
    const body = { id_categoria: 3, descripcion: 'Sin conexion' };

    await controller.crearTicket(CLIENTE_MOCK as any, body);

    expect(service.crearTicket).toHaveBeenCalledWith(1, body);
  });

  // CU-31 + CU-32: el endpoint solo registra la solicitud; la ejecucion en el
  // equipo del cliente es CU-33 y la hace el CRM.
  it('POST /portal/wifi/password registra la solicitud del cliente autenticado', async () => {
    const body = { id_contrato: 1, password: 'MiRedNueva2026' };

    const respuesta = await controller.solicitarCambioContrasenaWifi(
      CLIENTE_MOCK as any,
      body,
    );

    expect(service.solicitarCambioContrasenaWifi).toHaveBeenCalledWith(1, body);
    expect(respuesta).toEqual(
      expect.objectContaining({ estado: 'PENDIENTE', id_solicitud: 7 }),
    );
  });
});
