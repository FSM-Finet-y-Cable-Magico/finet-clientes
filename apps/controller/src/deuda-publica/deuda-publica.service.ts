import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SaldoClienteService } from '../common/saldo/saldo-cliente.service.js';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly saldos: SaldoClienteService,
  ) {}

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
      cliente,
      cliente.contrato.map((c) => c.id_contrato),
    );
  }

  /**
   * CU-41: el detalle de deuda y vencimientos de la consulta del CU-39. El monto
   * y el vencimiento son los de G8 (`GET …/invoices`), como en el portal y el
   * pago; de la base salen el cliente, sus planes y el periodo de cada factura.
   */
  private async construirRespuesta(
    cliente: {
      id_cliente: number;
      nombre_completo: string;
      rut: string | null;
    },
    idContratos: number[],
  ): Promise<DeudaPublicaResponseDto> {
    const base = {
      encontrado: true,
      cliente: { nombre_completo: cliente.nombre_completo, rut: cliente.rut },
    };

    let deuda: Awaited<ReturnType<SaldoClienteService['deudaDe']>>;
    let planes: PlanResumenPublicoDto[];
    try {
      const [deudaG8, contratosConPlan] = await Promise.all([
        this.saldos.deudaDe({ idCliente: cliente.id_cliente }),
        idContratos.length
          ? this.prisma.contrato.findMany({
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
            })
          : Promise.resolve([]),
      ]);
      deuda = deudaG8;
      planes = this.construirPlanes(contratosConPlan);
    } catch {
      deuda = null;
      planes = [];
    }

    // CU-41 Excepción 1: no fue posible obtener el detalle de facturación.
    // Un saldo inconsistente tampoco se muestra como "al día".
    if (deuda === null || deuda.inconsistente) {
      return {
        ...base,
        tiene_deuda: false,
        saldo_total: 0,
        facturas: [],
        planes,
        detalle_disponible: false,
        informacion_completa: true,
      };
    }

    const facturas: DetalleFacturaPublicaDto[] = deuda.facturas.map((f) => ({
      id_factura: f.idFactura,
      periodo: f.periodo,
      monto: f.monto,
      fecha_limite_pago: f.fechaLimite ?? '',
      estado: f.vencida ? 'vencida' : 'pendiente',
      dias_vencida: f.diasVencida,
      dias_para_vencer: f.diasParaVencer,
    }));

    return {
      ...base,
      // CU-41 Excepción 3: sin deuda, la vista deriva a la cuenta al día.
      tiene_deuda: facturas.length > 0,
      saldo_total: deuda.saldoTotal,
      facturas,
      planes,
      detalle_disponible: true,
      // CU-41 Excepción 2: alguna factura vino sin vencimiento.
      informacion_completa: deuda.completa,
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
}
