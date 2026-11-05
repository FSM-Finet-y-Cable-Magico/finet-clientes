/**
 * La URL del backend para las acciones que corren en el servidor de Next.
 * A diferencia de `API_URL` no tiene valor por defecto: sin la variable lanza.
 */
export function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL no está configurada en las variables de entorno");
  return `${base}${path}`;
}
