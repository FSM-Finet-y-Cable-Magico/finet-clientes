/**
 * CU-77: categoria de los tickets que abre el asistente al derivar. El ticket
 * exige una; el operador la cambia desde el CRM si corresponde otra.
 *
 * La pone el sistema, no el cliente: no se ofrece al reportar una falla, ni
 * en el portal (CU-29) ni en el asistente (CU-66).
 */
export const CATEGORIA_ESCALAMIENTO = 'Asistente virtual';
