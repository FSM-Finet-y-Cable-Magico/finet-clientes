# Portal Cliente — Documentacion para Frontend

Base URL: `http://localhost:4000/api`

**Todas las rutas requieren sesion activa.** Enviar `Authorization: Bearer <token>` o confiar en la cookie httpOnly `access_token`.

**Sesion:** ventana deslizante de 15 minutos. Cada request extiende el timeout. Si expira → `401 "Sesion expirada por inactividad"`.

---

## 1. Panel principal (CU-24)

Dashboard unificado que devuelve cliente, contratos vigentes, deuda y los ultimos 3 tickets en una sola llamada.

```
GET /api/portal/panel
Authorization: Bearer <token>
```

**Respuesta 200:**

```json
{
  "cliente": {
    "id_cliente": 1,
    "nombre_completo": "Juan Perez",
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
      "categoria": "Soporte Tecnico",
      "origen": "portal"
    }
  ]
}
```

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` / `"Unauthorized"` | Sesion o token (CU-26 Excepción 1) |
| 500 | `"No fue posible obtener la informacion de planes en este momento"` | Error al recuperar planes (CU-26 Excepción 2) |
| 404 | `"No se encontraron contratos para este cliente"` | Sin contratos |

---

## 2. Estado de contratos (CU-23)

Devuelve el estado operativo de todos los contratos del cliente.

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
    "fecha_inicio": "2025-01-15",
    "fecha_suspension": null
  },
  {
    "id_contrato": 101,
    "estado": "suspendido",
    "fecha_inicio": "2025-06-01",
    "fecha_suspension": "2026-04-15"
  }
]
```

Estados posibles: `"activo"`, `"suspendido"`, `"cortado"`, `"inactivo"`. `fecha_suspension` es `null` si el contrato no ha sido suspendido.

`fecha_inicio` y `fecha_suspension` se devuelven como strings `YYYY-MM-DD`.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` / `"Unauthorized"` | Sesión o token |

---

## 3. Planes vigentes (CU-25 / CU-26)

Devuelve los contratos activos o suspendidos con su plan comercial asociado.

```
GET /api/portal/contratos/vigentes
Authorization: Bearer <token>
```

**Logica de vistas:**
- 1 contrato → CU-25: vista de plan unico
- 2+ contratos → CU-26: vista de multiples planes

El frontend decide cual mostrar segun `contratos.length`.

**Respuesta 200:**

```json
[
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
]
```

> `plan` es `null` si el contrato no tiene plan asociado.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` / `"Unauthorized"` | Sesion o token |

---

## 4. Estado de deuda (CU-27 / CU-28)

Consulta las facturas pendientes y vencidas de todos los contratos del cliente.

```
GET /api/portal/deuda
Authorization: Bearer <token>
```

**Logica de vistas:**
- `tiene_deuda: false` → CU-27: cuenta al dia (sin mostrar detalle)
- `tiene_deuda: true` → CU-28: mostrar saldo total y listado de facturas

**Respuesta 200 — Sin deuda (CU-27):**

```json
{
  "tiene_deuda": false,
  "saldo_total": 0,
  "facturas_pendientes": []
}
```

**Respuesta 200 — Con deuda (CU-28):**

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

`dias_vencida` es `null` si la factura aun no ha vencido. `estado` puede ser `"pendiente"` o `"vencida"`.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` / `"Unauthorized"` | Sesion o token |
| 500 | `"Saldo inconsistente. Contacte al administrador."` | Saldo negativo |

---

## 5. Tickets de soporte (CU-29 / CU-30)

Devuelve el historial de tickets del cliente, ordenados del mas reciente al mas antiguo.

```
GET /api/portal/tickets?limite=3
Authorization: Bearer <token>
```

**Query params:**

| Param | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `limite` | number | No | Cantidad maxima de tickets a devolver. Si se omite, trae todos. |

**Logica de vistas:**
- `tiene_tickets: false` → CU-29: estado vacio ("No tienes tickets")
- `tiene_tickets: true` → CU-30: historial completo con codigo de seguimiento

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
      "categoria": "Soporte Tecnico",
      "origen": "portal"
    }
  ]
}
```

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 401 | `"Sesión expirada por inactividad"` / `"Unauthorized"` | Sesion o token |

---

## 6. Cambio de clave WiFi (CU-31 / CU-32)

El cliente pide cambiar la clave de su red WiFi. El portal **no** la cambia: deja registrada la solicitud, y aplicarla es el CU-33, de Grupo 3.

```
POST /api/portal/wifi/password
Authorization: Bearer <token>
Content-Type: application/json

{ "id_contrato": 1, "password": "<clave nueva>" }
```

**Validación (CU-31):** de 8 a 63 caracteres, sin espacios en blanco. Se permiten símbolos: es una decisión del equipo que difiere del RF-24 escrito.

**Respuesta 201:**

```json
{
  "id_solicitud": 7,
  "id_contrato": 1,
  "estado": "PENDIENTE",
  "fecha_solicitud": "2026-10-01T21:11:14.370Z"
}
```

La vista solo muestra "Solicitud registrada" (poscondición del CU-32). Nunca dice que la clave ya cambió.

**Errores:**

| HTTP | Causa |
|------|-------|
| 400 | La clave no cumple el formato (CU-32 Excepción 3) |
| 401 | Sesión expirada (CU-32 Excepción 1) |
| 404 | El servicio no es del cliente o no existe |
| 409 | El servicio no está activo (CU-32 Excepción 2) |
| 503 | No se pudo registrar la solicitud |

**Dos flujos.** Cuál corre lo decide `TICKET_WIFI_DEFINIDO` en `src/common/pendientes.ts`:

- **v1 (hoy):** la solicitud queda en `solicitud_contrasena_wifi`, con la clave cifrada con la llave pública del CRM (`CRM_PUBLIC_KEY`). El acuerdo v2.0 con G8 permite conservarlo mientras tanto (§6.7).
- **v2 (acuerdo v2.0, §6.4):** se activa cuando G8 defina el ticket WiFi, es decir, la categoría y dónde va el servicio. El flujo es:
  1. el portal crea el ticket;
  2. guarda `request_id` y `trace_id` en `log_auditoria`;
  3. cifra la clave con la llave pública de G3;
  4. la manda directo a G3 (`src/common/g3/`). Si hay un corte, reintenta con el mismo body.

  La clave no se guarda en ninguna parte, y G8 no recibe ni la clave ni el ciphertext (§6.5). En el v2, `id_solicitud`, `estado` y `fecha_solicitud` son los que devuelve G3.

  Necesita `G3_API_URL`, `G3_API_KEY` y `G3_WIFI_PUBLIC_KEY` (ver `.env.example`). Si falta alguna, responde 503 y no simula nada.

---

## Flujo de ejemplo: Cargar panel completo

```javascript
const API_URL = 'http://localhost:4000/api';
const token = localStorage.getItem('token');

async function cargarPanel() {
  const res = await fetch(`${API_URL}/portal/panel`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    const { message } = await res.json();
    if (message.includes('inactividad')) {
      window.location.href = '/login?reason=inactivity';
    }
    localStorage.removeItem('token');
    return null;
  }

  const panel = await res.json();

  // Determinar vistas segun datos
  const vistaPlan = panel.contratos.length === 1 ? 'plan-unico' : 'multiples-planes';
  const vistaDeuda = panel.resumen_deuda.tiene_deuda ? 'con-deuda' : 'al-dia';
  const vistaTickets = panel.tickets_recientes.length > 0 ? 'historial' : 'vacio';

  return { ...panel, vistaPlan, vistaDeuda, vistaTickets };
}

const panel = await cargarPanel();
```

---

[Anterior: Perfil](./perfil.md) | [Volver al indice](./api-frontend.md)
