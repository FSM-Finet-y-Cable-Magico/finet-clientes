import { Injectable } from '@nestjs/common';

/** A quién se le cobra: por código de abonado, solo ese contrato. */
export type Cuenta = { idCliente: number; idContrato: number | null };

/**
 * El saldo que debe un cliente, tal como lo deja Grupo 8.
 *
 * La deuda la calcula G8, no nosotros (acuerdo v2.0 §3 y §5): acá no se suman
 * facturas. G8 confirmó el 01-10 que el saldo no es una columna: lo entrega su
 * Billing por `GET /api/integrations/g2/invoices`. Mientras no lo desplieguen, no
 * hay saldo que leer y el servicio devuelve `null`: el pago cae en su
 * precondición ("una deuda pendiente identificada") y nunca cobra un total
 * inventado. Ver `SALDO_CLIENTE_DEFINIDO` en `common/pendientes.ts`.
 *
 * Lo usan el pago (CU-42, CU-43: el total a cobrar) y el aviso de corte (CU-68:
 * el monto que se informa). Con `idContrato`, el saldo de ese contrato (pago por
 * código de abonado); sin él, el de todos los contratos del cliente.
 */
@Injectable()
export class SaldoClienteService {
  saldoDe(cuenta: Cuenta): Promise<number | null> {
    void cuenta;
    return Promise.resolve(null);
  }
}
