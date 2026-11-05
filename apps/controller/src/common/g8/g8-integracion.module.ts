import { Module } from '@nestjs/common';
import { G8IntegracionService } from './g8-integracion.service.js';

@Module({
  providers: [G8IntegracionService],
  exports: [G8IntegracionService],
})
export class G8IntegracionModule {}
