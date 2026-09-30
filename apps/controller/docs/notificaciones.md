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

## CU-68 / RF-50 — Aviso de corte inminente por morosidad

**Construido, pendiente de dos datos.** Hoy no despacha nada: ver "Lo que falta".

Tarea programada en `aviso-corte.service.ts`, disparada por `@Cron` a las **09:30 de Chile**:
media hora después del CU-67, para no pisarse en el SMTP.

El correo muestra las fechas como pide el §11 (`DD/MM/AAAA`) con los formatos de
`src/mail/formato.ts`. El del CU-67 todavía las muestra como en la base (`AAAA-MM-DD`): se alinea
en el Incremento 4.

### Qué hace

1. **Revisa que no falte nada** (ver abajo). Si falta algo, lo deja en el log y termina.
2. **Toma su propio candado de transacción**, distinto del CU-67.
3. **Comprueba `FRONTEND_URL` y `ENLACE_PAGO_SECRET`** antes de despachar. Sin ellos los
   enlaces saldrían rotos, y cada cliente quedaría como `fallido` por un error de configuración.
4. **Busca las facturas impagas que vencieron ayer** (`pendiente` o `vencida`) y las agrupa:
   **un aviso por cliente**, aunque tenga varios contratos vencidos el mismo día.
5. **Salta a quien ya tiene aviso de hoy**, por si la tanda se relanzó.
6. **El monto es el saldo del portal** (`PortalService.getResumenDeuda`, CU-27), no el de la
   factura que venció: es lo que el cliente ve al entrar y lo que el enlace le va a cobrar. Si el
   saldo no cuadra (CU-27 Excepción 3), no se avisa un monto que no es: queda `fallido`.
7. **Fecha de corte** = vencimiento + días de gracia.
8. **Enlace directo para pagar** (RF-50, RNF-50.1): `FRONTEND_URL/pagar?t=…`. Ver abajo.
9. Tandas de 50 (RNF-49.1, por la dependencia con RF-49) y registro en `log_notificacion` con la
   plantilla `AVISO_CORTE`, igual que el CU-67.

### Cuándo avisa

El CU habla de un "umbral de morosidad definido para activar el aviso de corte", pero el
Documento 0 no lo define. Se avisa **el día siguiente al vencimiento**: así solo depende de los
días de gracia, que ya se le preguntan a Grupo 8.

### Lo que falta

Los dos datos viven en `src/common/pendientes.ts`, con quién tiene que responder cada uno. Al
arrancar, el backend deja en el log qué falta (`[Incremento 3] falta un dato: …`).

| Dato | Quién | Mientras falte |
|---|---|---|
| `DIAS_GRACIA_CORTE` — días de gracia antes del corte | Grupo 8 | No despacha |
| `PASARELA_ACTIVA` — pasarela de pagos operativa | Nosotros (CU-42, CU-43) | No despacha: es precondición del CU, y sin pasarela el enlace no lleva a ningún lado |

### Excepciones del CU

Las mismas del CU-67, y resueltas igual: `despacho-notificacion.ts` es la versión compartida que
usan el CU-68 y el CU-69. El CU-67 conserva su copia porque está en revisión en el PR #18;
migrarlo queda para el Incremento 4.

### El enlace de pago

`src/common/enlaces/enlace-pago.service.ts`. Corto (~50 caracteres), único y **sin tabla**: lo
necesario para validarlo viaja dentro del enlace, firmado con HMAC-SHA256.

- Formato `p.<cliente>.<vence>.<nonce>.<firma>`. Nadie puede fabricarlo ni cambiarle el
  cliente sin la clave.
- Vence a los **7 días**, que cubren los días de gracia hasta el corte.
- La firma se compara en tiempo constante y **como texto**, no como bytes: en base64 el último
  carácter lleva bits de relleno, y comparando bytes un mismo enlace tendría varias escrituras
  válidas.
- Clave en `ENLACE_PAGO_SECRET`. No hace falta para levantar el backend.
- Solo dice **a quién** le corresponde el pago. La página `/pagar` se construye junto con la
  pasarela.

### Probarlo a mano

Sembrar facturas impagas con `fecha_limite_pago` = ayer, levantar un receptor SMTP en el 1025 y
llamar a `AvisoCorteService.ejecutar(new Date())` desde un contexto de aplicación de Nest: no
despacha, y dice qué falta. Con `ejecutar(new Date(), { diasGracia: 4, pasarelaActiva: true })`
despacha; corriéndolo dos veces, la segunda no manda nada.

## CU-69 / RF-51 — Confirmación de pago registrado

**Construido, pendiente del pago.** Hoy nada lo llama: se conecta al construir el checkout
(CU-42, CU-43).

`confirmacion-pago.service.ts`. **No es tarea programada**: la dispara el registro del pago,
apenas la pasarela devuelve un estado exitoso (RNF-51.1: "inmediatamente").

### Qué hace

1. **Recupera los canales de contacto** del cliente que pagó.
2. **Despacha la confirmación** con los datos que el RF-32 exige guardar de cada pago: monto,
   fecha y código de autorización. La fecha va en hora de Chile (`DD/MM/AAAA HH:MM`, §11): un
   pago de las 22:30 ya es el día siguiente en UTC.
3. **Registra el envío** en `log_notificacion` con la plantilla `CONFIRMACION_PAGO`.

Las excepciones son las mismas del CU-67, con `despacho-notificacion.ts`.

**Nunca lanza.** El pago ya quedó registrado cuando esto corre: si la confirmación falla, queda
en el log y el pago no se toca. Quien llama puede no esperarla, para no demorar la respuesta a la
pasarela.

### Una vez por cada pago

Lo asegura quien llama, no este servicio: `log_notificacion` no tiene columna para referenciar
el pago, así que no puede deduplicar solo. El registro rechaza un código de transacción repetido
(RF-33) antes de llegar acá, y la confirmación se dispara solo después de un registro nuevo.

### Lo que falta

| Dato | Quién | Mientras falte |
|---|---|---|
| `PASARELA_ACTIVA` — pasarela de pagos operativa | Nosotros (CU-42, CU-43) | No hay pagos que confirmar |
| `REGISTRO_PAGO_DEFINIDO` — dónde queda registrado el pago confirmado | Grupo 8 | No hay pago registrado: la precondición del CU no se cumple |
