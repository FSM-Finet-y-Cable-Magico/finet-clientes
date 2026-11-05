import type { ReactNode } from "react";
import { formatPrecio } from "@/app/_lib/formato";

/**
 * "Detalle de facturas" de la consulta pública (CU-39/41) y de Mi deuda
 * (CU-28). Las filas van como hijos, con `FilaFactura`.
 */
export function TablaFacturas({ children }: { children: ReactNode }) {
  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Detalle de facturas
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="pb-2 font-medium">Periodo</th>
              <th className="pb-2 font-medium">Monto</th>
              <th className="pb-2 font-medium">Vence</th>
              <th className="pb-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Cada pantalla decide cómo muestra el vencimiento y el estado: la consulta
 * pública con la fecha corta, Mi deuda con la larga y los días de atraso.
 */
export function FilaFactura({
  periodo,
  monto,
  vence,
  estado,
}: {
  periodo: string;
  monto: number;
  vence: ReactNode;
  estado: ReactNode;
}) {
  return (
    <tr>
      <td className="py-2 text-foreground">{periodo}</td>
      <td className="py-2 text-foreground">{formatPrecio(monto)}</td>
      <td className="py-2 text-muted">{vence}</td>
      <td className="py-2">{estado}</td>
    </tr>
  );
}
