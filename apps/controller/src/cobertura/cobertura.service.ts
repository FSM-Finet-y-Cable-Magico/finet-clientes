import { Injectable } from '@nestjs/common';
import { COBERTURA_FINET } from './cobertura-finet.data.js';
import type { VisorCoberturaConfigDto } from './dto/cobertura.dto.js';

const VISOR_CONFIG: VisorCoberturaConfigDto = {
  // Centroide de la red, ponderado por densidad.
  centro: { latitud: -33.5897, longitud: -70.6191 },
  // La red ocupa ~11 x 7 km: a 12 se veia diluida en un cuarto de pantalla.
  zoom_inicial: 13,
  zoom_min: 10,
  // Las celdas miden ~220 m: a 18 se mostraba 0,5 m por pixel, cuatrocientas
  // veces mas precision de la que existe.
  //
  // 15 es el punto de equilibrio elegido recorriendo el rango: llega al nivel
  // de calle y todavia se lee. El costo es que la grilla empieza a notarse,
  // porque `radius`/`blur` de leaflet.heat estan en pixeles y no acompanan al
  // zoom: a 14 el radio iguala la separacion entre celdas y el campo cierra, de
  // 15 en adelante se abre en puntos. 14 es el ultimo nivel totalmente continuo,
  // si alguna vez se prefiere el aspecto por sobre el acercamiento.
  zoom_max: 15,
  limites: {
    sur_oeste: { latitud: -33.72, longitud: -70.78 },
    nor_este: { latitud: -33.48, longitud: -70.45 },
  },
};

/**
 * Visor cartografico publico (CU-59 a CU-62).
 *
 * Es de solo lectura y no toca la base de datos: la capa sale de
 * `cobertura-finet.data.ts`, generado desde el KML de planta externa de la red
 * FTTH de La Pintana y Puente Alto. El mapa publico funciona aunque Postgres
 * este caido.
 */
@Injectable()
export class CoberturaService {
  getConfig(): VisorCoberturaConfigDto {
    return VISOR_CONFIG;
  }

  getPuntos(tipoCobertura?: string) {
    return tipoCobertura
      ? COBERTURA_FINET.filter((p) => p.tipo_cobertura === tipoCobertura)
      : COBERTURA_FINET;
  }
}
