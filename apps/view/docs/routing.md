# Mapa de rutas

Todas las rutas viven en `app/`. Las protegidas por sesión están marcadas 🔒 (ver `proxy.ts`, matcher `/portal/:path*` y `/perfil/:path*`).

## Públicas — landing y marketing

| Ruta | Descripción |
|---|---|
| `/` | Home |
| `/planes` | Catálogo de planes — `GET /api/landing/planes` (CU-15/CU-17) |
| `/contratar/[planId]` | Formulario de contratación de un plan (CU-18) |
| `/hogar`, `/hogar/internet`, `/hogar/duo`, `/hogar/tv` | Landing de productos hogar |
| `/empresas`, `/empresas/internet`, `/empresas/cotizador` | Landing y cotizador para empresas |
| `/tv`, `/tv/canales`, `/tv/parrilla` | Landing de TV |
| `/cobertura` | Visor cartográfico de factibilidad — `GET /api/cobertura/config`, `GET /api/cobertura/puntos` (CU-59 a CU-62) |
| `/velocidad` | Test de velocidad |
| `/faqs`, `/ayuda`, `/soporte`, `/reportar` | Contenido de soporte |
| `/legal/terminos`, `/legal/privacidad`, `/legal/reclamos`, `/legal/ley-21398` | Legal |

## Públicas — auth y consulta de deuda

| Ruta | Endpoint(s) | Caso de uso |
|---|---|---|
| `/inicio-sesion` | `POST /api/auth/login` | CU-01 |
| `/recuperar-password` | `POST /api/auth/recuperar-password` | CU-03 |
| `/restablecer-password` | `POST /api/auth/restablecer-password` | CU-03 / RF-09 |
| `/consultar-deuda` | `GET /api/deuda-publica/rut`, `GET /api/deuda-publica/abonado` | CU-39 / CU-40 / CU-41 |
| `/pagar` | — (sin pasarela real todavía, ver [CASOS-DE-USO.md](../../../docs/CASOS-DE-USO.md) CU-42) |

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

## Referencia cruzada

La documentación de contrato de cada endpoint (bodies, respuestas, errores) vive en `apps/controller/docs/*.md`, no aquí — este archivo solo mapea ruta → endpoint → caso de uso para no duplicar contenido que se desactualiza fácil.
