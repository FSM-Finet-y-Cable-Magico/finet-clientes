import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CoberturaService } from './cobertura.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PASO_GRILLA_FINA } from './cobertura-grid.js';

describe('CoberturaService', () => {
  let service: CoberturaService;
  let prisma: jest.Mocked<PrismaService>;
  let ejecutarRaw: jest.Mock;

  // Prisma devuelve Decimal para lat/long/densidad; el service los pasa a number.
  const puntoPrisma = {
    id_punto: 1,
    id_empresa: null,
    latitud: '-33.583000',
    longitud: '-70.633000',
    densidad_cobertura: '92.50',
    tipo_cobertura: 'fibra',
  };

  const zonaPrisma = {
    id_zona: 1,
    id_empresa: null,
    nombre: 'La Pintana norte',
    densidad_cobertura: '78.00',
    tipo_cobertura: 'fibra',
    vertices: [
      [-33.57, -70.645],
      [-33.57, -70.625],
      [-33.59, -70.625],
      [-33.59, -70.645],
    ],
    activo: true,
    fecha_creacion: new Date('2026-08-24T00:00:00Z'),
    fecha_actualizacion: new Date('2026-08-24T00:00:00Z'),
  };

  beforeEach(async () => {
    ejecutarRaw = jest.fn();

    const mockPrisma = {
      punto_cobertura: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      zona_cobertura: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      // El service corre las dos sentencias del trazo dentro de una transacción.
      $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
        cb({ $executeRaw: ejecutarRaw }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoberturaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CoberturaService);
    prisma = module.get(PrismaService);
  });

  describe('CU-59: Accediendo al visor cartografico de factibilidad tecnica', () => {
    it('entrega el encuadre inicial del visor', () => {
      const config = service.getConfig();
      // Centro de la caja envolvente de La Pintana + Puente Alto juntas.
      expect(config.centro).toEqual({ latitud: -33.5931, longitud: -70.5782 });
      expect(config.zoom_inicial).toBe(12);
    });

    it('CU-62: el centro cae dentro de los limites de paneo', () => {
      // Si el encuadre inicial quedara fuera de los limites, Leaflet arrastraria
      // el mapa al borde apenas carga: el visor abriria corrido.
      const { centro, limites } = service.getConfig();
      expect(centro.latitud).toBeGreaterThan(limites.sur_oeste.latitud);
      expect(centro.latitud).toBeLessThan(limites.nor_este.latitud);
      expect(centro.longitud).toBeGreaterThan(limites.sur_oeste.longitud);
      expect(centro.longitud).toBeLessThan(limites.nor_este.longitud);
    });

    it('CU-61: acota el rango de zoom permitido', () => {
      const config = service.getConfig();
      expect(config.zoom_min).toBeLessThan(config.zoom_inicial);
      expect(config.zoom_max).toBeGreaterThan(config.zoom_inicial);
    });

    it('CU-62: define los limites geograficos del paneo', () => {
      const { limites } = service.getConfig();
      expect(limites.sur_oeste.latitud).toBeLessThan(limites.nor_este.latitud);
      expect(limites.sur_oeste.longitud).toBeLessThan(
        limites.nor_este.longitud,
      );
    });
  });

  describe('CU-60: Visualizando capa de mapa de calor de cobertura', () => {
    it('rasteriza los poligonos activos sobre la grilla publica', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([
        zonaPrisma,
      ]);
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getPuntos();

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((p) => p.densidad_cobertura === 78)).toBe(true);
    });

    it('solo considera zonas activas', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([]);

      await service.getPuntos();

      expect(prisma.zona_cobertura.findMany).toHaveBeenCalledWith({
        where: { activo: true },
      });
    });

    it('el pincel pisa al poligono en la celda compartida', async () => {
      // Punto dentro del cuadrado de la zona, con densidad mucho menor.
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([
        zonaPrisma,
      ]);
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([
        {
          ...puntoPrisma,
          latitud: '-33.580000',
          longitud: '-70.635000',
          densidad_cobertura: '5.00',
        },
      ]);

      const result = await service.getPuntos();

      // Exactamente una celda baja a 5: la que toco el pincel. El resto del
      // poligono queda en 78. Que 5 < 78 es justamente el caso interesante —
      // el pincel gana aunque baje la densidad.
      const conPincel = result.filter((p) => p.densidad_cobertura === 5);
      expect(conPincel).toHaveLength(1);
      expect(
        result.every(
          (p) => p.densidad_cobertura === 5 || p.densidad_cobertura === 78,
        ),
      ).toBe(true);
    });

    it('no devuelve id_punto: la celda no es una fila de la base', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([
        puntoPrisma,
      ]);

      const [celda] = await service.getPuntos();

      expect(celda).not.toHaveProperty('id_punto');
      expect(celda.densidad_cobertura).toBe(92.5);
    });

    it('Excepcion 1: sin datos devuelve lista vacia, no un error', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.getPuntos()).resolves.toEqual([]);
    });

    it('Excepcion 1: si la consulta falla informa indisponibilidad temporal', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockRejectedValue(
        new Error('db caida'),
      );
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.getPuntos()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('filtra por tipo_cobertura en ambas capas', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([]);

      await service.getPuntos('fibra');

      expect(prisma.zona_cobertura.findMany).toHaveBeenCalledWith({
        where: { activo: true, tipo_cobertura: 'fibra' },
      });
      expect(prisma.punto_cobertura.findMany).toHaveBeenCalledWith({
        where: { tipo_cobertura: 'fibra' },
      });
    });
  });

  describe('Pincel', () => {
    beforeEach(() => {
      (prisma.punto_cobertura.count as jest.Mock).mockResolvedValue(10);
    });

    it('redondea a la grilla lo que llega del editor', async () => {
      const result = await service.aplicarTrazo({
        pintar: [{ latitud: -33.60013, longitud: -70.61027, densidad: 80 }],
        borrar: [],
      });

      expect(result.pintadas).toBe(1);
      // -33.60013 y -70.61027 caen en la celda (-33.6, -70.6105).
      const valores = ejecutarRaw.mock.calls[0].slice(1);
      expect(valores[0]).toEqual([-33.6]);
      expect(valores[1]).toEqual([-70.6105]);
    });

    it('dentro de un trazo, la ultima pasada sobre una celda es la que vale', async () => {
      const result = await service.aplicarTrazo({
        pintar: [
          { latitud: -33.6, longitud: -70.61, densidad: 30 },
          { latitud: -33.6, longitud: -70.61, densidad: 90 },
        ],
        borrar: [],
      });

      expect(result.pintadas).toBe(1);
      const densidades = ejecutarRaw.mock.calls[0][3];
      expect(densidades).toEqual([90]);
    });

    it('un trazo solo de borrado no ejecuta el insert', async () => {
      const result = await service.aplicarTrazo({
        pintar: [],
        borrar: [{ latitud: -33.6, longitud: -70.61 }],
      });

      expect(result).toMatchObject({ pintadas: 0, borradas: 1 });
      expect(ejecutarRaw).toHaveBeenCalledTimes(1);
    });

    it('borra y pinta en la misma transaccion', async () => {
      await service.aplicarTrazo({
        pintar: [{ latitud: -33.6, longitud: -70.61, densidad: 50 }],
        borrar: [{ latitud: -33.61, longitud: -70.62 }],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(ejecutarRaw).toHaveBeenCalledTimes(2);
    });

    it('informa error si la transaccion falla', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('boom'));

      await expect(
        service.aplicarTrazo({
          pintar: [{ latitud: -33.6, longitud: -70.61, densidad: 50 }],
          borrar: [],
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('limpiar borra todas las celdas y deja las zonas intactas', async () => {
      (prisma.punto_cobertura.deleteMany as jest.Mock).mockResolvedValue({
        count: 42,
      });

      await expect(service.limpiarPincel()).resolves.toEqual({ borradas: 42 });
      expect(prisma.zona_cobertura.delete).not.toHaveBeenCalled();
    });
  });

  describe('Zonas (poligonos)', () => {
    it('por defecto lista solo las activas', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([
        zonaPrisma,
      ]);

      const zonas = await service.listarZonas(false);

      expect(prisma.zona_cobertura.findMany).toHaveBeenCalledWith({
        where: { activo: true },
        orderBy: { id_zona: 'asc' },
      });
      expect(zonas[0].densidad_cobertura).toBe(78);
      expect(zonas[0].vertices).toHaveLength(4);
    });

    it('puede incluir las inactivas para poder reactivarlas', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([]);

      await service.listarZonas(true);

      expect(prisma.zona_cobertura.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { id_zona: 'asc' },
      });
    });

    it('descarta vertices con forma invalida al leer el JSONB', async () => {
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([
        { ...zonaPrisma, vertices: [[-33.5, -70.6], 'basura', [1, 2, 3]] },
      ]);

      const [zona] = await service.listarZonas(false);

      expect(zona.vertices).toEqual([[-33.5, -70.6]]);
    });

    it('crea una zona activa por defecto', async () => {
      (prisma.zona_cobertura.create as jest.Mock).mockResolvedValue(zonaPrisma);

      await service.crearZona({
        densidad_cobertura: 78,
        vertices: [
          [-33.57, -70.645],
          [-33.57, -70.625],
          [-33.59, -70.625],
        ],
      });

      expect(prisma.zona_cobertura.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activo: true }),
        }),
      );
    });

    it('devuelve 404 al actualizar una zona inexistente', async () => {
      (prisma.zona_cobertura.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.actualizarZona(99, { activo: false }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.zona_cobertura.update).not.toHaveBeenCalled();
    });

    it('devuelve 404 al eliminar una zona inexistente', async () => {
      (prisma.zona_cobertura.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.eliminarZona(99)).rejects.toThrow(NotFoundException);
      expect(prisma.zona_cobertura.delete).not.toHaveBeenCalled();
    });
  });

  describe('Administracion de puntos sueltos', () => {
    it('lista paginado con el total de paginas calculado', async () => {
      (prisma.punto_cobertura.count as jest.Mock).mockResolvedValue(45);
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([
        puntoPrisma,
      ]);

      const result = await service.listarPuntos({
        page: 2,
        limit: 20,
        tipo_cobertura: undefined,
      });

      expect(prisma.punto_cobertura.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.total_paginas).toBe(3);
    });

    it('alinea a la grilla los puntos creados a mano', async () => {
      (prisma.punto_cobertura.create as jest.Mock).mockResolvedValue(
        puntoPrisma,
      );

      await service.crearPunto({ latitud: -33.60013, longitud: -70.61027 });

      expect(prisma.punto_cobertura.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ latitud: -33.6, longitud: -70.6105 }),
      });
    });

    it('informa error si la creacion falla', async () => {
      (prisma.punto_cobertura.create as jest.Mock).mockRejectedValue(
        new Error('choca con el indice unico'),
      );

      await expect(
        service.crearPunto({ latitud: -33.5, longitud: -70.6 }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('devuelve 404 al actualizar un punto inexistente', async () => {
      (prisma.punto_cobertura.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.actualizarPunto(999, { densidad_cobertura: 1 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.punto_cobertura.update).not.toHaveBeenCalled();
    });

    it('devuelve 404 al eliminar un punto inexistente', async () => {
      (prisma.punto_cobertura.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.eliminarPunto(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Lienzo del editor', () => {
    it('entrega celdas, zonas y el paso de grilla que debe usar el editor', async () => {
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([
        puntoPrisma,
      ]);
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([
        zonaPrisma,
      ]);

      const lienzo = await service.getLienzo();

      expect(lienzo.paso_grilla).toBe(PASO_GRILLA_FINA);
      expect(lienzo.puntos).toHaveLength(1);
      expect(lienzo.zonas).toHaveLength(1);
      expect(lienzo.config.zoom_inicial).toBe(12);
    });

    it('incluye las zonas inactivas para poder reactivarlas', async () => {
      (prisma.punto_cobertura.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.zona_cobertura.findMany as jest.Mock).mockResolvedValue([]);

      await service.getLienzo();

      expect(prisma.zona_cobertura.findMany).toHaveBeenCalledWith({
        orderBy: { id_zona: 'asc' },
      });
    });
  });
});
