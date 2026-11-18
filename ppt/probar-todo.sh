#!/usr/bin/env bash
# Prueba de punta a punta toda la demo local (rama ppt), en las dos empresas,
# en escritorio y en celular (ppt/e2e/probar-todo.mjs).
#
# Mientras corre, la demo queda en uso por la prueba: no la uses a mano, porque
# entra con los mismos usuarios y cerraría tus sesiones. Parte de la base de
# cero, con Mailpit (ningún correo de prueba sale a Gmail), y al terminar deja
# la base de cero y la demo abajo. Para presentar: ppt/levantar.sh.
#
# Uso: ppt/probar-todo.sh [--si]   (--si no pregunta antes de empezar)
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

if [ "${1:-}" != "--si" ]; then
  read -r -p "Esto baja la demo, la prueba entera (unos 10 minutos) y deja la base de cero. ¿Seguir? [s/N] " r
  [ "$r" = s ] || [ "$r" = S ] || exit 1
fi

# Playwright va en ppt/.local/e2e (fuera del repo), sin tocar package.json.
E2E="$LOCAL_DIR/e2e"
mkdir -p "$E2E"
if [ ! -d "$E2E/node_modules/playwright" ]; then
  echo "Instalando Playwright para las pruebas (solo la primera vez)…"
  npm install --prefix "$E2E" --no-audit --no-fund --silent playwright@1.61.0 >/dev/null
fi
"$E2E/node_modules/.bin/playwright" install chromium >/dev/null

terminar() {
  "$PPT_DIR/detener.sh" >/dev/null 2>&1 || true
  "$PPT_DIR/base/reiniciar.sh" >/dev/null 2>&1 || true
  echo "Demo abajo y base de cero. Para presentar: ppt/levantar.sh"
}
trap terminar EXIT

echo "Preparando: base de cero y demo con Mailpit…"
"$PPT_DIR/detener.sh" >/dev/null 2>&1 || true
"$PPT_DIR/base/reiniciar.sh" >/dev/null
if ! PPT_CORREO=mailpit "$PPT_DIR/levantar.sh" >"$LOG_DIR/probar-todo-levantar.log" 2>&1; then
  echo "No se pudo levantar la demo: revisa $LOG_DIR/probar-todo-levantar.log" >&2
  exit 1
fi

set +e
PPT_CORREO=mailpit PPT_DATABASE_URL="$(url_base)" E2E_DIR="$E2E" LOG_DIR="$LOG_DIR" \
  node "$PPT_DIR/e2e/probar-todo.mjs"
resultado=$?
set -e
exit "$resultado"
