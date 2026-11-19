#!/usr/bin/env bash
# Funciones comunes de la demo local (rama ppt). Nada de esto toca la VPS ni la
# base compartida: todo corre contra la base local finet_ppt y simuladores locales.
set -euo pipefail

PPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$PPT_DIR/.." && pwd)"
LOCAL_DIR="$PPT_DIR/.local"
LOG_DIR="$LOCAL_DIR/logs"
PID_DIR="$LOCAL_DIR/pids"
PPT_BASE="finet_ppt"
CHATBOT_DIR="${CHATBOT_DIR:-$(cd "$REPO_DIR/.." && pwd)/Finet-Chatbot-2}"

mkdir -p "$LOCAL_DIR" "$LOG_DIR" "$PID_DIR"

# macOS: Homebrew instala en /opt/homebrew (Apple Silicon) o /usr/local (Intel),
# y postgresql@N queda aparte, sin enlazar en el PATH. Se agregan al final, para
# que psql, node y pnpm se encuentren aunque la terminal no los tenga y sin
# pisar nada que el usuario ya tenga delante.
if [ "$(uname -s)" = Darwin ]; then
  for _dir in /opt/homebrew/bin /usr/local/bin /opt/homebrew/opt/postgresql@*/bin \
    /usr/local/opt/postgresql@*/bin /Applications/Postgres.app/Contents/Versions/latest/bin; do
    if [ -d "$_dir" ]; then PATH="$PATH:$_dir"; fi
  done
  export PATH
fi

# La DATABASE_URL del .env local del controller, apuntada a finet_ppt.
# $1 = nombre de la base (por defecto finet_ppt).
url_base() {
  local base="${1:-$PPT_BASE}"
  local original
  original=$(grep -E '^DATABASE_URL=' "$REPO_DIR/apps/controller/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
  python3 -I - "$original" "$base" <<'EOF'
import sys, urllib.parse
u = urllib.parse.urlsplit(sys.argv[1])
if u.hostname not in ("localhost", "127.0.0.1"):
    sys.exit("La DATABASE_URL del .env local no es localhost: no sigo.")
print(urllib.parse.urlunsplit((u.scheme, u.netloc, "/" + sys.argv[2], u.query, u.fragment)))
EOF
}

# Revisa el host de cada URL (http, https, postgresql), no el resto del texto,
# y corta si alguno no es este PC ni está en la lista de permitidos.
# Argumentos: el .env del servicio ("-" si no tiene) y los hosts externos
# permitidos. Por la entrada estándar llegan las variables KEY=VALOR que le
# pasa el script, que mandan sobre su .env (o un texto cualquiera, sin .env).
read -r -d '' _REVISAR <<'EOF' || true
import re, sys
archivo, permitidos = sys.argv[1], {"localhost", "127.0.0.1", *sys.argv[2:]}
def leer(lineas):
    vars = {}
    for l in lineas:
        m = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$", l.rstrip("\n"))
        if m:
            vars[m.group(1)] = m.group(2).strip().strip("'\"")
    return vars
entrada = sys.stdin.read()
if archivo == "-":
    efectivo = {"texto": entrada}
else:
    efectivo = leer(open(archivo, encoding="utf-8"))
    efectivo.update(leer(entrada.splitlines()))
fuera = sorted({f"{k} → {h}" for k, v in efectivo.items()
                for h in re.findall(r"[a-z][a-z0-9+.-]*://(?:[^@/\s]*@)?([^:/?\s]+)", v, re.I)
                if h.lower() not in permitidos})
if fuera:
    sys.exit("Algo apunta fuera de este PC (" + "; ".join(fuera) + "). No sigo.")
EOF

# exigir_local "texto" [hosts permitidos…]
exigir_local() { printf '%s\n' "$1" | python3 -I -c "$_REVISAR" - "${@:2}"; }

# printf '%s\n' VAR=… | revisar_entorno <.env del servicio> [hosts permitidos…]
revisar_entorno() { python3 -I -c "$_REVISAR" "$@"; }

# Secreto aleatorio para los .env locales.
secreto() { openssl rand -hex 24; }

# Espera a que una URL responda (sin sleep en primer plano: usa los reintentos de curl).
esperar() {
  local url="$1" nombre="$2"
  if curl -s -o /dev/null --retry 60 --retry-delay 2 --retry-connrefused --retry-all-errors "$url"; then
    echo "  ✓ $nombre"
  else
    echo "  ✗ $nombre no responde: revisa $LOG_DIR" >&2
    return 1
  fi
}

SECRETOS="$LOCAL_DIR/secretos.env"
LLAVE_PRIVADA="$LOCAL_DIR/g3-privada.pem"
LLAVE_PUBLICA="$LOCAL_DIR/g3-publica.pem"
SMTP_REAL="$LOCAL_DIR/smtp-real.env"

# Arma el entorno de cada servicio de la demo en los arreglos CONTROLLER,
# VISTA, CHATBOT, G8 y G3 (más BASICO, SITIO, API y LLM_HOST). Lo usan
# levantar.sh y disparar-avisos.sh, para que corran con lo mismo.
entorno_demo() {
  URL_BASE=$(url_base)
  exigir_local "$URL_BASE"
  # Primer uso: secretos aleatorios y el par RSA de la clave WiFi (el portal
  # cifra con la pública; el simulador de G3 descifra con la privada).
  if [ ! -f "$SECRETOS" ]; then
    (
      umask 077
      {
        echo "JWT_SECRET=$(secreto)"
        echo "ENLACE_PAGO_SECRET=$(secreto)"
        echo "COOKIE_CONSENTIMIENTO_SECRET=$(secreto)"
        echo "CHATBOT_API_KEY=$(secreto)"
        echo "ASISTENTE_API_KEY=$(secreto)"
        echo "G8_API_KEY=$(secreto)"
        echo "G3_API_KEY=$(secreto)"
        echo "CHATWOOT_WEBHOOK_SECRET=$(secreto)"
      } >"$SECRETOS"
    )
    echo "Secretos locales creados en $SECRETOS."
  fi
  if [ ! -f "$LLAVE_PRIVADA" ]; then
    (umask 077 && openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$LLAVE_PRIVADA" 2>/dev/null)
    openssl pkey -in "$LLAVE_PRIVADA" -pubout -out "$LLAVE_PUBLICA"
    echo "Par RSA de la clave WiFi creado en $LOCAL_DIR."
  fi
  set -a
  # shellcheck source=/dev/null
  source "$SECRETOS"
  # shellcheck source=/dev/null
  source "$LOCAL_DIR/llm.env"
  set +a
  LLM_HOST=$(python3 -I -c 'import sys, urllib.parse; print(urllib.parse.urlsplit(sys.argv[1]).hostname)' "$OPENAI_BASE_URL")

  # Cada servicio arranca con env -i: solo ve PATH, HOME y lo que se le pasa aquí
  # (más el .env de su carpeta, que el servicio lee y que estas variables pisan).
  BASICO=(PATH="$PATH" HOME="$HOME" LANG="${LANG:-C.UTF-8}")

  # Las cuentas de correo de cada empresa. Con ppt/.local/smtp-real.env (las
  # cuentas Gmail reales de Finet y Cable Mágico, copiadas de la VPS) los
  # correos llegan de verdad; sin él, o con PPT_CORREO=mailpit (lo usa
  # probar-todo.sh, para no mandar correos de prueba), las dos son Mailpit.
  CUENTAS_SMTP=()
  CORREO_REAL=0
  if [ -f "$SMTP_REAL" ] && [ "${PPT_CORREO:-}" != mailpit ]; then
    CORREO_REAL=1
    while IFS= read -r linea; do
      valor=${linea#*=}
      valor=${valor#\"}; valor=${valor%\"}; valor=${valor#\'}; valor=${valor%\'}
      CUENTAS_SMTP+=("${linea%%=*}=$valor")
    done < <(grep -E '^SMTP_(FINET|CABLE_MAGICO)_[A-Z_]+=' "$SMTP_REAL")
  else
    CUENTAS_SMTP=(
      SMTP_FINET_HOST=localhost SMTP_FINET_PORT=1025 SMTP_FINET_SECURE=false
      SMTP_FINET_USER=demo SMTP_FINET_PASSWORD=demo
      SMTP_FINET_FROM=finet@finet-demo.test SMTP_FINET_FROM_NAME=FiNet
      SMTP_CABLE_MAGICO_HOST=localhost SMTP_CABLE_MAGICO_PORT=1025 SMTP_CABLE_MAGICO_SECURE=false
      SMTP_CABLE_MAGICO_USER=demo SMTP_CABLE_MAGICO_PASSWORD=demo
      SMTP_CABLE_MAGICO_FROM=cablemagico@cable-demo.test SMTP_CABLE_MAGICO_FROM_NAME="Cable Magico Litoral"
    )
  fi
  SITIO="http://localhost:3000"
  API="http://localhost:4000/api"

  CONTROLLER=(
    NODE_ENV=development PORT=4000
    DATABASE_URL="$URL_BASE"
    JWT_SECRET="$JWT_SECRET" ENLACE_PAGO_SECRET="$ENLACE_PAGO_SECRET"
    FRONTEND_URL="$SITIO" CORS_ORIGIN="$SITIO"
    # Como en producción, cada empresa manda desde su cuenta y con su remitente
    # (CUENTAS_SMTP, más abajo). La cuenta general es Mailpit.
    SMTP_HOST=localhost SMTP_PORT=1025 SMTP_USER= SMTP_PASS=
    MAIL_FROM="FiNet <finet@finet-demo.test>"
    SMTP_COMPANIES='[{"idEmpresa":1,"alias":"FINET"},{"idEmpresa":2,"alias":"CABLE_MAGICO"}]'
    "${CUENTAS_SMTP[@]}"
    INTEGRACION_G8_API_URL=http://127.0.0.1:4900 INTEGRACION_G8_API_KEY="$G8_API_KEY"
    G3_API_URL=http://127.0.0.1:4901 G3_API_KEY="$G3_API_KEY"
    G3_WIFI_PUBLIC_KEY="$(base64 <"$LLAVE_PUBLICA" | tr -d '\n')"
    CHATBOT_URL=http://127.0.0.1:3001 CHATBOT_API_KEY="$CHATBOT_API_KEY"
    ASISTENTE_API_KEY="$ASISTENTE_API_KEY"
    WEBPAY_AMBIENTE=integracion WEBPAY_URL_RETORNO="$API/pagos/webpay/retorno"
    PPT_LIMITE_POR_MINUTO=600
    # En la demo todos los usuarios salen de este PC: sin bloqueo por IP (RF-05
    # sigue por RUT) y los límites por ruta (login, registro, etc.) ×20. Para
    # mostrar el CU-05 o el CU-83 como en main:
    #   PPT_SIN_BLOQUEO_IP=0 PPT_MULTIPLICADOR_LIMITES=1 ppt/levantar.sh
    PPT_SIN_BLOQUEO_IP="${PPT_SIN_BLOQUEO_IP:-1}"
    PPT_MULTIPLICADOR_LIMITES="${PPT_MULTIPLICADOR_LIMITES:-20}"
  )
  # Las NEXT_PUBLIC_* se fijan al compilar el sitio.
  VISTA=(
    NEXT_PUBLIC_API_URL="$API" NEXT_PUBLIC_SITE_URL="$SITIO" NEXT_PUBLIC_SENTRY_DSN=
    NEXT_TELEMETRY_DISABLED=1
    API_URL="$API" JWT_SECRET="$JWT_SECRET" COOKIE_CONSENTIMIENTO_SECRET="$COOKIE_CONSENTIMIENTO_SECRET"
  )
  CHATBOT=(
    NODE_ENV=production PORT=3001 HOST=127.0.0.1
    API_KEY="$CHATBOT_API_KEY"
    CLIENTES_API_URL="$API" CLIENTES_API_KEY="$ASISTENTE_API_KEY"
    OPENAI_BASE_URL="$OPENAI_BASE_URL" OPENAI_API_KEY="$OPENAI_API_KEY" OPENAI_MODEL="$OPENAI_MODEL"
    CHATWOOT_WEBHOOK_SECRET="$CHATWOOT_WEBHOOK_SECRET"
    WHATSAPP_NUMBER="+56 9 4500 2319" SITE_URL="$SITIO"
  )
  G8=(PPT_DATABASE_URL="$URL_BASE" G8_API_KEY="$G8_API_KEY" G8_PUERTO=4900)
  G3=(G3_API_KEY="$G3_API_KEY" G3_LLAVE_PRIVADA="$LLAVE_PRIVADA" G3_PUERTO=4901)
}

# Puertos de la demo: Mailpit (SMTP y web), G8, G3, chatbot, API y sitio.
PUERTOS=(1025 8025 4900 4901 3001 4000 3000)

#
# Lo que sigue es lo que cambia entre Linux y macOS: macOS no trae ss, setsid,
# timeout, sha1sum ni /proc, así que cada función usa lo que haya en el sistema.
# En Linux se comportan como antes.

# ¿Hay algo escuchando en el puerto $1? ss en Linux; lsof en macOS.
puerto_ocupado() {
  if command -v ss >/dev/null 2>&1; then
    [ -n "$(ss -Hltn "sport = :$1" 2>/dev/null || true)" ]
  else
    [ -n "$(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null || true)" ]
  fi
}

# Ejecuta un comando en una sesión nueva: así su pid es también el de su grupo
# de procesos y detener.sh puede bajarlo entero. Sin setsid (macOS), lo hace perl,
# que viene con el sistema.
en_sesion_nueva() {
  if command -v setsid >/dev/null 2>&1; then
    exec setsid "$@"
  fi
  exec perl -MPOSIX -e 'POSIX::setsid() or die "setsid: $!\n"; exec { $ARGV[0] } @ARGV or die "no pude ejecutar $ARGV[0]: $!\n"' -- "$@"
}

# Arranca un servicio en segundo plano, en su propio grupo de procesos, con su
# log en .local/logs y su pid en .local/pids. $1 = nombre, $2 = carpeta; el
# resto, el comando.
arrancar() {
  local nombre="$1" dir="$2"
  shift 2
  (cd "$dir" && en_sesion_nueva "$@") >"$LOG_DIR/$nombre.log" 2>&1 </dev/null &
  echo $! >"$PID_DIR/$nombre.pid"
}

# Espera hasta $2 segundos a que termine el proceso $1; sale con 1 si sigue vivo.
# Va con perl y no con timeout + tail --pid (que macOS no trae), y sin sleep.
esperar_salida() {
  perl -e 'my ($pid, $seg) = @ARGV; for (1 .. $seg * 10) { exit 0 unless kill 0, $pid; select(undef, undef, undef, 0.1) } exit 1' "$1" "$2"
}

# sha1sum (Linux) o shasum (macOS): mismo formato de salida, "huella  archivo".
sha1() {
  if command -v sha1sum >/dev/null 2>&1; then sha1sum "$@"; else shasum -a 1 "$@"; fi
}

# El entorno del proceso $1, para revisar a qué URL apunta. Linux lo guarda en
# /proc; en macOS lo da ps (solo de procesos propios), en una sola línea, y sirve
# igual porque revisar_entorno busca las URL dentro del texto.
entorno_de_proceso() {
  if [ -r "/proc/$1/environ" ]; then
    tr '\0' '\n' <"/proc/$1/environ"
  else
    ps eww -p "$1"
  fi
}

# Las conexiones TCP abiertas con la IP $1 (una línea cada una; nada si no hay).
conexiones_con() {
  if command -v ss >/dev/null 2>&1; then
    ss -Htn state established dst "$1"
  else
    local ip
    ip=$(printf '%s' "$1" | sed 's/\./\\./g')
    netstat -an -p tcp | grep -E "[[:space:]]${ip}\.[0-9]+[[:space:]]+ESTABLISHED" || true
  fi
}
