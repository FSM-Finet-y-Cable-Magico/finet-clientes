import { Module } from '@nestjs/common';
import { ConsentimientoController } from './consentimiento.controller.js';
import { ConsentimientoService } from './consentimiento.service.js';

@Module({
  controllers: [ConsentimientoController],
  providers: [ConsentimientoService],
})
export class ConsentimientoModule {}
