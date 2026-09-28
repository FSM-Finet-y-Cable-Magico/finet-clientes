# Mapa de rutas

Todas las rutas viven en `app/`. Las protegidas por sesión están marcadas 🔒 (ver `proxy.ts`, matcher `/portal/:path*` y `/perfil/:path*`).

## Públicas — landing y marketing

| Ruta | Descripción |
|---|---|
| `/` | Home |
| `/planes` | Catálogo de planes — `GET /api/landing/planes` (CU-15/CU-17) |
| `/contratar/[planId]` | Formulario de contratación de un plan (CU-18) |
| `/empresas` | Landing para empresas |
| `/tv`, `/tv/canales`, `/tv/parrilla` | Landing de TV |
| `/cobertura` | Visor cartográfico de factibilidad — `GET /api/cobertura/config`, `GET /api/cobertura/puntos` (CU-59 a CU-62) |
| `/velocidad` | Test de velocidad |
| `/ayuda` | Preguntas frecuentes y contacto de soporte |
| `/terminos`, `/privacidad` | Legal (CU-73), servidas con ISR (`revalidate = 86400`, RNF-56.1): contenido estático que se regenera una vez al día. Reclamos y Ley 21.398 son secciones de Términos (`#reclamos`, `#termino`); las URLs viejas `/legal/*` redirigen ahí. Datos pendientes en [CASOS-DE-USO.md](../../../docs/CASOS-DE-USO.md#pendientes-del-cu-73) |

## Públicas — auth y consulta de deuda

| Ruta | Endpoint(s) | Caso de uso |
|---|---|---|
| `/inicio-sesion` | `POST /api/auth/login` | CU-01 |
| `/recuperar-password` | `POST /api/auth/recuperar-password` | CU-03 |
| `/restablecer-password` | `POST /api/auth/restablecer-password` | CU-03 / RF-09 |
| `/consultar-deuda` | `GET /api/deuda-publica/rut`, `GET /api/deuda-publica/abonado` | CU-39 / CU-40 / CU-41 |

El registro de cuenta (CU-04, `POST /api/auth/register`) se sirve desde el mismo flujo de `/inicio-sesion` (`RegisterForm.tsx` + `AuthSwitch.tsx`), no tiene ruta propia.

## Protegidas 🔒

| Ruta | Endpoint(s) | Caso de uso |
|---|---|---|
| `/perfil` | `GET/PATCH /api/auth/perfil`, `PATCH /api/auth/perfil/{telefono,email,password}` | CU-07 a CU-11 |
| `/portal` | `GET /api/portal/panel` | CU-23 / CU-24 |
| `/portal/servicios` | `GET /api/portal/contratos/vigentes` | CU-25 / CU-26 |
| `/portal/deuda` | `GET /api/portal/deuda` | CU-27 / CU-28 / CU-41 |
| `/portal/tickets` | `GET /api/portal/tickets` | CU-29 / CU-30 |

Si el JWT falta o es inválido, `proxy.ts` redirige a `/inicio-sesion?redirect=<ruta>` (y `?expired=1` si el token existía pero no era válido).

## Indexación (CU-72 / CU-74)

Cada ruta pública se declara en [`app/_lib/rutas-publicas.ts`](../app/_lib/rutas-publicas.ts). De ese registro salen `sitemap.xml`, `robots.txt` y el `noindex` de las páginas no indexables. Al agregar o borrar una página hay que actualizarlo: `rutas-publicas.test.ts` falla si no coincide con las `page.tsx` de `app/`.

- **`/sitemap.xml`**: rutas indexables más un `/contratar/<id>` por plan del catálogo. Se regenera en cada build y cada 5 minutos.
- **`/robots.txt`**: bloquea `/api/` y las rutas protegidas. Las públicas no indexables (`/recuperar-password`, `/restablecer-password`) no se bloquean, llevan `noindex` para que el buscador pueda leerlo.
- **Si el backend no responde**, no se publica un sitemap sin planes. En el servidor se sigue sirviendo la última versión válida, y el log muestra una línea `[CU-74] sitemap.xml: no se pudo leer el catalogo de planes`. En el build ese error lo hace fallar, para que el deploy anterior siga con sus archivos: **para compilar el view, el controller tiene que estar respondiendo** en `NEXT_PUBLIC_API_URL`.

Para verificar lo publicado, abrir `<NEXT_PUBLIC_SITE_URL>/sitemap.xml` y `<NEXT_PUBLIC_SITE_URL>/robots.txt`.

## Referencia cruzada

La documentación de contrato de cada endpoint (bodies, respuestas, errores) vive en `apps/controller/docs/*.md`, no aquí — este archivo solo mapea ruta → endpoint → caso de uso para no duplicar contenido que se desactualiza fácil.
