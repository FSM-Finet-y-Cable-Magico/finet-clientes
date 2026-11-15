#!/usr/bin/env bash
# Crea la base local finet_ppt, le aplica las migraciones del portal y carga los
# datos de la demo. Solo trabaja en localhost.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

URL=$(url_base)
ADMIN=$(url_base postgres)
exigir_local "$URL"

if [ "$(psql "$ADMIN" -X -At -c "select 1 from pg_database where datname='$PPT_BASE'")" = "1" ]; then
  echo "La base $PPT_BASE ya existe. Para empezar de cero usa ppt/base/reiniciar.sh."
  exit 1
fi

echo "Creando $PPT_BASE…"
psql "$ADMIN" -X -q -c "CREATE DATABASE $PPT_BASE"

echo "Aplicando migraciones…"
(cd "$REPO_DIR/apps/controller" && DATABASE_URL="$URL" pnpm exec prisma migrate deploy 2>&1 | grep -E "applied|No pending|Error" || true)

echo "Cargando datos de la demo…"
psql "$URL" -X -q -v ON_ERROR_STOP=1 -f "$PPT_DIR/base/datos.sql"

# Los correos reales quedan fuera del repo: con ppt/.local/correo-demo todos
# los usuarios de prueba usan ese correo, y con ppt/.local/correo-registro,
# Ignacio (el que se registra en la demo) usa ese otro.
if [ -s "$LOCAL_DIR/correo-demo" ]; then
  psql "$URL" -X -q -v ON_ERROR_STOP=1 -v correo="$(tr -d '[:space:]' <"$LOCAL_DIR/correo-demo")" <<'SQL'
UPDATE cliente SET email = :'correo';
UPDATE usuario SET email = :'correo';
UPDATE prospecto SET email = :'correo';
SQL
  echo "  correo de los usuarios de prueba: el de ppt/.local/correo-demo"
fi
if [ -s "$LOCAL_DIR/correo-registro" ]; then
  psql "$URL" -X -q -v ON_ERROR_STOP=1 -v correo="$(tr -d '[:space:]' <"$LOCAL_DIR/correo-registro")" <<'SQL'
UPDATE cliente SET email = :'correo' WHERE rut = '22456789-8';
UPDATE prospecto SET email = :'correo' WHERE id_cliente = (SELECT id_cliente FROM cliente WHERE rut = '22456789-8');
SQL
  echo "  correo de Ignacio: el de ppt/.local/correo-registro"
fi

psql "$URL" -X -At -F ' ' -c "
  select 'empresas', count(*) from empresa union all
  select 'planes', count(*) from plan union all
  select 'clientes', count(*) from cliente union all
  select 'prospectos', count(*) from prospecto union all
  select 'contratos', count(*) from contrato union all
  select 'facturas', count(*) from factura union all
  select 'pagos', count(*) from pago union all
  select 'tickets', count(*) from ticket" | sed 's/^/  /'
echo "Listo: $PPT_BASE."
