import { Module } from '@nestjs/common';
import { G8IntegracionModule } from '../g8/g8-integracion.module.js';
import { SaldoClienteService } from './saldo-cliente.service.js';

@Module({
  imports: [G8IntegracionModule],
  providers: [SaldoClienteService],
  exports: [SaldoClienteService],
})
export class SaldoClienteModule {}
