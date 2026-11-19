#!/usr/bin/env bash
# Repone las facturas que se pagaron en un ensayo de la demo, sin reiniciar la
# base ni los servicios: borra los pagos hechos por Webpay (los que no son de la
# semilla, cuyo código termina en -DEMO), deja esas facturas otra vez Pendientes
# y devuelve el contador de pagos a donde estaba. Cada pago aprobado deja la
# factura como Pagada, así que sirve entre un ensayo y el siguiente.
#
#   ppt/rearmar-pagos.sh              # repone las facturas
#   ppt/rearmar-pagos.sh --correos    # y además vacía Mailpit
#
# Solo toca la base local finet_ppt: lib.sh se niega a trabajar con cualquier otra.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
URL=$(url_base)
exigir_local "$URL"

read -r -d '' SQL_REARMAR <<'SQL' || true
BEGIN;
WITH ensayo AS (
  SELECT id_pago, id_factura FROM pago WHERE codigo_transaccion NOT LIKE '%-DEMO'
), repuestas AS (
  UPDATE factura SET estado = 'Pendiente'
   WHERE id_factura IN (SELECT id_factura FROM ensayo) RETURNING id_factura
), borrados AS (
  DELETE FROM pago WHERE id_pago IN (SELECT id_pago FROM ensayo) RETURNING id_pago
)
SELECT (SELECT count(*) FROM repuestas), (SELECT count(*) FROM borrados);
SELECT setval(pg_get_serial_sequence('pago', 'id_pago'), (SELECT max(id_pago) FROM pago)) IS NOT NULL;
COMMIT;
SQL

resumen=$(printf '%s\n' "$SQL_REARMAR" | psql "$URL" -X -q -At -F ' ') \
  || { echo "No se pudo reponer: ¿está arriba Postgres?" >&2; exit 1; }

read -r repuestas borrados <<<"$(printf '%s\n' "$resumen" | sed -n '1p')"
echo "Facturas repuestas: $repuestas · pagos de ensayo borrados: $borrados."

echo "Facturas que se pueden pagar ahora (Camila Rojas, 16.234.567-2):"
psql "$URL" -X -At -F '  ' -c "SELECT '  factura ' || f.id_factura, f.periodo_mes || '/' || f.periodo_anio, '\$' || f.monto::int, 'vence ' || f.fecha_limite_pago, f.estado
                                FROM factura f JOIN contrato c USING (id_contrato)
                               WHERE c.id_cliente = 1 AND f.estado = 'Pendiente' ORDER BY f.id_factura"

if [ "${1:-}" = "--correos" ]; then
  curl -fsS -X DELETE http://127.0.0.1:8025/api/v1/messages >/dev/null \
    && echo "Mailpit vaciado." || echo "No se pudo vaciar Mailpit (¿está arriba?)." >&2
fi
