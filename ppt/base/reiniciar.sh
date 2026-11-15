#!/usr/bin/env bash
# Borra la base local finet_ppt y la vuelve a crear con los datos de la demo,
# para repetir la presentación desde cero. Solo trabaja en localhost.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

ADMIN=$(url_base postgres)
exigir_local "$ADMIN"

echo "Borrando $PPT_BASE…"
psql "$ADMIN" -X -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$PPT_BASE' AND pid <> pg_backend_pid()" >/dev/null
psql "$ADMIN" -X -q -c "DROP DATABASE IF EXISTS $PPT_BASE"
exec "$PPT_DIR/base/crear.sh"
