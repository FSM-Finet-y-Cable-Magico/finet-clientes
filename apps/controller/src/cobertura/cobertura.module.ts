import { Module } from '@nestjs/common';
import { CoberturaController } from './cobertura.controller.js';
import { CoberturaService } from './cobertura.service.js';

@Module({
  controllers: [CoberturaController],
  providers: [CoberturaService],
})
export class CoberturaModule {}
