import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlanResponseDto } from './dto/landing.dto.js';

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * CU-15 / CU-17: Catalogo de planes publico para la landing page.
   * CU-15: Filtrar catalogo por segmento (tipo_cliente).
   * CU-17: Mostrar detalles tecnicos y comerciales de cada plan
   *        (nombre, velocidad, precio, caracteristicas).
   * Endpoint publico — no requiere autenticacion.
   *
   * Con `idEmpresa`, solo los planes de esa empresa: el sitio de Finet y el de
   * Cable Mágico muestran cada uno los suyos (Documento 0, §6.6).
   */
  async getPlanes(
    tipoCliente?: string,
    idEmpresa?: number,
  ): Promise<PlanResponseDto[]> {
    try {
      const planes = await this.prisma.plan.findMany({
        where: {
          activo: true,
          ...(tipoCliente ? { tipo_cliente: tipoCliente } : {}),
          ...(idEmpresa ? { id_empresa: idEmpresa } : {}),
        },
        orderBy: { precio_mensual: 'asc' },
      });

      if (tipoCliente && planes.length === 0) {
        throw new NotFoundException(
          'No hay planes disponibles para este segmento',
        );
      }

      return planes.map((p) => ({
        id_plan: p.id_plan,
        id_empresa: p.id_empresa,
        nombre_comercial: p.nombre_comercial,
        tipo_plan: p.tipo_plan,
        tipo_cliente: p.tipo_cliente,
        velocidad_mbps: p.velocidad_mbps,
        precio_mensual: Number(p.precio_mensual),
        descripcion: p.descripcion,
      }));
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'La seccion Planes no esta disponible temporalmente',
      );
    }
  }
}
