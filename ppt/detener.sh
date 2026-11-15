#!/usr/bin/env bash
# Baja todos los servicios de la demo local (rama ppt) que levantó levantar.sh.
# La base finet_ppt queda como está; para empezar de cero: ppt/base/reiniciar.sh.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

shopt -s nullglob
for archivo in "$PID_DIR"/*.pid; do
  nombre=$(basename "$archivo" .pid)
  pid=$(cat "$archivo")
  # Cada servicio corre en su propio grupo de procesos (pnpm, next y sus hijos).
  if kill -TERM -- "-$pid" 2>/dev/null; then
    timeout 15 tail --pid="$pid" -f /dev/null || kill -KILL -- "-$pid" 2>/dev/null || true
    echo "  ✓ $nombre detenido"
  fi
  rm -f "$archivo"
done

ocupados=()
for p in "${PUERTOS[@]}"; do puerto_ocupado "$p" && ocupados+=("$p"); done
if [ ${#ocupados[@]} -gt 0 ]; then
  echo "Siguen ocupados los puertos ${ocupados[*]}: no los levantó esta demo (revisa con: ss -ltnp)." >&2
  exit 1
fi
echo "Demo local detenida."
