import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { cleanRut, variantesRut } from '../common/utils/rut.js';
import {
  DetalleFacturaPublicaDto,
  DeudaPublicaResponseDto,
  PlanResumenPublicoDto,
} from './dto/deuda-publica.dto.js';

// Forma del plan tal como llega del select de Prisma (precio_mensual es Decimal).
type PlanContratoRaw = {
  nombre_comercial: string;
  tipo_plan: string;
  velocidad_mbps: number | null;
  precio_mensual: { toString(): string };
};

@Injectable()
export class DeudaPublicaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * CU-39: Consultar deuda pública mediante RUT.
   * Endpoint público — no requiere autenticación.
   * Limpia el RUT antes de buscar (elimina puntos y guión).
   */
  async consultarPorRut(rut: string): Promise<DeudaPublicaResponseDto> {
    const rutNormalizado = cleanRut(rut);

    const cliente = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantesRut(rutNormalizado) } },
      select: {
        id_cliente: true,
        nombre_completo: true,
        rut: true,
        contrato: { select: { id_contrato: true } },
      },
    });

    if (!cliente) {
      return this.respuestaNoEncontrada();
    }

    return this.construirRespuesta(
      cliente.nombre_completo,
      cliente.rut,
      null,
      cliente.contrato.map((c) => c.id_contrato),
    );
  }

  /**
   * CU-40: Consultar deuda pública mediante código de abonado.
   * El código de abonado corresponde al id_contrato del sistema.
   * Endpoint público — no requiere autenticación.
   */
  async consultarPorAbonado(
    codigoAbonado: number,
  ): Promise<DeudaPublicaResponseDto> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id_contrato: codigoAbonado },
      include: {
        cliente: {
          select: { nombre_completo: true, rut: true },
        },
      },
    });

    if (!contrato || !contrato.cliente) {
      return this.respuestaNoEncontrada();
    }

    return this.construirRespuesta(
      contrato.cliente.nombre_completo,
      contrato.cliente.rut,
      codigoAbonado,
      [codigoAbonado],
    );
  }

  /**
   * CU-41: Lógica compartida que construye el detalle de deuda y vencimientos.
   * Usado internamente por CU-39 y CU-40.
   */
  private async construirRespuesta(
    nombreCompleto: string,
    rut: string | null,
    codigoAbonado: number | null,
    idContratos: number[],
  ): Promise<DeudaPublicaResponseDto> {
    if (!idContratos.length) {
      return {
        encontrado: true,
        cliente: {
          nombre_completo: nombreCompleto,
          rut,
          codigo_abonado: codigoAbonado,
        },
        tiene_deuda: false,
        saldo_total: 0,
        facturas: [],
        planes: [],
        detalle_disponible: true,
        informacion_completa: true,
      };
    }

    const hoy = new Date();

    let facturas: Awaited<ReturnType<typeof this.prisma.factura.findMany>>;
    let planes: PlanResumenPublicoDto[];
    try {
      const [facturasResult, contratosConPlan] = await Promise.all([
        this.prisma.factura.findMany({
          where: {
            id_contrato: { in: idContratos },
            estado: { in: ['pendiente', 'vencida'] },
          },
          orderBy: { fecha_limite_pago: 'asc' },
        }),
        this.prisma.contrato.findMany({
          where: { id_contrato: { in: idContratos } },
          select: {
            plan: {
              select: {
                nombre_comercial: true,
                tipo_plan: true,
                velocidad_mbps: true,
                precio_mensual: true,
              },
            },
          },
        }),
      ]);
      facturas = facturasResult;
      planes = this.construirPlanes(contratosConPlan);
    } catch {
      // CU-41 Excepción 1: no fue posible determinar/obtener el detalle de facturación
      return {
        encontrado: true,
        cliente: {
          nombre_completo: nombreCompleto,
          rut,
          codigo_abonado: codigoAbonado,
        },
        tiene_deuda: false,
        saldo_total: 0,
        facturas: [],
        planes: [],
        detalle_disponible: false,
        informacion_completa: true,
      };
    }

    // CU-41 Excepción 2: detectar montos o fechas inconsistentes
    let informacionCompleta = true;

    // CU-41: construir detalle con fecha de vencimiento y días
    const facturasMapeadas: DetalleFacturaPublicaDto[] = facturas.map((f) => {
      const limite = new Date(f.fecha_limite_pago);
      const fechaInvalida = Number.isNaN(limite.getTime());
      if (f.monto == null || fechaInvalida) {
        informacionCompleta = false;
      }

      const diffMs = limite.getTime() - hoy.getTime();
      const diffDias = Math.ceil(diffMs / 86_400_000);

      return {
        id_factura: f.id_factura,
        periodo: this.formatPeriodo(f.periodo_mes, f.periodo_anio),
        monto: Number(f.monto ?? 0),
        fecha_limite_pago: fechaInvalida
          ? ''
          : limite.toISOString().split('T')[0],
        estado: f.estado,
        // Si diffDias < 0 → ya vencida, informamos cuántos días hace
        dias_vencida:
          !fechaInvalida && diffDias < 0 ? Math.abs(diffDias) : null,
        // Si diffDias >= 0 → cuántos días faltan para vencer
        dias_para_vencer: !fechaInvalida && diffDias >= 0 ? diffDias : null,
      };
    });

    const saldo_total = facturasMapeadas.reduce((acc, f) => acc + f.monto, 0);

    return {
      encontrado: true,
      cliente: {
        nombre_completo: nombreCompleto,
        rut,
        codigo_abonado: codigoAbonado,
      },
      tiene_deuda: facturasMapeadas.length > 0,
      saldo_total,
      facturas: facturasMapeadas,
      planes,
      detalle_disponible: true,
      informacion_completa: informacionCompleta,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private respuestaNoEncontrada(): DeudaPublicaResponseDto {
    return {
      encontrado: false,
      cliente: null,
      tiene_deuda: false,
      saldo_total: 0,
      facturas: [],
      planes: [],
      detalle_disponible: true,
      informacion_completa: true,
    };
  }

  // Construye el detalle de plan(es), sin duplicados (un cliente puede tener
  // varios contratos con el mismo plan).
  private construirPlanes(
    contratos: { plan: PlanContratoRaw | null }[],
  ): PlanResumenPublicoDto[] {
    const porNombre = new Map<string, PlanResumenPublicoDto>();
    for (const { plan } of contratos) {
      if (!plan) continue;
      if (porNombre.has(plan.nombre_comercial)) continue;
      porNombre.set(plan.nombre_comercial, {
        nombre_comercial: plan.nombre_comercial,
        tipo_plan: plan.tipo_plan,
        velocidad_mbps: plan.velocidad_mbps,
        precio_mensual: Number(plan.precio_mensual.toString()),
      });
    }
    return [...porNombre.values()];
  }

  private formatPeriodo(mes: number, anio: number): string {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    return `${meses[mes - 1]} ${anio}`;
  }
}
