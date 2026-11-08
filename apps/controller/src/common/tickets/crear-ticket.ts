import type { Prisma } from '../../../generated/prisma/client.js';

/** `FIN-2026-000123`: el código que se le da al cliente. */
export function codigoSeguimiento(
  idTicket: number,
  creado: Date | null,
): string {
  const anio = creado?.getFullYear() ?? new Date().getFullYear();
  return `FIN-${anio}-${String(idTicket).padStart(6, '0')}`;
}

export type NuevoTicket = {
  cliente: { id_cliente: number; id_empresa: number | null };
  idCategoria: number;
  descripcion: string;
  valores: { prioridad: string; estado: string; origen: string };
  idConversacionBot?: number;
  auditoria: {
    accion: string;
    /** Lo propio de cada flujo; el código y el origen los agrega esta función. */
    detalle: Prisma.InputJsonObject;
  };
};

export type TicketCreado = {
  id_ticket: number;
  codigo_seguimiento: string;
};

/**
 * Crea un ticket con su código de seguimiento y su registro de auditoría: lo
 * mismo para el portal (CU-71) y el asistente (CU-66 y CU-77). Va dentro de la
 * transacción de quien llama, para que el ticket y su auditoría queden juntos
 * o no quede ninguno. El código necesita el id, por eso se crea y se actualiza.
 */
export async function crearTicket(
  tx: Prisma.TransactionClient,
  nuevo: NuevoTicket,
): Promise<TicketCreado> {
  const ticket = await tx.ticket.create({
    data: {
      id_cliente: nuevo.cliente.id_cliente,
      id_empresa: nuevo.cliente.id_empresa,
      id_categoria: nuevo.idCategoria,
      ...(nuevo.idConversacionBot === undefined
        ? {}
        : { id_conversacion_bot: nuevo.idConversacionBot }),
      ...nuevo.valores,
      descripcion: nuevo.descripcion,
    },
    select: { id_ticket: true, fecha_creacion: true },
  });

  const codigo = codigoSeguimiento(ticket.id_ticket, ticket.fecha_creacion);

  await tx.ticket.update({
    where: { id_ticket: ticket.id_ticket },
    data: { codigo_seguimiento: codigo },
  });

  await tx.log_auditoria.create({
    data: {
      accion: nuevo.auditoria.accion,
      entidad_afectada: 'ticket',
      id_entidad_afectada: ticket.id_ticket,
      valor_nuevo: {
        codigo_seguimiento: codigo,
        origen: nuevo.valores.origen,
        ...nuevo.auditoria.detalle,
      },
    },
  });

  return { id_ticket: ticket.id_ticket, codigo_seguimiento: codigo };
}
