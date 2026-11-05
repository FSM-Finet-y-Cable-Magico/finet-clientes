# Cobertura del portal cliente

La ruta pública `/cobertura` muestra la factibilidad geográfica de Finet para La
Pintana y Puente Alto. Es de solo lectura: no hay editor ni ruta de
administración.

Componentes activos:

- `app/cobertura/page.tsx`: página pública.
- `app/_components/cobertura/VisorCobertura.tsx`: estados de carga y error.
- `app/_components/cobertura/MapaCobertura.tsx`: mapa Leaflet y capa de calor.
- `app/_lib/api.ts`: lectura de `/api/cobertura/config` y
  `/api/cobertura/puntos`.

El encuadre se cachea 24 h porque es una constante del backend. La capa de puntos
usa `no-store`; podría cachearse igual, pero al ser un dataset estático no hay
diferencia práctica y así un despliegue nuevo se ve de inmediato.

La capa la genera el backend desde el KML de planta externa de Finet. Ver
[API pública de cobertura](../../controller/docs/cobertura.md) para el modelo de
densidad y cómo regenerarla.
