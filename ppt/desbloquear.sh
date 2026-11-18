#!/usr/bin/env bash
# Borra los intentos fallidos de inicio de sesión de la base local finet_ppt:
# quita los bloqueos por RUT (y por IP, si se levantó con PPT_SIN_BLOQUEO_IP=0)
# sin esperar los 15 minutos del RF-05. Para probar el CU-05 varias veces.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
URL=$(url_base)
exigir_local "$URL"
n=$(psql "$URL" -X -At -c "WITH borrados AS (DELETE FROM intento_fallido RETURNING 1) SELECT count(*) FROM borrados")
echo "Intentos fallidos borrados: $n. Ya se puede volver a entrar."
