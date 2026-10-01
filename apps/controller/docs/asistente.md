# Asistente virtual — Documentacion para Frontend

Base URL: `http://localhost:4000/api`

**Publico** — no requiere autenticacion. Lo consume el widget de chat
(`apps/view/app/_components/asistente/AsistenteWidget.tsx`), presente en todo
el sitio.

---

## Arquitectura

```
navegador (widget) ──▶ apps/controller  POST /api/asistente/mensajes
                              │  X-Api-Key: CHATBOT_API_KEY
                              ▼
                       finet-chatbot   POST /web/messages ──▶ motor LLM
```

- El navegador nunca habla con finet-chatbot: la API key no puede viajar al
  cliente, y el rate limit por IP vive aca, junto a los visitantes.
- El historial de la conversacion lo guarda finet-chatbot **en memoria** bajo
  `id_sesion` (ultimos 20 turnos). Se pierde si el chatbot se reinicia. Aca no
  se persiste nada todavia; `conversacion_bot` / `mensaje_bot` quedan para
  CU-79.
- Chatwoot se conectara mas adelante directo a finet-chatbot (webhook propio);
  no pasa por este endpoint.

---

## 1. Enviar un mensaje (CU-65)

```
POST /api/asistente/mensajes
```

**Body:**

```json
{
  "id_sesion": "3f6c8a52-7d1e-4b9a-9c2f-5e8d1a0b7c64",
  "mensaje": "¿Que planes tienen?"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id_sesion` | UUID | Si | Sesion anonima del visitante. La genera el widget (`crypto.randomUUID()`) y la guarda en `sessionStorage`. Es la conversacion: mismo id, mismo historial. |
| `mensaje` | string | Si | Se recorta (trim). Entre 1 y 1000 caracteres. |

**Respuesta 200:**

```json
{
  "respuesta": "Tenemos planes de fibra desde 200 Mbps simetricos..."
}
```

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Validation failed"` (+ `errors`) | `id_sesion` no es UUID, o `mensaje` vacio / sobre 1000 caracteres |
| 429 | `"ThrottlerException: Too Many Requests"` | Mas de 10 mensajes por minuto desde la misma IP |
| 503 | `"El asistente no esta disponible en este momento"` | Falta `CHATBOT_URL` / `CHATBOT_API_KEY`, el chatbot no responde (timeout 60 s), responde con error, o responde vacio |

> Si el chatbot falla, no guarda el turno: reenviar el mismo mensaje no lo
> duplica en el historial. El widget aprovecha esto y devuelve el texto al
> input para reintentar.

---

## 2. Configuracion

En `apps/controller/.env`:

```env
CHATBOT_URL="http://localhost:3001"
CHATBOT_API_KEY="<mismo valor que API_KEY en el .env de finet-chatbot>"
```

Para levantarlo en local: finet-chatbot en el puerto 3001 (`PORT=3001` en su
`.env`, el 3000 lo usa Next), con `API_KEY` y las variables `OPENAI_*` del
motor configuradas.
