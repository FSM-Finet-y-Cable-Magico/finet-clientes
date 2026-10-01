# IP del consentimiento, ISR en las legales y sitemap — revisión contra el Documento 0 definitivo

**Fecha:** 2026-09-28 · **Rama:** `I3-I2` · **Alcance:** CU-73, CU-74, CU-75 (bloque SEO y legales, ya mergeado en `dev` vía PR #16)

El Documento 0 definitivo llegó hoy. Los CU-72 a CU-75 se implementaron con las
tablas de casos de uso a la vista, pero sin los requisitos no funcionales. Al
leerlos aparecieron tres desviaciones. Este documento deja escrito qué se hizo
con cada una, y sobre todo **qué quedó sin resolver**.

Resumen:

| RNF | CU | Qué se hizo | ¿Queda cerrado? |
|---|---|---|---|
| RNF-59.1 | CU-75 | Se guarda la red (`/24`, `/48`) en vez de la IP exacta | **No.** Medida provisional |
| RNF-56.1 | CU-73 | `revalidate` explícito en las dos páginas, con test | Sí |
| RNF-58.1 | CU-74 | Nada. Se mantiene la arquitectura actual | Sí, como decisión tomada |

No hubo cambios de schema, así que no se disparó el anuncio previo a G8 (§13 del
acuerdo v2.0).

---

## RNF-59.1 — La IP del consentimiento: lo que se hizo y lo que NO

El RNF pide que el consentimiento se registre con la IP anonimizada. Hoy
`log_auditoria.ip_origen` guardaba la IP exacta.

**Lo que se hizo:** `apps/controller/src/common/utils/ip.ts`, funciones puras,
convierte `203.0.113.7` en `203.0.113.0/24` y una IPv6 en su `/48`. La usa solo
`common/politica-privacidad.ts`, es decir solo la fila
`ACEPTAR_POLITICA_PRIVACIDAD` que escriben el formulario de contratación
(CU-18/CU-75) y el registro de cuenta (CU-04/CU-75).

**Por qué esto no cierra nada.** Nadie lee esa fila: `log_auditoria` es de solo
escritura en todo el código. Anonimizar un dato que ningún flujo consulta
reduce el rastro que queda guardado durante años, y nada más. **La exposición
real está en otra parte**, en las IPs que sí se usan y que quedan exactas en la
base compartida con los otros tres grupos:

- `sesion_portal.ip_origen` — IP exacta ligada al `id_cliente`.
- `intento_fallido.ip_address` — IP exacta junto al `rut_intentado`.
- `log_auditoria` de perfil y de administración — IP exacta del cliente.
- `GET /api/admin/intentos-fallidos` — entrega RUT + IP protegido solo por una
  cabecera `x-api-key` estática.

Esas tres columnas **tienen que seguir exactas mientras el mecanismo sea este**:
el RF-05 bloquea una IP exacta y el CU-06 la desbloquea y la muestra al
administrador. Anonimizarlas rompería el bloqueo. Por eso hay un test de no
regresión que exige que `sesion_portal.create` siga recibiendo la IP completa:
para que nadie "mejore" esto de más.

Quien pueda leer la base sigue viendo IPs completas de clientes. Es
minimización, no protección.

### La solución real, pendiente: cifrado con llave + índice ciego

Va **atada a la tarea de la clave WiFi** (CU-33, I3 o I4), porque usa el mismo
mecanismo que ya existe en el repo: `publicEncrypt` con RSA-OAEP-SHA256 y
`CRM_PUBLIC_KEY` (`portal.service.ts:606-640`).

Diseño:

- La IP se guarda cifrada. La llave privada no vive en la base, así que otro
  grupo con acceso a Railway ve solo el criptograma.
- Tiene que ser **cifrado reversible, no un hash**: el CU-06 exige mostrarle la
  IP al administrador.
- El bloqueo compara la IP exacta en cinco puntos (`auth.service.ts:84,115,368,484`
  y `admin.service.ts:84`) y el panel las agrupa (`admin.service.ts:161`). Con la
  IP cifrada esas comparaciones dejan de funcionar, así que hace falta además un
  **índice ciego**: un HMAC de la IP con una clave que solo tiene el backend,
  para comparar y agrupar sin guardar el valor legible.

Lo que arrastra, y por eso no cabe en este arreglo:

1. Las tres columnas son `@db.Inet`. Cifrar obliga a cambiar el schema de la
   base compartida, con anuncio previo a G8 (§13 del acuerdo v2.0).
2. Toca el CU-05 y el CU-06, ya cerrados, incluido el bloqueo por IP.
3. Hay que decidir **quién custodia la llave privada** — el mismo punto que
   sigue abierto con G8 y G3 para la clave WiFi.
4. **Obliga a rehacer los diagramas de flujo** del bloque de autenticación
   (CU-05, CU-06) y el del registro de aceptación. No es un cambio interno: el
   flujo pasa a tener un paso de cifrado y otro de índice ciego, y el desbloqueo
   pasa a tener un paso de descifrado.
5. Los logs del proxy y del hosting seguirán conteniendo IPs. Eso no lo resuelve
   el cifrado, se resuelve con política de retención.

**Por eso el CU-75 no se marca como cumplido en la parte de la IP.** El estado
del CU en `CASOS-DE-USO.md` no se tocó.

---

## RNF-56.1 — ISR en las páginas legales

El RNF pide que el contenido legal se sirva con Incremental Static Regeneration.

Las dos páginas ya eran estáticas puras: su contenido son constantes de
`app/_lib/legal.ts` y `company.ts`, sin consultas a la base. Next las prerenderiza
en el build y las sirve desde el archivo, que es **más rápido** que ISR, no menos.
El objetivo del RNF (contenido legal servido estático) ya se cumplía; lo que
faltaba era la letra.

Se agregó una línea por página:

```ts
export const revalidate = 86400;
```

Efecto real: la página se sigue sirviendo estática, y además se regenera sola una
vez al día. Antes, cambiar un texto legal exigía un redeploy; ahora el redeploy
sigue siendo el camino normal, pero la página no queda congelada para siempre.

Se comprobó que no cambió nada más: el HTML servido es **idéntico byte a byte**
salvo el build ID que Next inyecta en cada compilación (21 bytes contiguos, el
resto del archivo igual). El `next build` muestra `1d` de revalidate únicamente
en `/terminos` y `/privacidad`; el resto de la tabla de rutas, igual. Los tests
que ya existían (`LegalPages.test.tsx`) no se tocaron y siguen pasando; se sumó
`LegalISR.test.ts` para que borrar el `revalidate` rompa algo visible.

---

## RNF-58.1 — El sitemap: se mantiene como está

El RNF dice que el backend expone el XML del sitemap consultando la base en
tiempo real. Hoy lo genera `apps/view/app/sitemap.ts` (el servidor del portal),
que consulta al backend por los planes activos.

**No se cambió, y es la única de las tres que requiere modificar el Documento 0.**
Razones:

1. Las rutas públicas son del frontend. El registro único
   (`app/_lib/rutas-publicas.ts`) alimenta también `robots.txt` y el `noindex`,
   y un test falla si no coincide con las `page.tsx` reales. Mover el sitemap al
   backend obliga a duplicar ese registro en un servicio que no sabe qué páginas
   existen — y una lista duplicada se desincroniza.
2. Lo que pide el RNF ya ocurre: el servidor del portal **es** un backend, y el
   XML se arma consultando los planes activos por API. Lo que no se cumple es
   *cuál* de los dos servidores lo sirve.
3. "En tiempo real" contradice la **Excepción 1 del propio CU-74**, que exige
   conservar la última versión válida si no se puede leer el catálogo. Eso es
   justamente lo que hace la implementación actual.
4. El host de producción de la API todavía no está definido, así que apuntar el
   sitemap ahí agregaría un punto de falla sin dirección conocida.

La propuesta de redacción para el documento está en el `.md` entregado al equipo.

---

## Verificación de que nada se rompió

Antes de tocar código se tomó una línea base: tests, tabla de rutas del build,
captura de las respuestas de la API y de las filas que quedan en la base, y un
snapshot de etiquetas de las 16 rutas públicas más `sitemap.xml` y `robots.txt`.
Después se repitió todo y se comparó.

| Qué | Resultado |
|---|---|
| `pnpm -r test` | 226 controller (antes 199, +27 nuevos) y 96 view (antes 94, +2), ninguno roto |
| `tsc` y lint | Sin errores nuevos |
| `next build` | `1d` de revalidate solo en `/terminos` y `/privacidad` |
| HTML de las legales | Idéntico byte a byte salvo el build ID de Next |
| Snapshot de las 16 rutas públicas | Idéntico, incluidos `sitemap.xml` y `robots.txt` |
| Contratación sin la casilla | Mismo 400 y mismo mensaje, no crea nada |
| Contratación con la casilla | Misma respuesta 201 con los mismos IDs |
| Fila del consentimiento, en desarrollo | `ip_origen = 127.0.0.0/24` (antes `::ffff:127.0.0.1`) |
| Fila del consentimiento, en producción con `X-Forwarded-For` | `203.0.113.0/24` |
| `sesion_portal.ip_origen` | IP completa, sin cambio |
| `intento_fallido.ip_address` | IP completa, sin cambio |
| Auditoría de `ACTUALIZAR_TELEFONO` | IP completa, sin cambio |
| Schema | Sin migraciones ni `prisma generate`. Postgres acepta `'203.0.113.0/24'::inet` en la columna que ya existe |

**Ningún flujo de un CU cerrado cambió.** En el CU-75 cambia la precisión de un
dato almacenado que el caso de uso no menciona: mismos pasos, mismo contrato de
API, mismos mensajes. En el CU-73 cambia cómo se regenera la página en el
servidor: mismo contenido y misma navegación. En el CU-74 no cambia nada. Los
diagramas de flujo actuales siguen siendo correctos — el que los va a obligar a
cambiar es el cifrado pendiente descrito arriba.

## Un cambio de estructura que ya viene, por el acuerdo con G8

`RegistroAceptacion` pasó de recibir `id_cliente` a recibir `entidad`
(`'cliente' | 'prospecto'`) más `id_entidad`. Hoy los dos llamadores siguen
pasando `'cliente'`, así que no cambia nada, pero el §4 del acuerdo v2.0 con G8
obliga a que el formulario público persista **solo Prospecto** (hoy crea Cliente,
Contrato y OT). Cuando eso se haga, la aceptación tendrá que apuntar al
prospecto, y la firma ya lo permite sin volver a tocar este módulo. Ese cambio
sí afecta al CU-18 y al CU-75, y también cambia diagramas.
