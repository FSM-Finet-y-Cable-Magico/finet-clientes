# API pública de cobertura

El portal consulta estos endpoints públicos:

| Método | Endpoint | Uso |
|---|---|---|
| `GET` | `/api/cobertura/config` | Centro, zoom y límites del mapa |
| `GET` | `/api/cobertura/puntos` | Capa del mapa de calor |

Ambos son de solo lectura, sin autenticación, y no exponen identificadores
internos. **No consultan la base de datos**: el módulo de cobertura no inyecta
Prisma, así que el mapa público funciona aunque Postgres esté caído.

## De dónde salen los datos

`/puntos` sirve `src/cobertura/cobertura-finet.data.ts`: 408 celdas de ~220 m
generadas desde el KML de planta externa de la red FTTH de La Pintana y Puente
Alto (907 NAP/CTO, 143 MUFA/nodo y 287 tramos de fibra).

La densidad de cada celda es la distancia a la infraestructura más cercana, no
una medición: un NAP cubre al 100 % hasta 120 m y decae a 0 a los 350 m; un
tramo de fibra aporta hasta 75 y un empalme hasta 55. Cada celda se queda con su
mejor valor, no con la suma. `tipo_cobertura` (`fibra` / `mixta` / `parcial`)
refleja qué tan directa es esa cobertura — toda la red es fibra.

Para regenerarla:

```bash
node scripts/extraer-cobertura-kml.mjs "<ruta al .kml>"
```

**El KML de origen no se versiona** (`*.kml` y `*.kmz` están en `.gitignore`):
contiene nombre, RUT, teléfono y dirección de clientes reales. El script
descarta esas fichas antes de calcular nada y solo emite coordenadas y densidad;
`cobertura-finet.data.spec.ts` verifica que en la salida no haya más texto que
los tres tipos de cobertura.

## Actualizar la cobertura

Requiere un KML nuevo de Finet, regenerar el archivo y desplegar. No hay editor
ni panel de administración: se eliminaron junto con las tablas `cobertura_mapa`,
`tomodat_mapa`, `celda_cobertura` y `zona_cobertura`, que existían solo para ese
flujo. `punto_cobertura` sigue en el modelo original y no la usa este módulo.
