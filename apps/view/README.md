# Finet View — Portal Web de Clientes

Frontend del monorepo Finet: landing pública, portal autenticado de clientes y flujos de auth. Next.js 16 (App Router) + React 19 + Tailwind CSS v4.

Para el panorama completo del monorepo (backend, base de datos, variables de entorno compartidas), ver el [README raíz](../../README.md).

## Stack

- Next.js 16 (App Router, React Server Components)
- React 19
- Tailwind CSS v4 (config vía `@theme` en CSS, no `tailwind.config.js`)
- Zod v4 para validación de formularios
- Jest + React Testing Library + `@testing-library/user-event`
- `jose` para verificar JWT en el proxy de rutas protegidas

## Requisitos

- Node.js 20+
- pnpm 9+
- El backend (`apps/controller`) corriendo en `http://localhost:4000` (o el que indique `NEXT_PUBLIC_API_URL`)

## Configuración

Crear `apps/view/.env` a mano (no hay `.env.example` en el repo; está en
`.gitignore` y no se commitea) y levantar el server:

```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Variables de entorno

```bash
API_URL="http://localhost:4000/api"
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
JWT_SECRET="tu-jwt-secret-aqui"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SENTRY_DSN=
```

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sí | URL del backend, usada por componentes cliente y por casi todo el server-side fetching |
| `API_URL` | Sí (ver nota) | URL del backend, usada **solo** por `app/portal/_lib/portal-api.ts`. Ver "Quirk conocido" abajo |
| `JWT_SECRET` | Sí | Debe ser idéntico al del backend — el proxy verifica el JWT localmente, sin llamar a la API |
| `NEXT_PUBLIC_SITE_URL` | No | URL pública del sitio (SEO: JSON-LD, sitemap) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Si está seteada, `securityLogger` reporta eventos de seguridad en producción |

> ⚠️ **Quirk conocido:** hay tres módulos que hacen fetch al backend y **no todos leen la misma variable de entorno**. Ver la sección "Clientes API" abajo antes de tocar cualquiera de los tres.

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo (puerto 3000) |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint (`eslint-config-next`) |
| `pnpm test` | Tests (Jest + RTL) |
| `pnpm test:watch` | Tests en modo watch |
| `pnpm test:cov` | Tests con cobertura |

## Estructura de `app/`

```
app/
├── _components/         # UI organizada por dominio (prefijo "_" = excluida del routing)
│   ├── ui/               #   primitivas genéricas: StatusBadge, PrimaryButton, ComingSoon
│   ├── layout/           #   navbar, footer, hero, theme (dark/light)
│   ├── portal/           #   UI del portal autenticado: sidebar, skeleton, secciones de dashboard
│   └── catalog/          #   catálogo de planes y formulario de contratación
├── components/          # Formularios de auth/perfil (Login, Register, Recovery, Reset,
│                         # ChangePassword, UpdateEmail, UpdateTelefono, DeudaLookupForm, inputs).
│                         # Histórico — para UI nueva reutilizable, preferir _components/<dominio>.
├── _lib/                 # Utilidades globales: company.ts, auth.tsx (AuthProvider), logger.ts,
│                         # consts.ts, jsonld.ts, api.ts (fetch de landing)
├── utils/                # api.ts (cliente API genérico get/post/put/patch/delete), login-schema.ts
├── portal/               # Rutas protegidas: page.tsx (panel), deuda/, servicios/, tickets/, _lib/
├── __tests__/            # Tests (Jest + RTL), un archivo por componente/página
└── <rutas públicas>/     # inicio-sesion, recuperar-password, restablecer-password, perfil,
                          # planes, contratar/[planId], consultar-deuda, hogar/, empresas/, tv/, legal/, ...
```

Ver [`docs/routing.md`](./docs/routing.md) para el mapa completo de rutas y a qué endpoint/caso de uso corresponde cada una, [`docs/conventions.md`](./docs/conventions.md) para las convenciones de componentes, fetching y testing (incluye el detalle del quirk de las variables de API), y [`docs/cobertura.md`](./docs/cobertura.md) para la diferencia entre el mapa público del sitio y el editor del administrador.

## Sesión y rutas protegidas

- **Borde de la app (`proxy.ts`):** middleware que verifica el JWT de la cookie `access_token` con `jose` para las rutas `/portal/*` y `/perfil/*`. Si falta o es inválido, redirige a `/inicio-sesion`. No llama a la API — verifica la firma localmente con `JWT_SECRET`.
- **Estado de UI (`app/_lib/auth.tsx`):** `AuthProvider`/`useAuth` — contexto cliente que consulta `GET /auth/perfil` al montar (con reintento exponencial) para saber quién está logueado, y escucha el evento `auth:session-expired` (disparado por `utils/api.ts` ante un 401) para desloguear y redirigir.

Estos dos mecanismos son independientes y cumplen roles distintos: el proxy protege la ruta a nivel de servidor, el contexto maneja el estado visual (navbar, nombre del cliente, etc.).

## Diseño

El sistema de diseño ("Lumina Connectivity System") está documentado en [`../../DESIGN.md`](../../DESIGN.md) y materializado como tokens CSS en `app/globals.css` (`--color-*`, `--shadow-*`, `--radius-*` bajo `@theme`, con overrides en `[data-theme="dark"]`). Usar las clases Tailwind derivadas de esos tokens (`bg-primary`, `text-on-error-container`, `bg-surface-deep`, etc.) en vez de colores hardcodeados.

## Testing

Convención: mockear `global.fetch` directamente (no el módulo `api`), ver cualquier archivo en `app/__tests__/` como referencia. `jest.config.ts` usa `next/jest` y mapea `@/*` al root de `apps/view` (mismo alias que `tsconfig.json`).
