export const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://finet.cl";

/**
 * El backend, visto desde el navegador. Sin la variable cae al backend local
 * de desarrollo. Del lado del servidor de Next se usa `apiUrl()`, de
 * `api-servidor.ts`.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
