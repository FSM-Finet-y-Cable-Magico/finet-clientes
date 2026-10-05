"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, History, RefreshCw } from "lucide-react";
import { api, API_URL } from "@/app/utils/api";

type PagoAnterior = {
  id_pago: number;
  fecha_pago: string;
  periodo: string | null;
  monto: number;
  pasarela: string;
};

type PagosAnterioresData = {
  comprobante_disponible: boolean;
  pagos: PagoAnterior[];
};

/** §11.5 del Documento 0: $XX.XXX. */
function formatPrecio(precio: number) {
  return `$${precio.toLocaleString("es-CL")}`;
}

/**
 * §11.4 del Documento 0: DD/MM/AAAA, en hora de Chile. El pago es un instante:
 * uno de las 22:30 en Chile ya es el día siguiente en UTC.
 */
function formatFechaPago(iso: string) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${partes.day}/${partes.month}/${partes.year}`;
}

const ID_NOTA = "comprobantes-no-disponibles";

/**
 * CU-52: los pagos anteriores del cliente y la descarga de su comprobante.
 *
 * El PDF lo genera G8. Mientras su endpoint no esté desplegado
 * (`comprobante_disponible = false`), el botón queda deshabilitado y la nota
 * explica por qué: no se ofrece una descarga que va a fallar.
 */
export default function PagosAnteriores() {
  const [data, setData] = useState<PagosAnterioresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPagos = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const json = await api.get<PagosAnterioresData>("/portal/pagos");
      // Una respuesta sin la lista se trata como error, no como "sin pagos".
      if (!Array.isArray(json?.pagos)) throw new Error("respuesta inválida");
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPagos(), 0);
    return () => clearTimeout(t);
  }, [fetchPagos]);

  return (
    <section
      aria-labelledby="pagos-anteriores-titulo"
      className="mt-6 border border-border rounded-xl bg-background"
    >
      <div className="flex items-start gap-3 p-6 pb-4">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
          <History size={18} aria-hidden />
        </div>
        <div>
          <h2
            id="pagos-anteriores-titulo"
            className="text-base font-semibold text-foreground"
          >
            Pagos anteriores
          </h2>
          <p className="text-sm text-muted">
            Descarga el comprobante del mes que necesites.
          </p>
        </div>
      </div>

      {loading && (
        <div className="px-6 pb-6 animate-pulse" aria-hidden>
          <div className="h-3 w-full rounded bg-border mb-3" />
          <div className="h-3 w-5/6 rounded bg-border mb-3" />
          <div className="h-3 w-2/3 rounded bg-border" />
        </div>
      )}

      {error && !loading && (
        <div className="mx-6 mb-6 border border-error bg-error-container rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={18}
              className="text-error mt-0.5 shrink-0"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium text-on-error-container">
                No se pudieron cargar tus pagos
              </p>
              <button
                type="button"
                onClick={fetchPagos}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-on-error-container hover:brightness-110 transition-[filter]"
              >
                <RefreshCw size={14} aria-hidden />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {data && !loading && !error && data.pagos.length === 0 && (
        <p className="px-6 pb-6 text-sm text-muted">Aún no registras pagos.</p>
      )}

      {data && !loading && !error && data.pagos.length > 0 && (
        <>
          {!data.comprobante_disponible && (
            <p
              id={ID_NOTA}
              className="mx-6 mb-4 rounded-lg bg-info-container px-4 py-3 text-sm text-on-info-container"
            >
              Los comprobantes todavía no se pueden descargar desde el portal.
              Estarán disponibles pronto.
            </p>
          )}

          {/* Escritorio: tabla */}
          <div className="hidden sm:block px-6 pb-6">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Pagos anteriores y su comprobante
              </caption>
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th scope="col" className="pb-2 font-medium">Fecha</th>
                  <th scope="col" className="pb-2 font-medium">Período</th>
                  <th scope="col" className="pb-2 font-medium">Monto</th>
                  <th scope="col" className="pb-2 font-medium">Medio</th>
                  <th scope="col" className="pb-2 font-medium text-right">
                    Comprobante
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.pagos.map((p) => (
                  <tr key={p.id_pago}>
                    <td className="py-3 text-foreground tabular-nums">
                      {formatFechaPago(p.fecha_pago)}
                    </td>
                    <td className="py-3 text-foreground">{p.periodo ?? "—"}</td>
                    <td className="py-3 font-semibold text-foreground tabular-nums">
                      {formatPrecio(p.monto)}
                    </td>
                    <td className="py-3 text-muted">{p.pasarela}</td>
                    <td className="py-3 text-right">
                      <BotonComprobante
                        pago={p}
                        disponible={data.comprobante_disponible}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas apiladas */}
          <ul className="sm:hidden divide-y divide-border border-t border-border">
            {data.pagos.map((p) => (
              <li key={p.id_pago} className="flex items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {p.periodo ?? "Pago sin período"}
                  </p>
                  <p className="text-xs text-muted tabular-nums">
                    {formatFechaPago(p.fecha_pago)} · {p.pasarela}
                  </p>
                  <p className="mt-1 text-base font-bold text-foreground tabular-nums">
                    {formatPrecio(p.monto)}
                  </p>
                </div>
                <BotonComprobante
                  pago={p}
                  disponible={data.comprobante_disponible}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function BotonComprobante({
  pago,
  disponible,
}: {
  pago: PagoAnterior;
  disponible: boolean;
}) {
  const etiqueta = `Descargar comprobante del pago del ${formatFechaPago(pago.fecha_pago)}`;
  const clases =
    "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors";

  if (!disponible) {
    return (
      <button
        type="button"
        disabled
        aria-label={etiqueta}
        aria-describedby={ID_NOTA}
        className={`${clases} cursor-not-allowed opacity-50`}
      >
        <Download size={16} aria-hidden />
        <span className="hidden sm:inline">Descargar</span>
      </button>
    );
  }

  return (
    <a
      href={`${API_URL}/portal/pagos/${pago.id_pago}/comprobante`}
      aria-label={etiqueta}
      className={`${clases} hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
    >
      <Download size={16} aria-hidden />
      <span className="hidden sm:inline">Descargar</span>
    </a>
  );
}
