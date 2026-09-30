# Pagos — CU-42 (Webpay) y CU-43 (Mercado Pago)

**Construido, pendiente del saldo de G8 y de la pasarela.** Hoy nunca cobra: ver "Lo que falta".

Público, como la consulta de deuda (CU-39/CU-40): se puede pagar la cuenta de alguien más con su
RUT o su código de abonado. El throttler global limita los intentos por IP.

## Qué se paga

**El total**, sin abonos parciales: todo lo del RUT (todos sus contratos) o todo lo del código de
abonado (ese contrato). **Ese total no lo calculamos nosotros: lo da G8**
(`src/common/saldo/saldo-cliente.service.ts`). El acuerdo v2.0 pone Factura y Pago de su lado (§3)
y dice que G2 consume "el valor persistido" (§5).

## Endpoints

### `GET /api/pagos/resumen?rut=… | ?abonado=… | ?t=…`

Exactamente un identificador. `t` es el enlace firmado del aviso de corte (CU-68) o del portal.

```json
{
  "encontrado": true,
  "cliente": { "nombre": "Ana Pérez", "rut": "XX.XXX.678-5", "codigo_abonado": null },
  "saldo": null,
  "medios": [
    { "id": "webpay", "nombre": "Webpay", "descripcion": "…", "disponible": false },
    { "id": "mercadopago", "nombre": "Mercado Pago", "descripcion": "…", "disponible": false }
  ]
}
```

- `rut` va enmascarado: al que llega por el enlace no se le muestra el RUT entero.
- `saldo` es `null` mientras G8 no diga dónde lo deja.
- Un enlace alterado o vencido responde igual que una cuenta que no existe (`encontrado: false`).

### `POST /api/pagos/iniciar` — `{ rut | abonado | t, medio: "webpay" | "mercadopago" }`

El total **no viene en el body**: se vuelve a pedir a G8 en el servidor. Un `monto` en el body se
descarta.

| HTTP | Cuándo |
|---|---|
| 404 | La cuenta no existe |
| 409 | No hay deuda |
| 503 | Sin el saldo de G8: "No pudimos obtener tu deuda en este momento" (precondición de los dos CU) |
| 503 | Sin pasarela: Excepción 1 del CU-42 ("Webpay no puede utilizarse temporalmente") o del CU-43 ("Mercado Pago se encuentra temporalmente indisponible") |

Cómo se va y se vuelve de la pasarela (y la respuesta exitosa) se define al elegirla.

### `GET /api/portal/enlace-pago` (con sesión)

Devuelve `{ "enlace": "/pagar?t=…" }`: el mismo enlace firmado del aviso de corte, para que el
botón "Pagar ahora" del portal no ponga el RUT en la URL. 503 si falta `ENLACE_PAGO_SECRET`.

## Lo que falta

En `src/common/pendientes.ts`; el backend lo lista al arrancar.

| Dato | Quién |
|---|---|
| `SALDO_CLIENTE_DEFINIDO` — dónde está el saldo | Grupo 8 |
| `PASARELA_ACTIVA` — Webpay y Mercado Pago operativos | Nosotros, tras leer su documentación |
| `REGISTRO_PAGO_DEFINIDO` — dónde se registra el pago confirmado (RF-32) | Grupo 8 |

## En la view

`/pagar` (`apps/view/app/pagar/`), no indexable. Se llega desde el aviso de corte y desde el
portal (`?t=`), desde la consulta pública (`?rut=` o `?abonado=`), o directo, a identificar la
cuenta. Tiene dos pasos, "Tu deuda" y "Elige un medio de pago", con el total y el botón Pagar fijos
abajo. El botón va en Finet Lime, que el `DESIGN.md` reserva para pagar.
