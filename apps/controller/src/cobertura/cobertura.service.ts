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
  // 16 llega al nivel de cuadra. Pasado 14 las celdas dejan de solaparse y la
  // capa se atenua sola a una veladura azul, que es el comportamiento buscado:
  // marca la zona sin fingir precision de metros. El aspecto ya no depende de
  // este numero — la intensidad se normaliza contra un zoom fijo en la capa,
  // ver `ZOOM_REFERENCIA_INTENSIDAD` en MapaCobertura.tsx.
  zoom_max: 16,
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
