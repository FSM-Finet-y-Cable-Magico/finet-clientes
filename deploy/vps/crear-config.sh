#!/usr/bin/env sh
# Arma los env_file del compose en $G2_CONFIG (fuera del repo), con permisos 600.
#
#   sh deploy/vps/crear-config.sh [claves-externas.env]
#
# - Los secretos propios (base, JWT, firmas) se generan aquí con openssl y no
#   salen del servidor.
# - Las claves que entregan otros grupos (G8, G3), la de fast.com y la del LLM
#   del asistente se leen del archivo que se pase (o de la entrada estándar), y solo se aceptan esos
#   nombres. Ese archivo no se guarda.
# - No pisa nada: si ya existe un archivo, lo deja como está.
#
# PORTAL_URL es adonde entra el navegador (por defecto, el túnel SSH).
set -eu

G2_CONFIG="${G2_CONFIG:-/srv/finet/grupo2/config}"
PORTAL_URL="${PORTAL_URL:-http://localhost:18200}"
EXTERNAS="${1:--}"

umask 077
mkdir -p "$G2_CONFIG"

for f in db.env controller.env view.env chatbot.env; do
  if [ -e "$G2_CONFIG/$f" ]; then
    echo "Ya existe $G2_CONFIG/$f: no se toca nada. Bórralo a mano si quieres rehacerlo." >&2
    exit 1
  fi
done

secreto() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }

DB_PASS="$(secreto)"
JWT="$(secreto)"
CHATBOT_KEY="$(secreto)"
ASISTENTE_KEY="$(secreto)"
EXTERNO="$(cat "$EXTERNAS")"

cat > "$G2_CONFIG/db.env" <<EOF
POSTGRES_USER=portal
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=finet_portal
EOF

cat > "$G2_CONFIG/controller.env" <<EOF
DATABASE_URL=postgresql://portal:$DB_PASS@db:5432/finet_portal
JWT_SECRET=$JWT
SESSION_INACTIVITY_MINUTES=15
NODE_ENV=production
CORS_ORIGIN=$PORTAL_URL
FRONTEND_URL=$PORTAL_URL

SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Portal Clientes <no-reply@finet.cl>"

CRM_PUBLIC_KEY=
CHATBOT_API_KEY=$CHATBOT_KEY
ASISTENTE_API_KEY=$ASISTENTE_KEY
SOPORTE_EMAIL=

WEBPAY_AMBIENTE=integracion
WEBPAY_CODIGO_COMERCIO=
WEBPAY_API_KEY=
WEBPAY_URL_RETORNO=$PORTAL_URL/api/pagos/webpay/retorno
ENLACE_PAGO_SECRET=$(secreto)
EOF

cat > "$G2_CONFIG/view.env" <<EOF
NEXT_PUBLIC_API_URL=$PORTAL_URL/api
JWT_SECRET=$JWT
NEXT_PUBLIC_SITE_URL=$PORTAL_URL
NEXT_PUBLIC_SENTRY_DSN=
COOKIE_CONSENTIMIENTO_SECRET=$(secreto)
EOF

cat > "$G2_CONFIG/chatbot.env" <<EOF
API_KEY=$CHATBOT_KEY
CLIENTES_API_KEY=$ASISTENTE_KEY
SITE_URL=$PORTAL_URL
WHATSAPP_NUMBER="+56 9 4500 2319"
CHATWOOT_WEBHOOK_SECRET=$(secreto)
EOF

# Claves externas: solo estos nombres.
printf '%s\n' "$EXTERNO" | grep -E '^(INTEGRACION_G8_API_URL|INTEGRACION_G8_API_KEY|G3_API_URL|G3_API_KEY|G3_WIFI_PUBLIC_KEY|FAST_API_URL|FAST_TOKEN)=' \
  >> "$G2_CONFIG/controller.env" || true
printf '%s\n' "$EXTERNO" | grep -E '^OPENAI_(BASE_URL|API_KEY|MODEL)=' \
  >> "$G2_CONFIG/chatbot.env" || true

# Los puertos no son secretos, pero cambian por servidor.
PUERTOS="$(dirname "$0")/.env"
[ -e "$PUERTOS" ] || cp "$(dirname "$0")/.env.example" "$PUERTOS"

chmod 600 "$G2_CONFIG"/*.env
echo "Listo: $G2_CONFIG/{db,controller,view,chatbot}.env"
grep -oE '^[A-Z0-9_]+=' "$G2_CONFIG/controller.env" | tr -d '=' | tr '\n' ' '
echo
