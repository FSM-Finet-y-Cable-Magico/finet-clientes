import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../prisma/prisma.service.js';

/** RNF-08.2: la nueva contraseña no puede ser ninguna de las últimas 5. */
export const PASSWORDS_SIN_REPETIR = 5;

export const MENSAJE_PASSWORD_REPETIDA = `La nueva contraseña no puede ser igual a ninguna de tus últimas ${PASSWORDS_SIN_REPETIR} contraseñas`;

/**
 * Si `nueva` es la actual o una de las 4 anteriores del historial. La usan el
 * cambio desde el perfil (CU-10) y el restablecimiento con enlace (CU-03).
 */
export async function esPasswordReciente(
  prisma: Pick<PrismaService, 'historial_password_portal'>,
  idCliente: number,
  hashActual: string,
  nueva: string,
): Promise<boolean> {
  const anteriores = await prisma.historial_password_portal.findMany({
    where: { id_cliente: idCliente },
    orderBy: [{ fecha: 'desc' }, { id_historial: 'desc' }],
    take: PASSWORDS_SIN_REPETIR - 1,
    select: { password_hash: true },
  });
  for (const hash of [hashActual, ...anteriores.map((h) => h.password_hash)]) {
    if (await bcrypt.compare(nueva, hash)) return true;
  }
  return false;
}
