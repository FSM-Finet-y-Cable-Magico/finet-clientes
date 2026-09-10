# Finet Clientes Backend

Backend para el portal de clientes basado en NestJS, Prisma y PostgreSQL.

## Stack

- Node.js + NestJS 11 (ESM)
- PostgreSQL + Prisma 7 (con `@prisma/adapter-pg`)
- Zod v4 para validación
- JWT (Passport.js) para autenticación + sesiones en DB con ventana deslizante
- Nodemailer para envío de emails (Mailpit en dev)
- Helmet + CORS + Rate Limiting (Throttler)
- Protección anti fuerza bruta (doble capa: por RUT y por IP)
- pnpm como gestor de paquetes

## Requisitos

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+
- Docker (opcional, para servicios locales)

## Configuración

Crear `apps/controller/.env` a mano — no hay `.env.example` en el repo. La
plantilla completa y lista para copiar está en el
[README raíz](../../README.md#backend--appscontrollerenv); el archivo está en
`.gitignore` y no se commitea.

Variables principales:

- `DATABASE_URL` — conexión a PostgreSQL
- `JWT_SECRET` — secreto para firmar JWT
- `ADMIN_API_KEY` — clave para endpoints admin
- `SESSION_INACTIVITY_MINUTES` — minutos de inactividad para expirar sesión (default: 15)
- `CORS_ORIGIN` — lista separada por comas de orígenes CORS permitidos
- `FRONTEND_URL` — URL base del frontend para recuperación de contraseña
- `PORT` — puerto del servidor (default: 4000)
- `NODE_ENV` — `development` o `production`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — configuración de correo
- `FAST_API_URL`, `FAST_TOKEN` — API de fast.com para el test de velocidad (CU-34/35). El navegador no puede consultarla directamente porque solo acepta el origen `https://fast.com`, así que el backend pide los servidores de medición y se los entrega al cliente vía `GET /diagnostico/servidores`

## Servicios locales con Docker

Levantar PostgreSQL y Mailpit (captura de emails en dev):

```bash
$ docker compose up -d
```

- PostgreSQL: `localhost:5555`
- Mailpit SMTP: `localhost:1025`
- Mailpit Web UI: `http://localhost:8025` (todos los emails capturados)

## Base de datos

Aplicar migraciones:

```bash
$ pnpm prisma migrate deploy
```

Regenerar Prisma Client (si se modifica el schema):

```bash
$ pnpm prisma generate
```

El visor cartográfico (CU-59 a CU-62) no necesita seed: su capa es estática y
vive en `src/cobertura/cobertura-finet.data.ts`. Ver
[`docs/cobertura.md`](./docs/cobertura.md).

## Scripts

```bash
# instalar dependencias
$ pnpm install

# desarrollo
$ pnpm run start:dev

# producción
$ pnpm run start:prod

# build
$ pnpm run build

# tests unitarios
$ pnpm run test

# tests e2e
$ pnpm run test:e2e

# lint
$ pnpm run lint

# formato
$ pnpm run format
```

## Estructura del proyecto

```
src/
├── main.ts                    # Entrada de la app (bootstrap)
├── app.module.ts              # Módulo raíz, configuración global
├── app.controller.ts          # Health check (GET /)
├── prisma/
│   ├── prisma.module.ts       # Módulo global de Prisma
│   └── prisma.service.ts      # Servicio Prisma (extiende PrismaClient)
├── mail/
│   ├── mail.module.ts         # Módulo global de mail
│   └── mail.service.ts        # Servicio de envío de emails (Nodemailer)
├── common/
│   ├── filters/               # Filtros de excepciones HTTP
│   └── utils/                 # Utilidades (RUT chileno)
├── auth/                      # Autenticación (login, register, password recovery, logout)
├── perfil/                    # Perfil del cliente (obtener, actualizar datos, cambiar contraseña)
├── portal/                    # Portal autenticado (panel, contratos, deuda, tickets)
├── landing/                   # Landing page pública (catálogo de planes)
├── deuda-publica/             # Consulta pública de deuda (por RUT o código de abonado)
├── cobertura/                 # Visor cartográfico público (capa estática)
├── admin/                     # Panel admin (intentos fallidos, desbloqueo de IP)
└── generated/zod/             # Schemas Zod auto-generados desde Prisma
```

## Documentación

### API para Frontend

Documentación de endpoints organizada por feature (bodies, respuestas, errores, ejemplos fetch):

| Feature | Archivo | Endpoints |
|---------|---------|-----------|
| **Auth** | [`docs/auth.md`](./docs/auth.md) | Login, register, recuperar/restablecer password, logout |
| **Perfil** | [`docs/perfil.md`](./docs/perfil.md) | Obtener perfil, actualizar teléfono/email, cambiar contraseña |
| **Portal** | [`docs/portal.md`](./docs/portal.md) | Panel, contratos (estado/vigentes), deuda, tickets |
| **Landing** | [`docs/landing.md`](./docs/landing.md) | Catálogo de planes |
| **Deuda Pública** | [`docs/deuda-publica.md`](./docs/deuda-publica.md) | Consulta de deuda por RUT o código de abonado |
| **Cobertura** | [`docs/cobertura.md`](./docs/cobertura.md) | Visor cartográfico público, capa generada desde el KML de planta externa |
| **Admin** | (ver abajo) | Intentos fallidos, desbloquear IP |

### Documentación técnica

- [`docs/api-frontend.md`](./docs/api-frontend.md) — referencia completa de la API (todos los módulos)
- [`docs/auth-feature.md`](./docs/auth-feature.md) — diseño de autenticación (seguridad, rate limits, sesiones)
- [`docs/prisma-types.md`](./docs/prisma-types.md) — generación de tipos desde Prisma

## Notas de despliegue

- En prod, `CORS_ORIGIN` es obligatorio.
- Se requiere `JWT_SECRET` en todos los entornos.
- Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` con un proveedor SMTP real en producción.
- El puerto por defecto es 4000, configurable con `PORT`.
