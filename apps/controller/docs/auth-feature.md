# API de Autenticación de Clientes

Autenticación exclusiva para clientes (`cliente`), empresa 1.

Base URL: `http://localhost:4000/api`

## Endpoints

| Método | Ruta | Auth | Rate Limit | Descripción |
|---|---|---|---|---|
| `POST` | `/auth/login` | No | 5 req/min | Iniciar sesión con RUT y contraseña |
| `POST` | `/auth/register` | No | 3 req/min | Registrar nuevo cliente + JWT |
| `POST` | `/auth/recuperar-password` | No | 3 req/min | Solicitar token de recuperación |
| `POST` | `/auth/restablecer-password` | No | 3 req/min | Restablecer contraseña con token |
| `POST` | `/auth/logout` | JWT | 10 req/min | Cerrar sesión activa |
| `GET` | `/auth/perfil` | JWT | 10 req/min | Obtener datos del cliente autenticado |
| `PATCH` | `/auth/perfil/telefono` | JWT | 10 req/min | Actualizar teléfono |
| `PATCH` | `/auth/perfil/email` | JWT | 10 req/min | Actualizar correo electrónico |
| `PATCH` | `/auth/perfil/password` | JWT | 10 req/min | Cambiar contraseña |

---

## POST /auth/login

Inicia sesión con RUT y contraseña.

```
POST /api/auth/login
Content-Type: application/json

{
  "rut": "12.345.678-5",
  "password": "tu_password"
}
```

**Respuesta 200:**
```json
{
  "access_token": "eyJhbGciOi...",
  "cliente": {
    "id": 123,
    "rut": "123456785",
    "nombre_completo": "Nombre Apellido",
    "email": "cliente@correo.com",
    "telefono": "+56911111111"
  }
}
```

**Errores:**
| Código | Mensaje | Causa |
|---|---|---|
| 400 | Validation failed | RUT con formato inválido o DV incorrecto |
| 401 | RUT o contraseña incorrectos | Credenciales inválidas o cuenta no activa |
| 401 | RUT bloqueado temporalmente | 5 intentos fallidos contra el mismo RUT en 10 min → bloqueo 15 min |
| 401 | IP bloqueada temporalmente | 5 intentos fallidos desde la misma IP en 5 min → bloqueo 15 min |
| 429 | ThrottlerException | Excede 5 req/min |

---

## POST /auth/register

Registra un nuevo cliente y devuelve JWT automáticamente.

```
POST /api/auth/register
Content-Type: application/json

{
  "rut": "12.345.678-5",
  "nombre_completo": "Juan Perez",
  "email": "juan@ejemplo.cl",
  "telefono": "912345678",
  "password": "<contraseña>",
  "password_confirmation": "<contraseña>"
}
```

**Validación de contraseña:**
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 número
- Máximo 72 caracteres (límite bcrypt)

**Campos obligatorios:** `rut`, `nombre_completo`, `email`, `password`, `password_confirmation`
**Campo opcional:** `telefono` (puede omitirse o enviarse como `""`)

**Respuesta 201:**
```json
{
  "access_token": "eyJhbGciOi...",
  "cliente": {
    "id": 456,
    "rut": "123456785",
    "nombre_completo": "Juan Perez",
    "email": "juan@ejemplo.cl",
    "telefono": "912345678"
  }
}
```

**Errores:**
| Código | Mensaje | Causa |
|---|---|---|
| 400 | Validation failed | Campos inválidos (RUT, email, contraseña débil) |
| 409 | No se pudo completar el registro | RUT o email duplicado |
| 429 | ThrottlerException | Excede 3 req/min |

---

## POST /auth/recuperar-password

Solicita un token para restablecer la contraseña. **Siempre devuelve el mismo mensaje genérico** por seguridad (no revela si el RUT existe o no). Si el RUT existe y tiene correo, se envía el enlace de recuperación por email.

```
POST /api/auth/recuperar-password
Content-Type: application/json

{
  "rut": "12.345.678-5"
}
```

**Respuesta 200 (siempre la misma):**
```json
{
  "message": "Si el RUT está registrado, recibirás un enlace de recuperación"
}
```

**Comportamiento interno:**
- RUT registrado con email → genera token JWT `type: "reset"` (15 min), envía email con enlace (token en fragmento `#token=...`, no visible al servidor)
- RUT registrado sin email → registra incidente en `intento_fallido`, no envía email
- RUT no registrado → no hace nada, mismo mensaje genérico

**Errores:**
| Código | Mensaje | Causa |
|---|---|---|
| 400 | Validation failed | RUT con formato inválido o DV incorrecto |
| 429 | ThrottlerException | Excede 3 req/min |

**Notas:**
- El token en el enlace es un JWT firmado con claim `type: "reset"`, expira en 15 minutos.
- Si falla el envío del email, se registra en el log del servidor y se devuelve el mensaje genérico igualmente.

---

## POST /auth/restablecer-password

Restablece la contraseña usando el token de recuperación.

```
POST /api/auth/restablecer-password
Content-Type: application/json

{
  "token": "eyJhbGciOi...",
  "password": "<contraseña nueva>"
}
```

**Respuesta 200:**
```json
{
  "message": "Contraseña restablecida exitosamente"
}
```

**Efectos:**
- Actualiza `password_portal_hash` en la tabla `cliente`
- Invalida todas las sesiones activas del cliente (fuerza re-login)
- Envía email de confirmación si el cliente tiene correo asociado

**Errores:**
| Código | Mensaje | Causa |
|---|---|---|
| 400 | Token inválido o expirado | Token expiró (>15 min) o firma inválida |
| 400 | Token inválido | El token no es de tipo `reset` (ej: token de sesión) |
| 429 | ThrottlerException | Excede 3 req/min |

---

## POST /auth/logout

Cierra la sesión activa del cliente autenticado.

```
POST /api/auth/logout
Authorization: Bearer <jwt>
```

**Respuesta 200:**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

**Errores:**
| Código | Causa |
|---|---|
| 401 | JWT inválido, expirado, o sesión expirada por inactividad |

---

## GET /auth/perfil

Obtiene los datos del cliente autenticado.

```
GET /api/auth/perfil
Authorization: Bearer <jwt>
```

**Respuesta 200:**
```json
{
  "id_cliente": 123,
  "rut": "123456785",
  "nombre_completo": "Nombre Apellido",
  "email": "cliente@correo.com",
  "telefono": "+56911111111",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
| Código | Causa |
|---|---|
| 401 | JWT inválido, expirado, cliente no encontrado, o sesión expirada por inactividad |

---

## PATCH /auth/perfil/telefono

Actualiza el teléfono del cliente autenticado. Requiere la contraseña actual para autorizar el cambio. El cambio queda registrado en el log de auditoría.

```
PATCH /api/auth/perfil/telefono
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "password_actual": "<contraseña actual>",
  "telefono": "+56987654321"
}
```

**Reglas del teléfono:** 8-20 caracteres. Formato: dígitos, espacios, `+`, `-`, `()`.

**Respuesta 200:**
```json
{
  "id_cliente": 123,
  "rut": "123456785",
  "nombre_completo": "Nombre Apellido",
  "email": "cliente@correo.com",
  "telefono": "+56987654321",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
| Código | Mensaje | Causa |
|---|---|---|
| 400 | La contraseña actual es requerida | Campo vacío |
| 400 | El teléfono debe tener al menos 8 caracteres | Muy corto |
| 400 | Formato de teléfono inválido | Formato incorrecto |
| 401 | La contraseña actual es incorrecta | Password no coincide |
| 401 | Sesión expirada por inactividad | Sesión inactiva |

---

## PATCH /auth/perfil/email

Actualiza el correo electrónico del cliente autenticado. Requiere la contraseña actual. Rechaza si el nuevo email ya está en uso por otro cliente. El cambio queda registrado en el log de auditoría.

```
PATCH /api/auth/perfil/email
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "password_actual": "<contraseña actual>",
  "email": "nuevo@correo.cl"
}
```

**Respuesta 200:**
```json
{
  "id_cliente": 123,
  "rut": "123456785",
  "nombre_completo": "Nombre Apellido",
  "email": "nuevo@correo.cl",
  "telefono": "+56912345678",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
| Código | Mensaje | Causa |
|---|---|---|
| 400 | La contraseña actual es requerida | Campo vacío |
| 400 | El correo electrónico no tiene un formato válido | Formato incorrecto |
| 400 | El nuevo correo electrónico no puede ser igual al actual | Mismo email |
| 400 | El correo electrónico ya está registrado por otro usuario | Email duplicado |
| 401 | La contraseña actual es incorrecta | Password no coincide |
| 401 | Sesión expirada por inactividad | Sesión inactiva |

---

## PATCH /auth/perfil/password

Cambia la contraseña del cliente autenticado. Requiere la contraseña actual. La nueva contraseña debe cumplir requisitos de complejidad. El cambio queda registrado en el log de auditoría (sin almacenar la contraseña).

```
PATCH /api/auth/perfil/password
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "password_actual": "<contraseña actual>",
  "password_nuevo": "<contraseña nueva>",
  "password_confirmacion": "<contraseña nueva>"
}
```

**Reglas de la nueva contraseña:**
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 número
- No puede ser igual a la actual
- Debe coincidir con `password_confirmacion`

**Respuesta 200:**
```json
{
  "mensaje": "Contrasena actualizada correctamente"
}
```

**Errores:**
| Código | Mensaje | Causa |
|---|---|---|
| 400 | Mínimo 8 caracteres | Muy corta |
| 400 | Debe contener al menos una letra mayúscula | Falta mayúscula |
| 400 | Debe contener al menos un número | Falta número |
| 400 | Las contraseñas no coinciden | password_nuevo ≠ password_confirmacion |
| 400 | La nueva contraseña no puede ser igual a la actual | Misma contraseña |
| 401 | La contraseña actual es incorrecta | Password actual incorrecta |
| 401 | Sesión expirada por inactividad | Sesión inactiva |
## Sesiones e inactividad

- Cada login/register crea una sesión en `sesion_portal` con `fecha_expiracion = now + 15 min`.
- En cada request autenticado, se extiende la sesión otros 15 minutos (sliding window).
- Si pasan 15 minutos sin requests → `401 Sesión expirada por inactividad`.
- El JWT tiene expiración de 7 días, pero la sesión en DB vence por inactividad.
- Logout expira la sesión inmediatamente.

Configurable via `.env`: `SESSION_INACTIVITY_MINUTES=15`

---

## Rate Limiting global

Configurado via `ThrottlerGuard` global en `app.module.ts`:

| Endpoint | Rate Limit |
|---|---|
| `POST /auth/login` | 5 req/min |
| `POST /auth/register` | 3 req/min |
| `POST /auth/recuperar-password` | 3 req/min |
| `POST /auth/restablecer-password` | 3 req/min |
| Todos los demás | 10 req/min (default) |

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar JWT |
| `SESSION_INACTIVITY_MINUTES` | No (default: 15) | Minutos de inactividad para expirar sesión |
| `FRONTEND_URL` | Sí | URL base del frontend para enlaces de recuperación |
| `SMTP_HOST` | No (default: localhost) | Servidor SMTP para envío de emails |
| `SMTP_PORT` | No (default: 1025) | Puerto SMTP |
| `SMTP_USER` | No | Usuario SMTP (no necesario en dev con Mailpit) |
| `SMTP_PASS` | No | Contraseña SMTP (no necesario en dev con Mailpit) |
| `MAIL_FROM` | No | Remitente de emails ("Portal Clientes" <no-reply@finet.cl>) |
| `CORS_ORIGIN` | No | Orígenes CORS permitidos (separados por coma) |
| `NODE_ENV` | No | `development` o `production` |
| `PORT` | No (default: 4000) | Puerto del servidor |

---

## Probar con curl

```bash
BASE_URL=http://localhost:4000/api

# Login
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"rut":"12.345.678-5","password":"<contraseña>"}'

# Register
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"rut":"12.345.678-5","nombre_completo":"Juan Perez","email":"juan@test.cl","password":"<contraseña>","password_confirmation":"<contraseña>"}'

# Recuperar password
curl -X POST "$BASE_URL/auth/recuperar-password" \
  -H "Content-Type: application/json" \
  -d '{"rut":"12.345.678-5"}'

# Restablecer password
curl -X POST "$BASE_URL/auth/restablecer-password" \
  -H "Content-Type: application/json" \
  -d '{"token":"<token>","password":"<contraseña nueva>"}'

# Perfil
curl -X GET "$BASE_URL/auth/perfil" \
  -H "Authorization: Bearer <jwt>"

# Actualizar telefono
curl -X PATCH "$BASE_URL/auth/perfil/telefono" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"password_actual":"<contraseña actual>","telefono":"+56987654321"}'

# Actualizar email
curl -X PATCH "$BASE_URL/auth/perfil/email" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"password_actual":"<contraseña actual>","email":"nuevo@correo.cl"}'

# Cambiar contraseña
curl -X PATCH "$BASE_URL/auth/perfil/password" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"password_actual":"<contraseña actual>","password_nuevo":"<contraseña nueva>","password_confirmacion":"<contraseña nueva>"}'

# Logout
curl -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer <jwt>"
```

## Seguridad aplicada

- Rate limiting global con `@Throttle` por endpoint
- Bloqueo temporal por intentos fallidos (doble capa):
  - Por RUT: 5 intentos en 10 min → 15 min de bloqueo
  - Por IP: 5 intentos en 5 min → 15 min de bloqueo
- JWT con `JWT_SECRET` obligatorio, expiración 7 días
- Sesiones con sliding window de inactividad (15 min)
- Una sesión activa por cliente (login invalida sesiones anteriores)
- Password hasheada con bcrypt (salt rounds 10)
- Validación Zod en todos los DTOs
- Reset token con claim `type: "reset"` para evitar reuso de token de sesión
- Reset token enviado en fragmento de URL (`#token=...`) para no exponerlo en logs del servidor
- Login rechaza cuentas con estado distinto a `'activo'` (mensaje genérico idéntico)
- Admin protegido con `X-API-Key`
- CORS configurable via `CORS_ORIGIN`
- Helmet con HSTS en producción para headers de seguridad HTTP

## Archivos clave

| Archivo | Propósito |
|---|---|
| `src/auth/auth.controller.ts` | Endpoints de autenticación |
| `src/auth/auth.service.ts` | Lógica de negocio (login, register, password reset, sesiones) |
| `src/auth/dto/login.dto.ts` | Validación Zod para login |
| `src/auth/dto/register.dto.ts` | Validación Zod para register |
| `src/auth/dto/recuperar-password.dto.ts` | Validación Zod para recuperar password |
| `src/auth/dto/restablecer-password.dto.ts` | Validación Zod para restablecer password |
| `src/auth/strategies/jwt.strategy.ts` | Estrategia JWT + validación de sesión por inactividad |
| `src/auth/guards/jwt-auth.guard.ts` | Guard JWT |
| `src/perfil/perfil.controller.ts` | Endpoints de perfil |
| `src/perfil/perfil.service.ts` | Lógica de perfil |
| `src/perfil/dto/perfil.dto.ts` | Validación Zod para perfil |
| `src/mail/mail.service.ts` | Servicio de envío de emails (nodemailer) |
| `src/mail/mail.module.ts` | Módulo global de mail |
| `src/common/utils/rut.ts` | Limpieza y validación de RUT chileno |
| `src/app.module.ts` | Módulo raíz con ThrottlerGuard global |

## Email en desarrollo

El proyecto incluye **Mailpit** en `docker-compose.yml` para capturar emails en desarrollo.

```bash
docker compose up -d mailpit
```

- SMTP: `localhost:1025` (sin auth)
- Web UI: `http://localhost:8025` (todos los emails capturados)

En producción, configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` con un proveedor SMTP real.
