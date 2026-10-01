import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { cleanRut } from '../common/utils/rut.js';
import type { ClienteIdentificadoDto } from './dto/asistente.dto.js';

/**
 * CU-63: verifica el RUT que el cliente le da al asistente y devuelve los
 * datos con que se personalizan las respuestas.
 *
 * Lo consulta finet-chatbot y no el widget, porque el mismo flujo tiene que
 * funcionar en WhatsApp (via Chatwoot), donde no pasa por este backend.
 */
@Injectable()
export class AsistenteClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async identificar(rut: string): Promise<ClienteIdentificadoDto> {
    const limpio = cleanRut(rut);

    // Como en deuda-publica (CU-39) se busca el RUT limpio. Se prueba la K en
    // ambas cajas: el chatbot la manda en mayuscula y no hay garantia de como
    // quedo guardada.
    const variantes = [
      ...new Set([limpio, limpio.toUpperCase(), limpio.toLowerCase()]),
    ];

    const cliente = await this.prisma.cliente.findFirst({
      where: { rut: { in: variantes } },
      select: {
        nombre_completo: true,
        contrato: {
          select: {
            estado: true,
            plan: {
              select: {
                nombre_comercial: true,
                tipo_plan: true,
                velocidad_mbps: true,
              },
            },
          },
        },
      },
    });

    if (!cliente) {
      return { encontrado: false, cliente: null };
    }

    return {
      encontrado: true,
      cliente: {
        nombre_completo: cliente.nombre_completo,
        planes: cliente.contrato.flatMap((contrato) =>
          contrato.plan
            ? [
                {
                  nombre_comercial: contrato.plan.nombre_comercial,
                  tipo_plan: contrato.plan.tipo_plan,
                  velocidad_mbps: contrato.plan.velocidad_mbps,
                  estado_contrato: contrato.estado,
                },
              ]
            : [],
        ),
      },
    };
  }
}
