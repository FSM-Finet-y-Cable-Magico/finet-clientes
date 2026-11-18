#!/usr/bin/env bash
# Vence ahora todas las sesiones abiertas del portal en la base local
# finet_ppt, como si hubieran pasado los 15 minutos sin uso (CU-12). El
# siguiente clic en el portal lleva al login con «Tu sesión fue cerrada por
# inactividad».
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
URL=$(url_base)
exigir_local "$URL"
n=$(psql "$URL" -X -At -c "WITH vencidas AS (UPDATE sesion_portal SET fecha_expiracion = now() WHERE fecha_expiracion > now() RETURNING 1) SELECT count(*) FROM vencidas")
echo "Sesiones vencidas: $n. El siguiente clic en el portal lleva al login."
