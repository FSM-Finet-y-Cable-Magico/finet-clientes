# Auth — Documentacion para Frontend

Base URL: `http://localhost:4000/api`

---

## Autenticacion

| Tipo | Como se envia | Donde se usa |
|------|---------------|--------------|
| **Publico** | Sin auth | Login, register, recuperacion |
| **JWT** | `Authorization: Bearer <token>` o cookie `access_token` | Logout, portal, perfil |

---

## 1. Iniciar sesion (RF-01)

```
POST /api/auth/login
```

**Body:**

```json
{
  "rut": "12.345.678-5",
  "password": "MiClave1"
}
```

**Respuesta 200:**

```json
{
  "access_token": "eyJhbGciOi...",
  "cliente": {
    "id": 1,
    "rut": "123456785",
    "nombre_completo": "Juan Perez",
    "email": "juan@test.cl",
    "telefono": "912345678"
  }
}
```

El backend setea una cookie `access_token` httpOnly (7 dias). Para llamadas autenticadas, enviar `Authorization: Bearer <token>` o confiar en la cookie.

**Rate limit:** 5 intentos por minuto por IP.

**Bloqueo por intentos fallidos:**
- 5 intentos fallidos en 10 min contra el mismo RUT → RUT bloqueado 15 min.
- 5 intentos fallidos en 5 min desde la misma IP → IP bloqueada 15 min.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Formato inválido. Ej: 12.345.678-5"` | RUT mal escrito |
| 400 | `"RUT inválido — dígito verificador incorrecto"` | DV no coincide |
| 401 | `"IP bloqueada temporalmente"` | +5 intentos desde misma IP |
| 401 | `"RUT bloqueado temporalmente"` | +5 intentos contra ese RUT |
| 401 | `"RUT o contraseña incorrectos"` | Credenciales invalidas o cuenta no activa |
| 429 | `"ThrottlerException: Too Many Requests"` | +5 req/min |

> El error 401 por credenciales nunca distingue entre RUT inexistente, cuenta no activa, y contrasena erronea — siempre dice `"RUT o contraseña incorrectos"`.

---

## 2. Registrar cuenta nueva (RF-10)

```
POST /api/auth/register
```

**Body:**

```json
{
  "rut": "12.345.678-5",
  "nombre_completo": "Juan Perez",
  "email": "juan@ejemplo.cl",
  "telefono": "912345678",
  "password": "Clave123",
  "password_confirmation": "Clave123"
}
```

`telefono` es opcional (puede omitirse o enviarse como `""`).

**Reglas de contrasena:**
- Minimo 8 caracteres
- Al menos 1 mayuscula
- Al menos 1 numero
- Maximo 72 caracteres

El cliente se crea con `id_empresa=1` y `estado='activo'`. Si el registro es exitoso, inicia sesion automaticamente (devuelve token JWT + cookie).

**Respuesta 201:**

```json
{
  "access_token": "eyJhbGciOi...",
  "cliente": {
    "id": 2,
    "rut": "123456785",
    "nombre_completo": "Juan Perez",
    "email": "juan@ejemplo.cl",
    "telefono": "912345678"
  }
}
```

**Rate limit:** 3 intentos por minuto por IP.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Email es requerido"` | Campo vacio |
| 400 | `"Email inválido"` | Formato incorrecto |
| 400 | `"Contraseña debe tener al menos 8 caracteres"` | Muy corta |
| 400 | `"Contraseña debe contener al menos una mayúscula"` | Falta mayuscula |
| 400 | `"Contraseña debe contener al menos un número"` | Falta numero |
| 400 | `"Las contraseñas no coinciden"` | password ≠ password_confirmation |
| 409 | `"No se pudo completar el registro"` | RUT o email duplicado |
| 429 | Rate limit | +3 req/min |

---

## 3. Recuperar contrasena (RF-03)

```
POST /api/auth/recuperar-password
```

**Body:**

```json
{
  "rut": "12.345.678-5"
}
```

Si el RUT existe y tiene email registrado, se envia un enlace de recuperacion al correo. El enlace expira en **15 minutos**.

Por seguridad, la respuesta siempre es identica, sin revelar si el RUT existe o no.

> Para probar el envio de correos en dev (Mailpit, sin SMTP real) ver
> [`../README.md#probar-el-correo-de-recuperación-de-contraseña`](../README.md#probar-el-correo-de-recuperación-de-contraseña).

**Respuesta 200 (siempre la misma):**

```json
{
  "message": "Si el RUT está registrado, recibirás un enlace de recuperación"
}
```

**Rate limit:** 3 intentos por minuto por IP.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Formato inválido. Ej: 12.345.678-5"` | RUT mal escrito |
| 400 | `"RUT inválido — dígito verificador incorrecto"` | DV no coincide |
| 429 | Rate limit | +3 req/min |

---

## 4. Restablecer contrasena (RF-09)

```
POST /api/auth/restablecer-password
```

**Body:**

```json
{
  "token": "eyJhbGciOi...",
  "password": "NuevaClave1"
}
```

El token viene del enlace en el email de recuperacion. Expira en **15 minutos**. Es un JWT de tipo `'reset'`.

Al cambiar la contrasena se invalidan todas las sesiones activas del cliente.

**Respuesta 200:**

```json
{
  "message": "Contraseña restablecida exitosamente"
}
```

**Rate limit:** 3 intentos por minuto por IP.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Token inválido o expirado"` | Token JWT expiro o es invalido |
| 400 | `"Token inválido"` | Token no es de tipo 'reset' o audiencia incorrecta |
| 400 | `"Contraseña debe tener al menos 8 caracteres"` | Muy corta |
| 400 | `"Contraseña debe contener al menos una mayúscula"` | Falta mayuscula |
| 400 | `"Contraseña debe contener al menos un número"` | Falta numero |
| 429 | Rate limit | +3 req/min |

---

## 5. Cerrar sesion (RF-02)

```
POST /api/auth/logout
Authorization: Bearer <token>
```

Requiere autenticacion. Elimina la sesion de la base de datos y limpia la cookie `access_token`.

Si no hay token o el cliente no esta autenticado, igualmente limpia la cookie.

**Respuesta 200:**

```json
{
  "message": "Sesión cerrada exitosamente"
}
```

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` | Sesion inactiva 15 min |
| 401 | `"Unauthorized"` | Token JWT invalido |

---

## 6. Cierre automatico por inactividad (RF-07)

No es un endpoint. Cada request autenticado extiende la sesion 15 minutos (ventana deslizante). Si pasan 15 minutos sin requests, el proximo request recibe:

```
401 — "Sesión expirada por inactividad"
```

El frontend debe capturar este 401 y redirigir a login con un mensaje informativo.

---

## Flujo de ejemplo: Login + obtener token

```javascript
const API_URL = 'http://localhost:4000/api';

// 1. Login
const res = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rut: '12.345.678-5', password: 'MiClave1' }),
});

if (res.status === 401) {
  // Error de credenciales o bloqueo — mostrar mensaje del body
  const { message } = await res.json();
  console.error(message);
  return;
}

const { access_token, cliente } = await res.json();
localStorage.setItem('token', access_token);
```

## Flujo de ejemplo: Recuperar contrasena

```javascript
// 1. Solicitar recuperacion
await fetch(`${API_URL}/auth/recuperar-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rut: '12.345.678-5' }),
});
// Siempre 200 — mostrar mensaje generico al usuario

// 2. El usuario recibe email, hace clic en el link
// El link lleva a: /restablecer-password#token=eyJhbGciOi...

// 3. Restablecer
const token = window.location.hash.replace('#token=', '');
const res = await fetch(`${API_URL}/auth/restablecer-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, password: 'NuevaClave1' }),
});

if (res.ok) {
  // Redirigir a login con mensaje de exito
  window.location.href = '/login?reset=success';
}
```

---

[Siguiente: Perfil](./perfil.md) | [Volver al indice](./api-frontend.md)
