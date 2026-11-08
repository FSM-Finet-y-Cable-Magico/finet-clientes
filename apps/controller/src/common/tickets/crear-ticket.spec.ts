import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Prisma } from '../../../generated/prisma/client.js';
import {
  codigoSeguimiento,
  crearTicket,
  type NuevoTicket,
} from './crear-ticket.js';

const CREADO = new Date(2026, 10, 8, 12);

function transaccion() {
  return {
    ticket: {
      create: jest
        .fn<(a: unknown) => Promise<unknown>>()
        .mockResolvedValue({ id_ticket: 42, fecha_creacion: CREADO }),
      update: jest.fn<(a: unknown) => Promise<unknown>>().mockResolvedValue({}),
    },
    log_auditoria: {
      create: jest.fn<(a: unknown) => Promise<unknown>>().mockResolvedValue({}),
    },
  };
}

const NUEVO: NuevoTicket = {
  cliente: { id_cliente: 5, id_empresa: 1 },
  idCategoria: 3,
  descripcion: 'Sin conexión',
  valores: { prioridad: 'media', estado: 'abierto', origen: 'portal' },
  auditoria: { accion: 'CREAR_TICKET_PORTAL', detalle: { id_categoria: 3 } },
};

describe('crearTicket', () => {
  let tx: ReturnType<typeof transaccion>;
  const crear = (nuevo: NuevoTicket) =>
    crearTicket(tx as unknown as Prisma.TransactionClient, nuevo);

  beforeEach(() => {
    tx = transaccion();
  });

  it('el código lleva el año y el id con seis dígitos', () => {
    expect(codigoSeguimiento(42, CREADO)).toBe('FIN-2026-000042');
  });

  it('crea el ticket, le guarda el código y lo devuelve', async () => {
    await expect(crear(NUEVO)).resolves.toEqual({
      id_ticket: 42,
      codigo_seguimiento: 'FIN-2026-000042',
    });
    expect(tx.ticket.create).toHaveBeenCalledWith({
      data: {
        id_cliente: 5,
        id_empresa: 1,
        id_categoria: 3,
        prioridad: 'media',
        estado: 'abierto',
        origen: 'portal',
        descripcion: 'Sin conexión',
      },
      select: { id_ticket: true, fecha_creacion: true },
    });
    expect(tx.ticket.update).toHaveBeenCalledWith({
      where: { id_ticket: 42 },
      data: { codigo_seguimiento: 'FIN-2026-000042' },
    });
  });

  it('la auditoría lleva el código, el origen y el detalle de cada flujo', async () => {
    await crear(NUEVO);

    expect(tx.log_auditoria.create).toHaveBeenCalledWith({
      data: {
        accion: 'CREAR_TICKET_PORTAL',
        entidad_afectada: 'ticket',
        id_entidad_afectada: 42,
        valor_nuevo: {
          codigo_seguimiento: 'FIN-2026-000042',
          origen: 'portal',
          id_categoria: 3,
        },
      },
    });
  });

  it('vincula la conversación solo si viene del asistente', async () => {
    await crear({ ...NUEVO, idConversacionBot: 9 });

    expect(tx.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id_conversacion_bot: 9 }),
      }),
    );
  });

  it('si falla la auditoría, el error sube para que se revierta todo', async () => {
    tx.log_auditoria.create.mockRejectedValue(new Error('falló'));

    await expect(crear(NUEVO)).rejects.toThrow('falló');
  });
});
