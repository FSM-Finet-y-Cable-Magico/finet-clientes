#!/usr/bin/env bash
# Manda ahora el recordatorio de pago (CU-67) y el aviso de corte (CU-68), que
# el portal manda solo cada mañana. Los correos llegan a Mailpit. A quien ya se
# le avisó hoy no se le repite: para mostrarlo otra vez, ppt/base/reiniciar.sh.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

for p in 1025 4900; do
  puerto_ocupado "$p" || { echo "La demo no está levantada (ppt/levantar.sh): los avisos necesitan a G8 simulado y a Mailpit." >&2; exit 1; }
done
[ -f "$REPO_DIR/apps/controller/dist/src/main.js" ] || { echo "Falta la API compilada: levanta la demo con ppt/levantar.sh." >&2; exit 1; }

entorno_demo
printf '%s\n' "${CONTROLLER[@]}" | revisar_entorno "$REPO_DIR/apps/controller/.env" api.fast.com

cd "$REPO_DIR/apps/controller"
env -i "${BASICO[@]}" "${CONTROLLER[@]}" node "$PPT_DIR/disparar-avisos.mjs"
echo "Los correos están en http://localhost:8025"
