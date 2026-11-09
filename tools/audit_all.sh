#!/usr/bin/env bash
# Audita la interfaz en modo celular (--mobile) o normal (sin argumentos extra) en todas las pantallas y estados principales.
#   bash tools/audit_all.sh [--mobile] [carpeta-salida]
cd "$(dirname "$0")/.." || exit 1
MOB=""; [ "$1" = "--mobile" ] && { MOB="--mobile"; shift; }
OUT="${1:-/tmp/urbanmex_audit}"; mkdir -p "$OUT"; TOTAL=0
run() { # nombre escena args...
  local n="$1" sc="$2"; shift 2
  node tools/dump_scene.js . "$sc" "$OUT/$n.json" --frames 40 $MOB "$@" >/dev/null 2>"$OUT/$n.err" || { echo "[$n] ERROR: $(tail -1 "$OUT/$n.err")"; TOTAL=$((TOTAL+1)); return; }
  local r; r=$(node tools/audit_layout.js "$OUT/$n.json"); local c=$?
  if [ $c -ne 0 ]; then echo "[$n]"; echo "$r" | grep -v "aviso(s)" | sed 's/^/   /'; TOTAL=$((TOTAL+c)); fi
}
run menu Menu; run menu-niveles Menu --view levels; run menu-sonido Menu --view sound; run menu-logros Menu --view ach; run menu-creditos Menu --view credits
run nivel0 Nivel --level 0; run nivel0-sel Nivel --level 0 --select Pantitlan; run nivel0-modal Nivel --level 0 --modal
for a in news map saldo lines snd config a11y; do run phone-$a Nivel --level 0 --phone $a; done
run nivel7 Nivel --level 7; run nivel9 Nivel --level 9
run pausa Nivel --level 0 --pause main; run pausa-sonido Nivel --level 0 --pause sound; run pausa-confirm Nivel --level 0 --pause confirm
run result-win Resultado --result win --stars 3 --record new; run result-win1 Resultado --result win --stars 1; run result-lose Resultado --result lose --cause money; run result-night Resultado --result lose --cause night
for p in 0 1 2 3 4 5; do run tut$p Tutorial --page $p; done
echo "TOTAL: $TOTAL aviso(s)"
