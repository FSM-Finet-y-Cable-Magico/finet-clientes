import { Module } from '@nestjs/common';
import { EnlacePagoService } from './enlace-pago.service.js';

@Module({
  providers: [EnlacePagoService],
  exports: [EnlacePagoService],
})
export class EnlacePagoModule {}
