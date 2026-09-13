# Contrataciones — API

Endpoint público del formulario de contratación del sitio (`/contratar/[planId]`, CU-18 y CU-75).

## Solicitar contratación

```
POST /api/contrataciones
```

**Body:**

```json
{
  "id_plan": 1,
  "nombre_completo": "Juan Perez",
  "rut": "12.345.678-5",
  "email": "juan@ejemplo.cl",
  "telefono": "+56 9 1234 5678",
  "direccion_completa": "Av. Siempre Viva 742",
  "comuna": "La Pintana",
  "ciudad": "Santiago",
  "acepta_politica_privacidad": true,
  "version_politica_privacidad": "1.1"
}
```

- `id_plan` es número, no texto. `telefono` y `ciudad` son opcionales (pueden ir `null`).
- `rut` acepta puntos y guion; se guarda limpio.
- **CU-75:** `acepta_politica_privacidad` tiene que venir en `true` y `version_politica_privacidad` es la versión publicada en `/privacidad`.

**Respuesta 201:**

```json
{ "id_cliente": 10, "id_contrato": 20, "id_ot": 30 }
```

Crea en una sola transacción el cliente (estado `pendiente`), su dirección, el contrato (`PENDIENTE`), la orden de instalación, el prospecto y la aceptación de la Política de Privacidad. La aceptación es una fila en `log_auditoria` con `accion = 'ACEPTAR_POLITICA_PRIVACIDAD'`, la IP de origen, `fecha_hora` y los datos enviados en `valor_nuevo`. Si no se puede registrar, no se crea nada.

**Errores:**

| Código | Cuándo |
|---|---|
| 400 | Validación: campos faltantes o inválidos, o `"Debes aceptar la Política de Privacidad para continuar"` |
| 404 | El plan no existe o no está activo |
| 409 | El RUT ya está registrado |
| 429 | Más de 3 solicitudes por minuto desde la misma IP |
