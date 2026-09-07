# Casos de Uso por Incremento

Fuente de verdad: documento de requisitos `CU_por_Incremento` (aportado por el equipo, no versionado en el repo — pedirlo a quien lo mantenga si hace falta la versión original). Este archivo transcribe su contenido para que quede consultable desde el código y no se pierda entre conversaciones.

80 casos de uso repartidos en 4 incrementos:

| Incremento | Alcance | CU | % | Estado |
|---|---|---|---|---|
| **Incremento 1** | Experiencia del cliente, sitio web, portal y autoservicio | 34 | 42,5% | ✅ Implementado |
| **Incremento 2** | Gestión operacional, deuda, soporte y administración interna | 29 | 36,25% | ⏳ **En curso** |
| **Incremento 3** | Pasarelas de pago y asistente virtual | 12 | 15% | No iniciado |
| **Incremento 4** | SEO, políticas, privacidad y cierre técnico | 5 | 6,25% | No iniciado |

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

## Incremento 2 — Gestión operacional, deuda, soporte y administración interna

29 CU · 36,25% · **Estado: en curso** (arrancado el 2026-08-20)

### Criterio de agrupación (del documento fuente)

> El incremento deja operativo el ciclo completo de deuda y cobranza sin depender de ninguna pasarela de pago externa. Los casos CU-44, CU-45, CU-46, CU-52 y CU-53 constituyen la capa de dominio del pago: registro de abonos, validación de unicidad de transacción, actualización de saldo y emisión de comprobante. Esta capa se alimenta en el incremento mediante CU-46, es decir, pagos ingresados por recaudación externa.
>
> Con ello el flujo queda cerrado de extremo a extremo: vencimiento del contrato (CU-54), detección de morosidad (CU-47, CU-80), suspensión del servicio vía SmartOLT (CU-48), registro del pago (CU-44), aplicación del recargo de reconexión (CU-49), reactivación (CU-50) y emisión del comprobante (CU-52, CU-53).
>
> El orden interno parte por CU-54 porque sin fecha de vencimiento asignada no existe el concepto de contrato vencido, del cual dependen todos los casos posteriores de morosidad y suspensión.
>
> El visor cartográfico (CU-59 a CU-62) se adelanta a este incremento porque corresponde a funcionalidad de frontend sobre capas de mapa, sin dependencia del asistente virtual ni de su base de datos.

### Casos de uso y estado real en el código (auditado 2026-08-20)

| Prioridad | CU | Caso de uso | Bloque | Estado |
|---|---|---|---|---|
| 1 | CU-54 | Asignando fecha de vencimiento fija a un contrato | Deuda | ⏳ Pendiente — `contrato` no tiene campo de fecha de vencimiento fija en el schema (solo `dia_vencimiento`, un día del mes) |
| 2 | CU-47 | Identificando contratos morosos en revisión diaria automática | Deuda | ⏳ Pendiente |
| 3 | CU-80 | Configurando parámetros de detección de morosidad | Deuda | ⏳ Pendiente — no hay modelo de configuración para esto todavía |
| 4 | CU-55 | Consultando lista de contratos con saldos vencidos | Deuda | ⏳ Pendiente |
| 5 | CU-56 | Gestionando seguimiento de contrato vencido seleccionado | Deuda | ⏳ Pendiente |
| 6 | CU-44 | Registrando pago confirmado con trazabilidad financiera | Núcleo de pago | ⏳ Pendiente — schema listo: `model pago` ya existe (`prisma/schema.prisma`) |
| 7 | CU-45 | Validando unicidad de código de transacción para evitar duplicados | Núcleo de pago | ⏳ Pendiente — schema listo: `pago.codigo_transaccion` ya es `@unique` |
| 8 | CU-46 | Incorporando abonos de recaudación externa al saldo del cliente | Núcleo de pago | ⏳ Pendiente |
| 9 | CU-52 | Generando comprobante de pago en formato PDF | Núcleo de pago | ⏳ Pendiente — schema listo: `pago.comprobante_pdf_url` ya existe |
| 10 | CU-53 | Enviando comprobante de pago al correo del cliente | Núcleo de pago | ⏳ Pendiente — reutilizable: `MailService`/Nodemailer ya existe (`apps/controller/src/mail/`) |
| 11 | CU-48 | Suspendiendo servicio por morosidad mediante SmartOLT | SmartOLT | ⏳ Pendiente — sin integración SmartOLT en el código |
| 12 | CU-49 | Aplicando recargo de reconexión al saldo del cliente suspendido | SmartOLT | ⏳ Pendiente |
| 13 | CU-50 | Reactivando servicio de cliente suspendido tras pago total | SmartOLT | ⏳ Pendiente |
| 14 | CU-51 | Registrando bitácora de eventos de suspensión y reactivación | SmartOLT | ⏳ Pendiente — podría reutilizar `log_auditoria` en vez de un modelo nuevo |
| 15 | CU-31 | Validando formato de nueva clave de red inalámbrica | Autogestión | 🚧 Parcial — frontend y validación ya implementados: `apps/view/app/_components/portal/WifiPasswordSection.tsx` |
| 16 | CU-32 | Solicitando cambio de contraseña de red inalámbrica | Autogestión | 🚧 Parcial — el Server Action `changeWifiPassword` (`apps/view/app/portal/_lib/portal-actions.ts`) ya llama a `POST /portal/wifi/password`, pero **ese endpoint no existe en el backend** — solo falta implementarlo ahí |
| 17 | CU-33 | Ejecutando cambio de clave WiFi solicitado por el cliente | Autogestión | ⏳ Pendiente — la ejecución real contra el equipo del cliente (ONT/router) no está implementada |
| 18 | CU-34 | Iniciando prueba de velocidad de red con herramienta Ookla | Diagnóstico | 🚧 Parcial — widget de Speedtest.net embebido (`OoklaSpeedTest.tsx`), sin backend propio ni persistencia de resultados |
| 19 | CU-36 | Ejecutando evaluación de red para diagnóstico técnico | Diagnóstico | ⏳ Pendiente — alcance a confirmar con el equipo (no hay evidencia de un flujo propio más allá del widget de Ookla) |
| 20 | CU-35 | Visualizando resultados de la evaluación de red | Diagnóstico | 🚧 Parcial — el widget de Ookla muestra resultados inline, pero no hay componente propio ni persistencia |
| 21 | CU-71 | Registrando solicitud de soporte técnico desde el portal | Soporte | ⏳ Pendiente — `portal/tickets` hoy es solo lectura (CU-29/30), no existe creación de tickets desde el cliente |
| 22 | CU-78 | Actualizando estado y cerrando ticket de soporte asignado | Soporte | ⏳ Pendiente — es un flujo de agente/admin, no del portal de cliente |
| 23 | CU-57 | Generando reporte financiero del período seleccionado | Administración | ⏳ Pendiente |
| 24 | CU-58 | Descargando reporte financiero generado | Administración | ⏳ Pendiente |
| 25 | CU-06 | Revisando historial de IPs bloqueadas por intentos fallidos | Administración | 🚧 Parcial/✅ — `GET /admin/intentos-fallidos` (`apps/controller/src/admin/`) ya devuelve exactamente esto, con filtros `bloqueados`/`ip`/`rut` y paginado. Revisar si falta UI de administración o si el endpoint ya cubre el CU |
| 26 | CU-59 | Accediendo al visor cartográfico de factibilidad técnica | Mapa | ✅ — `/cobertura` monta Leaflet vía `GET /api/cobertura/config` |
| 27 | CU-60 | Visualizando capa de mapa de calor de cobertura | Mapa | ✅ — `leaflet.heat` sobre `GET /api/cobertura/puntos` (capa estática generada desde el KML de planta externa) |
| 28 | CU-61 | Aplicando zoom sobre el mapa de factibilidad | Mapa | ✅ — rueda/doble click/pellizco, acotado por `zoom_min`/`zoom_max` del backend |
| 29 | CU-62 | Desplazándose por el mapa de factibilidad mediante paneo | Mapa | ✅ — arrastre con puntero o táctil, acotado por `maxBounds` |

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
| `incremento-2/administracion` | Administración | CU-57, CU-58, CU-06 |
| `incremento-2/mapa` | Mapa | CU-59, CU-60, CU-61, CU-62 |

El orden de dependencia real es el que describe el criterio de agrupación: `deuda` (en especial CU-54) antes que `smartolt`, y `nucleo-pago` puede avanzar en paralelo. `mapa` y `autogestion`/`diagnostico` no dependen de nada del resto del incremento.

---

## Incremento 3 — Pasarelas de pago y asistente virtual

12 CU · 15% · No iniciado

> **Nota:** el schema de Prisma ya tiene modelado `conversacion_bot`, `mensaje_bot`, `plantilla_notificacion` y `log_notificacion` — el diseño de datos para este incremento ya existe, no arranca de cero cuando llegue el momento. `apps/view/app/portal/_lib/portal-actions.ts` también tiene ya un `initiatePayment()` que llama a `POST /portal/payment/initiate` (endpoint que todavía no existe en el backend) — scaffolding temprano para CU-42/43.

### Criterio de agrupación (del documento fuente)

> CU-42 y CU-43 incorporan el canal de pago en línea sobre una capa de dominio ya construida y verificada en el Incremento 2. Ambas pasarelas se integran contra la misma interfaz de pago, lo que permite desarrollarlas en paralelo durante el Incremento 2 sin alterar la planificación, dado que el contrato de interfaz ya se encuentra definido. Este bajo acoplamiento es el fundamento de agrupar ambas integraciones en un mismo incremento.
>
> El bloque de asistente virtual se mantiene íntegro en este incremento por requerir un esquema de datos propio para el historial conversacional. Los casos de despacho de notificaciones (CU-67, CU-68, CU-69) se ubican aquí porque comparten el canal de mensajería del asistente; adelantarlos obligaría a construir dicho canal antes de tiempo.

| Prioridad | CU | Caso de uso | Bloque |
|---|---|---|---|
| 1 | CU-42 | Pagando deuda mediante la pasarela Webpay de Transbank | Pasarelas |
| 2 | CU-43 | Pagando deuda mediante la pasarela Mercado Pago | Pasarelas |
| 3 | CU-63 | Solicitando RUT al inicio de la conversación | Chatbot |
| 4 | CU-64 | Consultando saldo y estado del servicio vía asistente | Chatbot |
| 5 | CU-65 | Respondiendo consultas mediante el asistente virtual | Chatbot |
| 6 | CU-66 | Reportando falla y generando solicitud de soporte | Chatbot |
| 7 | CU-77 | Creando ticket de soporte al escalar conversación del asistente | Chatbot |
| 8 | CU-70 | Derivando conversación a operador humano | Chatbot |
| 9 | CU-79 | Auditando historial de sesiones del asistente virtual | Chatbot |
| 10 | CU-67 | Despachando recordatorio de pago previo al vencimiento | Notificaciones |
| 11 | CU-68 | Despachando aviso de corte inminente por morosidad | Notificaciones |
| 12 | CU-69 | Despachando confirmación de pago registrado al cliente | Notificaciones |

## Incremento 4 — SEO, políticas, privacidad y cierre técnico

5 CU · 6,25% · No iniciado

| Prioridad | CU | Caso de uso |
|---|---|---|
| 1 | CU-72 | Generando etiquetas de indexación por sección y plan |
| 2 | CU-73 | Accediendo a términos, condiciones y políticas de privacidad |
| 3 | CU-74 | Generando y actualizando archivos de indexación del sitio |
| 4 | CU-75 | Registrando aceptación de políticas de privacidad en formularios |
| 5 | CU-76 | Gestionando consentimiento de cookies al primer ingreso |

---

## Requisitos Funcionales (RF)

El documento de incrementos no cubre RF-XX — estos números vienen de `apps/controller/docs/*.md` (contrato de API), fuente distinta y ya vigente desde antes del Incremento 1:

| RF | Descripción | CU relacionados |
|---|---|---|
| RF-01 | Login con RUT + contraseña | CU-01 |
| RF-02 | Logout | CU-02 |
| RF-03 | Recuperación de contraseña vía email, sin revelar si el RUT existe | CU-03 |
| RF-05 | Bloqueo temporal por intentos fallidos por IP (5 en 5 min → 15 min) | CU-05 |
| RF-06 | Desbloqueo manual de IP por admin | CU-06 |
| RF-07 | Cierre de sesión automático por inactividad (15 min) | CU-12 |
| RF-09 | Política de complejidad de contraseña (mín. 8, 1 mayúscula, 1 número) | CU-03, CU-10, CU-11 |
| RF-10 | Registro: email obligatorio, confirmación de contraseña, unicidad de RUT/email | CU-04 |
| RF-24 | Contraseña WiFi: solo caracteres alfanuméricos | CU-31 |

RF-04, RF-08 y los que faltan entre RF-11 y RF-23 no tienen referencia encontrada en código ni docs — no se completaron para no inventar contenido.
