# Cobertura — mapa público vs. editor del administrador

El bloque **Mapa** (CU-59 a CU-62) tiene **dos frontends distintos** que comparten
el mismo modelo de datos pero no comparten casi nada más: ni ruta, ni
autenticación, ni componentes, ni cliente de API, ni estrategia de caché.

Esta es la diferencia, de un vistazo:

| | Mapa del sitio (cliente) | Editor (administrador) |
|---|---|---|
| **Ruta** | `/cobertura` | `/admin/cobertura` |
| **Quién entra** | Cualquier visitante, sin cuenta | Quien tenga la `ADMIN_API_KEY` |
| **Qué hace** | Solo mira | Lee y escribe |
| **Página** | [`app/cobertura/page.tsx`](../app/cobertura/page.tsx) — Server Component | [`app/admin/cobertura/page.tsx`](../app/admin/cobertura/page.tsx) — shell + componente cliente |
| **Componentes** | `VisorCobertura` → `MapaCobertura` | `EditorCobertura` → `MapaEditor` |
| **Cliente de API** | [`app/_lib/api.ts`](../app/_lib/api.ts) (server-side) | [`app/_lib/cobertura-admin.ts`](../app/_lib/cobertura-admin.ts) (browser) |
| **Endpoints** | `GET /api/cobertura/config`, `GET /api/cobertura/puntos` | `GET/POST/PATCH/DELETE /api/admin/cobertura/*` |
| **Auth** | Ninguna | Header `X-API-Key` en cada request |
| **Caché** | `revalidate: 86400` + tag `"cobertura"` | Sin caché — siempre datos frescos |
| **Grilla** | 0,002° (~220 m), agregada | 0,0005° (~55 m), celda por celda |
| **Render** | `leaflet.heat` (mapa de calor) | Canvas propio + polígonos de Leaflet |
| **SEO** | Indexable, con `metadata` | `robots: noindex` |

---

## 1. Mapa del sitio — `/cobertura`

Es una página **pública de marketing**: alguien evalúa si Finet llega a su
dirección. No hay interacción más allá de mover el mapa (CU-61 zoom, CU-62 paneo).

### Cómo se carga

Los datos se piden **en el servidor**, antes de mandar HTML:

```tsx
const [config, puntos] = await Promise.all([
  getVisorCoberturaConfig(),
  getPuntosCobertura(),
]);
```

El componente de mapa sí es cliente, pero solo porque Leaflet toca `window` al
importarse. `VisorCobertura` existe únicamente para poder hacer
`dynamic(..., { ssr: false })` — eso no se puede usar dentro de un Server
Component, así que hace falta ese wrapper intermedio.

### Los dos estados de excepción

Ambos vienen de los casos de uso y se ven en la página, no en la consola:

- **CU-59, excepción 2 — el visor no arranca.** Si `GET /cobertura/config` falla,
  `getVisorCoberturaConfig()` devuelve `null` y se muestra el cartel "El visor no
  está disponible temporalmente". No se renderiza ningún mapa.
- **CU-60, excepción 1 — no hay datos de densidad.** Si `GET /cobertura/puntos`
  falla o viene vacío, el fallback es `[]`, **no** un error: el mapa se dibuja
  igual, sin la capa de calor, con un aviso arriba. Un mapa base sin capa temática
  sigue siendo útil; un error en toda la página, no.

### Caché de 24 h

Las dos llamadas usan `next: { revalidate: 86400, tags: ["cobertura"] }`. El día
de caché lo pide el CU-60 — son datos que cambian poco y el heat map es caro de
recalcular. El `tag` es lo que hace que un cambio del administrador no tarde 24 h
en verse: ver "Publicar" más abajo.

---

## 2. Editor — `/admin/cobertura`

Es una **herramienta interna provisional**. El panel de administración definitivo
todavía no existe; cuando exista, esta página se mueve dentro de él **sin tocar el
backend**, porque todo el estado vive en `/api/admin/cobertura/*`.

### No hay sesión de administrador

Esta es la diferencia más importante y la que hay que entender antes de tocar
nada:

- `proxy.ts` **no** protege `/admin/*`. Su matcher es solo `/portal/:path*` y
  `/perfil/:path*`. La página carga para cualquiera.
- Lo que protege los datos es el backend: cada endpoint de `/api/admin/cobertura/*`
  exige el header `X-API-Key` y responde `401` sin él.
- La clave la **escribe el usuario** en la propia página y queda en
  `sessionStorage` (`finet:cobertura:api-key`) — se pierde al cerrar la pestaña.
  No hay cookie, ni JWT, ni endpoint de login.
- Por eso la página lleva `robots: { index: false, follow: false }`: sin la clave
  no expone nada, pero tampoco tiene por qué salir en buscadores.
- `cobertura-admin.ts` lanza `ErrorApiKey` específicamente en un `401`, para poder
  distinguirlo de cualquier otro fallo y volver a pedir la clave en vez de mostrar
  un error genérico.

> Cuando exista sesión de administrador real, lo que hay que cambiar es esto:
> el header `X-API-Key` y el `sessionStorage`. El resto del editor no se entera.

### Dos herramientas, dos capas de datos

El mapa de calor público sale de combinar **dos** tablas, y el editor edita cada
una con una herramienta distinta:

| Herramienta | Tabla | Para qué |
|---|---|---|
| **Polígono** | `zona_cobertura` | Rellenar el grueso de un área de una vez |
| **Pincel / goma** | `punto_cobertura` | Retocar el detalle fino, celda por celda |

### El área predefinida

Los dos mapas arrancan con la **misma área base**, porque los dos leen las mismas
tablas: las comunas de **La Pintana** y **Puente Alto** cubiertas completas, como
dos polígonos de `zona_cobertura`. El visor público las muestra rellenas desde el
primer día; el editor las carga como polígonos editables.

Los vértices salen de los límites administrativos reales de OpenStreetMap, no de
rectángulos dibujados a mano — solo el 56% de la caja envolvente de cada comuna
cae dentro de ella, así que un rectángulo se habría desbordado a las comunas
vecinas.

El administrador ajusta ese punto de partida sin tocar código: mover vértices,
cambiar la densidad, pintar detalle encima, o sacar una comuna del mapa público
con `PATCH { "activo": false }` (que la desactiva sin borrarla — sigue apareciendo
en el editor para poder reactivarla).

### Cómo se combinan

El backend rasteriza los polígonos activos, baja las celdas del pincel a la misma
grilla y las superpone — **el pincel siempre gana**, incluso si baja la densidad,
porque una corrección a mano tiene que verse aunque haya un polígono encima. El
detalle está en [`apps/controller/docs/cobertura.md`](../../controller/docs/cobertura.md).

### Por qué el editor dibuja distinto que el visor

No es una decisión estética, son dos problemas distintos:

- **Grilla más fina.** El editor trabaja a 0,0005° (~55 m); el mapa público agrega
  a 0,002° (~220 m). `leaflet.heat` se degrada pasando los ~15.000 puntos, y el
  blur de 20 px hace indistinguible el detalle fino a esa escala — mandarle la
  grilla fina al visitante sería más lento y se vería igual.
- **Canvas en vez de nodos DOM.** `MapaEditor` pinta las celdas en un canvas
  propio sobre el mapa. Un rectángulo de Leaflet por celda serían miles de nodos
  del DOM y el editor se arrastraría.
- **La grilla se espeja en el cliente.** [`app/_lib/cobertura-grid.ts`](../app/_lib/cobertura-grid.ts)
  duplica el redondeo de `apps/controller/src/cobertura/cobertura-grid.ts`. El
  backend vuelve a redondear todo lo que recibe, así que una diferencia no corrompe
  datos — pero si las dos se desincronizan, el editor dibuja una celda en un lugar
  y el backend la guarda en otro. **Si cambia el paso o el redondeo en el backend,
  hay que cambiarlo acá también.**

### Guardado y deshacer

- El trazo se acumula mientras se arrastra y se manda **al soltar el botón**, en
  un solo `POST /admin/cobertura/pincel`. No hay botón de guardar.
- La pila de deshacer guarda la densidad previa de cada celda tocada, así que
  revertir es otro trazo, no un endpoint aparte.
- Máximo 5.000 celdas por lista; un trazo más largo se parte en varios envíos.

---

## 3. El puente entre los dos: "Publicar"

Este es el único punto donde las dos mitades se tocan, y es el que más confunde:

**El botón "Publicar" no le pega al backend.** Le pega a
[`POST /api/cobertura/revalidar`](../app/api/cobertura/revalidar/route.ts), un
route handler **de Next**.

El motivo: el mapa público cachea 24 h del lado de Next. Aunque el administrador
guarde un cambio y el backend lo tenga al instante, el visitante seguiría viendo
la versión cacheada hasta un día después. El handler hace
`revalidateTag("cobertura", { expire: 0 })` — `expire: 0` significa que no se
puede seguir sirviendo nada de lo cacheado ni por un segundo — y el próximo
visitante ya recibe la versión nueva.

Consecuencia práctica, y la razón de que la variable esté duplicada:

> **`ADMIN_API_KEY` tiene que estar definida en `apps/view/.env` además de
> `apps/controller/.env`, y con el mismo valor.** El handler corre en Next, no en
> NestJS: no tiene forma de consultar la clave del backend. Si falta, "Publicar"
> responde `500`; si no coincide, `401` — y el editor las distingue.

## Referencias

| Dónde | Qué contiene |
|---|---|
| [`apps/controller/docs/cobertura.md`](../../controller/docs/cobertura.md) | Contrato de cada endpoint, bodies, errores, y cómo se combinan las dos capas |
| [`docs/db/2026-08-23-editor-cobertura.md`](../../../docs/db/2026-08-23-editor-cobertura.md) | Por qué el modelo de datos es así (grilla fija, índice único) |
| [`docs/routing.md`](./routing.md) | Ruta → endpoint → caso de uso |
| [`docs/conventions.md`](./conventions.md) | Los cuatro clientes de API y cuál variable de entorno lee cada uno |
| [`docs/CASOS-DE-USO.md`](../../../docs/CASOS-DE-USO.md) | Texto de los CU-59 a CU-62 |
