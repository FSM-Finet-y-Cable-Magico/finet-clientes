import { Module } from '@nestjs/common';
import { ComprobantePagoModule } from '../common/comprobantes/comprobante-pago.module.js';
import { EnlacePagoModule } from '../common/enlaces/enlace-pago.module.js';
import { G3WifiModule } from '../common/g3/g3-wifi.module.js';
import { G8IntegracionModule } from '../common/g8/g8-integracion.module.js';
import { SaldoClienteModule } from '../common/saldo/saldo-cliente.module.js';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Module({
  imports: [
    ComprobantePagoModule,
    EnlacePagoModule,
    G3WifiModule,
    G8IntegracionModule,
    SaldoClienteModule,
  ],
  controllers: [PortalController],
  providers: [PortalService, JwtAuthGuard],
})
export class PortalModule {}
