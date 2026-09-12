import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ContratacionDto,
  ContratacionResponseDto,
} from './dto/contratacion.dto.js';

const ESTADO_PIPELINE_CONVERTIDO = 'ACTIVO';

@Injectable()
export class ContratacionesService {
  private readonly logger = new Logger(ContratacionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: ContratacionDto): Promise<ContratacionResponseDto> {
    const hoy = new Date();

    try {
      const { id_cliente, id_contrato, id_ot } = await this.prisma.$transaction(
        async (tx) => {
          const existe = await tx.cliente.findUnique({
            where: { rut: dto.rut },
            select: { id_cliente: true },
          });

          if (existe) {
            throw new ConflictException('El RUT ya está registrado');
          }

          const plan = await tx.plan.findFirst({
            where: { id_plan: dto.id_plan, activo: true },
            select: { id_plan: true },
          });

          if (!plan) {
            throw new NotFoundException(
              'El plan seleccionado no existe o no está disponible',
            );
          }

          const cliente = await tx.cliente.create({
            data: {
              nombre_completo: dto.nombre_completo,
              rut: dto.rut,
              email: dto.email,
              telefono: dto.telefono ?? null,
              id_empresa: 1,
              estado: 'pendiente',
            },
          });

          const direccion = await tx.direccion_servicio.create({
            data: {
              id_cliente: cliente.id_cliente,
              direccion_completa: dto.direccion_completa,
              comuna: dto.comuna,
              ciudad: dto.ciudad ?? null,
              es_principal: true,
            },
          });

          const contrato = await tx.contrato.create({
            data: {
              id_cliente: cliente.id_cliente,
              id_plan: dto.id_plan,
              id_empresa: 1,
              // Tabla 11.15 del Documento 0: el contrato nace en PENDIENTE.
              // Antes se escribia 'en_tramite', que no existe en esa tabla.
              estado: 'PENDIENTE',
              fecha_inicio: hoy,
              dia_vencimiento: 5,
            },
          });

          const ot = await tx.orden_trabajo.create({
            data: {
              id_cliente: cliente.id_cliente,
              id_direccion: direccion.id_direccion,
              id_empresa: 1,
              tipo_ot: 'instalacion',
              estado: 'pendiente',
              prioridad: 'normal',
              fecha_creacion: hoy,
            },
          });

          await tx.prospecto.create({
            data: {
              id_empresa: 1,
              id_cliente: cliente.id_cliente,
              rut: dto.rut,
              nombre_completo: dto.nombre_completo,
              email: dto.email,
              telefono: dto.telefono ?? null,
              direccion: dto.direccion_completa,
              estado_pipeline: ESTADO_PIPELINE_CONVERTIDO,
              tiempo_conversion_dias: 0,
              fecha_creacion: hoy,
              fecha_conversion: hoy,
            },
          });

          return {
            id_cliente: cliente.id_cliente,
            id_contrato: contrato.id_contrato,
            id_ot: ot.id_ot,
          };
        },
      );

      this.logger.log(
        `Contratación creada — cliente=${id_cliente} contrato=${id_contrato} ot=${id_ot}`,
      );

      try {
        await this.prisma.log_auditoria.create({
          data: {
            accion: 'CREAR_CONTRATACION',
            entidad_afectada: 'cliente',
            id_entidad_afectada: id_cliente,
            valor_nuevo: {
              id_contrato,
              id_ot,
              rut: dto.rut,
              plan: dto.id_plan,
            },
          },
        });
      } catch (auditError) {
        this.logger.error(
          `No se pudo registrar auditoría para contratación cliente=${id_cliente}`,
          auditError,
        );
      }

      return { id_cliente, id_contrato, id_ot };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error inesperado al crear contratación', error);
      throw new InternalServerErrorException(
        'No fue posible procesar la contratación en este momento',
      );
    }
  }
}
