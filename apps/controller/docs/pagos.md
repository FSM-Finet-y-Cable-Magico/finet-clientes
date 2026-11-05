# Pagos — CU-42 (Webpay Plus, por factura)

**Construido, pendiente de G8.** Webpay funciona (en integración mientras Finet no entregue su
código de comercio), pero el pago completo corre recién cuando G8 despliegue el saldo y el registro
de pagos: ver "Lo que falta". Solo Webpay: Mercado Pago no se construye (decisión del 22-10).

Público, como la consulta de deuda (CU-39): se puede pagar la cuenta de alguien más con su RUT. El
throttler global limita los intentos por IP.

## Qué se paga

**Una factura entera, la que elige el cliente**, sin abonos: se cobra su `saldoExigible`. Así lo
pide el contrato de G8 (02-10, §4: `id_factura` obligatorio) y su diagrama del pago del 29-10. **El
saldo no lo calculamos nosotros: lo da G8** (`src/common/saldo/saldo-cliente.service.ts`), con su
mora y su vencimiento con prórroga (su respuesta del 01-10, §2).

## El flujo

1. `/pagar` muestra las facturas que G8 deja pagar (`aceptaPagos` y saldo), y el cliente elige una.
2. `POST /api/pagos/iniciar` vuelve a pedirle las facturas a G8, crea la transacción en Webpay por
   el `saldoExigible` y responde su URL y su token. La vista manda al cliente al formulario de Webpay
   con `token_ws` por POST.
3. Webpay devuelve al cliente a `WEBPAY_URL_RETORNO` (`/api/pagos/webpay/retorno`):
   - **aprobado:** se confirma (commit) y se le manda el pago a G8
     (`POST /api/integrations/g2/payments`), que lo registra (CU-44 y CU-45 son suyos). Si es la
     primera vez que lo registra, sale la confirmación al cliente (CU-69);
   - **rechazado:** Excepción 3, "el pago no fue aprobado";
   - **el cliente anuló, se le acabó el tiempo o falló el formulario:** Excepción 2. No se confirma
     nada y queda `PAGO_NO_COMPLETADO` en `log_auditoria`.
4. El backend redirige (303) a `/pagar/resultado`, que le pregunta el estado a Transbank.

**Sin tabla de pagos pendientes.** A quién y qué factura se cobra viaja en el `session_id` de Webpay,
firmado con `ENLACE_PAGO_SECRET`. Solo se procesan transacciones que creó el portal: el código de
comercio de integración es público. La orden de compra (`F<factura>-<único>`) es también el
`codigo_transaccion` para G8, y el `request_id` sale de ella, así que reintentar o recargar no
duplica el pago.

**Si G8 no registra un pago aprobado:**

| Qué responde G8 | Qué se hace | En `log_auditoria` | El cliente ve |
|---|---|---|---|
| 4xx (sobrepago, factura cerrada…), salvo 409 | Se anula en Webpay (decisión del 29-10) | `PAGO_ANULADO` | "No pudimos aplicar tu pago" |
| Sin respuesta, 5xx o 409 | No se anula: pudo quedar registrado. Se reenvía a mano con el mismo `request_id` | `PAGO_SIN_REGISTRAR` | "Tu pago fue aprobado", pendiente |

Las dos filas guardan lo necesario para reenviarlo o revisarlo (factura, monto, fecha, código de
autorización, orden y token). Nunca datos de la tarjeta.

## Endpoints

### `GET /api/pagos/resumen?rut=… | ?t=…`

Exactamente un identificador. `t` es el enlace firmado del aviso de corte (CU-68) o del portal.

```json
{
  "encontrado": true,
  "cliente": { "nombre": "Ana Pérez", "rut": "XX.XXX.678-5" },
  "saldo": 19990,
  "facturas": [{ "id_factura": 101, "saldo": 14990, "vence": "2026-10-15" }],
  "medios": [
    { "id": "webpay", "nombre": "Webpay", "descripcion": "…", "disponible": true }
  ]
}
```

- `rut` va enmascarado: al que llega por el enlace no se le muestra el RUT entero.
- `saldo` es la suma del `saldoExigible` de G8. `saldo` y `facturas` son `null` mientras G8 no lo
  entregue.
- `facturas` trae solo las que se pueden pagar. `vence` es el vencimiento efectivo de G8.
- Webpay está `disponible` solo si también está el registro de pagos de G8: sin él no se cobra.
- Un enlace alterado o vencido responde igual que una cuenta que no existe (`encontrado: false`).

### `POST /api/pagos/iniciar` — `{ rut | t, id_factura, medio: "webpay" }`

Responde `200 { "url": "https://webpay3gint.transbank.cl/…", "token": "…" }`. El monto **no viene en
el body**: se vuelve a pedir a G8 en el servidor. Un `monto` en el body se descarta.

| HTTP | Cuándo |
|---|---|
| 404 | La cuenta no existe |
| 409 | La factura no es del cliente, G8 no deja pagarla o no tiene saldo |
| 503 | Sin el saldo de G8: "No pudimos obtener tu deuda en este momento" (precondición) |
| 503 | Excepción 1, "Webpay no puede utilizarse temporalmente": sin pasarela, sin el registro de G8, falta configuración o Webpay no responde |

### `GET|POST /api/pagos/webpay/retorno`

Adonde Webpay devuelve al cliente (`WEBPAY_URL_RETORNO`). Según el caso llega por GET o por POST,
con `token_ws` o con `TBK_TOKEN`, `TBK_ORDEN_COMPRA` y `TBK_ID_SESION`. Siempre responde 303 a
`${FRONTEND_URL}/pagar/resultado?resultado=…&token_ws=…`.

### `GET /api/pagos/webpay/resultado?token_ws=…`

Lo que dice Transbank del pago, para la pantalla de resultado:
`{ estado, monto, fecha, codigo_autorizacion, orden, id_factura }`. `estado` es `aprobado`,
`anulado`, `rechazado` o `error`. 404 si la transacción no la creó el portal · 503 si Webpay no
responde.

### `GET /api/portal/enlace-pago` (con sesión)

Devuelve `{ "enlace": "/pagar?t=…" }`: el mismo enlace firmado del aviso de corte, para que el
botón "Pagar ahora" del portal no ponga el RUT en la URL. 503 si falta `ENLACE_PAGO_SECRET`.

## Configuración

En el `.env` (ver `.env.example`). Las credenciales de producción van solo en el `.env` del
servidor, nunca en el repo.

| Variable | Para qué |
|---|---|
| `WEBPAY_AMBIENTE` | `integracion` (por defecto, con las credenciales de prueba que trae el SDK) o `produccion` |
| `WEBPAY_CODIGO_COMERCIO`, `WEBPAY_API_KEY` | Solo en producción: el código de comercio y la llave secreta de Finet |
| `WEBPAY_URL_RETORNO` | La URL pública de `/api/pagos/webpay/retorno`. En producción, HTTPS |
| `ENLACE_PAGO_SECRET` | Firma la sesión de cada pago (y el enlace del aviso de corte) |
| `FRONTEND_URL` | Adonde se redirige al volver de Webpay |

Si falta algo, el pago cae en la Excepción 1 y el log nombra la variable, nunca su valor.

**Para probar en integración:** tarjeta VISA 4051885600446623, CVV 123 y cualquier vencimiento
futuro. En el banco simulado, RUT 11.111.111-1 y clave 123, y ahí se elige aprobar o rechazar
(documentación de Webpay Plus).

**Para producción** (cuando Finet entregue su código de comercio): `WEBPAY_AMBIENTE=produccion`,
las dos credenciales y el retorno por HTTPS, más los requisitos que Transbank le pide al comercio
(sitio activo, comunicaciones cifradas, componentes al día, etc.).

## Lo que falta

En `src/common/pendientes.ts`; el backend lo lista al arrancar.

| Dato | Quién |
|---|---|
| `SALDO_CLIENTE_DEFINIDO` — el saldo por factura (`GET …/invoices`) desplegado | Grupo 8 |
| `REGISTRO_PAGO_DEFINIDO` — el registro de pagos (`POST …/payments`) desplegado | Grupo 8 |

`PASARELA_ACTIVA` ya está en `true`: Webpay quedó construido (CU-42).

## En la view

- `/pagar` (`apps/view/app/pagar/`), no indexable. Se llega desde el aviso de corte y desde el
  portal (`?t=`), desde la consulta pública (`?rut=`), o directo, a identificar la cuenta. Tiene dos
  pasos, "Elige la factura" y "Elige un medio de pago", con el total y el botón Pagar fijos abajo.
  El botón va en Finet Lime, que el `DESIGN.md` reserva para pagar.
- `/pagar/resultado`, no indexable: el resultado, consultado a Transbank con el token. De la URL
  solo se toma que el cliente canceló o que el pago quedó pendiente de registrar.
- La CSP de `next.config.ts` deja enviar formularios solo a los dos hosts de Webpay.
