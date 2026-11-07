import { Module } from '@nestjs/common';
import { SaldoClienteModule } from '../common/saldo/saldo-cliente.module.js';
import { DeudaPublicaController } from './deuda-publica.controller.js';
import { DeudaPublicaService } from './deuda-publica.service.js';

@Module({
  imports: [SaldoClienteModule],
  controllers: [DeudaPublicaController],
  providers: [DeudaPublicaService],
})
export class DeudaPublicaModule {}
