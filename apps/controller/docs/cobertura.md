# API pública de cobertura

El portal consulta estos endpoints públicos:

| Método | Endpoint | Uso |
|---|---|---|
| `GET` | `/api/cobertura/config` | Centro, zoom y límites del mapa |
| `GET` | `/api/cobertura/puntos` | Capa del mapa de calor |

Ambos son de solo lectura, sin autenticación, y no exponen identificadores
internos. **No consultan la base de datos**: el módulo de cobertura no inyecta
Prisma, así que el mapa público funciona aunque Postgres esté caído.

Cada empresa tiene su red y su mapa. Los dos endpoints aceptan `id_empresa`
(`1` Finet, `2` Cable Mágico), como el catálogo; sin él responden lo de Finet, y
con otro valor, 400. El sitio de cada empresa pide el suyo.

## De dónde salen los datos

`/puntos` sirve una capa estática por empresa, las dos con celdas de ~220 m:

| Empresa | Archivo | Celdas | Origen |
|---|---|---|---|
| Finet | `src/cobertura/cobertura-finet.data.ts` | 408 | KML de planta externa de la red FTTH de La Pintana y Puente Alto: 907 NAP/CTO, 143 MUFA/nodo y 287 tramos de fibra |
| Cable Mágico | `src/cobertura/cobertura-cable-magico.data.ts` | 249 | KML de Tomodat de la red de Algarrobo y El Quisco: 85 cajas de acceso y 16 empalmes. No trae el trazado de fibra |

La densidad de cada celda es la distancia a la infraestructura más cercana, no
una medición: un NAP cubre al 100 % hasta 120 m y decae a 0 a los 350 m; un
tramo de fibra aporta hasta 75 y un empalme hasta 55. Cada celda se queda con su
mejor valor, no con la suma. `tipo_cobertura` (`fibra` / `mixta` / `parcial`)
refleja qué tan directa es esa cobertura — toda la red es fibra.

El KML de Finet nombra cada elemento por su tipo (`NAP`, `MUFA`, `TRONCAL`). El
de Cable Mágico los nombra por su calle o condominio y deja el tipo en el color
del icono: las amarillas y azules se cuentan como cajas de acceso y las rojas
como empalmes del troncal (están en línea, una cada ~700 m, de Mirasol a El
Quisco). **Esa lectura de los colores es nuestra**: si Cable Mágico confirma
otra, se cambia `tipoPorColor` en el script y se regenera. Los puntos del
archivo que caen fuera de la zona (hay ocho, en Santiago y en Argentina) se
descartan por los límites del visor.

Para regenerarla (sin el segundo argumento, Finet):

```bash
node scripts/extraer-cobertura-kml.mjs "<ruta al .kml>" [finet|cable-magico]
```

**El KML de origen no se versiona** (`*.kml` y `*.kmz` están en `.gitignore`):
el de Finet contiene nombre, RUT, teléfono y dirección de clientes reales. El
script descarta esas fichas antes de calcular nada y solo emite coordenadas y
densidad; `cobertura.data.spec.ts` verifica que en la salida de cada empresa no
haya más texto que los tres tipos de cobertura.

El centro y los límites de cada visor están en `VISORES`
(`cobertura.service.ts`); los límites son los mismos con que el script filtra el
KML de esa empresa.

## Actualizar la cobertura

Requiere un KML nuevo de la empresa, regenerar su archivo y desplegar. No hay editor
ni panel de administración: se eliminaron junto con las tablas `cobertura_mapa`,
`tomodat_mapa`, `celda_cobertura` y `zona_cobertura`, que existían solo para ese
flujo. `punto_cobertura` sigue en el modelo original y no la usa este módulo.
