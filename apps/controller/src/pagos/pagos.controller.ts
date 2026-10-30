import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
} from '@nestjs/common';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { PagosService } from './pagos.service.js';
import {
  IdentificadorPagoDto,
  IniciarPagoDto,
  ResultadoWebpayDto,
  type InicioPagoDto,
  type ResultadoWebpayRespuestaDto,
  type ResumenPagoDto,
} from './dto/pagos.dto.js';

/**
 * CU-42. Público, como la consulta de deuda (CU-39): se puede pagar la cuenta de
 * alguien más con su RUT, igual que en otros portales de pago. El throttler
 * global limita los intentos por IP.
 *
 * Base path: /api/pagos
 */
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  /**
   * GET /pagos/resumen?rut=123456785 | ?t=<enlace firmado>
   *
   * 200 { encontrado, cliente, saldo, facturas, medios }. `saldo` y `facturas`
   * son `null` mientras G8 no entregue el saldo; `facturas` trae solo las que G8
   * deja pagar. 400 si no viene exactamente un identificador válido.
   */
  @Get('resumen')
  resumen(
    @Query(new ZodValidationPipe(IdentificadorPagoDto))
    query: IdentificadorPagoDto,
  ): Promise<ResumenPagoDto> {
    return this.pagos.resumen(query);
  }

  /**
   * POST /pagos/iniciar { rut | t, id_factura, medio: 'webpay' }
   *
   * 200 { url, token }: la vista manda al cliente al formulario de Webpay con
   * `token_ws` por POST. 404 cuenta no encontrada · 409 factura que no se puede
   * pagar · 503 sin saldo de G8 o sin pasarela (Excepción 1 del CU-42).
   */
  @Post('iniciar')
  @HttpCode(200)
  iniciar(
    @Body(new ZodValidationPipe(IniciarPagoDto)) body: IniciarPagoDto,
  ): Promise<InicioPagoDto> {
    const { medio, id_factura, ...identificador } = body;
    return this.pagos.iniciar(identificador, id_factura, medio);
  }

  /**
   * GET o POST /pagos/webpay/retorno: adonde Webpay devuelve al cliente
   * (`WEBPAY_URL_RETORNO`). Según el caso llega por GET o por POST, con
   * `token_ws` o con los `TBK_*`. Siempre responde 303 a /pagar/resultado.
   */
  @Get('webpay/retorno')
  @Redirect()
  async retornoPorGet(@Query() query: unknown) {
    return { url: await this.pagos.retorno(query), statusCode: 303 };
  }

  @Post('webpay/retorno')
  @Redirect()
  async retornoPorPost(@Body() body: unknown) {
    return { url: await this.pagos.retorno(body), statusCode: 303 };
  }

  /**
   * GET /pagos/webpay/resultado?token_ws=…
   *
   * 200 { estado, monto, fecha, codigo_autorizacion, orden, id_factura }, según
   * Transbank. 404 si la transacción no es del portal · 503 si Webpay no
   * responde.
   */
  @Get('webpay/resultado')
  resultado(
    @Query(new ZodValidationPipe(ResultadoWebpayDto))
    query: ResultadoWebpayDto,
  ): Promise<ResultadoWebpayRespuestaDto> {
    return this.pagos.resultado(query.token_ws);
  }
}
