#!/usr/bin/env bash
# Revisa que la demo local esté completa y aislada: cada servicio responde, la
# base es la local y está al día, ningún proceso de la demo tiene una URL que
# salga de este PC (salvo fast.com y el LLM del chatbot) y no hay ninguna
# conexión abierta con la VPS.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

fallas=0
ok() { echo "  ✓ $1"; }
mal() { echo "  ✗ $1" >&2; fallas=$((fallas + 1)); }
responde() {
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1" || true)
  [ "$codigo" = "${3:-200}" ] && ok "$2" || mal "$2 ($1 → ${codigo:-sin respuesta})"
}

echo "Servicios:"
responde http://127.0.0.1:8025/readyz "Correo (Mailpit)"
responde http://127.0.0.1:4900/salud "G8 simulado"
responde http://127.0.0.1:4901/salud "G3 simulado"
responde http://127.0.0.1:3001/health "Chatbot"
responde http://localhost:3000/ "Sitio Finet"
responde http://localhost:3000/cable-magico "Sitio Cable Mágico"
planes=$(curl -s --max-time 15 http://localhost:4000/api/landing/planes | python3 -I -c 'import sys, json; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
[ "$planes" = 8 ] && ok "API (8 planes de la base local)" || mal "API: devolvió $planes planes, se esperaban 8"

echo "Base:"
URL=$(url_base)
exigir_local "$URL" && ok "es $PPT_BASE en este PC"
if (cd "$REPO_DIR/apps/controller" && DATABASE_URL="$URL" pnpm exec prisma migrate status 2>&1 | grep -q "Database schema is up to date"); then
  ok "migraciones al día"
else
  mal "faltan migraciones (ppt/base/reiniciar.sh)"
fi

echo "Aislamiento:"
entorno_demo >/dev/null
shopt -s nullglob
for archivo in "$PID_DIR"/*.pid; do
  nombre=$(basename "$archivo" .pid)
  pid=$(cat "$archivo")
  if [ ! -r "/proc/$pid/environ" ]; then mal "$nombre no está corriendo"; continue; fi
  if tr '\0' '\n' <"/proc/$pid/environ" | revisar_entorno - api.fast.com "$LLM_HOST" 2>/dev/null; then
    ok "$nombre: todas sus URL son locales"
  else
    mal "$nombre tiene una URL que sale de este PC"
  fi
done
# La IP de la VPS no va al repo, que es público: se lee de ppt/.local/ip-vps.
vps=$(tr -d '[:space:]' <"$LOCAL_DIR/ip-vps" 2>/dev/null || true)
if [ -z "$vps" ]; then
  echo "  – sin ppt/.local/ip-vps: no se revisan las conexiones con la VPS"
elif [ -z "$(ss -Htn state established dst "$vps")" ]; then
  ok "ninguna conexión abierta con la VPS"
else
  mal "hay una conexión abierta con la VPS (revisa con: ss -tnp dst $vps)"
fi

if [ "$fallas" -eq 0 ]; then echo "Todo en orden."; else echo "$fallas problema(s)." >&2; exit 1; fi
