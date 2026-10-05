import type { ReactNode } from "react";

type TablaLegalProps = {
  /** Lo anuncia el lector de pantalla al entrar a la tabla. */
  titulo: string;
  columnas: string[];
  /** La primera celda de cada fila es su encabezado. */
  filas: ReactNode[][];
};

export default function TablaLegal({ titulo, columnas, filas }: TablaLegalProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{titulo}</caption>
        <thead className="bg-surface">
          <tr>
            {columnas.map((columna) => (
              <th key={columna} scope="col" className="px-4 py-3 font-semibold text-foreground">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map(([encabezado, ...celdas], i) => (
            <tr key={i}>
              <th scope="row" className="px-4 py-3 align-top font-medium text-foreground">
                {encabezado}
              </th>
              {celdas.map((celda, j) => (
                <td key={j} className="px-4 py-3 align-top text-foreground/80">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
