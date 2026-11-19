# Demostración técnica: pago con Webpay e identificación en el chatbot

Recorrido de Daniel en la presentación final (de las 07:00 a las 12:50): el pago
de una factura con Webpay (CU-42) y la identificación del cliente en el asistente
(CU-63), con su excepción. Se hace con la demo local levantada (`ppt/levantar.sh`).
El texto de lo que se dice en cada paso está en el guion del grupo; aquí va lo que
se hace y con qué datos.

## Datos

| Para | Dato |
|---|---|
| Sitio | <http://localhost:3000> |
| Cliente de prueba | Camila Rojas, RUT `16.234.567-2`, contraseña `Demo2026` |
| Facturas que se pueden pagar | #2 (9/2026, vencida) y #3 (10/2026, vence en 3 días), de $19.990 cada una; saldo $39.980 |
| RUT del chatbot | `16.234.567-2` (el de la sesión del portal) |
| RUT válido pero inexistente | `12.345.678-5` (no está en `cliente` ni en `prospecto`) |
| Correos (comprobante del pago) | <http://localhost:8025> |

Un RUT con el dígito verificador mal escrito prueba el formato, no la ausencia
del cliente: para la excepción hace falta uno válido que no exista.

### Tarjetas de prueba de Webpay (integración)

Son los datos públicos de Transbank
(<https://www.transbankdevelopers.cl>, «Ambiente de pruebas»); si alguno falla,
confirmarlo allí. No se cobra nada, pero no se usa una tarjeta real.

| Resultado | Medio | Número | CVV | Vencimiento |
|---|---|---|---|---|
| Aprobada | Crédito Visa | `4051 8856 0044 6623` | `123` | cualquier fecha futura |
| Aprobada | Débito Redcompra | `4051 8842 3993 7763` | no pide | no pide |
| Rechazada | Crédito Mastercard | `5186 0595 5959 0568` | `123` | cualquier fecha futura |

Después del formulario, el banco simulado pide RUT `11.111.111-1` y clave `123`;
ahí se elige **Aceptar** o **Rechazar**. Si el formulario pregunta por cuotas,
«Sin cuotas».

## Recorrido

| Hora | Qué se hace | Qué se muestra |
|---|---|---|
| 07:00 | Estado de los servicios y pasar al sitio abierto. | Sitio, API y chatbot arriba. |
| 07:20 | Entrar a Planes, activar un momento la vista móvil y volver a escritorio. | Una tarjeta de plan, sin recorrerlos todos. |
| 07:45 | Iniciar sesión con Camila. | El resumen de la cuenta; luego «Pagar ahora» o *Mi Deuda*. |
| 08:10 | En `/pagar`, elegir una factura (la #3). | Network: `GET /api/pagos/resumen` y su respuesta. |
| 08:40 | Elegir Webpay y presionar Pagar. | Network: `POST /api/pagos/iniciar`, con `url` y `token` en la respuesta. |
| 09:10 | Pagar en Webpay con la tarjeta aprobada y aceptar en el banco simulado. | El retorno al sitio y la pantalla de resultado. Sin explicaciones largas. |
| 09:55 | Volver al editor. | `PagosService`: `retorno` y `registrar` (también `iniciar` y `transaccionDe`). |
| 10:25 | Abrir el widget, «Nueva conversación» y enviar «Hola». | Pide el RUT. La sesión del portal sigue activa. |
| 10:55 | Escribir `16.234.567-2` y preguntar «Qué plan tengo contratado». | Saluda a Camila y responde «Fibra 600». |
| 11:30 | Mostrar la solicitud y pasar al editor. | Network: `POST /api/asistente/mensajes`; `AsistenteService.responder` y `AsistenteClientesService.identificar` (y `esSesionDe`). |
| 12:00 | Otra conversación nueva: «Hola» y luego `12.345.678-5`. | Avisa que no pudo verificarlo y sigue en modo general; si alcanza, una pregunta general. |
| 12:30 | Dejar visible la última respuesta. | Terminar antes del minuto 13. |

Si hay atraso, se recorta la vista móvil y la pregunta del plan.

Las llamadas del backend a Transbank y a G8 no aparecen en Network, porque no las
hace el navegador.

## Antes de presentar

1. Levantar la demo y comprobarla: `ppt/levantar.sh` y `ppt/verificar.sh`.
2. Reponer las facturas: `ppt/rearmar-pagos.sh` (también `--correos` para dejar
   Mailpit vacío).
3. Network con **Preserve log**, y el editor con los tres archivos abiertos en los
   métodos de la tabla: `apps/controller/src/pagos/pagos.service.ts`,
   `apps/controller/src/asistente/asistente.service.ts` y
   `apps/controller/src/asistente/asistente-clientes.service.ts`.
4. Sesión de Camila iniciada y los datos a mano para no escribirlos despacio.
5. Hacer el recorrido completo en el mismo equipo que se usará, y grabar el
   ensayo por si hay que usarlo de respaldo (identificándolo como grabación).

## Entre ensayos

- Cada pago aprobado deja la factura como Pagada. `ppt/rearmar-pagos.sh` repone
  las facturas y el contador de pagos sin reiniciar la base ni los servicios.
  Conviene ensayar con la #2 y dejar la #3 para presentar; el script repone las dos.
- En el chatbot, cada conversación nueva parte sin identificación.
- Si la cuenta se bloquea por intentos fallidos: `ppt/desbloquear.sh`.
- Para fechas frescas y la base de cero: `ppt/base/reiniciar.sh`, con la demo detenida.

## Qué esperar si algo no sale

- **Pago aprobado pero registro pendiente.** La pantalla de resultado lo dice; es
  el camino de `registrar` cuando G8 no confirma. El guion trae la frase para ese caso.
- **Webpay no responde.** Necesita internet; si no hay, se pasa a la grabación del
  ensayo.
- **El chatbot tarda o no responde.** Usa el LLM de `ppt/.local/llm.env`, que
  también necesita internet. Mirar `ppt/.local/logs/chatbot.log`.
- **Con el RUT inexistente, la respuesta puede traer una frase de más.** En los
  ensayos salió «No pude verificar tu identidad con ese RUT, así que seguiré
  ayudándote con consultas generales», a veces seguida de un agradecimiento de más:
  es el modelo, no los datos. Conviene ensayarlo varias veces.
