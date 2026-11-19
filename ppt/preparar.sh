#!/usr/bin/env bash
# Deja el PC listo para la demo local (rama ppt), en macOS o en Linux: revisa las
# herramientas, crea los .env, instala las dependencias de los dos repos,
# compila el chatbot, baja Mailpit (verificado con su sha256) y crea la base
# finet_ppt. Se puede repetir: lo que ya está hecho se salta.
#
# No instala programas del sistema (brew, apt): si falta alguno, dice cuál y cómo.
# Tampoco trae el repositorio del chatbot ni la llave del LLM: son de cada
# persona (ver ppt/MACOS.md).
#
# Uso: ppt/preparar.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

MAILPIT_VERSION=v1.33.1
so=$(uname -s)
arq=$(uname -m)
pendientes=""

paso() { printf '\n== %s\n' "$1"; }
ok() { echo "  ✓ $1"; }
falta() { echo "  ✗ $1" >&2; pendientes="${pendientes}  - $1"$'\n'; }

rama=$(git -C "$REPO_DIR" branch --show-current)
[ "$rama" = ppt ] || { echo "Esto es solo para la rama ppt (estás en «$rama»)." >&2; exit 1; }

# --- 1. Herramientas ---------------------------------------------------------
paso "Herramientas ($so $arq)"
faltan_herramientas=0
herramienta() {
  if command -v "$1" >/dev/null 2>&1; then
    ok "$1"
  else
    falta "$1 no está instalado"
    faltan_herramientas=1
  fi
}
for h in git node pnpm psql python3 openssl curl perl; do herramienta "$h"; done

if command -v node >/dev/null 2>&1; then
  version_node=$(node -p 'process.versions.node')
  if [ "${version_node%%.*}" -ge 20 ]; then
    ok "node $version_node (se pide 20 o más)"
  else
    falta "node $version_node es muy antiguo: se pide 20 o más"
    faltan_herramientas=1
  fi
fi
if command -v curl >/dev/null 2>&1; then
  ayuda_curl=$(curl --help all 2>/dev/null || true)
  case "$ayuda_curl" in
    *--retry-all-errors*) ;;
    *)
      falta "este curl no tiene --retry-all-errors (en macOS pide la versión 12 o posterior)"
      faltan_herramientas=1
      ;;
  esac
fi

if [ "$faltan_herramientas" = 1 ]; then
  if [ "$so" = Darwin ]; then
    cat >&2 <<'EOF'

Instálalas y vuelve a correr ppt/preparar.sh. En macOS, con Homebrew:
  brew install node pnpm postgresql@17
  brew services start postgresql@17
y, si faltan git, python3, perl, openssl o curl: xcode-select --install
EOF
  else
    echo "Instálalas con el gestor de paquetes de tu sistema y vuelve a correr ppt/preparar.sh." >&2
  fi
  exit 1
fi

# --- 2. Archivos de configuración -------------------------------------------
paso "Archivos de configuración"
for app in controller view; do
  destino="$REPO_DIR/apps/$app/.env"
  if [ -f "$destino" ]; then
    ok "apps/$app/.env"
  elif [ -f "$destino.example" ]; then
    cp "$destino.example" "$destino"
    chmod 600 "$destino"
    ok "apps/$app/.env creado desde .env.example"
  else
    falta "no encuentro apps/$app/.env ni su .env.example"
  fi
done

if grep -qE '^OPENAI_API_KEY=.+' "$LOCAL_DIR/llm.env" 2>/dev/null; then
  ok "ppt/.local/llm.env con la llave del LLM"
else
  [ -f "$LOCAL_DIR/llm.env" ] || cp "$PPT_DIR/llm.env.example" "$LOCAL_DIR/llm.env"
  chmod 600 "$LOCAL_DIR/llm.env"
  falta "ppt/.local/llm.env no tiene la llave del LLM: pon tu OPENAI_API_KEY (cópiala del otro PC, o sácala en https://console.groq.com/keys)"
fi

# --- 3. PostgreSQL -----------------------------------------------------------
paso "PostgreSQL"
postgres_listo=0
if [ -f "$REPO_DIR/apps/controller/.env" ] && psql "$(url_base postgres)" -X -At -c 'select 1' >/dev/null 2>&1; then
  postgres_listo=1
  ok "responde con la DATABASE_URL de apps/controller/.env"
else
  falta "PostgreSQL no responde con la DATABASE_URL de apps/controller/.env (usuario, clave y puerto)"
  if [ "$so" = Darwin ]; then
    cat >&2 <<'EOF'
     Con Homebrew el servidor se arranca con «brew services start postgresql@17» y
     el único usuario es el tuyo, sin clave. Crea el que espera la demo:
       psql postgres -c "CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres'"
     (si el rol ya existía: ALTER ROLE postgres WITH PASSWORD 'postgres')
EOF
  fi
fi

# --- 4. Mailpit --------------------------------------------------------------
paso "Mailpit $MAILPIT_VERSION (el correo de la demo)"
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}
# Ese release no publica checksums.txt: los sha256 son los que GitHub guarda de
# cada archivo (https://api.github.com/repos/axllent/mailpit/releases/tags/$MAILPIT_VERSION).
case "$so-$arq" in
  Darwin-arm64)   mailpit_archivo=mailpit-darwin-arm64; mailpit_sha=15703838762355d42befeb1c942f3a5cc53bcf1fa3ba6abc216a05dd254a8ac2 ;;
  Darwin-x86_64)  mailpit_archivo=mailpit-darwin-amd64; mailpit_sha=d8ca2a9da16c977189f2514a7fc28f8a47fe050bd2b0296a13c815288b5fe39f ;;
  Linux-x86_64)   mailpit_archivo=mailpit-linux-amd64;  mailpit_sha=84d7fe375ebef25df26758984dc0d5d5e17d8c0734cb2e77be7873b14ab51716 ;;
  Linux-aarch64)  mailpit_archivo=mailpit-linux-arm64;  mailpit_sha=3c5f076cb676d6980e47da030861c6d60f1f5614103dea93cccbcdfc43198e12 ;;
  *)              mailpit_archivo=""; mailpit_sha="" ;;
esac
if [ -x "$LOCAL_DIR/bin/mailpit" ]; then
  ok "ya está en ppt/.local/bin/"
elif [ -z "$mailpit_archivo" ]; then
  falta "no tengo la descarga de Mailpit para $so $arq: bájalo de https://github.com/axllent/mailpit/releases a ppt/.local/bin/"
else
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/ppt-mailpit.XXXXXX")
  if curl -fsSL -o "$tmp/mailpit.tar.gz" "https://github.com/axllent/mailpit/releases/download/$MAILPIT_VERSION/$mailpit_archivo.tar.gz" \
    && [ "$(sha256 "$tmp/mailpit.tar.gz")" = "$mailpit_sha" ]; then
    mkdir -p "$LOCAL_DIR/bin"
    tar -xz -C "$LOCAL_DIR/bin" -f "$tmp/mailpit.tar.gz" mailpit
    chmod +x "$LOCAL_DIR/bin/mailpit"
    if [ "$so" = Darwin ]; then xattr -d com.apple.quarantine "$LOCAL_DIR/bin/mailpit" 2>/dev/null || true; fi
    ok "$("$LOCAL_DIR/bin/mailpit" version | head -n 1)"
  else
    falta "no pude bajar Mailpit, o la descarga no coincide con el sha256 esperado ($mailpit_archivo)"
  fi
  rm -rf "$tmp"
fi

# --- 5. Dependencias de finet-clientes ---------------------------------------
paso "Dependencias de finet-clientes (pnpm install y cliente Prisma)"
if (cd "$REPO_DIR" && pnpm install --frozen-lockfile) \
  && (cd "$REPO_DIR/apps/controller" && pnpm exec prisma generate >/dev/null); then
  ok "dependencias instaladas y cliente Prisma generado"
else
  falta "falló pnpm install o prisma generate en finet-clientes (mira el error de arriba)"
fi

# --- 6. Chatbot --------------------------------------------------------------
paso "Chatbot ($CHATBOT_DIR)"
if [ ! -d "$CHATBOT_DIR" ]; then
  falta "no existe $CHATBOT_DIR: clona ahí el repositorio Finet-Chatbot-2 (o apunta CHATBOT_DIR a donde lo tengas) y vuelve a correr ppt/preparar.sh"
elif [ -f "$CHATBOT_DIR/dist/main.js" ]; then
  ok "ya está compilado"
elif (cd "$CHATBOT_DIR" && pnpm install --frozen-lockfile && pnpm build) && [ -f "$CHATBOT_DIR/dist/main.js" ]; then
  ok "instalado y compilado"
else
  falta "no pude compilar el chatbot en $CHATBOT_DIR (mira el error de arriba)"
fi

# --- 7. Base de datos --------------------------------------------------------
paso "Base $PPT_BASE"
if [ "$postgres_listo" != 1 ]; then
  echo "  – se salta: PostgreSQL todavía no responde"
elif [ "$(psql "$(url_base postgres)" -X -At -c "select 1 from pg_database where datname='$PPT_BASE'")" = "1" ]; then
  ok "ya existe (para dejarla de cero: ppt/base/reiniciar.sh)"
elif "$PPT_DIR/base/crear.sh"; then
  ok "creada con los datos de la demo"
else
  falta "no pude crear la base $PPT_BASE (mira el error de arriba)"
fi

# --- Resumen -----------------------------------------------------------------
echo
if [ -n "$pendientes" ]; then
  printf 'Falta resolver:\n%s\nCuando lo tengas, vuelve a correr ppt/preparar.sh.\n' "$pendientes" >&2
  exit 1
fi
echo "Todo listo. Para levantar la demo: ppt/levantar.sh"
