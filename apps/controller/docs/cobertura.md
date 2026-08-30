# Cobertura — visor público y editor del administrador

Base URL: `http://localhost:4000/api`

Cubre CU-59 a CU-62 (bloque **Mapa** del Incremento 2).

| Grupo | Auth | Consumidor |
|---|---|---|
| `/cobertura/*` | Público | `/cobertura` del sitio |
| `/admin/cobertura/*` | Header `X-API-Key` | `/admin/cobertura` (editor provisional) |

Este documento cubre el **contrato de la API**. La diferencia entre los dos
frontends que la consumen (componentes, caché, grilla, autenticación) está en
[`apps/view/docs/cobertura.md`](../../view/docs/cobertura.md).

---

## Modelo de datos: dos capas

El mapa de calor sale de combinar **dos** fuentes, no de una tabla:

| Capa | Tabla | Para qué |
|---|---|---|
| **Polígonos** | `zona_cobertura` | Rellenar el grueso de un área de una vez |
| **Pincel** | `punto_cobertura` | Retocar el detalle fino, celda por celda |

Cada fila de `punto_cobertura` es una **celda de una grilla fija** de 0,0005°
(~55 m). El índice único `(latitud, longitud)` es lo que hace que repintar
actualice en vez de duplicar. Ver
[`docs/db/2026-08-23-editor-cobertura.md`](../../../docs/db/2026-08-23-editor-cobertura.md)
y `src/cobertura/cobertura-grid.ts`.

### Cómo se combinan

`GET /cobertura/puntos` no devuelve filas crudas. El backend:

1. Rasteriza los polígonos **activos** sobre la grilla pública (0,002°, ~220 m).
2. Baja las celdas del pincel a esa misma grilla, quedándose con la densidad
   máxima de cada grupo.
3. Superpone las dos: **el pincel siempre gana**, incluso si baja la densidad —
   corregir una celda a mano tiene que verse aunque haya un polígono encima.

La grilla pública es más gruesa a propósito: `leaflet.heat` se degrada pasando
los ~15.000 puntos, y el render aplica un blur de 20 px que a esa escala hace
indistinguible el detalle fino.

---

## 1. Configuración del visor (CU-59)

```
GET /api/cobertura/config
```

Encuadre inicial más los límites de zoom (CU-61) y de paneo (CU-62).
`Cache-Control: public, max-age=86400`.

```json
{
  "centro": { "latitud": -33.6, "longitud": -70.61 },
  "zoom_inicial": 12,
  "zoom_min": 10,
  "zoom_max": 18,
  "limites": {
    "sur_oeste": { "latitud": -33.72, "longitud": -70.78 },
    "nor_este": { "latitud": -33.48, "longitud": -70.45 }
  }
}
```

## 2. Capa de calor (CU-60)

```
GET /api/cobertura/puntos
GET /api/cobertura/puntos?tipo_cobertura=fibra
```

```json
[
  { "latitud": -33.594, "longitud": -70.644, "densidad_cobertura": 85, "tipo_cobertura": "fibra" }
]
```

> **No lleva `id_punto`.** Cada elemento es una celda calculada, no una fila de
> la base: un id sería inventado.

**Excepción 1 del CU-60:** sin datos devuelve `[]`, no un error — el visor se
muestra sin la capa temática. Solo un fallo de consulta devuelve `503`.

### Publicar cambios

Estos dos endpoints cachean 24 h, y el frontend además cachea con
`revalidate: 86400`. Para que un cambio del editor se vea al instante, el botón
**Publicar** llama a `POST /api/cobertura/revalidar` **de Next** (no de este
backend), que hace `revalidateTag("cobertura", { expire: 0 })`.

---

## 3. Editor — todos requieren `X-API-Key`

Sin el header o con clave incorrecta: `401`.

### 3.1 Lienzo completo

```
GET /api/admin/cobertura/lienzo
```

Todo lo que el editor necesita para dibujar, en una sola llamada:

```json
{
  "paso_grilla": 0.0005,
  "paso_grilla_publica": 0.002,
  "config": { "...": "igual que /cobertura/config" },
  "puntos": [{ "id_punto": 1, "latitud": -33.583, "longitud": -70.633, "densidad_cobertura": 92.5, "tipo_cobertura": "fibra" }],
  "zonas": [{ "id_zona": 1, "nombre": "La Pintana norte", "densidad_cobertura": 78, "tipo_cobertura": "fibra", "vertices": [[-33.57, -70.645]], "activo": true, "fecha_actualizacion": "2026-08-24T03:57:58.327Z" }]
}
```

Incluye zonas **inactivas** — el editor tiene que poder reactivarlas.
Tope de 60.000 celdas por respuesta.

### 3.2 Trazo del pincel

```
POST /api/admin/cobertura/pincel
```

```json
{
  "tipo_cobertura": "fibra",
  "pintar": [{ "latitud": -33.6001, "longitud": -70.6102, "densidad": 90 }],
  "borrar": [{ "latitud": -33.6006, "longitud": -70.6102 }]
}
```

- `densidad` va de 0 a 100. Máximo 5.000 celdas por lista; un trazo más largo se
  parte en varios envíos.
- Debe traer al menos una celda entre `pintar` y `borrar`, si no `400`.
- **El backend redondea las coordenadas a la grilla**, aunque el editor ya las
  mande alineadas. Una celda fuera de grilla quedaría huérfana: se dibujaría en
  el mapa pero el pincel nunca podría repintarla ni borrarla.
- Dentro de un mismo trazo, la última pasada sobre una celda es la que vale.
- Borrado e inserción van en **una transacción y dos sentencias**
  (`DELETE ... IN (UNNEST(...))` e `INSERT ... ON CONFLICT DO UPDATE`), no un
  upsert por celda: 5.000 round-trips harían que el editor se sintiera trabado.

```json
{ "pintadas": 1, "borradas": 1, "total_celdas": 434 }
```

### 3.3 Limpiar el pincel

```
DELETE /api/admin/cobertura/pincel
```

Borra **todas** las celdas pintadas. Los polígonos quedan intactos.
Responde `{ "borradas": 176 }`.

### 3.4 Zonas (polígonos)

```
GET    /api/admin/cobertura/zonas?incluir_inactivas=true
POST   /api/admin/cobertura/zonas
PATCH  /api/admin/cobertura/zonas/:id
DELETE /api/admin/cobertura/zonas/:id
```

```json
{
  "nombre": "La Pintana norte",
  "densidad_cobertura": 78,
  "tipo_cobertura": "fibra",
  "vertices": [[-33.57, -70.645], [-33.57, -70.625], [-33.59, -70.625], [-33.59, -70.645]]
}
```

- `vertices` es `[latitud, longitud]` — orden de Leaflet, **no** el `[lng, lat]`
  de GeoJSON. Mínimo 3, máximo 500. El anillo no se cierra: el último vértice
  conecta con el primero.
- `PATCH` acepta cualquier subconjunto, pero al menos un campo (body vacío → `400`).
- Para sacar una zona del mapa público sin perderla: `PATCH { "activo": false }`.
  `DELETE` la borra de verdad.
- Zona inexistente → `404`.

### 3.5 Puntos sueltos (CRUD fila a fila)

```
GET    /api/admin/cobertura/puntos?page=1&limit=50&tipo_cobertura=fibra
POST   /api/admin/cobertura/puntos
PATCH  /api/admin/cobertura/puntos/:id
DELETE /api/admin/cobertura/puntos/:id
```

Sirven para inspección y scripts; el editor usa el endpoint de pincel. `POST` y
`PATCH` también alinean a la grilla. `limit` va de 1 a 500.

---

## Datos de prueba

```bash
pnpm -C apps/controller db:seed:cobertura
```

Deja el mapa con el **área de cobertura predefinida**:

- **2 polígonos** — las comunas de La Pintana y Puente Alto, cubiertas completas.
  Los vértices son los límites administrativos reales de OpenStreetMap
  (relaciones `191216` y `166571`), simplificados a 240 vértices cada uno. Un
  rectángulo se habría desbordado a las comunas vecinas: solo el 56% de la caja
  envolvente de cada comuna cae realmente dentro de ella.
- **176 celdas de pincel** alineadas a la grilla, como detalle fino encima.

Rasterizado sobre la grilla pública son ~2.900 celdas, bastante por debajo del
límite práctico de `leaflet.heat`. Semilla fija: mismos datos en cada corrida.

El administrador ajusta este punto de partida desde `/admin/cobertura` — puede
mover vértices, cambiar la densidad, o sacar una comuna del mapa con
`PATCH { "activo": false }` sin perderla.

> Los límites de las comunas son reales; las densidades son ficticias y no
> representan la red real de Finet.
