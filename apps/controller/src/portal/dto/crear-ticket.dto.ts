import { z } from 'zod';

export const crearTicketSchema = z
  .object({
    id_categoria: z.number().int().positive('Selecciona una categoria valida'),
    descripcion: z
      .string()
      .trim()
      .min(1, 'Describe el problema')
      .max(5000, 'La descripcion no puede superar los 5000 caracteres'),
  })
  .strict();

export type CrearTicketDto = z.infer<typeof crearTicketSchema>;
