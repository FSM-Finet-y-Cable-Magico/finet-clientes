# Casos de Uso por Incremento

Fuente de verdad: documento de requisitos `CU_por_Incremento` (aportado por el equipo, no versionado en el repo — pedirlo a quien lo mantenga si hace falta la versión original). Este archivo transcribe su contenido para que quede consultable desde el código y no se pierda entre conversaciones.

80 casos de uso repartidos en 3 incrementos (el 3 y el 4 se fusionaron), según la
reorganización coordinada con el Grupo 8 y recogida en el documento `CU_por_Incremento`
del 2026-09-28:

| Incremento | Alcance | CU | % | Estado |
|---|---|---|---|---|
| **Incremento 1** | Experiencia del cliente, sitio web, portal y autoservicio | 34 | 42,5% | ✅ Implementado |
| **Incremento 2** | Autogestión, diagnóstico, mapa, SEO/políticas adelantadas y ciclo de deuda y pago (conjunto con G8) | 23 | 28,75% | ⏳ **En curso** |
| **Incremento 3 + 4** | Pasarelas de pago, asistente virtual, notificaciones, cierre técnico y casos aplazados del Inc. 2 | 23 | 28,75% | ⏳ **En curso** |

> **Reorganización del 2026-09-28.** Los antiguos incrementos 3 y 4 se fusionaron en uno.
> Del Incremento 2 se adelantaron CU-72 a CU-75 (SEO y políticas) y se aplazaron al 3+4 los
> casos cuya coordinación con G8 quedó para después: CU-46, CU-52, CU-53, CU-48, CU-49,
> CU-50, CU-33, CU-36, CU-06 y CU-58.


> ⚠️ **Discrepancia en el documento fuente:** la tabla de Incremento 1 declara "34 casos de uso" pero solo lista 32 filas — las prioridades 1 y 2 no aparecen en la tabla original. No se inventó contenido para esas dos filas; si alguien tiene la versión completa del documento, hay que completarlas aquí.

---

## Incremento 1 — Experiencia del cliente, sitio web, portal y autoservicio

34 CU · 42,5% · **Estado: implementado** (confirmado contra el código en `apps/controller` y `apps/view`; ver [README raíz](../README.md) y `apps/view/docs/routing.md` para el detalle técnico de cada uno).

| Prioridad | CU | Caso de uso |
|---|---|---|
| — | — | *(prioridades 1 y 2 no están en el documento fuente, ver nota arriba)* |
| 3 | CU-20 | Navegando a secciones internas desde el pie de página |
| 4 | CU-21 | Accediendo a redes sociales de la empresa desde el pie de página |
| 5 | CU-22 | Alternando entre modo oscuro y claro |
| 6 | CU-16 | Navegando manualmente por el carrusel de imágenes |
| 7 | CU-15 | Filtrando catálogo de planes por segmento |
| 8 | CU-17 | Consultando detalles de los planes de servicio |
| 9 | CU-19 | Consultando ofertas y servicios corporativos |
| 10 | CU-18 | Iniciando solicitud de contratación de un plan |
| 11 | CU-01 | Iniciando sesión y redirigiendo al Portal Cliente |
| 12 | CU-04 | Registrando cuenta nueva |
| 13 | CU-03 | Solicitando recuperación de contraseña |
| 14 | CU-02 | Cerrando sesión activa |
| 15 | CU-07 | Accediendo a la sección Perfil del portal |
| 16 | CU-08 | Actualizando número de teléfono de contacto |
| 17 | CU-09 | Actualizando correo electrónico de contacto |
| 18 | CU-10 | Cambiando contraseña de acceso al portal |
| 19 | CU-11 | Validando requisitos de complejidad de contraseña |
| 20 | CU-12 | Cerrando sesión automáticamente por inactividad |
| 21 | CU-23 | Consultando el estado operativo del contrato |
| 22 | CU-24 | Accediendo al panel principal del Portal Cliente |
| 23 | CU-25 | Consultando nombre del plan vigente contratado |
| 24 | CU-26 | Visualizando múltiples planes vigentes en el portal |
| 25 | CU-27 | Visualizando confirmación de cuenta al día sin deuda |
| 26 | CU-28 | Visualizando saldo de deuda pendiente en el portal |
| 27 | CU-29 | Visualizando estado vacío de tickets de soporte |
| 28 | CU-30 | Consultando historial de tickets de soporte existentes |
| 29 | CU-37 | Navegando por el sitio desde el menú móvil colapsable |
| 30 | CU-38 | Consultando planes de servicio desde vista móvil |
| 31 | CU-39 | Consultando deuda pública mediante RUT |
| 32 | CU-40 | Consultando deuda pública mediante código de abonado |
| 33 | CU-41 | Consultando detalle de deuda y fecha de vencimiento |
| 34 | CU-05 | Bloqueando IP por intentos fallidos de inicio de sesión |

---

## Incremento 2 — Autogestión, diagnóstico, mapa, SEO adelantado y ciclo de deuda

23 CU · 28,75% · **Estado: en curso** (arrancado el 2026-08-20)

### Criterio de agrupación (del documento fuente)

> El Incremento 2 reúne, por un lado, el desarrollo propio de Grupo 2 —autogestión de red
> inalámbrica (CU-31, CU-32), diagnóstico (CU-34, CU-35), visor cartográfico de factibilidad
> (CU-59 a CU-62) y registro de solicitudes de soporte (CU-71)— y, por otro, los casos de uso
> desarrollados en conjunto con Grupo 8 para dejar operativo el ciclo de deuda y cobranza:
> vencimiento del contrato (CU-54), detección de morosidad (CU-47, CU-80), seguimiento de
> contratos vencidos (CU-55, CU-56), registro de pago (CU-44, CU-45), bitácora de suspensión y
> reactivación (CU-51) y generación del reporte financiero (CU-57), junto con el cierre de
> tickets de soporte (CU-78).
>
> Se adelantan a este incremento los casos CU-72 a CU-75 (etiquetas de indexación, términos y
> políticas de privacidad, archivos de indexación y aceptación de políticas), originalmente
> ubicados en el Incremento 4, por tratarse de funcionalidad de frontend sin dependencia de las
> pasarelas de pago ni del asistente virtual.
>
> En contrapartida, se postergan al Incremento 3 + 4 los casos CU-46, CU-52, CU-53, CU-48,
> CU-49, CU-50, CU-33, CU-36, CU-06 y CU-58, ya que su coordinación con Grupo 8 (recaudación
> externa, comprobantes de pago, integración con SmartOLT) quedó definida para esa etapa
> posterior.

### Casos de uso y estado real en el código (auditado 2026-08-20)

Los estados vienen de esa auditoría y solo se actualizan cuando un CU se comprueba de verdad
contra sus RF. Si una fila dice pendiente y el código ya lo hace, es que nadie lo ha verificado
todavía, no que no exista.

| Prioridad | CU | Caso de uso | Bloque | Estado |
|---|---|---|---|---|
| 1 | CU-31 | Validando formato de nueva clave de red inalámbrica | Autogestión | ✅ — valida formato en `WifiPasswordSection.tsx` y en el backend con Zod (`dto/solicitud-contrasena-wifi.dto.ts`). **Diverge del RF-24 escrito**: se permiten símbolos, solo se rechazan espacios en blanco (decisión de equipo, pendiente de reflejar en el Documento 0) |
| 2 | CU-32 | Solicitando cambio de contraseña de red inalámbrica | Autogestión | ✅ — `POST /portal/wifi/password` registra la solicitud en la tabla `solicitud_contrasena_wifi` (estado `PENDIENTE`, en mayúsculas por el §11.15) y la muestra en `/portal/servicios`. La clave nunca se guarda en texto plano: va **cifrada con la llave pública RSA del CRM** (`password_nueva_cifrada`, la vía por la que CU-33 la obtiene; el CRM la borra al aplicarla). El portal **no** cambia la clave: la ejecución es CU-33 y corre por cuenta del CRM |
| 3 | CU-34 | Iniciando prueba de velocidad de red con herramienta Ookla | Diagnóstico | 🚧 Parcial — widget de Speedtest.net embebido (`OoklaSpeedTest.tsx`), sin backend propio ni persistencia de resultados |
| 4 | CU-35 | Visualizando resultados de la evaluación de red | Diagnóstico | 🚧 Parcial — el widget de Ookla muestra resultados inline, pero no hay componente propio ni persistencia |
| 5 | CU-59 | Accediendo al visor cartográfico de factibilidad técnica | Mapa | ✅ — `/cobertura` monta Leaflet vía `GET /api/cobertura/config` |
| 6 | CU-60 | Visualizando capa de mapa de calor de cobertura | Mapa | ✅ — `leaflet.heat` sobre `GET /api/cobertura/puntos` (capa estática generada desde el KML de planta externa) |
| 7 | CU-61 | Aplicando zoom sobre el mapa de factibilidad | Mapa | ✅ — rueda/doble click/pellizco, acotado por `zoom_min`/`zoom_max` del backend |
| 8 | CU-62 | Desplazándose por el mapa de factibilidad mediante paneo | Mapa | ✅ — arrastre con puntero o táctil, acotado por `maxBounds` |
| 9 | CU-71 | Registrando solicitud de soporte técnico desde el portal | Soporte | ⏳ Pendiente — `portal/tickets` hoy es solo lectura (CU-29/30), no existe creación de tickets desde el cliente |
| 10 | CU-72 | Generando etiquetas de indexación por sección y plan | SEO/Políticas | ✅ — `metadataSeccion`/`metadataPlan` en `apps/view/app/_lib/seo.ts` |
| 11 | CU-73 | Accediendo a términos, condiciones y políticas de privacidad | SEO/Políticas | ✅ — `/terminos` y `/privacidad` publicadas y enlazadas desde el footer. Faltan datos que entrega Finet, ver abajo |
| 12 | CU-74 | Generando y actualizando archivos de indexación del sitio | SEO/Políticas | ✅ — `sitemap.xml` y `robots.txt` desde `apps/view/app/_lib/rutas-publicas.ts` |
| 13 | CU-75 | Registrando aceptación de políticas de privacidad en formularios | SEO/Políticas | ✅ — casilla obligatoria en contratación y registro de cuenta (no existe formulario de Contacto). La aceptación se registra en `log_auditoria` (`ACEPTAR_POLITICA_PRIVACIDAD`) dentro de la misma transacción que los datos, sin cambios de schema. Ver `apps/controller/docs/contrataciones.md` |
| 14 | CU-44 | Registrando pago confirmado con trazabilidad financiera | Núcleo de pago · conjunto G8 | ⏳ Pendiente — schema listo: `model pago` ya existe (`prisma/schema.prisma`) |
| 15 | CU-45 | Validando unicidad de código de transacción para evitar duplicados | Núcleo de pago · conjunto G8 | ⏳ Pendiente — schema listo: `pago.codigo_transaccion` ya es `@unique` |
| 16 | CU-47 | Identificando contratos morosos en revisión diaria automática | Deuda · conjunto G8 | ⏳ Pendiente |
| 17 | CU-51 | Registrando bitácora de eventos de suspensión y reactivación | SmartOLT · conjunto G8 | ⏳ Pendiente — podría reutilizar `log_auditoria` en vez de un modelo nuevo. Como CU-49 y CU-50, queda del lado de quien opera SmartOLT (**G3**) |
| 18 | CU-54 | Asignando fecha de vencimiento fija a un contrato | Deuda · conjunto G8 | ⏳ Pendiente — `contrato` no tiene campo de fecha de vencimiento fija en el schema (solo `dia_vencimiento`, un día del mes) |
| 19 | CU-55 | Consultando lista de contratos con saldos vencidos | Deuda · conjunto G8 | ⏳ Pendiente |
| 20 | CU-56 | Gestionando seguimiento de contrato vencido seleccionado | Deuda · conjunto G8 | ⏳ Pendiente |
| 21 | CU-57 | Generando reporte financiero del período seleccionado | Administración · conjunto G8 | ⏳ Pendiente |
| 22 | CU-78 | Actualizando estado y cerrando ticket de soporte asignado | Soporte · conjunto G8 | ⏳ Pendiente — es un flujo de agente/admin, no del portal de cliente |
| 23 | CU-80 | Configurando parámetros de detección de morosidad | Deuda · conjunto G8 | ⏳ Pendiente — no hay modelo de configuración para esto todavía |

> **Reparto con el Grupo 8.** El documento `CU_Grupo2_Equivalencias_Grupo8_Incremento2.pdf`
> cerró el alcance de este incremento: 7 CU son 100% nuestros, 5 se trabajan en conjunto con G8
> (CU-31/32, CU-52/53 y CU-71) y 17 se derivan enteros a G8.
>
> **Confirmado y corregido por el acuerdo de G8 del 12-09-2026** (`acuerdo-integracion-g2-portal-crm.md`,
> §1 "Responsabilidad definitiva propuesta"). Dos cosas que ese documento deja por escrito y
> valen independientemente de cómo se resuelva el resto de la integración, porque son reparto
> de dominio y no mecanismo:
>
> - **G8 se declara dueño** de contratación comercial, contratos, planes, tickets CRM, deuda,
>   pagos, morosidad, comprobantes y estados comerciales. Eso **confirma por escrito** la
>   derivación de los CU de deuda y pago que teníamos anotados sin respuesta suya: CU-44,
>   CU-45, CU-46, CU-47, CU-54, CU-55, CU-56 y CU-80, más la generación del comprobante (CU-52).
> - **G3 se declara dueño** de órdenes de trabajo, ejecución en terreno, **SmartOLT** y el
>   **cambio WiFi técnico**. Esto corrige lo que teníamos: el bloque SmartOLT (CU-48 a CU-51)
>   y la ejecución de CU-33 **no son de G8**, son de G3.
>
> Lo que sigue abierto es el mecanismo (si las integraciones van por la base compartida o por
> API). Nuestra respuesta a ese acuerdo, con la contrapropuesta y las 10 preguntas respondidas
> una por una, está en `CAMBIOS-BD-Y-SOLICITUDES.md`, enviado a G8 el 12-09-2026.

> **Datos del bloque Mapa:** la capa de calor se genera desde el KML de planta externa que
> entrega Finet (NAPs, MUFAs y trazado de fibra de la red FTTH) y vive como archivo estático
> en el backend. Los cuatro CU son de lectura, así que el bloque no necesita administración:
> el editor y las tablas que lo sostenían se eliminaron. Actualizar la cobertura significa
> regenerar el archivo con un KML nuevo y desplegar.
> Ver [`apps/controller/docs/cobertura.md`](../apps/controller/docs/cobertura.md).

### Ramas creadas para este incremento

Una rama por bloque, todas creadas desde `dev` el 2026-08-20 (ver [CONTRIBUTING.md](../CONTRIBUTING.md) para el flujo de integración de vuelta a `dev`):

| Rama | Bloque | CU |
|---|---|---|
| `incremento-2/deuda` | Deuda | CU-54, CU-47, CU-80, CU-55, CU-56 |
| `incremento-2/nucleo-pago` | Núcleo de pago | CU-44, CU-45, CU-46, CU-52, CU-53 |
| `incremento-2/smartolt` | SmartOLT | CU-48, CU-49, CU-50, CU-51 |
| `incremento-2/autogestion` | Autogestión | CU-31, CU-32, CU-33 |
| `incremento-2/diagnostico` | Diagnóstico | CU-34, CU-36, CU-35 |
| `incremento-2/soporte` | Soporte | CU-71, CU-78 |
| `incremento-2/administracion` | Administración | CU-57, CU-58 |
| `incremento-2/mapa` | Mapa | CU-59, CU-60, CU-61, CU-62 |

> **Ojo:** estas ramas se crearon el 2026-08-20, antes de la reorganización del 2026-09-28.
> Varios de los CU que listan se aplazaron al Incremento 3 + 4 (CU-46, CU-52, CU-53, CU-48,
> CU-49, CU-50, CU-33, CU-36 y CU-58), y `incremento-2/administracion` se quedó sin el CU-06.
> La tabla se deja tal como estaba porque describe para qué se abrió cada rama.

El orden de dependencia real es el que describe el criterio de agrupación: `deuda` (en especial CU-54) antes que `smartolt`, y `nucleo-pago` puede avanzar en paralelo. `mapa` y `autogestion`/`diagnostico` no dependen de nada del resto del incremento.

---

## Incremento 3 + 4 — Pasarelas, asistente virtual, notificaciones y cierre técnico

23 CU · 28,75% · **Estado: en curso** (arrancado el 2026-09-28)

> **Nota:** el schema ya tiene modelados `conversacion_bot`, `mensaje_bot`,
> `plantilla_notificacion`, `log_notificacion` y `consentimiento_cookies` — el diseño de
> datos de este incremento ya existe y no arranca de cero.

### Criterio de agrupación (del documento fuente)

> Los antiguos Incremento 3 e Incremento 4 se fusionan en un único incremento. Mantiene como
> casos propios las pasarelas de pago Webpay y Mercado Pago (CU-42, CU-43), el bloque completo
> del asistente virtual —que requiere un esquema de datos propio para el historial
> conversacional— (CU-63 a CU-66, CU-70, CU-77, CU-79), las notificaciones asociadas al mismo
> canal de mensajería (CU-67 a CU-69) y el consentimiento de cookies (CU-76).
>
> Se incorporan además los casos CU-52, CU-53, CU-46, CU-58, CU-06, CU-33, CU-36, CU-48,
> CU-49 y CU-50, reubicados desde el Incremento 2 al quedar aplazada su coordinación con
> Grupo 8 (recaudación externa, comprobantes de pago y suspensión/reactivación vía SmartOLT).

### Reparto: qué es nuestro y qué no

De los 23, ocho no los desarrolla el Grupo 2. El criterio es el mismo en todos: **nuestro
alcance es la interfaz web y el asistente virtual del cliente**, no la administración interna
ni la operación técnica de la red.

- **CU-63 a CU-66, CU-70, CU-77 y CU-79** — los lleva Dani.
- **CU-06** — lo desarrolla el CRM (G8).

Los demás tienen actor Administrador o Técnico, o dependen de un contrato de otro grupo que
todavía no está publicado; cada fila lo dice.

| Prioridad | CU | Caso de uso | Bloque | Estado |
|---|---|---|---|---|
| 1 | CU-42 | Pagando deuda mediante la pasarela Webpay de Transbank | Pasarelas | 🔧 Construido, **pendiente de la pasarela y del saldo de G8** — `/pagar` (`apps/view/app/pagar/`) y `src/pagos/`: el cliente se identifica por RUT, código de abonado o enlace firmado, ve el total de su deuda (lo da G8; sin abonos parciales) y elige Webpay. Sin pasarela, cae en la Excepción 1. El total se vuelve a pedir en el servidor; nunca se confía en el del navegador. Los tres "Pagar ahora" llevan a `/pagar`. Falta: la integración con la pasarela (tras leer su documentación), el saldo y el registro del pago de G8. Ver `apps/controller/docs/pagos.md` |
| 2 | CU-43 | Pagando deuda mediante la pasarela Mercado Pago | Pasarelas | 🔧 Construido, **pendiente de la pasarela y del saldo de G8** — `/pagar` (`apps/view/app/pagar/`) y `src/pagos/`: el cliente se identifica por RUT, código de abonado o enlace firmado, ve el total de su deuda (lo da G8; sin abonos parciales) y elige Mercado Pago. Sin pasarela, cae en la Excepción 1. El total se vuelve a pedir en el servidor; nunca se confía en el del navegador. Los tres "Pagar ahora" llevan a `/pagar`. Falta: la integración con la pasarela (tras leer su documentación), el saldo y el registro del pago de G8. Ver `apps/controller/docs/pagos.md` |
| 3 | CU-63 | Solicitando RUT al inicio de la conversación | Chatbot | 🧑 **Dani** — el bloque del asistente virtual no lo llevamos nosotros (acordado el 2026-09-28) |
| 4 | CU-64 | Consultando saldo y estado del servicio vía asistente | Chatbot | 🧑 **Dani** — el bloque del asistente virtual no lo llevamos nosotros (acordado el 2026-09-28) |
| 5 | CU-65 | Respondiendo consultas mediante el asistente virtual | Chatbot | 🧑 **Dani** — el bloque del asistente virtual no lo llevamos nosotros (acordado el 2026-09-28) |
| 6 | CU-66 | Reportando falla y generando solicitud de soporte | Chatbot | 🧑 **Dani** — el bloque del asistente virtual no lo llevamos nosotros (acordado el 2026-09-28) |
| 7 | CU-77 | Creando ticket de soporte al escalar conversación del asistente | Chatbot | 🧑 **Dani** — el bloque del asistente virtual no lo llevamos nosotros (acordado el 2026-09-28) |
| 8 | CU-70 | Derivando conversación a operador humano | Chatbot | 🧑 **Dani** — el bloque del asistente virtual no lo llevamos nosotros (acordado el 2026-09-28) |
| 9 | CU-79 | Auditando historial de sesiones del asistente virtual | Chatbot | 🧑 **Dani** — el bloque del asistente virtual no lo llevamos nosotros (acordado el 2026-09-28) |
| 10 | CU-67 | Despachando recordatorio de pago previo al vencimiento | Notificaciones | ✅ 2026-09-28 — tarea programada diaria en `src/notificaciones/`: detecta las facturas impagas que vencen en 3 días (RF-49) y despacha el correo con el `MailService` que ya existía. Tandas de 50 con pausa (RNF-49.1) y registro en `log_notificacion` con canal, marca de tiempo y estado (RNF-49.2). Excepción 1 (sin canal de contacto) → `omitido`; Excepción 2 (falla el despacho) → reintenta una vez y si falla queda `fallido`. Dos candados contra el correo duplicado: `pg_try_advisory_xact_lock` entre instancias y el registro del día por cliente. Sin cambios de esquema. Ver `apps/controller/docs/notificaciones.md` |
| 11 | CU-68 | Despachando aviso de corte inminente por morosidad | Notificaciones | 🔧 Construido, **pendiente de la pasarela y del saldo de G8** — tarea diaria en `src/notificaciones/aviso-corte.service.ts`: un aviso por cliente el día siguiente al vencimiento de una factura impaga, con la deuda (la da G8, no la calculamos), la fecha de corte (vencimiento + los 4 días de prórroga del §6.7.3) y un enlace firmado para pagar (RF-50, RNF-50.1). Mismas tandas, excepciones y registro que el CU-67. **No despacha hasta tener** la pasarela (precondición del CU) y el saldo de G8; los dos huecos están en `src/common/pendientes.ts`. Ver `apps/controller/docs/notificaciones.md` |
| 12 | CU-69 | Despachando confirmación de pago registrado al cliente | Notificaciones | 🔧 Construido, **pendiente del pago** — `src/notificaciones/confirmacion-pago.service.ts`: con un pago registrado, despacha la confirmación con monto, fecha y código de autorización (RF-51, datos del RF-32) y la registra en `log_notificacion`. Mismas excepciones que el CU-67. No es tarea programada: la dispara el registro del pago (RNF-51.1, "inmediatamente"). **Hoy nada lo llama**: se conecta al construir el checkout (CU-42, CU-43), y falta saber dónde queda registrado el pago (G8). Ver `apps/controller/docs/notificaciones.md` |
| 13 | CU-76 | Gestionando consentimiento de cookies al primer ingreso | SEO/Políticas | ✅ 2026-09-28 — banner en el pie, montado en `app/layout.tsx`, con aceptar y rechazar (RF-57). La decisión persiste en una **cookie cifrada** JWE A256GCM vía `jose` (RNF-57.1, `app/_lib/cookies-consentimiento.servidor.ts`) y se registra en `consentimiento_cookies` con la IP anonimizada. Si ya hay preferencia el banner no sale y no interrumpe la navegación (Excepción 1). El gate `seguimientoPermitido()` apaga el único envío a un tercero que hace el sitio, el de Sentry en `logger.ts`. Comprobado en navegador real: ver `apps/controller/docs/consentimiento.md` |
| 14 | CU-52 | Generando comprobante de pago en formato PDF | Núcleo de pago · aplazado de Inc. 2 | ⏳ Pendiente — schema listo: `pago.comprobante_pdf_url` ya existe |
| 15 | CU-53 | Enviando comprobante de pago al correo del cliente | Núcleo de pago · aplazado de Inc. 2 | ⏳ Pendiente — reutilizable: `MailService`/Nodemailer ya existe (`apps/controller/src/mail/`) |
| 16 | CU-46 | Incorporando abonos de recaudación externa al saldo del cliente | Núcleo de pago · aplazado de Inc. 2 | ⏳ Pendiente |
| 17 | CU-58 | Descargando reporte financiero generado | Administración · aplazado de Inc. 2 | ⏳ Pendiente |
| 18 | CU-06 | Revisando historial de IPs bloqueadas por intentos fallidos | Administración · aplazado de Inc. 2 | ✅ **Lo desarrolla el CRM (G8)**, no es nuestro: el alcance del Grupo 2 es interfaz web y asistente virtual. El módulo `src/admin/` que lo implementaba se eliminó el 2026-09-28 — ninguna interfaz del portal lo consumía. Ojo: el RF-05 (CU-05, bloqueo automático por IP) sigue siendo nuestro y no cambia; lo que salió es la **vista** del historial y el desbloqueo manual |
| 19 | CU-33 | Ejecutando cambio de clave WiFi solicitado por el cliente | Autogestión · aplazado de Inc. 2 | ⏳ Pendiente — la ejecución real contra el equipo del cliente (ONT/router) no está implementada y no es nuestra. **Quién la hace**: según el acuerdo de integración de G8 del 12-09-2026, **G8 valida comercialmente y G3 ejecuta técnicamente** (SmartOLT es de G3, ver la nota de reparto más abajo). Antes teníamos anotado que la aplicaba G8 vía Smart OLT; ese documento lo corrige. **Cómo obtienen la clave**: descifran `solicitud_contrasena_wifi.password_nueva_cifrada` con la llave privada RSA (nosotros ciframos con la pública, `CRM_PUBLIC_KEY`), y al marcar `APLICADA` dejan esa columna en `NULL` — con eso la fila deja de guardar cualquier secreto. Si la columna cifrada llega en `NULL` es que faltaba la llave: hay que pedirle la clave al cliente. **Abierto**: de quién es la llave privada, de G8 o de G3 — lo tienen que definir entre ellos |
| 20 | CU-36 | Ejecutando evaluación de red para diagnóstico técnico | Diagnóstico · aplazado de Inc. 2 | ⏳ Pendiente — alcance a confirmar con el equipo (no hay evidencia de un flujo propio más allá del widget de Ookla) |
| 21 | CU-48 | Suspendiendo servicio por morosidad mediante SmartOLT | SmartOLT · aplazado de Inc. 2 | ⏳ Pendiente — sin integración SmartOLT en el código. **Derivado**: la detección de morosidad es de G8 y la ejecución en SmartOLT es de **G3** (acuerdo del 12-09-2026) |
| 22 | CU-49 | Aplicando recargo de reconexión al saldo del cliente suspendido | SmartOLT · aplazado de Inc. 2 | ⏳ Pendiente |
| 23 | CU-50 | Reactivando servicio de cliente suspendido tras pago total | SmartOLT · aplazado de Inc. 2 | ⏳ Pendiente |

### Pendientes del CU-73

Las páginas están publicadas con el contenido de `legales-isp-v2.md`. Donde falta un dato, la página deja el **espacio en blanco** (el lector de pantalla lo anuncia como "dato pendiente"). Al recibir un dato se completa en el archivo indicado, que cambia en todo el sitio, y se tacha de esta lista. No es asesoría legal: si Finet contrata un abogado, estos textos son el punto de partida para su revisión.

**Datos que faltan**

| Dato | Dónde se ve | Dónde se completa | Quién lo entrega |
|---|---|---|---|
| RUT de la razón social | Encabezado de Términos, Privacidad §1 | `company.ts` → `COMPANY_RUT` | Administración |
| Calle y número del domicilio | Encabezado de Términos, Privacidad §1 y §14 | `company.ts` → `COMPANY_STREET_ADDRESS` | Administración |
| Correo de contacto general | Términos §2, §5 y §6 | `company.ts` → `COMPANY_CONTACT_EMAIL` | Administración |
| Correo de privacidad | Privacidad §1, §12 y §14 | `company.ts` → `COMPANY_PRIVACY_EMAIL` | Administración |
| Velocidad mínima garantizada, sobreventa, disponibilidad, latencia y pérdida, direccionamiento IP | Términos §4, tabla de características | `legal.ts` → `CALIDAD_SERVICIO` | Área técnica |
| Medidas de seguridad de red (p. ej. bloqueo de puertos de abuso) | Términos §4, gestión de tráfico | `legal.ts` → `CALIDAD_SERVICIO.medidasSeguridadRed` | Área técnica |
| Fecha de la primera medición del tiempo de reposición, y luego una fila por trimestre | Términos §4, indicadores | `legal.ts` → `CALIDAD_SERVICIO.primeraMedicionReposicion` | Área técnica |
| Mecanismo de descuento por interrupción | Términos §7 | `legal.ts` → `CONDICIONES_CONTRATO.mecanismoCompensacion` | Administración |
| Comuna de los tribunales competentes | Términos §10 | `legal.ts` → `CONDICIONES_CONTRATO.comunaTribunales` | Administración |
| Pasarela de pago, facturación electrónica y proveedor de correo | Privacidad §3 y §7 | `legal.ts` → `PROVEEDORES` | Desarrollo + administración |
| Región de Railway donde se aloja la base | Privacidad §9 | `legal.ts` → `PROVEEDORES.regionAlojamiento` | Desarrollo |
| Plazos de conservación: registros de red, accesos al Portal, tickets, solicitudes sin contrato | Privacidad §6 | `legal.ts` → `PLAZOS_DATOS` | Administración |
| Plazo de respuesta a solicitudes de derechos | Privacidad §12 | `legal.ts` → `PLAZOS_DATOS.respuestaDerechos` | Administración |

Los archivos están en `apps/view/app/_lib/`.

**Afirmaciones del documento fuente que se publicaron sin poder verificarlas desde el código** (confirmar con Finet y corregir si no aplican):

- Términos §4: que no se aplica gestión de tráfico que priorice o degrade servicios, y que la tecnología es GPON.
- Términos §5: el plazo de 1 día hábil para dar término al contrato y la confirmación con folio.
- Privacidad §3: que no se inspecciona ni guarda contenido de comunicaciones ni historial de navegación (depende de si hay logs de DNS o NetFlow).
- Privacidad §7: SmartOLT como plataforma de gestión de red.
- Privacidad §10: respaldos periódicos, separación de ambientes y acuerdos de confidencialidad.

**Decisiones que cambian el texto si la respuesta es sí**:

1. ¿Hay Analytics, Pixel, Tag Manager o chat de terceros en el sitio? → hace falta banner de consentimiento (CU-76) y reescribir Privacidad §5.
2. ¿Se reporta morosidad a Boletín Comercial o Equifax? → declararlo en Privacidad §7.
3. ¿Se graban las llamadas de soporte? → aviso al inicio de la llamada.
4. ¿El aliado regional accede a datos de clientes? → declararlo como destinatario en Privacidad §7.
5. ¿Está configurado Sentry (`NEXT_PUBLIC_SENTRY_DSN`) en producción? → declararlo como destinatario en Privacidad §7.

**Fuera del alcance del sitio** (obligaciones de la empresa, requieren abogado): registro de actividades de tratamiento, contratos con encargados, procedimiento de brechas ante la Agencia de Datos y la ANCI, protocolo de requerimientos de autoridad y revisión del contrato de servicio contra la Ley 19.496 y la normativa de Subtel.

---

## Deuda técnica anotada — I3 / I4 (2026-09-28)

Pendientes detectados al revisar el bloque SEO y legales contra el Documento 0
definitivo. Ninguno cambia el estado de un CU de arriba: son trabajo que falta,
no correcciones de lo marcado. El detalle y el porqué están en la bitácora
[2026-09-28-ip-consentimiento-y-legales.md](2026-09-28-ip-consentimiento-y-legales.md).

| # | Pendiente | Incremento | CU que toca | ¿Cambia diagramas de flujo? |
|---|---|---|---|---|
| 1 | **Cifrado de IPs con llave + índice ciego.** Va junto con la tarea de la clave WiFi, mismo mecanismo (`publicEncrypt` + `CRM_PUBLIC_KEY`) y mismo punto abierto: quién custodia la llave privada. Hoy `sesion_portal.ip_origen`, `intento_fallido.ip_address` y la auditoría de perfil guardan la IP exacta del cliente en la base compartida | I3 o I4, con CU-33 | CU-05, CU-06, CU-75 | **Sí** — autenticación y administración: el flujo suma cifrado, índice ciego y descifrado |
| 2 | **Endurecer `GET /api/admin/intentos-fallidos`**, que entrega RUT + IP tras una cabecera `x-api-key` estática | I4 | CU-06 | No |
| 3 | **El formulario público debe persistir solo Prospecto** (§4 del acuerdo v2.0 con G8). Hoy crea Cliente, Contrato y OT en la misma transacción | I4 | CU-18, CU-75 | **Sí** — contratación |
| 4 | **CU-76, banner de consentimiento de cookies.** La tabla `consentimiento_cookies` ya existe con su columna `ip_anonimizada`, que debe usar el mismo formato que `common/utils/ip.ts` | I4 | CU-76 | No, es CU nuevo |

**Lo que no quedó cerrado del CU-75:** el RNF-59.1 pide la IP del consentimiento
anonimizada. Se implementó (se guarda la red, no la IP exacta), pero es una
medida provisional: ese registro no lo lee ningún flujo, así que anonimizarlo no
protege las IPs que sí se usan. El pendiente 1 es el que cierra el asunto.

---

## Requisitos Funcionales (RF)

El documento de incrementos no cubre RF-XX — estos números vienen de `apps/controller/docs/*.md` (contrato de API), fuente distinta y ya vigente desde antes del Incremento 1:

| RF | Descripción | CU relacionados |
|---|---|---|
| RF-01 | Login con RUT + contraseña | CU-01 |
| RF-02 | Logout | CU-02 |
| RF-03 | Recuperación de contraseña vía email, sin revelar si el RUT existe | CU-03 |
| RF-05 | Bloqueo temporal por intentos fallidos por IP (5 en 5 min → 15 min) | CU-05 |
| RF-07 | Cierre de sesión automático por inactividad (15 min) | CU-12 |
| RF-09 | Política de complejidad de contraseña (mín. 8, 1 mayúscula, 1 número) | CU-03, CU-10, CU-11 |
| RF-10 | Registro: email obligatorio, confirmación de contraseña, unicidad de RUT/email | CU-04 |
| RF-24 | Contraseña WiFi: solo caracteres alfanuméricos | CU-31 |

RF-04, RF-08 y los que faltan entre RF-11 y RF-23 no tienen referencia encontrada en código ni docs — no se completaron para no inventar contenido.
