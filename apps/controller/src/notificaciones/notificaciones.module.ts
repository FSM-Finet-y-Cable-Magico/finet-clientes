import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { EnlacePagoModule } from '../common/enlaces/enlace-pago.module.js';
import { pendientesVacios } from '../common/pendientes.js';
import { RecordatorioPagoService } from './recordatorio-pago.service.js';
import { AvisoCorteService } from './aviso-corte.service.js';
import { ConfirmacionPagoService } from './confirmacion-pago.service.js';

@Module({
  imports: [EnlacePagoModule],
  providers: [
    RecordatorioPagoService,
    AvisoCorteService,
    ConfirmacionPagoService,
  ],
  exports: [
    RecordatorioPagoService,
    AvisoCorteService,
    ConfirmacionPagoService,
  ],
})
export class NotificacionesModule implements OnModuleInit {
  private readonly logger = new Logger('Incremento 3');

  /**
   * Al arrancar, deja en el log qué datos siguen faltando y qué caso de uso
   * frena cada uno. Es la lista de `common/pendientes.ts`.
   */
  onModuleInit() {
    for (const falta of pendientesVacios()) {
      this.logger.warn(`falta un dato: ${falta}`);
    }
  }
}
