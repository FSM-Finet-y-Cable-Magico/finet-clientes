# Convenciones de `apps/view`

## Componentes

- `app/_components/<dominio>/` — UI organizada por dominio (`ui`, `layout`, `portal`, `catalog`). El prefijo `_` excluye la carpeta del routing de Next.js. **Para UI nueva reutilizable, usar este patrón.**
- `app/components/` — formularios de auth/perfil (Login, Register, Recovery, Reset, ChangePassword, UpdateEmail, UpdateTelefono, DeudaLookupForm) e inputs asociados (RutInput, TelefonoInput, PasswordInput). Es anterior a la convención de `_components/<dominio>` — se mantiene por continuidad, no es el patrón a copiar para código nuevo.
- Páginas de `portal/*` son client components (`"use client"`) que hacen fetch en un `useEffect` con `setTimeout(fn, 0)` (evita el warning de `act()` en tests) y manejan tres estados: loading (skeleton), error (con botón "Reintentar"), y success.

## Clientes API — módulos distintos, no son intercambiables

| Módulo | Uso | Variable de entorno | Notas |
|---|---|---|---|
| `app/utils/api.ts` | Client components (`"use client"`) — el que usan las páginas de `portal/*` | `NEXT_PUBLIC_API_URL` | Objeto `api.get/post/put/patch/delete`. Envía `credentials: "include"`. En un 401 dispara `window.dispatchEvent(new CustomEvent("auth:session-expired"))` (lo escucha `AuthProvider`) y loguea con `securityLogger`. |
| `app/_lib/api.ts` | Server components de landing (`getLandingPlanes`, `getPlanById`) | `NEXT_PUBLIC_API_URL` | `fetch` con `next: { revalidate: 300 }`. Si el backend no responde, hace fallback silencioso a catálogo vacío (`console.error("Backend no disponible...")` — esto es lo que se ve en el log de `pnpm build`, es esperado). |
| `app/portal/_lib/portal-api.ts` | Server-side (`getDeuda`, `getTickets`) | **`API_URL`** (sin `NEXT_PUBLIC_`) | `fetch` con `cache: 'no-store'`. Lanza `Error` si la respuesta no es `ok` — no hace fallback silencioso como el de landing. |

Antes de agregar otro helper de fetch, revisar si alguno de los módulos activos
ya cubre el caso y verificar cuál variable de entorno lee realmente (`API_URL`
vs `NEXT_PUBLIC_API_URL`).

## Sesión

Dos mecanismos independientes, no los confundas:

1. **`proxy.ts`** (raíz de `apps/view`) — middleware de Next.js, verifica el JWT de la cookie con `jose` para `/portal/*` y `/perfil/*`. Corre en el edge, no llama a la API.
2. **`app/_lib/auth.tsx`** (`AuthProvider`/`useAuth`) — contexto React del lado cliente. Al montar, llama `GET /auth/perfil` (con reintento exponencial, `MAX_RETRIES=3`) para poblar el navbar/estado de UI. Escucha `auth:session-expired` para desloguear reactivamente cuando `utils/api.ts` recibe un 401 en cualquier fetch posterior.

## Datos de contacto/empresa

Todo lo que sea teléfono, WhatsApp, dirección o razón social se centraliza en `app/_lib/company.ts`. No hardcodear estos valores en componentes — editar solo ese archivo.

## Estilos

Tailwind v4, config vía `@theme` en `app/globals.css` (no hay `tailwind.config.js`). Los tokens de color siguen el sistema de diseño documentado en [`DESIGN.md`](../../../DESIGN.md) (`--color-primary`, `--color-error-container`, etc., con override completo en `[data-theme="dark"]`). Usar las clases derivadas (`bg-primary`, `text-on-error-container`, `bg-surface-deep`) en vez de valores hardcodeados — así el modo oscuro funciona gratis.

`z-index`: la escala de Tailwind v4 solo llega a `z-50` (`0/10/20/30/40/50/auto`). Para valores mayores usar sintaxis de valor arbitrario `z-[100]`, **no** `z-100` — esa clase no existe y Tailwind no genera ninguna regla para ella (queda como no-op silencioso).

## Testing

- Jest + React Testing Library + `@testing-library/user-event`, un archivo por componente/página en `app/__tests__/`.
- Mockear `global.fetch` directamente con `jest.fn()` en `beforeEach`, **no** mockear el módulo `api` — así el test también verifica implícitamente la URL/método que arma el cliente real. Ver cualquier test existente como plantilla.
- `jest.config.ts` usa `next/jest` (soporta CSS/next.config automáticamente) y mapea `@/*` al root de `apps/view`, igual que `tsconfig.json`.
- No hay tests e2e en `view` — solo unitarios/componente. Los e2e (si existen) viven en `apps/controller` (`test:e2e`).
