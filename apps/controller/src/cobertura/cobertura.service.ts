import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PASO_GRILLA_FINA,
  PASO_GRILLA_PUBLICA,
  agregarAGrillaPublica,
  claveCelda,
  combinarCapas,
  rasterizarZonas,
  snapCoordenada,
} from './cobertura-grid.js';
import type { Celda, Vertice } from './cobertura-grid.js';
import type {
  ActualizarPuntoCoberturaDto,
  ActualizarZonaCoberturaDto,
  CrearPuntoCoberturaDto,
  CrearZonaCoberturaDto,
  ListarPuntosCoberturaDto,
  PuntoCoberturaResponseDto,
  PuntoMapaDto,
  ResultadoTrazoDto,
  TrazoPincelDto,
  VisorCoberturaConfigDto,
  ZonaCoberturaResponseDto,
} from './dto/cobertura.dto.js';

/**
 * Área operativa de Finet: La Pintana y Puente Alto (ver README raíz).
 * Fija el encuadre inicial del visor y los límites de paneo/zoom.
 *
 * El centro es el de la caja envolvente de las dos comunas juntas
 * (lat -33,6434..-33,5428, lng -70,6706..-70,4858), que es el área predefinida
 * que siembra `prisma/seed-cobertura.sql`. A `zoom_inicial` 12 entran las dos
 * completas sin que el usuario tenga que alejar.
 */
const VISOR_CONFIG: VisorCoberturaConfigDto = {
  centro: { latitud: -33.5931, longitud: -70.5782 },
  zoom_inicial: 12,
  zoom_min: 10,
  zoom_max: 18,
  limites: {
    sur_oeste: { latitud: -33.72, longitud: -70.78 },
    nor_este: { latitud: -33.48, longitud: -70.45 },
  },
};

/** Techo defensivo al cargar el lienzo del editor. */
const MAX_CELDAS_LIENZO = 60_000;

@Injectable()
export class CoberturaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * CU-59: parámetros de inicialización del visor cartográfico.
   * Endpoint público — no requiere autenticación.
   */
  getConfig(): VisorCoberturaConfigDto {
    return VISOR_CONFIG;
  }

  /**
   * CU-60: capa de mapa de calor del sitio público.
   *
   * No devuelve las filas crudas de la base: rasteriza los polígonos activos
   * sobre la grilla pública y les superpone las celdas del pincel, que siempre
   * ganan (el polígono es el relleno base, el pincel el retoque encima).
   *
   * Excepción 1 del CU: sin datos devuelve `[]`, no un error — el visor se
   * muestra sin la capa temática.
   */
  async getPuntos(tipoCobertura?: string): Promise<PuntoMapaDto[]> {
    try {
      const filtroTipo = tipoCobertura ? { tipo_cobertura: tipoCobertura } : {};

      const [zonas, puntos] = await Promise.all([
        this.prisma.zona_cobertura.findMany({
          where: { activo: true, ...filtroTipo },
        }),
        this.prisma.punto_cobertura.findMany({
          where: tipoCobertura ? filtroTipo : undefined,
        }),
      ]);

      const rasterizadas = rasterizarZonas(
        zonas.map((z) => ({
          vertices: this.parseVertices(z.vertices),
          densidad: Number(z.densidad_cobertura),
          tipo: z.tipo_cobertura,
        })),
        PASO_GRILLA_PUBLICA,
      );

      const pincel = agregarAGrillaPublica(
        puntos.map((p) => ({
          latitud: Number(p.latitud),
          longitud: Number(p.longitud),
          densidad: Number(p.densidad_cobertura ?? 0),
          tipo: p.tipo_cobertura,
        })),
        PASO_GRILLA_PUBLICA,
      );

      return combinarCapas(rasterizadas, pincel).map((celda) =>
        this.celdaAPunto(celda),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Los datos de cobertura no estan disponibles temporalmente',
      );
    }
  }

  // --- Editor: lienzo -------------------------------------------------------

  /**
   * Estado completo que el editor necesita para dibujar: celdas del pincel en
   * grilla fina más los polígonos (activos e inactivos, para poder reactivarlos).
   */
  async getLienzo() {
    const [puntos, zonas] = await Promise.all([
      this.prisma.punto_cobertura.findMany({
        orderBy: { id_punto: 'asc' },
        take: MAX_CELDAS_LIENZO,
      }),
      this.prisma.zona_cobertura.findMany({ orderBy: { id_zona: 'asc' } }),
    ]);

    return {
      paso_grilla: PASO_GRILLA_FINA,
      paso_grilla_publica: PASO_GRILLA_PUBLICA,
      config: VISOR_CONFIG,
      puntos: puntos.map((p) => this.toResponse(p)),
      zonas: zonas.map((z) => this.zonaAResponse(z)),
    };
  }

  // --- Editor: pincel -------------------------------------------------------

  /**
   * Aplica un trazo del pincel.
   *
   * Todo va en una transacción y en dos sentencias, no en un upsert por celda:
   * un trazo puede traer miles de celdas y 5.000 round-trips a la base harían
   * que el editor se sintiera trabado.
   *
   * El redondeo a la grilla se rehace acá aunque el editor ya lo mande hecho —
   * una coordenada fuera de grilla crearía una celda que después nadie puede
   * repintar ni borrar (ver docs/db/2026-08-23-editor-cobertura.md).
   */
  async aplicarTrazo(body: TrazoPincelDto): Promise<ResultadoTrazoDto> {
    const pintar = this.dedupeCeldas(
      body.pintar.map((c) => ({
        latitud: snapCoordenada(c.latitud, PASO_GRILLA_FINA),
        longitud: snapCoordenada(c.longitud, PASO_GRILLA_FINA),
        densidad: c.densidad,
        tipo: body.tipo_cobertura ?? null,
      })),
    );

    const borrar = this.dedupeCeldas(
      body.borrar.map((c) => ({
        latitud: snapCoordenada(c.latitud, PASO_GRILLA_FINA),
        longitud: snapCoordenada(c.longitud, PASO_GRILLA_FINA),
        densidad: 0,
        tipo: null,
      })),
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        if (borrar.length > 0) {
          await tx.$executeRaw`
            DELETE FROM "punto_cobertura"
            WHERE ("latitud", "longitud") IN (
              SELECT * FROM UNNEST(
                ${borrar.map((c) => c.latitud)}::numeric[],
                ${borrar.map((c) => c.longitud)}::numeric[]
              )
            )
          `;
        }

        if (pintar.length > 0) {
          await tx.$executeRaw`
            INSERT INTO "punto_cobertura" ("latitud", "longitud", "densidad_cobertura", "tipo_cobertura", "id_empresa")
            SELECT * FROM UNNEST(
              ${pintar.map((c) => c.latitud)}::numeric[],
              ${pintar.map((c) => c.longitud)}::numeric[],
              ${pintar.map((c) => c.densidad)}::numeric[],
              ${pintar.map(() => body.tipo_cobertura ?? null)}::varchar[],
              ${pintar.map(() => body.id_empresa ?? null)}::int[]
            )
            ON CONFLICT ("latitud", "longitud") DO UPDATE
              SET "densidad_cobertura" = EXCLUDED."densidad_cobertura",
                  "tipo_cobertura"     = EXCLUDED."tipo_cobertura"
          `;
        }
      });
    } catch {
      throw new InternalServerErrorException(
        'No fue posible guardar el trazo del pincel',
      );
    }

    const total = await this.prisma.punto_cobertura.count();

    return {
      pintadas: pintar.length,
      borradas: borrar.length,
      total_celdas: total,
    };
  }

  /** Borra todas las celdas pintadas a mano. Los polígonos no se tocan. */
  async limpiarPincel(): Promise<{ borradas: number }> {
    const { count } = await this.prisma.punto_cobertura.deleteMany({});
    return { borradas: count };
  }

  // --- Editor: zonas (polígonos) -------------------------------------------

  async listarZonas(
    incluirInactivas: boolean,
  ): Promise<ZonaCoberturaResponseDto[]> {
    const zonas = await this.prisma.zona_cobertura.findMany({
      where: incluirInactivas ? undefined : { activo: true },
      orderBy: { id_zona: 'asc' },
    });
    return zonas.map((z) => this.zonaAResponse(z));
  }

  async crearZona(
    body: CrearZonaCoberturaDto,
  ): Promise<ZonaCoberturaResponseDto> {
    const zona = await this.prisma.zona_cobertura.create({
      data: {
        nombre: body.nombre,
        densidad_cobertura: body.densidad_cobertura,
        tipo_cobertura: body.tipo_cobertura,
        vertices: body.vertices,
        activo: body.activo ?? true,
        id_empresa: body.id_empresa,
      },
    });
    return this.zonaAResponse(zona);
  }

  async actualizarZona(
    idZona: number,
    body: ActualizarZonaCoberturaDto,
  ): Promise<ZonaCoberturaResponseDto> {
    await this.assertZonaExiste(idZona);

    const zona = await this.prisma.zona_cobertura.update({
      where: { id_zona: idZona },
      data: { ...body, fecha_actualizacion: new Date() },
    });
    return this.zonaAResponse(zona);
  }

  async eliminarZona(idZona: number): Promise<{ id_zona: number }> {
    await this.assertZonaExiste(idZona);

    await this.prisma.zona_cobertura.delete({ where: { id_zona: idZona } });
    return { id_zona: idZona };
  }

  // --- Administración de puntos sueltos ------------------------------------

  /** Administración — listado paginado de celdas del pincel. */
  async listarPuntos(query: ListarPuntosCoberturaDto) {
    const where = query.tipo_cobertura
      ? { tipo_cobertura: query.tipo_cobertura }
      : undefined;

    const [total, puntos] = await Promise.all([
      this.prisma.punto_cobertura.count({ where }),
      this.prisma.punto_cobertura.findMany({
        where,
        orderBy: { id_punto: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: puntos.map((p) => this.toResponse(p)),
      page: query.page,
      limit: query.limit,
      total,
      total_paginas: Math.ceil(total / query.limit),
    };
  }

  /** Administración — alta de un punto de cobertura. */
  async crearPunto(
    body: CrearPuntoCoberturaDto,
  ): Promise<PuntoCoberturaResponseDto> {
    try {
      const punto = await this.prisma.punto_cobertura.create({
        data: {
          latitud: snapCoordenada(body.latitud, PASO_GRILLA_FINA),
          longitud: snapCoordenada(body.longitud, PASO_GRILLA_FINA),
          densidad_cobertura: body.densidad_cobertura,
          tipo_cobertura: body.tipo_cobertura,
          id_empresa: body.id_empresa,
        },
      });
      return this.toResponse(punto);
    } catch {
      throw new InternalServerErrorException(
        'No fue posible registrar el punto de cobertura',
      );
    }
  }

  /** Administración — edición de un punto existente. */
  async actualizarPunto(
    idPunto: number,
    body: ActualizarPuntoCoberturaDto,
  ): Promise<PuntoCoberturaResponseDto> {
    await this.assertExiste(idPunto);

    const punto = await this.prisma.punto_cobertura.update({
      where: { id_punto: idPunto },
      data: {
        ...body,
        ...(body.latitud !== undefined
          ? { latitud: snapCoordenada(body.latitud, PASO_GRILLA_FINA) }
          : {}),
        ...(body.longitud !== undefined
          ? { longitud: snapCoordenada(body.longitud, PASO_GRILLA_FINA) }
          : {}),
      },
    });
    return this.toResponse(punto);
  }

  /** Administración — baja de un punto existente. */
  async eliminarPunto(idPunto: number): Promise<{ id_punto: number }> {
    await this.assertExiste(idPunto);

    await this.prisma.punto_cobertura.delete({ where: { id_punto: idPunto } });
    return { id_punto: idPunto };
  }

  // --- Helpers --------------------------------------------------------------

  private async assertExiste(idPunto: number): Promise<void> {
    const existe = await this.prisma.punto_cobertura.findUnique({
      where: { id_punto: idPunto },
      select: { id_punto: true },
    });

    if (!existe) {
      throw new NotFoundException('El punto de cobertura no existe');
    }
  }

  private async assertZonaExiste(idZona: number): Promise<void> {
    const existe = await this.prisma.zona_cobertura.findUnique({
      where: { id_zona: idZona },
      select: { id_zona: true },
    });

    if (!existe) {
      throw new NotFoundException('La zona de cobertura no existe');
    }
  }

  /** Dentro de un mismo trazo, la última pasada sobre una celda es la que vale. */
  private dedupeCeldas(celdas: Celda[]): Celda[] {
    const unicas = new Map<string, Celda>();
    for (const celda of celdas) {
      unicas.set(claveCelda(celda.latitud, celda.longitud), celda);
    }
    return [...unicas.values()];
  }

  /** `vertices` es JSONB: Prisma lo entrega como `unknown`. */
  private parseVertices(valor: unknown): Vertice[] {
    if (!Array.isArray(valor)) return [];
    return valor.filter(
      (v): v is Vertice =>
        Array.isArray(v) &&
        v.length === 2 &&
        typeof v[0] === 'number' &&
        typeof v[1] === 'number',
    );
  }

  private celdaAPunto(celda: Celda): PuntoMapaDto {
    return {
      latitud: celda.latitud,
      longitud: celda.longitud,
      densidad_cobertura: celda.densidad,
      tipo_cobertura: celda.tipo,
    };
  }

  private zonaAResponse(zona: {
    id_zona: number;
    nombre: string | null;
    densidad_cobertura: unknown;
    tipo_cobertura: string | null;
    vertices: unknown;
    activo: boolean;
    fecha_actualizacion: Date | null;
  }): ZonaCoberturaResponseDto {
    return {
      id_zona: zona.id_zona,
      nombre: zona.nombre,
      densidad_cobertura: Number(zona.densidad_cobertura),
      tipo_cobertura: zona.tipo_cobertura,
      vertices: this.parseVertices(zona.vertices),
      activo: zona.activo,
      fecha_actualizacion: zona.fecha_actualizacion?.toISOString() ?? null,
    };
  }

  /** Prisma devuelve `Decimal` para lat/long/densidad; el JSON los expone como number. */
  private toResponse(punto: {
    id_punto: number;
    latitud: unknown;
    longitud: unknown;
    densidad_cobertura: unknown;
    tipo_cobertura: string | null;
  }): PuntoCoberturaResponseDto {
    return {
      id_punto: punto.id_punto,
      latitud: Number(punto.latitud),
      longitud: Number(punto.longitud),
      densidad_cobertura:
        punto.densidad_cobertura === null
          ? null
          : Number(punto.densidad_cobertura),
      tipo_cobertura: punto.tipo_cobertura,
    };
  }
}
