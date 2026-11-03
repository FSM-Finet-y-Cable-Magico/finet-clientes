import { Module } from '@nestjs/common';
import { EnlacePagoModule } from '../common/enlaces/enlace-pago.module.js';
import { G8IntegracionModule } from '../common/g8/g8-integracion.module.js';
import { SaldoClienteModule } from '../common/saldo/saldo-cliente.module.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { PagosController } from './pagos.controller.js';
import { PagosService } from './pagos.service.js';
import { SDK_WEBPAY, WebpayService, sdkWebpay } from './webpay.service.js';

@Module({
  imports: [
    EnlacePagoModule,
    SaldoClienteModule,
    G8IntegracionModule,
    NotificacionesModule,
  ],
  controllers: [PagosController],
  providers: [
    PagosService,
    WebpayService,
    { provide: SDK_WEBPAY, useValue: sdkWebpay },
  ],
})
export class PagosModule {}
