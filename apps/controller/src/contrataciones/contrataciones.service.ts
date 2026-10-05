import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { registrarAceptacionPolitica } from '../common/politica-privacidad.js';
import { variantesRut } from '../common/utils/rut.js';
import {
  ContratacionDto,
  ContratacionResponseDto,
} from './dto/contratacion.dto.js';

/** §11.10 del Documento 0: la etapa en que entra un interesado al pipeline. */
const ETAPA_PIPELINE_INICIAL = 'NUEVO';

/** `prospecto.direccion` es VARCHAR(200). La dirección completa queda también en la auditoría. */
const LARGO_DIRECCION = 200;

/**
 * CU-18: solicitud de contratación desde el formulario público.
 *
 * Crea **solo el Prospecto** y lo deja en la etapa NUEVO del pipeline, para que G8
 * siga la gestión comercial (acuerdo v2.0 §4 y prueba §14.1). No crea Cliente,
 * Dirección, Contrato ni Orden de Trabajo: el cliente se crea en G8 cuando la
 * instalación de G3 queda completada.
 *
 * El plan de interés no tiene dónde ir en `prospecto`, que no tiene `id_plan`.
 * Queda en la auditoría de la solicitud mientras G8 dice dónde lo quiere.
 */
@Injectable()
export class ContratacionesService {
  private readonly logger = new Logger(ContratacionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async crear(
    dto: ContratacionDto,
    ip: string,
  ): Promise<ContratacionResponseDto> {
    const hoy = new Date();

    try {
      const id_prospecto = await this.prisma.$transaction(async (tx) => {
        // Si ya es cliente, contrata desde su portal, no como interesado nuevo.
        const existe = await tx.cliente.findFirst({
          where: { rut: { in: variantesRut(dto.rut) } },
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

        const prospecto = await tx.prospecto.create({
          data: {
            id_empresa: 1,
            rut: dto.rut,
            nombre_completo: dto.nombre_completo,
            email: dto.email,
            telefono: dto.telefono ?? null,
            direccion: [dto.direccion_completa, dto.comuna, dto.ciudad]
              .filter(Boolean)
              .join(', ')
              .slice(0, LARGO_DIRECCION),
            estado_pipeline: ETAPA_PIPELINE_INICIAL,
            fecha_creacion: hoy,
          },
          select: { id_prospecto: true },
        });

        // CU-75: dentro de la transacción, a diferencia de la auditoría de más
        // abajo — sin la aceptación registrada no se procesa la solicitud.
        await registrarAceptacionPolitica(tx, {
          formulario: 'CONTRATACION',
          entidad: 'prospecto',
          id_entidad: prospecto.id_prospecto,
          version: dto.version_politica_privacidad,
          ip,
          datos: {
            nombre_completo: dto.nombre_completo,
            rut: dto.rut,
            email: dto.email,
            telefono: dto.telefono ?? null,
            id_plan: dto.id_plan,
            direccion_completa: dto.direccion_completa,
            comuna: dto.comuna,
            ciudad: dto.ciudad ?? null,
          },
        });

        return prospecto.id_prospecto;
      });

      this.logger.log(`Solicitud de contratación: prospecto=${id_prospecto}`);

      try {
        await this.prisma.log_auditoria.create({
          data: {
            accion: 'CREAR_PROSPECTO_PORTAL',
            entidad_afectada: 'prospecto',
            id_entidad_afectada: id_prospecto,
            valor_nuevo: {
              rut: dto.rut,
              // El plan de interés, mientras G8 dice dónde lo quiere.
              id_plan: dto.id_plan,
              etapa: ETAPA_PIPELINE_INICIAL,
              origen: 'PORTAL',
            },
          },
        });
      } catch (auditError) {
        this.logger.error(
          `No se pudo registrar auditoría del prospecto ${id_prospecto}`,
          auditError,
        );
      }

      return { id_prospecto };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error inesperado al crear contratación', error);
      throw new InternalServerErrorException(
        'No fue posible procesar la contratación en este momento',
      );
    }
  }
}
