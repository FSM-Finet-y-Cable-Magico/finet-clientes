# Deuda Pública — Documentación para Frontend

Base URL: `http://localhost:4000/api`

**Público** — no requiere autenticación. Permite consultar la deuda de un cliente sin iniciar sesión.

---

## 1. Consultar por RUT (CU-39)

Consulta la deuda de un cliente usando su RUT.

```
GET /api/deuda-publica/rut?rut=123456785
```

**Query params:**

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `rut` | string | Sí | RUT sin puntos ni guión (ej: `12345678-5` o `123456785`) |

**Respuesta 200 — Cliente encontrado:**

```json
{
  "encontrado": true,
  "cliente": {
    "nombre_completo": "Juan Perez",
    "rut": "12345678-5",
    "codigo_abonado": null
  },
  "tiene_deuda": true,
  "saldo_total": 39980,
  "facturas": [
    {
      "id_factura": 201,
      "periodo": "Mayo 2026",
      "monto": 19990,
      "fecha_limite_pago": "2026-05-10",
      "estado": "pendiente",
      "dias_vencida": null,
      "dias_para_vencer": 15
    },
    {
      "id_factura": 202,
      "periodo": "Abril 2026",
      "monto": 19990,
      "fecha_limite_pago": "2026-04-10",
      "estado": "vencida",
      "dias_vencida": 45,
      "dias_para_vencer": null
    }
  ]
}
```

> `codigo_abonado` es `null` en consultas por RUT (solo se incluye en consultas por abonado).

> El RUT se busca en sus dos formas, sin guion y con guion (K mayúscula o minúscula). El
> Documento 0 (§11) pide guardarlo sin guion y así lo escribimos, pero la base es compartida y en
> producción hay clientes guardados con guion (G3 contó 14 de 25 el 29-09). Lo mismo hacen el
> login, el registro, la recuperación de contraseña, la contratación y `/api/pagos` (ver
> `variantesRut` en `src/common/utils/rut.ts`).

**Respuesta 200 — No encontrado:**

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

## 2. Consultar por código de abonado (CU-40)

Consulta la deuda de un cliente usando su código de abonado (`id_contrato`).

```
GET /api/deuda-publica/abonado?codigo_abonado=100
```

**Query params:**

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `codigo_abonado` | string | Sí | Código de abonado numérico (máx 20 caracteres) |

**Respuesta 200 — Encontrado:**

```json
{
  "encontrado": true,
  "cliente": {
    "nombre_completo": "Juan Perez",
    "rut": "12345678-5",
    "codigo_abonado": 100
  },
  "tiene_deuda": true,
  "saldo_total": 19990,
  "facturas": [
    {
      "id_factura": 201,
      "periodo": "Mayo 2026",
      "monto": 19990,
      "fecha_limite_pago": "2026-05-10",
      "estado": "pendiente",
      "dias_vencida": null,
      "dias_para_vencer": 15
    }
  ]
}
```

> `codigo_abonado` coincide con el `id_contrato` del sistema.

**Respuesta 200 — No encontrado:**

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

## 3. Detalle de factura (CU-41)

Cada factura en el array `facturas` incluye el siguiente detalle:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_factura` | number | ID de la factura |
| `periodo` | string | Mes y año (ej: `"Mayo 2026"`) |
| `monto` | number | Monto en pesos |
| `fecha_limite_pago` | string | Fecha límite en formato `YYYY-MM-DD` |
| `estado` | string | `"pendiente"` o `"vencida"` |
| `dias_vencida` | number \| null | Días transcurridos desde que venció. `null` si aún no vence |
| `dias_para_vencer` | number \| null | Días restantes para el vencimiento. `null` si ya está vencida |

**Lógica de vencimiento:**
- Si `fecha_limite_pago` es anterior a hoy → `dias_vencida > 0`, `dias_para_vencer = null`
- Si `fecha_limite_pago` es hoy o futura → `dias_vencida = null`, `dias_para_vencer >= 0`

---

## Errores

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"El RUT es requerido"` | Query param `rut` vacío |
| 400 | `"Formato inválido. Ej: 123456785"` | RUT con formato incorrecto |
| 400 | `"RUT inválido — dígito verificador incorrecto"` | DV no coincide |
| 400 | `"El código de abonado es requerido"` | Query param `codigo_abonado` vacío |

---

## Flujo de ejemplo

```javascript
const API_URL = 'http://localhost:4000/api';

// Consultar por RUT
const res = await fetch(
  `${API_URL}/deuda-publica/rut?rut=123456785`
);
const data = await res.json();

if (!data.encontrado) {
  console.log('No se encontraron resultados para este RUT');
  return;
}

if (data.tiene_deuda) {
  console.log(`Saldo total: $${data.saldo_total}`);
  console.log(`Facturas pendientes: ${data.facturas.length}`);
  data.facturas.forEach((f) => {
    const estado = f.dias_vencida
      ? `Vencida hace ${f.dias_vencida} días`
      : `Vence en ${f.dias_para_vencer} días`;
    console.log(`- ${f.periodo}: $${f.monto} (${estado})`);
  });
} else {
  console.log('Cliente sin deuda pendiente');
}

// Consultar por código de abonado
const res2 = await fetch(
  `${API_URL}/deuda-publica/abonado?codigo_abonado=100`
);
const data2 = await res2.json();
```

---

[Volver al índice](./api-frontend.md)
