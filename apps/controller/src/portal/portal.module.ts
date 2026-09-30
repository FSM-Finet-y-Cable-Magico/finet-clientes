import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Module({
  controllers: [PortalController],
  providers: [PortalService, JwtAuthGuard],
})
export class PortalModule {}
