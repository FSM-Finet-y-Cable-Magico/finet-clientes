# API del Portal Clientes — Documentación para Frontend

Base URL: `http://localhost:4000/api`

---

## 1. Autenticación

### 1.1 Iniciar sesión (RF-01)

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
    "nombre_completo": "Juan Pérez",
    "email": "juan@test.cl",
    "telefono": "912345678"
  }
}
```

El backend también setea una cookie `access_token` httpOnly (7 días). Para llamadas autenticadas, enviar el header `Authorization: Bearer <token>` o confiar en la cookie.

**Errores:**
| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Formato inválido. Ej: 12.345.678-5"` | RUT mal escrito |
| 400 | `"RUT inválido — dígito verificador incorrecto"` | DV no coincide |
| 401 | `"IP bloqueada temporalmente"` | 5 intentos desde misma IP en 5 min |
| 401 | `"RUT bloqueado temporalmente"` | 5 intentos contra ese RUT en 10 min |
| 401 | `"RUT o contraseña incorrectos"` | Credenciales inválidas o cuenta no activa |
| 429 | `"ThrottlerException: Too Many Requests"` | +5 req/min |

> **Importante:** El error 401 por credenciales incorrectas no distingue entre RUT inexistente, cuenta no activa, y contraseña errónea — siempre dice `"RUT o contraseña incorrectos"`.

---

### 1.2 Registrar cuenta nueva (RF-10)

```
POST /api/auth/register
```

**Body:**
```json
{
  "rut": "12.345.678-5",
  "nombre_completo": "Juan Pérez",
  "email": "juan@ejemplo.cl",
  "telefono": "912345678",
  "password": "Clave123",
  "password_confirmation": "Clave123"
}
```

`telefono` es opcional (puede omitirse o enviarse como `""`).

**Reglas de contraseña:**
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 número
- Máximo 72 caracteres

**Respuesta 201:**
```json
{
  "access_token": "eyJhbGciOi...",
  "cliente": {
    "id": 2,
    "rut": "123456785",
    "nombre_completo": "Juan Pérez",
    "email": "juan@ejemplo.cl",
    "telefono": "912345678"
  }
}
```

**Errores:**
| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Email es requerido"` | Campo vacío |
| 400 | `"Email inválido"` | Formato incorrecto |
| 400 | `"Contraseña debe tener al menos 8 caracteres"` | Muy corta |
| 400 | `"Contraseña debe contener al menos una mayúscula"` | Falta mayúscula |
| 400 | `"Contraseña debe contener al menos un número"` | Falta número |
| 400 | `"Las contraseñas no coinciden"` | password ≠ password_confirmation |
| 409 | `"No se pudo completar el registro"` | RUT o email duplicado |
| 429 | Rate limit | +3 req/min |

---

### 1.3 Recuperar contraseña (RF-03)

```
POST /api/auth/recuperar-password
```

**Body:**
```json
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

> El sistema nunca revela si el RUT existe. Si existe y tiene email, se envía el enlace por correo. Si no tiene email o no existe, igual responde con este mensaje genérico.

---

### 1.4 Restablecer contraseña (RF-09)

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

El token viene del enlace en el email de recuperación. Expira en **15 minutos**.

**Respuesta 200:**
```json
{
  "message": "Contraseña restablecida exitosamente"
}
```

Efectos: actualiza la contraseña, invalida todas las sesiones activas del cliente, envía email de confirmación.

**Errores:**
| HTTP | Mensaje |
|------|---------|
| 400 | `"Token inválido o expirado"` |
| 400 | `"Token inválido"` (no es de tipo reset) |

---

### 1.5 Cerrar sesión (RF-02)

```
POST /api/auth/logout
Authorization: Bearer <token>
```

**Respuesta 200:**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

Limpia la cookie `access_token` y borra la sesión de la base de datos.

**Errores:**
| HTTP | Mensaje |
|------|---------|
| 401 | `"Sesión expirada por inactividad"` |
| 401 | `"Unauthorized"` (JWT inválido) |

---

### 1.6 Cierre automático por inactividad (RF-07)

No es un endpoint. Cada request autenticado extiende la sesión 15 minutos (ventana deslizante). Si pasan 15 minutos sin requests, el próximo request recibe:

```
401 — "Sesión expirada por inactividad"
```

El frontend debe capturar este 401 y redirigir a login con un mensaje informativo.

---

### 1.7 Obtener perfil (CU-07)

```
GET /api/auth/perfil
Authorization: Bearer <token>
```

**Respuesta 200:**
```json
{
  "id_cliente": 1,
  "nombre_completo": "Juan Pérez",
  "rut": "123456785",
  "email": "juan@test.cl",
  "telefono": "+56912345678",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

---

### 1.8 Actualizar teléfono (CU-08)

```
PATCH /api/auth/perfil/telefono
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "password_actual": "MiClave1",
  "telefono": "+56987654321"
}
```

Se requiere la contraseña actual para autorizar el cambio. El cambio queda registrado en el log de auditoría.

**Respuesta 200:**
```json
{
  "id_cliente": 1,
  "nombre_completo": "Juan Pérez",
  "rut": "123456785",
  "email": "juan@test.cl",
  "telefono": "+56987654321",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"La contraseña actual es requerida"` | Campo vacío |
| 400 | `"El teléfono debe tener al menos 8 caracteres"` | Muy corto |
| 400 | `"Formato de teléfono inválido"` | Formato incorrecto |
| 401 | `"La contraseña actual es incorrecta"` | Password no coincide |
| 401 | `"Sesión expirada por inactividad"` | Sesión inactiva |

---

### 1.9 Actualizar correo electrónico (CU-09)

```
PATCH /api/auth/perfil/email
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "password_actual": "MiClave1",
  "email": "nuevo@correo.cl"
}
```

Se requiere la contraseña actual para autorizar el cambio. Si el nuevo email ya está en uso por otro cliente se rechaza. El cambio queda registrado en el log de auditoría.

**Respuesta 200:**
```json
{
  "id_cliente": 1,
  "nombre_completo": "Juan Pérez",
  "rut": "123456785",
  "email": "nuevo@correo.cl",
  "telefono": "+56912345678",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"La contraseña actual es requerida"` | Campo vacío |
| 400 | `"El correo electrónico no tiene un formato válido"` | Formato incorrecto |
| 400 | `"El nuevo correo electrónico no puede ser igual al actual"` | Mismo email |
| 400 | `"El correo electronico ya esta registrado por otro usuario"` | Email duplicado |
| 401 | `"La contraseña actual es incorrecta"` | Password no coincide |
| 401 | `"Sesión expirada por inactividad"` | Sesión inactiva |

---

### 1.10 Cambiar contraseña (CU-10 / CU-11)

```
PATCH /api/auth/perfil/password
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "password_actual": "MiClave1",
  "password_nuevo": "NuevaClave2!",
  "password_confirmacion": "NuevaClave2!"
}
```

**Reglas de contraseña nueva (CU-11):**
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 número
- No puede ser igual a la actual
- Debe coincidir con `password_confirmacion`

El cambio queda registrado en el log de auditoría (sin almacenar la contraseña).

**Respuesta 200:**
```json
{
  "mensaje": "Contrasena actualizada correctamente"
}
```

**Errores:**
| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Mínimo 8 caracteres"` | Muy corta |
| 400 | `"Debe contener al menos una letra mayúscula"` | Falta mayúscula |
| 400 | `"Debe contener al menos un número"` | Falta número |
| 400 | `"Las contraseñas no coinciden"` | password_nuevo ≠ password_confirmacion |
| 400 | `"La nueva contrasena no puede ser igual a la actual"` | Misma contraseña |
| 401 | `"La contrasena actual es incorrecta"` | Password actual incorrecta |
| 401 | `"Sesión expirada por inactividad"` | Sesión inactiva |

---

## 2. Portal Cliente (panel autenticado)

Todos los endpoints requieren `Authorization: Bearer <token>`.

### 2.1 Panel principal (CU-24)

```
GET /api/portal/panel
Authorization: Bearer <token>
```

**Respuesta 200:**
```json
{
  "cliente": {
    "id_cliente": 1,
    "nombre_completo": "Juan Pérez",
    "rut": "123456785",
    "email": "juan@test.cl",
    "telefono": "912345678"
  },
  "contratos": [
    {
      "id_contrato": 100,
      "estado": "activo",
      "fecha_inicio": "2025-01-15T00:00:00.000Z",
      "dia_vencimiento": 10,
      "plan": {
        "id_plan": 5,
        "nombre_comercial": "Fibra 600 Megas",
        "tipo_plan": "fibra",
        "velocidad_mbps": 600,
        "precio_mensual": 19990
      }
    }
  ],
  "resumen_deuda": {
    "tiene_deuda": false,
    "saldo_total": 0,
    "facturas_pendientes": []
  },
  "tickets_recientes": [
    {
      "id_ticket": 42,
      "codigo_seguimiento": "FIN-0042",
      "estado": "abierto",
      "prioridad": "media",
      "descripcion": "Internet lento por las tardes",
      "fecha_creacion": "2026-05-20T14:30:00.000Z",
      "fecha_cierre": null,
      "categoria": "Soporte Técnico",
      "origen": "portal"
    }
  ]
}
```

---

### 2.2 Estado operativo de contratos (CU-23)

```
GET /api/portal/contratos/estado
Authorization: Bearer <token>
```

**Respuesta 200:**
```json
[
  {
    "id_contrato": 100,
    "estado": "activo",
    "fecha_inicio": "2025-01-15T00:00:00.000Z",
    "fecha_suspension": null
  },
  {
    "id_contrato": 101,
    "estado": "suspendido",
    "fecha_inicio": "2025-06-01T00:00:00.000Z",
    "fecha_suspension": "2026-04-15T00:00:00.000Z"
  }
]
```

Estados posibles: `"activo"`, `"suspendido"`, `"cortado"`, `"inactivo"`.

---

### 2.3 Planes vigentes (CU-25 / CU-26)

```
GET /api/portal/contratos/vigentes
Authorization: Bearer <token>
```

**Respuesta 200:** Misma estructura que `contratos` en el panel. Incluye `plan` con detalles comerciales.

Si hay 1 contrato → vista de plan único (CU-25). Si hay varios → vista de múltiples planes (CU-26). El frontend decide la vista según `contratos.length`.

**Errores:**
| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` / `"Unauthorized"` | Sesion o token (CU-26 Excepción 1) |
| 500 | `"No fue posible obtener la informacion de planes en este momento"` | Error al recuperar planes vigentes (CU-26 Excepción 2) |

---

### 2.4 Estado de deuda (CU-27 / CU-28)

```
GET /api/portal/deuda
Authorization: Bearer <token>
```

**Respuesta 200 (sin deuda — CU-27):**
```json
{
  "tiene_deuda": false,
  "saldo_total": 0,
  "facturas_pendientes": []
}
```

**Respuesta 200 (con deuda — CU-28):**
```json
{
  "tiene_deuda": true,
  "saldo_total": 59880,
  "facturas_pendientes": [
    {
      "id_factura": 201,
      "periodo": "Mayo 2026",
      "monto": 19990,
      "fecha_limite_pago": "2026-05-10T00:00:00.000Z",
      "estado": "pendiente",
      "dias_vencida": 22
    },
    {
      "id_factura": 202,
      "periodo": "Abril 2026",
      "monto": 19990,
      "fecha_limite_pago": "2026-04-10T00:00:00.000Z",
      "estado": "vencida",
      "dias_vencida": 52
    }
  ]
}
```

`dias_vencida` es `null` si la factura aún no ha vencido.

---

### 2.5 Tickets de soporte (CU-29 / CU-30)

```
GET /api/portal/tickets?limite=3
Authorization: Bearer <token>
```

`limite` es opcional. Si se omite, devuelve todos los tickets.

**Respuesta 200:**
```json
{
  "total": 5,
  "tiene_tickets": true,
  "tickets": [
    {
      "id_ticket": 42,
      "codigo_seguimiento": "FIN-0042",
      "estado": "abierto",
      "prioridad": "media",
      "descripcion": "Internet lento",
      "fecha_creacion": "2026-05-20T14:30:00.000Z",
      "fecha_cierre": null,
      "categoria": "Soporte Técnico",
      "origen": "portal"
    }
  ]
}
```

Si `tiene_tickets: false` → vista de estado vacío (CU-29). Si `true` → historial completo (CU-30).

---

## 3. Landing Page (público)

Endpoints públicos para la landing page, no requieren autenticación.

### 3.1 Catálogo de planes (CU-15 / CU-17)

CU-15: filtrar por segmento. CU-17: detalles técnicos y comerciales de cada plan.

```
GET /api/landing/planes
GET /api/landing/planes?tipo_cliente=residencial
```

Filtro opcional `tipo_cliente`. Devuelve planes activos ordenados por precio. Cada plan incluye `nombre_comercial`, `velocidad_mbps`, `precio_mensual` y `descripcion` (características) para mostrar en las tarjetas.

**Respuesta 200:**
```json
[
  {
    "id_plan": 1,
    "nombre_comercial": "Fibra 100 Megas",
    "tipo_plan": "fibra",
    "tipo_cliente": "residencial",
    "velocidad_mbps": 100,
    "precio_mensual": 14990,
    "descripcion": "Internet fibra optica 100 Mbps"
  }
]
```

> [Documentacion detallada](./landing.md)

---

## 4. Consulta de deuda pública (sin sesión)

Endpoints públicos, no requieren autenticación.

> [Documentación detallada](./deuda-publica.md)

### 4.1 Consultar por RUT (CU-39)

```
GET /api/deuda-publica/rut?rut=12.345.678-9
```

Formatos de RUT aceptados: `12.345.678-9` o `12345678-9`.

**Respuesta 200 (cliente encontrado):**
```json
{
  "encontrado": true,
  "cliente": {
    "nombre_completo": "Juan Pérez",
    "rut": "12345678-9",
    "codigo_abonado": 100
  },
  "tiene_deuda": true,
  "saldo_total": 39980,
  "facturas": [
    {
      "id_factura": 201,
      "periodo": "Mayo 2026",
      "monto": 19990,
      "fecha_limite_pago": "2026-05-10T00:00:00.000Z",
      "estado": "pendiente",
      "dias_vencida": 22,
      "dias_para_vencer": null
    }
  ]
}
```

**Respuesta 200 (no encontrado):**
```json
{
  "encontrado": false,
  "cliente": null,
  "tiene_deuda": false,
  "saldo_total": 0,
  "facturas": []
}
```

---

### 4.2 Consultar por código de abonado (CU-40)

```
GET /api/deuda-publica/abonado?codigo_abonado=100
```

**Respuesta 200:** Misma estructura que consulta por RUT.
## 6. Mecanismos de autenticación

| Tipo | Cómo se envía | Dónde se usa |
|------|---------------|--------------|
| **Público** | Sin auth | Login, register, recuperación, deuda pública, landing |
| **JWT** | Header `Authorization: Bearer <token>` o cookie `access_token` | Portal, perfil, logout |

---

## 7. Manejo de errores general

Todas las respuestas de error siguen este formato:

```json
{
  "statusCode": 401,
  "message": "Sesión expirada por inactividad"
}
```

### Códigos frecuentes:

| HTTP | Cuándo ocurre |
|------|---------------|
| 400 | Validación fallida (Zod). Revisar `message` para el campo específico. |
| 401 | No autenticado, token expirado, sesión inactiva, IP/RUT bloqueado, o cuenta no activa. Redirigir a login. |
| 409 | Conflicto (registro duplicado). |
| 429 | Rate limit excedido. Esperar y reintentar. |
| 500 | `"Error interno del servidor"` — error inesperado. Contactar soporte. |

### Regla de oro para el frontend:

**Si recibís 401 con `"Sesión expirada por inactividad"`** → redirigir a login con mensaje "Tu sesión se cerró por inactividad".

**Si recibís 401 con `"Unauthorized"`** → el token JWT es inválido. Limpiar token local, redirigir a login.

**Si recibís 401 en `/api/auth/login`** → no es error de sesión, es error de credenciales. Mostrar el mensaje del body.

---

## 8. Variables de entorno para el frontend

```env
VITE_API_URL=http://localhost:4000/api
```

> El backend ya configura CORS para los orígenes definidos en `CORS_ORIGIN`. Asegurate de que la URL del frontend esté en esa lista.

---

## 9. Flujos completos de ejemplo

### Flujo de login + panel

```javascript
// 1. Login
const loginRes = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rut: '12.345.678-5', password: 'MiClave1' }),
});
const { access_token, cliente } = await loginRes.json();

// 2. Guardar token (localStorage o cookie ya seteada)
localStorage.setItem('token', access_token);

// 3. Cargar panel
const panelRes = await fetch(`${API_URL}/portal/panel`, {
  headers: { Authorization: `Bearer ${access_token}` },
});
const panel = await panelRes.json();

// 4. Si 401 "Sesión expirada" → redirigir a login
if (panelRes.status === 401) {
  localStorage.removeItem('token');
  window.location.href = '/login?reason=inactivity';
}
```

### Flujo de recuperación de contraseña

```javascript
// 1. Solicitar recuperación
await fetch(`${API_URL}/auth/recuperar-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rut: '12.345.678-5' }),
});
// Siempre responde 200 con mensaje genérico

// 2. El usuario recibe email, hace clic en el link
// El link lleva a: /restablecer-password#token=eyJhbGciOi...

// 3. Restablecer contraseña
const resetRes = await fetch(`${API_URL}/auth/restablecer-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: window.location.hash.replace('#token=', ''),
    password: 'NuevaClave1',
  }),
});
// Si 200 → mostrar "Contraseña actualizada" y redirigir a login
```
