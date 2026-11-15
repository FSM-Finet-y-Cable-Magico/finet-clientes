#!/usr/bin/env bash
# Hace en la base local lo que en producción hace G8 cuando la instalación queda
# lista: convierte en cliente a quien pidió un plan desde «Contratar». Crea el
# cliente (activo, todavía sin cuenta en el portal), su contrato ACTIVO del plan
# que pidió, el servicio Internet y la dirección de instalación, y deja el
# prospecto enlazado al cliente. Después la persona se registra desde el sitio.
#
# No toca la etapa del pipeline: es de G8 y el portal no la lee.
#
# Uso: ppt/aceptar-prospecto.sh 20.123.456-5
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

[ $# -eq 1 ] || { echo "Uso: ppt/aceptar-prospecto.sh <RUT del prospecto>" >&2; exit 1; }
RUT=$(printf '%s' "$1" | tr -d '.-' | tr '[:lower:]' '[:upper:]')
[[ "$RUT" =~ ^[0-9]{7,8}[0-9K]$ ]] || { echo "RUT inválido: $1" >&2; exit 1; }

URL=$(url_base)
exigir_local "$URL"

psql "$URL" -X -q -v ON_ERROR_STOP=1 -v rut="$RUT" <<'SQL'
BEGIN;
CREATE TEMP TABLE p ON COMMIT DROP AS
  SELECT * FROM prospecto
   WHERE regexp_replace(upper(rut), '[^0-9K]', '', 'g') = :'rut' AND id_cliente IS NULL
   ORDER BY fecha_creacion DESC LIMIT 1;
SELECT count(*) = 1 AS hay FROM p \gset
\if :hay
  WITH c AS (
    INSERT INTO cliente (id_empresa, rut, nombre_completo, email, telefono, estado, fecha_creacion)
    SELECT id_empresa, left(:'rut', -1) || '-' || right(:'rut', 1), nombre_completo, email, telefono, 'activo', now()
      FROM p
    RETURNING id_cliente, id_empresa
  ), k AS (
    INSERT INTO contrato (id_cliente, id_plan, id_empresa, fecha_inicio, dia_vencimiento, estado)
    SELECT c.id_cliente, p.id_plan_interes, c.id_empresa, CURRENT_DATE, extract(day FROM CURRENT_DATE), 'ACTIVO'
      FROM c, p
    RETURNING id_contrato, id_cliente, id_empresa
  ), s AS (
    INSERT INTO servicio_contratado (id_cliente, id_empresa, id_contrato, tipo_servicio, estado_operativo)
    SELECT id_cliente, id_empresa, id_contrato, 'Internet', 'Operativo' FROM k
    RETURNING id_servicio
  ), d AS (
    INSERT INTO direccion_servicio (id_cliente, direccion_completa, comuna, es_principal)
    SELECT c.id_cliente, coalesce(p.direccion, ''), coalesce(p.comuna, ''), true FROM c, p
    RETURNING id_direccion
  )
  UPDATE prospecto
     SET id_cliente = c.id_cliente,
         fecha_conversion = CURRENT_DATE,
         tiempo_conversion_dias = CURRENT_DATE - p.fecha_creacion::date
    FROM c, p, k, s, d
   WHERE prospecto.id_prospecto = p.id_prospecto;
  COMMIT;
  \pset footer off
  SELECT cl.nombre_completo AS "Cliente nuevo", cl.rut AS "RUT", e.nombre AS "Empresa",
         pl.nombre_comercial AS "Plan", k.estado AS "Contrato", cl.email AS "Correo"
    FROM cliente cl
    JOIN empresa e ON e.id_empresa = cl.id_empresa
    JOIN contrato k ON k.id_cliente = cl.id_cliente
    JOIN plan pl ON pl.id_plan = k.id_plan
   WHERE cl.rut = left(:'rut', -1) || '-' || right(:'rut', 1);
  \echo 'Listo: ya puede crear su cuenta en el sitio (Iniciar sesión → Registrarse). El correo para confirmarla llega a Mailpit.'
\else
  ROLLBACK;
  \echo 'No hay una solicitud de contratación pendiente con ese RUT (¿ya se aceptó, o se envió con otro RUT?).'
  \quit
\endif
SQL
