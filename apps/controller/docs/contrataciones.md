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
{ "id_prospecto": 5 }
```

Crea **solo el prospecto**, en la etapa `NUEVO` del pipeline (§11.10), y la aceptación de la Política de Privacidad a su nombre, en una sola transacción. **No crea cliente, dirección, contrato ni orden de trabajo**: el acuerdo v2.0 con G8 (§4 y prueba §14.1) dice que el formulario público termina en el prospecto, y que el cliente lo crea G8 cuando la instalación de G3 queda completada. El plan de interés no tiene columna en `prospecto`: queda en la auditoría (`CREAR_PROSPECTO_PORTAL`, `valor_nuevo.id_plan`) mientras G8 dice dónde lo quiere. Si el RUT ya es cliente, responde 409 como antes. La aceptación es una fila en `log_auditoria` con `accion = 'ACEPTAR_POLITICA_PRIVACIDAD'`, la IP de origen **anonimizada** (`203.0.113.7` se guarda como `203.0.113.0/24`, ver `common/utils/ip.ts`), `fecha_hora` y los datos enviados en `valor_nuevo`. Si no se puede registrar, no se crea nada.

La anonimización no cambia el contrato de este endpoint ni sus mensajes: solo la precisión de ese dato almacenado. Las IPs de seguridad (`intento_fallido`, `sesion_portal`) siguen exactas a propósito, porque el bloqueo del RF-05 y el desbloqueo del CU-06 comparan una IP exacta. Es una medida provisional; el cifrado real está anotado en [la bitácora del 2026-09-28](../../../docs/2026-09-28-ip-consentimiento-y-legales.md).

**Errores:**

| Código | Cuándo |
|---|---|
| 400 | Validación: campos faltantes o inválidos, o `"Debes aceptar la Política de Privacidad para continuar"` |
| 404 | El plan no existe o no está activo |
| 409 | El RUT ya está registrado |
| 429 | Más de 3 solicitudes por minuto desde la misma IP |
