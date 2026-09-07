# Monorepo Finet

Plataforma de gestión de clientes para Fibernet Limitada (Finet) — Internet de fibra óptica en La Pintana y Puente Alto.

## Estructura

```
finet-clientes/
├── pnpm-workspace.yaml        ← Workspace pnpm (apps/*)
├── package.json               ← Scripts del monorepo
├── CONTRIBUTING.md            ← Convenciones de ramas y commits
├── DESIGN.md                  ← Sistema de diseño (tokens, tipografía, color)
├── docs/
│   ├── CASOS-DE-USO.md        ← Glosario CU-XX / RF-XX por incremento
│   └── db/                    ← Decisiones de modelo de datos
└── apps/
    ├── controller/            ← @finet/controller — API REST (NestJS + Prisma + PostgreSQL)
    └── view/                  ← @finet/view — Cliente web (Next.js + React + Tailwind)
```

## Requisitos

- Node.js >= 20
- pnpm >= 9
- PostgreSQL (para el backend)

## Inicio rápido

```bash
# 1. Instalar dependencias de todo el monorepo (desde raíz)
pnpm install

# 2. Crear los dos archivos .env (ver "Variables de entorno" abajo).
#    No hay .env.example en el repo: las variables se documentan acá.
#    Ambos archivos están en .gitignore — nunca se commitean.

# 3. Generar el cliente Prisma (obligatorio antes de correr tests o build)
pnpm -C apps/controller prisma generate

# 4. Base de datos (migraciones)
pnpm -C apps/controller prisma migrate dev

# 5. Desarrollo (ambos apps en paralelo)
pnpm dev
```

> `apps/controller/generated/` y `apps/controller/src/generated/` son artefactos
> de `prisma generate` y están ignorados por git. Si `pnpm test` falla con
> `Could not locate module ../../generated/prisma/client.js`, el paso 3 es lo que
> falta.

## Comandos

| Comando | Descripción |
|---|---|
| `pnpm install` | Instalar dependencias de todos los paquetes |
| `pnpm dev` | Levantar backend + frontend en paralelo |
| `pnpm dev:controller` | Solo backend (NestJS) |
| `pnpm dev:view` | Solo frontend (Next.js) |
| `pnpm build` | Build de todos los paquetes |
| `pnpm lint` | Lint de todos los paquetes |
| `pnpm test` | Tests de todos los paquetes |
| `pnpm -C apps/controller prisma ...` | Comandos Prisma (generate, migrate, studio) |

## Variables de entorno

Los dos archivos `.env` se crean a mano. Los bloques de abajo sirven como
plantilla completa para desarrollo local.

### Backend — `apps/controller/.env`

```bash
# Base de datos (PostgreSQL)
# Puerto 5555: es el que expone el docker-compose de apps/controller.
DATABASE_URL="postgresql://postgres:postgres@localhost:5555/finet_clientes"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="finet_clientes"

# Autenticación
JWT_SECRET="tu-jwt-secret-aqui"
ADMIN_API_KEY="tu-admin-api-key-aqui"

# Sesión
SESSION_INACTIVITY_MINUTES=15

# Entorno
NODE_ENV="development"
PORT=4000

# CORS
CORS_ORIGIN="http://localhost:3000,https://app.tudominio.com"
FRONTEND_URL="http://localhost:3000"

# SMTP (Mail)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Portal Clientes <no-reply@finet.cl>"
```

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | URL de conexión PostgreSQL. Con `docker compose up -d` el puerto es **5555**, no el 5432 por defecto |
| `JWT_SECRET` | Sí | Secreto para firmar los JWT. **Debe ser idéntico al del frontend** |
| `ADMIN_API_KEY` | Sí | Clave del header `X-API-Key` que protege los endpoints administrativos activos del backend |
| `SESSION_INACTIVITY_MINUTES` | No | Minutos de inactividad para expirar la sesión (default: 15) |
| `PORT` | No | Puerto del servidor (default: 4000) |
| `NODE_ENV` | No | `development` o `production` |
| `CORS_ORIGIN` | Sí | Orígenes permitidos, separados por coma |
| `FRONTEND_URL` | Sí | URL base del frontend, usada en recuperación de contraseña |
| `SMTP_*`, `MAIL_FROM` | Sí | Envío de correo (en dev, Mailpit vía `docker compose up -d`) |
| `POSTGRES_*` | No | Solo los consume el `docker-compose` de desarrollo |

### Frontend — `apps/view/.env`

```bash
# API (backend)
API_URL="http://localhost:4000/api"
NEXT_PUBLIC_API_URL="http://localhost:4000/api"

# Autenticación
JWT_SECRET="tu-jwt-secret-aqui"

# Sitio
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# Monitoreo (opcional)
NEXT_PUBLIC_SENTRY_DSN=
```

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sí | URL del backend para componentes cliente y casi todo el fetching server-side |
| `API_URL` | Sí | Misma URL, pero la lee **solo** `app/portal/_lib/portal-api.ts`. Ver el quirk documentado en [`apps/view/docs/conventions.md`](apps/view/docs/conventions.md) |
| `JWT_SECRET` | Sí | Debe coincidir con el backend — `proxy.ts` verifica la firma localmente, sin llamar a la API |
| `NEXT_PUBLIC_SITE_URL` | No | URL pública del sitio (SEO: JSON-LD, sitemap) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Si está seteada, `securityLogger` reporta eventos de seguridad en producción |

## Documentación

| Documento | Contenido |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Flujo de ramas, convención de commits, checklist antes de mergear |
| [`DESIGN.md`](DESIGN.md) | Sistema de diseño y tokens |
| [`docs/CASOS-DE-USO.md`](docs/CASOS-DE-USO.md) | Glosario de CU-XX / RF-XX por incremento |
| [`apps/controller/docs/`](apps/controller/docs/) | Contrato de cada endpoint de la API |
| [`apps/view/docs/routing.md`](apps/view/docs/routing.md) | Ruta → endpoint → caso de uso |
| [`apps/view/docs/conventions.md`](apps/view/docs/conventions.md) | Convenciones de componentes, fetching y testing |
| [`apps/view/docs/cobertura.md`](apps/view/docs/cobertura.md) | Mapa de cobertura del portal cliente |

## Licencia

Propietario — Fibernet Limitada.
