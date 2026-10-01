import { Module } from '@nestjs/common';
import { AsistenteController } from './asistente.controller.js';
import { AsistenteService } from './asistente.service.js';

@Module({
  controllers: [AsistenteController],
  providers: [AsistenteService],
})
export class AsistenteModule {}
