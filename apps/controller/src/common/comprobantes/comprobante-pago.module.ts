import { Module } from '@nestjs/common';
import { ComprobantePagoService } from './comprobante-pago.service.js';

/** CU-52: el comprobante de pago, para el portal y el correo de confirmación. */
@Module({
  providers: [ComprobantePagoService],
  exports: [ComprobantePagoService],
})
export class ComprobantePagoModule {}
