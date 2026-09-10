import { Module } from '@nestjs/common';
import { DiagnosticoController } from './diagnostico.controller.js';
import { DiagnosticoService } from './diagnostico.service.js';

@Module({
  controllers: [DiagnosticoController],
  providers: [DiagnosticoService],
})
export class DiagnosticoModule {}
