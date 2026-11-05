# Perfil — Documentacion para Frontend

Base URL: `http://localhost:4000/api`

**Todas las rutas requieren sesion activa.** Enviar `Authorization: Bearer <token>` o confiar en la cookie httpOnly `access_token`.

Si la sesion expira (15 min de inactividad), se recibe `401 "Sesion expirada por inactividad"`. Redirigir a login.

---

## 1. Obtener perfil (CU-07)

```
GET /api/auth/perfil
Authorization: Bearer <token>
```

Devuelve los datos personales del cliente autenticado.

**Respuesta 200:**

```json
{
  "id_cliente": 1,
  "nombre_completo": "Juan Perez",
  "rut": "123456785",
  "email": "juan@test.cl",
  "telefono": "+56912345678",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` | 15 min sin actividad |
| 401 | `"Unauthorized"` | Token JWT invalido |
| 404 | `"Cliente no encontrado"` | Raro si el token es valido |

---

## 2. Actualizar telefono (CU-08)

```
PATCH /api/auth/perfil/telefono
Authorization: Bearer <token>
Content-Type: application/json
```

Requiere la contrasena actual para autorizar el cambio. El cambio queda registrado en el log de auditoria.

**Body:**

```json
{
  "password_actual": "<contraseña actual>",
  "telefono": "+56987654321"
}
```

**Reglas del telefono:**
- 8-20 caracteres
- Formato: digitos, espacios, `+`, `-`, `()`

**Respuesta 200:**

```json
{
  "id_cliente": 1,
  "nombre_completo": "Juan Perez",
  "rut": "123456785",
  "email": "juan@test.cl",
  "telefono": "+56987654321",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"La contraseña actual es requerida"` | Campo vacio |
| 400 | `"El teléfono debe tener al menos 8 caracteres"` | Muy corto |
| 400 | `"Formato de teléfono inválido"` | Formato incorrecto |
| 401 | `"La contraseña actual es incorrecta"` | Password no coincide |
| 401 | `"Sesión expirada por inactividad"` | Sesion inactiva |
| 404 | `"Cliente no encontrado"` | Cliente no existe |

---

## 3. Actualizar correo electronico (CU-09)

```
PATCH /api/auth/perfil/email
Authorization: Bearer <token>
Content-Type: application/json
```

Requiere la contrasena actual para autorizar el cambio. Rechaza si el nuevo email ya esta en uso por otro cliente. El cambio queda registrado en el log de auditoria.

**Body:**

```json
{
  "password_actual": "<contraseña actual>",
  "email": "nuevo@correo.cl"
}
```

**Respuesta 200:**

```json
{
  "id_cliente": 1,
  "nombre_completo": "Juan Perez",
  "rut": "123456785",
  "email": "nuevo@correo.cl",
  "telefono": "+56912345678",
  "fecha_creacion": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"La contraseña actual es requerida"` | Campo vacio |
| 400 | `"El correo electrónico no tiene un formato válido"` | Formato incorrecto |
| 400 | `"El nuevo correo electrónico no puede ser igual al actual"` | Mismo email |
| 400 | `"El correo electronico ya esta registrado por otro usuario"` | Email duplicado |
| 401 | `"La contraseña actual es incorrecta"` | Password no coincide |
| 401 | `"Sesión expirada por inactividad"` | Sesion inactiva |
| 404 | `"Cliente no encontrado"` | Cliente no existe |

---

## 4. Cambiar contrasena (CU-10 / CU-11)

```
PATCH /api/auth/perfil/password
Authorization: Bearer <token>
Content-Type: application/json
```

Requiere la contrasena actual. La nueva contrasena debe cumplir requisitos de complejidad (CU-11). No puede ser igual a la actual. El cambio queda registrado en el log de auditoria (sin almacenar la contrasena).

**Body:**

```json
{
  "password_actual": "<contraseña actual>",
  "password_nuevo": "<contraseña nueva>",
  "password_confirmacion": "<contraseña nueva>"
}
```

**Reglas de la nueva contrasena (CU-11):**

| Regla | Validacion |
|-------|-----------|
| Minimo 8 caracteres | `"Mínimo 8 caracteres"` |
| Al menos 1 mayuscula | `"Debe contener al menos una letra mayúscula"` |
| Al menos 1 numero | `"Debe contener al menos un número"` |
| No igual a la actual | `"La nueva contrasena no puede ser igual a la actual"` |
| Coincidir confirmacion | `"Las contraseñas no coinciden"` |

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
| 400 | `"Debe contener al menos una letra mayúscula"` | Falta mayuscula |
| 400 | `"Debe contener al menos un número"` | Falta numero |
| 400 | `"Las contraseñas no coinciden"` | password_nuevo ≠ password_confirmacion |
| 400 | `"La nueva contrasena no puede ser igual a la actual"` | Misma contrasena |
| 401 | `"La contrasena actual es incorrecta"` | Password actual incorrecta |
| 401 | `"Sesión expirada por inactividad"` | Sesion inactiva |
| 404 | `"Cliente no encontrado"` | Cliente no existe |

---

## Flujo de ejemplo: Cambiar telefono

```javascript
const API_URL = 'http://localhost:4000/api';
const token = localStorage.getItem('token');

const res = await fetch(`${API_URL}/auth/perfil/telefono`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    password_actual: '<contraseña actual>',
    telefono: '+56987654321',
  }),
});

if (res.status === 401) {
  // Sesion expirada o contraseña incorrecta — redirigir segun mensaje
  const { message } = await res.json();
  if (message.includes('inactividad')) {
    window.location.href = '/login?reason=inactivity';
  }
  return;
}

const perfil = await res.json();
console.log('Nuevo telefono:', perfil.telefono);
```

---

[Anterior: Auth](./auth.md) | [Siguiente: Portal](./portal.md) | [Volver al indice](./api-frontend.md)
