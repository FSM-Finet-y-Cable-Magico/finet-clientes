# Notificaciones

## CU-67 / RF-49 — Recordatorio de pago previo al vencimiento

Tarea programada, no un endpoint: no hay nada que llamar desde el frontend.
`apps/controller/src/notificaciones/recordatorio-pago.service.ts`, disparada por `@Cron` a
las **09:00 de Chile** (`America/Santiago`, §11 del Documento 0) todos los días. La hora no la fija el RF-49, que solo habla de "tres días
corridos antes"; se eligió una a la que un aviso de cobro le sirva a alguien.

### Qué hace

1. **Toma un candado de Postgres** (`pg_try_advisory_xact_lock`, en `candado.ts`). Si otra
   instancia del backend ya lo tiene —dos réplicas, o el contenedor viejo y el nuevo durante un
   deploy— esta se va sin hacer nada. Es un candado, no una tabla: no toca el esquema.

   Es **de transacción**, no de sesión: se suelta solo cuando termina la tanda, aunque falle.
   El de sesión (`pg_try_advisory_lock`) quedaba tomado en la conexión del pool y la tanda del
   día siguiente creía que otra instancia estaba despachando.
2. **Busca las facturas** con `fecha_limite_pago` exactamente a 3 días y `estado` en
   `pendiente` o `vencida`. La precondición del CU es que el pago no se haya realizado, por eso
   las pagadas no entran. Misma convención de estados que `deuda-publica.service.ts`.
3. **Salta a quien ya tiene registro de hoy**, por si el job se cayó a mitad y se relanzó.
4. **Despacha por correo** con `MailService`, en tandas de 50 con un segundo de pausa entre
   ellas (RNF-49.1).
5. **Registra cada envío** en `log_notificacion` con canal, marca de tiempo y estado de
   entrega (RNF-49.2).

### Excepciones del CU

| Excepción | Qué hace |
|---|---|
| **1 — el cliente no tiene canales de contacto** | No despacha y deja el registro en `omitido` |
| **2 — falla el despacho** | Reintenta una vez; si el reintento también falla, queda en `fallido` para revisión manual |

La fila de `log_notificacion` se escribe **antes** de mandar el correo, con `en_curso`, y recién
después pasa a `enviado` o `fallido`. Si el proceso muere justo después de que el correo salga,
el registro ya existe y nadie recibe el aviso dos veces.

### Valores de `canal` y `estado_envio`

No están en la tabla §11.15 de enumeraciones del Documento 0 — ahí no existe "Canal
notificación" ni "Estado envío". Se reutilizan **los que el portal ya escribía** desde el CU-71
(tickets, `portal.service.ts`): minúsculas, `email` como canal, y `enviado` / `fallido` /
`omitido` como estados. Una sola convención por columna, aunque el §11.15 use mayúsculas para
los enums que sí define. **Hay que reflejarlos en el diccionario común antes de producción**
(§13.2 del acuerdo con G8).

### Por qué se distingue por plantilla y no por canal

El CU-71 también escribe en `log_notificacion` con `canal: 'email'`. Si el anti-duplicados
filtrara por canal, un cliente que abrió un ticket hoy se quedaría sin su recordatorio. Por eso
cada registro lleva `id_plantilla`, apuntando a la fila `RECORDATORIO_PAGO` de
`plantilla_notificacion`, que el servicio busca y crea una sola vez si no existe. El texto del
correo vive en `MailService`, así que `contenido_texto` queda en null: esa fila etiqueta, no
plantilla.

### Sin cambios de esquema

`log_notificacion` y `plantilla_notificacion` ya existen en la base compartida y solo se les
insertan filas. Solo se leen `factura`, `contrato` y `cliente`, que el §5 del acuerdo v2.0 con
G8 autoriza expresamente. No se dispara el anuncio del §13.

### Probarlo a mano

Sembrar una factura que venza en 3 días, levantar un receptor SMTP en el puerto 1025 (o
Mailpit, que está en `docker-compose.yml`) y llamar a `RecordatorioPagoService.ejecutar(new
Date())` desde un contexto de aplicación de Nest. El reloj entra por parámetro justamente para
eso. Corriéndolo dos veces seguidas, la segunda no debe despachar nada.
