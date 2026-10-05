import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Cuánto puede durar una tanda con el candado tomado. Holgado a propósito: el
 * tope de 50 mensajes por segundo más la latencia del SMTP hacen que una tanda
 * grande tarde minutos. Si se pasa, la transacción se aborta y suelta el candado.
 */
export const DURACION_MAXIMA_TANDA_MS = 30 * 60 * 1000;

export type ResultadoCandado<T> =
  | { tomado: true; resultado: T }
  | { tomado: false };

/**
 * Corre `trabajo` solo si esta instancia consigue el candado `clave`. Si otra
 * instancia lo tiene, devuelve `{ tomado: false }` sin hacer nada.
 *
 * **Por qué no `pg_try_advisory_lock` a secas:** ese es un candado de sesión, que
 * se suelta solo al pedirlo o al cerrar la conexión. Prisma trabaja con un pool,
 * así que la conexión que lo tomó vuelve al pool con el candado puesto y lo
 * retiene mientras viva. En un servidor que corre de continuo, el cron del día
 * siguiente puede tocar otra conexión del pool, no conseguirlo, creer que otra
 * instancia está trabajando y saltarse la tanda entera sin avisar.
 *
 * Acá el candado es **de transacción** (`pg_try_advisory_xact_lock`) y la
 * transacción queda abierta mientras dura el trabajo, así que se suelta sola al
 * terminar, bien o mal.
 *
 * `trabajo` usa el cliente normal y no el de la transacción, a propósito: cada
 * registro se confirma al instante. Es lo que impide el doble envío si el
 * proceso muere a mitad de la tanda.
 */
export async function conCandado<T>(
  prisma: PrismaService,
  clave: number,
  trabajo: () => Promise<T>,
): Promise<ResultadoCandado<T>> {
  return prisma.$transaction(
    async (tx): Promise<ResultadoCandado<T>> => {
      const filas = await tx.$queryRaw<{ tomado: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${clave}::bigint) AS tomado`;
      if (filas[0]?.tomado !== true) return { tomado: false };
      return { tomado: true, resultado: await trabajo() };
    },
    { timeout: DURACION_MAXIMA_TANDA_MS, maxWait: 10_000 },
  );
}
