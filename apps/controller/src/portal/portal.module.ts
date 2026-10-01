import { Module } from '@nestjs/common';
import { EnlacePagoModule } from '../common/enlaces/enlace-pago.module.js';
import { G3WifiModule } from '../common/g3/g3-wifi.module.js';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Module({
  imports: [EnlacePagoModule, G3WifiModule],
  controllers: [PortalController],
  providers: [PortalService, JwtAuthGuard],
})
export class PortalModule {}
