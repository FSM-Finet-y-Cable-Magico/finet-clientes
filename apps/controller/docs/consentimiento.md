# Consentimiento de cookies — API

Endpoint público del banner de cookies del sitio (CU-76 / RF-57).

## Registrar la decisión

```
POST /api/consentimiento/cookies
```

**Body:**

```json
{
  "acepto": true,
  "version_documento": "1.1"
}
```

- `acepto` cubre las dos opciones del RF-57: **el rechazo también se registra**, porque es la
  prueba de que se preguntó y de qué contestó el visitante.
- `version_documento` es la versión publicada en `/privacidad`, la misma constante que usa el
  CU-75 (`apps/view/app/_lib/legal.ts` → `POLITICA_PRIVACIDAD_VERSION`).

**Respuesta 201:**

```json
{ "registrado": true }
```

Inserta una fila en `consentimiento_cookies`. **Sin cambios de schema**: la tabla ya existe en
la base compartida.

| Columna | Qué guarda |
|---|---|
| `acepto` | La decisión |
| `version_documento` | La versión de la política que el visitante tenía a la vista |
| `fecha_aceptacion` | Cuándo decidió |
| `ip_anonimizada` | La red, no el equipo (`203.0.113.0/24`), vía `common/utils/ip.ts` |
| `id_cliente` | **Siempre null**, a propósito — ver abajo |

**`id_cliente` queda en null.** El CU-76 dice que la preferencia es "una vez por dispositivo o
navegador" y el banner sale en el primer ingreso al sitio, cuando casi nunca hay sesión.
Vincularlo a una persona agregaría un dato personal que ningún flujo necesita.

**Si la inserción falla**, el endpoint responde `{ "registrado": false }` con 201 y deja el
error en el log del backend. No se le corta la navegación al visitante: su preferencia ya vive
en la cookie y el banner no va a volver a salir. Es lo que pide la Excepción 1 del CU-76.

**Errores:**

| Código | Cuándo |
|---|---|
| 400 | `acepto` no es booleano, o falta/viene vacía `version_documento` |
| 429 | Más de 3 solicitudes por minuto desde la misma IP |

## Dónde vive el resto

La cookie cifrada, el banner y la puerta del seguimiento son del frontend:

| Pieza | Archivo |
|---|---|
| Cookie cifrada (JWE A256GCM con `jose`) | `apps/view/app/_lib/cookies-consentimiento.servidor.ts` |
| Contrato compartido y `seguimientoPermitido()` | `apps/view/app/_lib/cookies-consentimiento.ts` |
| Banner | `apps/view/app/_components/legal/BannerCookies.tsx` |
| Server action que guarda y avisa al backend | `apps/view/app/_lib/cookies-actions.ts` |
| Ruta que descifra la decisión para el navegador | `apps/view/app/api/consentimiento-cookies/route.ts` |

Necesita `COOKIE_CONSENTIMIENTO_SECRET` en el entorno del view (ver su `.env.example`).
