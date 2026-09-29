import { Module } from '@nestjs/common';
import { RecordatorioPagoService } from './recordatorio-pago.service.js';

@Module({
  providers: [RecordatorioPagoService],
  exports: [RecordatorioPagoService],
})
export class NotificacionesModule {}
