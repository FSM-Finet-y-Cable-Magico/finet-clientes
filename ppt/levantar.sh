#!/usr/bin/env bash
# Levanta la demo local completa (rama ppt): correo (Mailpit), simuladores de G8
# y G3, chatbot, API y sitio, contra la base local finet_ppt. Nada de esto toca
# la VPS ni la base compartida: antes de arrancar cada servicio se revisa que
# todas sus URL apunten a este PC (salvo fast.com, el LLM del chatbot y, si
# está ppt/.local/smtp-real.env, el Gmail de cada empresa).
#
# Los .env de apps/ no se tocan: las variables de aquí mandan sobre ellos.
# Lo que no va al repo (secretos, llaves, logs, pids) queda en ppt/.local/.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

rama=$(git -C "$REPO_DIR" branch --show-current)
[ "$rama" = ppt ] || { echo "Esto es solo para la rama ppt (estás en «$rama»)." >&2; exit 1; }

for p in "${PUERTOS[@]}"; do
  if puerto_ocupado "$p"; then
    echo "El puerto $p ya está en uso. Si es la demo, bájala con ppt/detener.sh; si es otro servidor (pnpm dev, por ejemplo), bájalo primero." >&2
    exit 1
  fi
done

[ -x "$LOCAL_DIR/bin/mailpit" ] || { echo "Falta Mailpit en $LOCAL_DIR/bin/. Bájalo (y deja lo demás listo) con: ppt/preparar.sh" >&2; exit 1; }
grep -qE '^OPENAI_API_KEY=.+' "$LOCAL_DIR/llm.env" 2>/dev/null || { echo "Falta la llave del LLM del chatbot en $LOCAL_DIR/llm.env: cópialo de ppt/llm.env.example y pon tu OPENAI_API_KEY." >&2; exit 1; }
[ -f "$CHATBOT_DIR/dist/main.js" ] || { echo "Falta el chatbot compilado en $CHATBOT_DIR (pnpm install && pnpm build)." >&2; exit 1; }

if [ "$(psql "$(url_base postgres)" -X -At -c "select 1 from pg_database where datname='$PPT_BASE'")" != "1" ]; then
  echo "No existe la base $PPT_BASE: créala con ppt/base/crear.sh." >&2
  exit 1
fi

entorno_demo

printf '%s\n' "${CONTROLLER[@]}" | revisar_entorno "$REPO_DIR/apps/controller/.env" api.fast.com
printf '%s\n' "${VISTA[@]}" | revisar_entorno "$REPO_DIR/apps/view/.env"
printf '%s\n' "${CHATBOT[@]}" | revisar_entorno - "$LLM_HOST"
printf '%s\n' "${G8[@]}" "${G3[@]}" | revisar_entorno -
[ ! -e "$CHATBOT_DIR/.env" ] || { echo "El chatbot tiene un .env propio ($CHATBOT_DIR/.env): sácalo para que la demo no lo lea." >&2; exit 1; }

fallar() {
  echo "No se pudo levantar $1. Últimas líneas de $LOG_DIR/$1.log:" >&2
  tail -n 20 "$LOG_DIR/$1.log" >&2 || true
  "$PPT_DIR/detener.sh" >/dev/null || true
  exit 1
}

echo "Levantando la demo local…"
arrancar mailpit "$LOCAL_DIR" env -i "${BASICO[@]}" "$LOCAL_DIR/bin/mailpit" \
  --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025 --disable-version-check \
  --smtp-auth-accept-any --smtp-auth-allow-insecure
esperar http://127.0.0.1:8025/readyz "Correo (Mailpit)" || fallar mailpit

arrancar g8 "$PPT_DIR" env -i "${BASICO[@]}" "${G8[@]}" node simuladores/g8.mjs
esperar http://127.0.0.1:4900/salud "G8 simulado" || fallar g8

arrancar g3 "$PPT_DIR" env -i "${BASICO[@]}" "${G3[@]}" node simuladores/g3.mjs
esperar http://127.0.0.1:4901/salud "G3 simulado" || fallar g3

arrancar chatbot "$CHATBOT_DIR" env -i "${BASICO[@]}" "${CHATBOT[@]}" node dist/main.js
esperar http://127.0.0.1:3001/health "Chatbot" || fallar chatbot

echo "  … compilando la API"
(cd "$REPO_DIR/apps/controller" && pnpm build >"$LOG_DIR/controller-build.log" 2>&1) || fallar controller-build
arrancar controller "$REPO_DIR/apps/controller" env -i "${BASICO[@]}" "${CONTROLLER[@]}" node dist/src/main.js
esperar "$API/landing/planes" "API" || fallar controller

# El sitio se compila solo si cambió desde la última vez (código o variables
# públicas): next build tarda unos minutos.
huella_vista() {
  {
    git -C "$REPO_DIR" rev-parse HEAD
    git -C "$REPO_DIR" diff HEAD -- apps/view ':!apps/view/AGENTS.md'
    git -C "$REPO_DIR" ls-files --others --exclude-standard -- apps/view ':!apps/view/AGENTS.md' | (cd "$REPO_DIR" && while IFS= read -r archivo; do sha1 "$archivo"; done)
    printf '%s\n' "${VISTA[@]}"
  } | sha1 | cut -d' ' -f1
}
HUELLA="$LOCAL_DIR/vista.huella"
if [ ! -f "$HUELLA" ] || [ "$(cat "$HUELLA")" != "$(huella_vista)" ] || [ ! -f "$REPO_DIR/apps/view/.next/BUILD_ID" ]; then
  echo "  … compilando el sitio (unos minutos)"
  habia_agents=$([ -e "$REPO_DIR/apps/view/AGENTS.md" ] && echo si || echo no)
  (cd "$REPO_DIR/apps/view" && env -i "${BASICO[@]}" "${VISTA[@]}" pnpm build >"$LOG_DIR/vista-build.log" 2>&1) || fallar vista-build
  # next genera un AGENTS.md que no es del proyecto: nunca se commitea.
  [ "$habia_agents" = si ] || rm -f "$REPO_DIR/apps/view/AGENTS.md"
  huella_vista >"$HUELLA"
fi
arrancar vista "$REPO_DIR/apps/view" env -i "${BASICO[@]}" "${VISTA[@]}" pnpm exec next start -p 3000
esperar "$SITIO/" "Sitio" || fallar vista

if [ "$CORREO_REAL" = 1 ]; then
  CORREOS="llegan de verdad a Gmail, desde la cuenta de cada empresa"
else
  CORREOS="http://localhost:8025 (Mailpit: aquí llega todo lo que manda el portal)"
fi
cat <<EOF

Demo local lista (rama ppt, base $PPT_BASE). Nada de esto toca la VPS.

  Finet          $SITIO
  Cable Mágico   $SITIO/cable-magico
  Correos        $CORREOS
  Logs           ppt/.local/logs/        (g8.log y g3.log muestran lo que «reciben» G8 y G3)

  Con cuenta (contraseña Demo2026):
    Finet         16.234.567-2  Camila Rojas    factura vencida y otra por vencer, ticket abierto
    Finet         15.456.789-5  Sofía Pérez     contrato suspendido, dos facturas vencidas
    Cable Mágico  18.567.890-3  Matías González factura por vencer, ticket abierto
    Finet         17.890.123-0  Rodrigo Vidal   dos planes vigentes, al día
  Listo para registrarse (solicitud aprobada):
    Finet         22.456.789-8  Ignacio Fuentes
  Sin cuenta:
    Finet         17.345.678-6  Diego Muñoz     factura que venció ayer (aviso de corte)
    Cable Mágico  19.678.901-4  Valentina Soto  al día
  Para pedir un plan en «Contratar»: 20.123.456-5 o 21.234.567-9

Para bajar todo: ppt/detener.sh
EOF
