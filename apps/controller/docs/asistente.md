# Asistente virtual — Documentacion para Frontend

Base URL: `http://localhost:4000/api`

Dos endpoints:

- `POST /asistente/mensajes` — **publico**. Lo consume el widget de chat
  (`apps/view/app/_components/asistente/AsistenteWidget.tsx`), presente en
  todo el sitio.
- `POST /asistente/clientes/identificar` — **interno**. Solo lo llama
  finet-chatbot, con API key, para verificar RUTs (CU-63).

---

## Arquitectura

```
navegador (widget) ──▶ apps/controller  POST /api/asistente/mensajes
                              │  X-Api-Key: CHATBOT_API_KEY
                              ▼
                       finet-chatbot   POST /web/messages ──▶ motor LLM
                              │  X-Api-Key: ASISTENTE_API_KEY
                              ▼
       apps/controller  POST /api/asistente/clientes/identificar ──▶ tabla cliente
```

- El navegador nunca habla con finet-chatbot: la API key no puede viajar al
  cliente, y el rate limit por IP vive aca, junto a los visitantes.
- La identificacion por RUT (CU-63) la maneja finet-chatbot y no el widget:
  el mismo flujo tiene que funcionar en WhatsApp (via Chatwoot), donde los
  mensajes no pasan por este backend. Por eso es solo texto, sin botones.
- El historial y la identificacion los guarda finet-chatbot **en memoria**
  bajo `id_sesion` (ultimos 20 turnos). Se pierden si el chatbot se reinicia.
  Aca no se persiste nada todavia; `conversacion_bot` / `mensaje_bot` quedan
  para CU-79.

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
| `id_sesion` | UUID | Si | Sesion anonima del visitante. La genera el widget (`crypto.randomUUID()`) y la guarda en `localStorage`. Es la conversacion: mismo id, mismo historial y misma identificacion. |
| `mensaje` | string | Si | Se recorta (trim). Entre 1 y 1000 caracteres. |

**Respuesta 200:**

```json
{
  "respuesta": "Tenemos planes de fibra desde 200 Mbps simetricos...",
  "derivado": false
}
```

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `respuesta` | string \| null | Texto del asistente. `null` solo cuando `derivado` es `true` y la conversacion ya habia terminado. |
| `derivado` | boolean | El asistente derivo al cliente a una persona por WhatsApp y no responde mas en esta sesion. Ver [Derivacion a una persona](#derivacion-a-una-persona). |

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Validation failed"` (+ `errors`) | `id_sesion` no es UUID, o `mensaje` vacio / sobre 1000 caracteres |
| 429 | `"ThrottlerException: Too Many Requests"` | Mas de 10 mensajes por minuto desde la misma IP |
| 503 | `"El asistente no esta disponible en este momento"` | Falta `CHATBOT_URL` / `CHATBOT_API_KEY`, el chatbot no responde (timeout 60 s), responde con error, o responde vacio |

> **CU-65, excepcion 1.** Si el motor del chatbot falla o no termina dentro de
> su plazo (`REPLY_TIMEOUT_MS` en finet-chatbot, 45 s), el chatbot no responde
> 503: deriva la conversacion con un texto fijo ("No pude responder en este
> momento. Una persona de nuestro equipo puede atenderte por WhatsApp al…") y
> `derivado: true`. Si el que no responde es el chatbot mismo (caido, o pasados
> los 60 s de aca), este endpoint responde 503 y el widget muestra ese mismo
> texto y termina la conversacion. El CU pide decir que "un agente humano
> tomara su caso en breve", pero todavia no hay agentes detras del asistente
> (CU-70): el texto dice lo que si existe.
>
> Ante un 429 o un 400 el widget devuelve el mensaje al input para reenviarlo:
> el chatbot no lo recibio, asi que no queda duplicado.

### Derivacion a una persona

Cuando el cliente pide hablar con una persona, o acepta que el asistente lo
derive, finet-chatbot responde con un texto fijo que recomienda escribir por
WhatsApp al numero configurado (`WHATSAPP_NUMBER` en finet-chatbot) y marca la
conversacion como derivada. Desde ahi no contesta ni registra los mensajes de
esa sesion.

1. La respuesta que deriva llega con el texto y `derivado: true`.
2. El widget muestra ese texto, quita la entrada de texto y muestra "Esta
   conversacion termino" con un boton **Iniciar nueva conversacion**. El estado
   se guarda en `localStorage`, asi que sigue terminada si se recarga la
   pagina.
3. El boton limpia el chat y genera un `id_sesion` nuevo. Para finet-chatbot
   es otra conversacion, asi que vuelve a responder empezando por el pedido de
   RUT.
4. Si llega un mensaje a una sesion ya derivada (por ejemplo, si se perdio el
   `localStorage`), la respuesta es `respuesta: null, derivado: true`. El
   widget no muestra ese mensaje, porque el chatbot lo descarto, y pasa
   directo al estado terminado.

### Saldo y facturas (CU-64)

El asistente no tiene un endpoint propio para esto: reutiliza la consulta
publica de deuda, `GET /api/deuda-publica/rut` (CU-39), con el RUT que guardo
al identificar al cliente. La consulta se hace cada vez que el cliente
pregunta por su saldo, sus facturas o sus vencimientos.

- **Estado que se informa: el de las facturas** (`pendiente` o `vencida`, con
  dias de atraso o para vencer). La consulta publica no trae el estado del
  contrato, y el estado del equipo depende de SmartOLT (G3).
- **Limite de peticiones propio.** Todas las consultas del asistente salen de
  la IP de finet-chatbot, y el limite global (10 por minuto por IP) alcanzaria
  para todos los clientes del chat juntos. Por eso una peticion con la clave
  del chatbot en `X-API-Key` (`ASISTENTE_API_KEY`) tiene un limite de 600 por
  minuto: alto, pero no infinito, por si la clave se filtra. Vale para
  cualquier ruta con el limite global; las que tienen `@Throttle` propio, como
  `/asistente/mensajes`, siguen con el suyo. Ver `src/asistente/limite-chatbot.ts`.
- **Excepcion 1:** si esta API no responde, no encuentra al cliente
  (`encontrado: false`) o no pudo leer las facturas (`detalle_disponible:
  false`), el asistente responde con un texto fijo: "No fue posible recuperar
  tu informacion en este momento…", y sugiere intentarlo mas tarde o escribir
  a soporte por WhatsApp. Si `informacion_completa` es `false` (excepcion 2
  del CU-41), avisa que el detalle puede no ser exacto.
- **Al LLM solo llegan montos, fechas y estados.** El nombre y el RUT que
  trae la respuesta no se le envian.
- **Poscondicion:** la respuesta queda en el historial de la sesion, en
  memoria del chatbot. El registro persistente es CU-79.
- **El RUT viaja en la query**, como en la consulta del sitio, y puede quedar
  en logs de acceso. Se acepto para no agregar otro endpoint.

### Flujo de la conversacion (CU-63)

1. Primer mensaje de una conversacion: el asistente responde pidiendo el RUT
   y avisa que se puede seguir sin darlo.
2. El cliente responde con su RUT (con o sin puntos y guion):
   - Si esta en los registros, el asistente lo saluda por su nombre y responde
     con sus planes y el estado de sus contratos.
   - Si no esta, o el sistema no responde: "No pude verificar tu identidad con
     ese RUT, asi que seguire ayudandote con consultas generales."
3. Si responde otra cosa, sigue en modo general (solo consultas generales).
   Puede dar su RUT mas adelante.
4. Tras 48 h sin actividad la conversacion empieza de nuevo y se vuelve a
   pedir el RUT. El widget borra su copia local con el mismo plazo.

El widget no hace nada especial: el pedido de RUT y los avisos llegan como
cualquier otra `respuesta`.

### Trazabilidad del CU-63 — Solicitando RUT al inicio de la conversacion

| Elemento del CU | Como se cumple | Donde |
|---|---|---|
| **Frecuencia:** conversacion nueva o mas de 48 h desde la ultima interaccion | Una conversacion sin actividad por mas de 48 h se descarta y la siguiente empieza de cero. El widget borra su copia local con el mismo plazo. | finet-chatbot `src/chat/conversation.store.ts` (`IDLE_LIMIT_MS`); widget `AsistenteWidget.tsx` (`LIMITE_INACTIVIDAD_MS`) |
| **Precondicion:** sin sesion activa identificada | Cada conversacion tiene un estado de identidad (`new`, `awaiting_rut`, `anonymous`, `identified`); solo se pide el RUT en una conversacion `new`. | finet-chatbot `src/chat/conversation.store.ts` (`Identity`) |
| **Descripcion:** el cliente envia el primer mensaje y el sistema solicita el RUT | El primer mensaje recibe un texto fijo (no lo genera el LLM, para que no se omita). Si el primer mensaje ya trae el RUT, se verifica directo. | finet-chatbot `src/messages/messages.service.ts` (`respond`), `src/messages/identity.texts.ts` (`RUT_REQUEST`) |
| **Descripcion:** el cliente ingresa su RUT | Se reconoce el RUT escrito de cualquier forma habitual y se valida el digito verificador. | finet-chatbot `src/customers/rut.ts` (`extractRut`) |
| **Descripcion:** el sistema consulta los registros | finet-chatbot llama a `POST /asistente/clientes/identificar`, que busca en la tabla `cliente`. | finet-chatbot `src/customers/customers.service.ts`; aca `src/asistente/asistente-clientes.service.ts` |
| **Descripcion:** activa las respuestas personalizadas | El LLM recibe nombre y planes (con estado del contrato) del cliente en cada turno. | finet-chatbot `src/messages/identity.texts.ts` (`identifiedContext`) |
| **Excepcion 1:** RUT no encontrado o el sistema no responde | Aviso fijo "No pude verificar tu identidad con ese RUT…" y modo general. Se trata igual un RUT inexistente, un error de base de datos, un timeout (5 s) o la falta de configuracion. | finet-chatbot `src/messages/identity.texts.ts` (`RUT_NOT_VERIFIED`, `anonymousContext`) |
| **Poscondicion:** cliente identificado en la sesion, o modo general | La identidad queda guardada con la conversacion hasta que expire (48 h sin actividad) o se reinicie el chatbot. | finet-chatbot `src/chat/conversation.store.ts` |
| **Dependencia:** RF-45 | El texto de RF-45 no esta en el repo (ver [CASOS-DE-USO](../../../docs/CASOS-DE-USO.md#requisitos-funcionales-rf)). | — |

### Decisiones que el CU no definia

- **Solo texto, sin botones.** El mismo flujo se va a usar en WhatsApp via
  Chatwoot, donde no hay botones. Por eso la logica vive en finet-chatbot y no
  en el widget.
- **Se puede seguir sin RUT.** El CU no lo contempla, pero muchos visitantes no
  son clientes y preguntan por planes. Responder cualquier otra cosa al pedido
  de RUT pasa a modo general, y el RUT se puede dar mas adelante.
- **Datos que recibe el asistente: nombre y planes al identificar.** El saldo
  y las facturas los consulta aparte, cuando el cliente pregunta (CU-64).
  Todo lo que recibe el asistente viaja al proveedor del LLM.
- **Se pide el RUT aunque el cliente tenga sesion en el portal.** La sesion
  del portal no se reutiliza.
- **48 h entre visitas.** El widget guarda la conversacion en `localStorage`
  (no `sessionStorage`), asi que la identificacion sobrevive a cerrar la
  pestana dentro de ese plazo. "Nueva conversacion" la borra antes.
- **El RUT no llega al LLM.** En el historial se reemplaza por `[RUT]`, y los
  logs solo registran si se encontro (`found`, `not_found`, `unavailable`).
- **Sin tope de RUTs por conversacion**, igual que la consulta publica de
  deuda (CU-39). Contra quien pruebe RUTs al azar esta el limite de
  `/asistente/mensajes` (10 por minuto por IP). Los mensajes que llegan por
  Chatwoot no pasan por ese limite.

### Limitaciones conocidas

- **El RUT identifica, no autentica.** Quien conozca el RUT de otra persona ve
  su nombre, sus planes y su deuda. Es lo mismo que ya muestra la consulta
  publica de deuda (CU-39) a cualquiera, y por eso se acepto para CU-64.
- **La identificacion vive en memoria del chatbot.** Si se reinicia, el
  cliente tiene que volver a dar su RUT.
- **No se registra en `conversacion_bot`** (con `id_cliente`) todavia: queda
  para CU-79.

---

## 2. Verificar un RUT (CU-63, interno)

```
POST /api/asistente/clientes/identificar
X-API-Key: <ASISTENTE_API_KEY>
```

Solo para finet-chatbot. Sin rate limit por IP (todas las llamadas salen de la
IP del chatbot); contra probar RUTs al azar, cada mensaje del widget ya paso
por el limite de `/asistente/mensajes` (10 por minuto por IP).

**Body:**

```json
{ "rut": "123456785" }
```

`rut` acepta puntos y guion, y se valida el digito verificador.

**Respuesta 200 — encontrado:**

```json
{
  "encontrado": true,
  "cliente": {
    "nombre_completo": "Juan Perez",
    "planes": [
      {
        "nombre_comercial": "Fibra 600",
        "tipo_plan": "fibra",
        "velocidad_mbps": 600,
        "estado_contrato": "activo"
      }
    ]
  }
}
```

**Respuesta 200 — no encontrado:**

```json
{ "encontrado": false, "cliente": null }
```

Solo nombre y planes: esto viaja al proveedor del motor LLM, asi que no se
devuelve RUT, correo, telefono, direccion ni deuda (la deuda se consulta aparte, CU-64). El RUT
identifica pero no autentica, por eso tampoco se entrega nada que la consulta
publica de deuda (CU-39) no muestre ya.

**Errores:**

| HTTP | Mensaje | Causa |
|------|---------|-------|
| 400 | `"Validation failed"` (+ `errors`) | RUT vacio o con digito verificador incorrecto |
| 401 | `"X-API-Key header is required"` / `"Invalid API key"` / `"ASISTENTE_API_KEY not configured"` | Falta la clave, es incorrecta, o no esta configurada aca |
| 500 | `"Error interno del servidor"` | Falla de base de datos. El chatbot lo trata como "no se pudo verificar" |

---

## 3. Configuracion

En `apps/controller/.env`:

```env
CHATBOT_URL="http://localhost:3001"
CHATBOT_API_KEY="<mismo valor que API_KEY en el .env de finet-chatbot>"
ASISTENTE_API_KEY="<mismo valor que CLIENTES_API_KEY en el .env de finet-chatbot>"
```

En el `.env` de finet-chatbot, ademas de `API_KEY` y las variables `OPENAI_*`:

```env
PORT=3001
CLIENTES_API_URL=http://localhost:4000/api
CLIENTES_API_KEY=<mismo valor que ASISTENTE_API_KEY>
WHATSAPP_NUMBER="+56 9 4500 2319"
```

Son dos claves distintas, una por sentido. Para levantarlo en local:
finet-chatbot en el puerto 3001 (el 3000 lo usa Next).

La guia paso a paso para levantar los tres procesos, comprobar que funcionan
y resolver los problemas frecuentes esta en finet-chatbot,
`docs/puesta-en-marcha.md`.
