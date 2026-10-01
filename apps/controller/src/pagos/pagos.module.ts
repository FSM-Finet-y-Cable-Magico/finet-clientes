import { Module } from '@nestjs/common';
import { EnlacePagoModule } from '../common/enlaces/enlace-pago.module.js';
import { SaldoClienteModule } from '../common/saldo/saldo-cliente.module.js';
import { PagosController } from './pagos.controller.js';
import { PagosService } from './pagos.service.js';

@Module({
  imports: [EnlacePagoModule, SaldoClienteModule],
  controllers: [PagosController],
  providers: [PagosService],
})
export class PagosModule {}
