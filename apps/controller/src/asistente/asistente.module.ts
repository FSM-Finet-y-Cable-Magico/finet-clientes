import { Module } from '@nestjs/common';
import { AsistenteController } from './asistente.controller.js';
import { AsistenteService } from './asistente.service.js';
import { AsistenteClientesController } from './asistente-clientes.controller.js';
import { AsistenteClientesService } from './asistente-clientes.service.js';

@Module({
  controllers: [AsistenteController, AsistenteClientesController],
  providers: [AsistenteService, AsistenteClientesService],
})
export class AsistenteModule {}
