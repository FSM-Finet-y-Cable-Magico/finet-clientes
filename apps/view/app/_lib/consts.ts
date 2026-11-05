export const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://finet.cl";

/**
 * El backend, visto desde el navegador. Sin la variable cae al backend local
 * de desarrollo. Del lado del servidor de Next se usa `apiUrl()`, de
 * `api-servidor.ts`.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

/**
 * El evento con el que `utils/api.ts` avisa que el backend respondió 401 a una
 * sesión, y que `AuthProvider` escucha para mandar al login.
 */
export const EVENTO_SESION_EXPIRADA = "auth:session-expired";
