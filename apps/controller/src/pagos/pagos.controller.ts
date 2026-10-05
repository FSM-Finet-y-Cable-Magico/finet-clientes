import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { PagosService } from './pagos.service.js';
import {
  IdentificadorPagoDto,
  IniciarPagoDto,
  type ResumenPagoDto,
} from './dto/pagos.dto.js';

/**
 * CU-42 / CU-43. Público, como la consulta de deuda (CU-39/CU-40): se puede
 * pagar la cuenta de alguien más con su RUT o su código de abonado, igual que en
 * otros portales de pago. El throttler global limita los intentos por IP.
 *
 * Base path: /api/pagos
 */
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  /**
   * GET /pagos/resumen?rut=123456785 | ?abonado=100 | ?t=<enlace firmado>
   *
   * 200 { encontrado, cliente, saldo, medios }. `saldo` es `null` mientras G8
   * no diga dónde lo deja; `medios[].disponible` es `false` sin pasarela.
   * 400 si no viene exactamente un identificador válido.
   */
  @Get('resumen')
  resumen(
    @Query(new ZodValidationPipe(IdentificadorPagoDto))
    query: IdentificadorPagoDto,
  ): Promise<ResumenPagoDto> {
    return this.pagos.resumen(query);
  }

  /**
   * POST /pagos/iniciar { rut | abonado | t, medio: 'webpay' | 'mercadopago' }
   *
   * 404 cuenta no encontrada · 409 sin deuda · 503 sin saldo de G8 o sin
   * pasarela (Excepción 1 del CU-42 / CU-43, con su mensaje).
   */
  @Post('iniciar')
  @HttpCode(200)
  iniciar(
    @Body(new ZodValidationPipe(IniciarPagoDto)) body: IniciarPagoDto,
  ): Promise<never> {
    const { medio, ...identificador } = body;
    return this.pagos.iniciar(identificador, medio);
  }
}
