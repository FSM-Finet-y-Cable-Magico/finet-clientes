import { Module } from '@nestjs/common';
import { SaldoClienteService } from './saldo-cliente.service.js';

@Module({
  providers: [SaldoClienteService],
  exports: [SaldoClienteService],
})
export class SaldoClienteModule {}
