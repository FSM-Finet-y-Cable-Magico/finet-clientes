import { Injectable } from '@nestjs/common';
import {
  ID_EMPRESA_POR_DEFECTO,
  type IdEmpresa,
} from '../common/constants/empresas.js';
import { COBERTURA_CABLE_MAGICO } from './cobertura-cable-magico.data.js';
import { COBERTURA_FINET } from './cobertura-finet.data.js';
import type {
  PuntoMapaDto,
  VisorCoberturaConfigDto,
} from './dto/cobertura.dto.js';

/** Igual para las dos redes: ambas miden ~11 km de largo, con celdas de ~220 m. */
const ZOOM = {
  // A 12 la red se veia diluida en un cuarto de pantalla.
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
};

/**
 * El visor de cada empresa. `centro` es el centroide de su red, ponderado por
 * densidad; `limites` son los mismos con que el extractor filtra su KML.
 */
const VISORES: Record<
  IdEmpresa,
  { config: VisorCoberturaConfigDto; puntos: readonly PuntoMapaDto[] }
> = {
  // La Pintana y Puente Alto.
  1: {
    config: {
      ...ZOOM,
      centro: { latitud: -33.5897, longitud: -70.6191 },
      limites: {
        sur_oeste: { latitud: -33.72, longitud: -70.78 },
        nor_este: { latitud: -33.48, longitud: -70.45 },
      },
    },
    puntos: COBERTURA_FINET,
  },
  // Algarrobo y El Quisco.
  2: {
    config: {
      ...ZOOM,
      centro: { latitud: -33.3704, longitud: -71.6699 },
      limites: {
        sur_oeste: { latitud: -33.49, longitud: -71.84 },
        nor_este: { latitud: -33.25, longitud: -71.51 },
      },
    },
    puntos: COBERTURA_CABLE_MAGICO,
  },
};

/**
 * Visor cartografico publico (CU-59 a CU-62), uno por empresa; sin empresa,
 * el de Finet.
 *
 * Es de solo lectura y no toca la base de datos: cada capa sale de su
 * `cobertura-<empresa>.data.ts`, generado desde el KML de planta externa de esa
 * red. El mapa publico funciona aunque Postgres este caido.
 */
@Injectable()
export class CoberturaService {
  getConfig(
    idEmpresa: IdEmpresa = ID_EMPRESA_POR_DEFECTO,
  ): VisorCoberturaConfigDto {
    return VISORES[idEmpresa].config;
  }

  getPuntos(
    tipoCobertura?: string,
    idEmpresa: IdEmpresa = ID_EMPRESA_POR_DEFECTO,
  ): readonly PuntoMapaDto[] {
    const { puntos } = VISORES[idEmpresa];
    return tipoCobertura
      ? puntos.filter((p) => p.tipo_cobertura === tipoCobertura)
      : puntos;
  }
}
