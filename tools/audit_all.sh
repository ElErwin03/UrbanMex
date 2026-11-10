#!/usr/bin/env bash
# Audita la interfaz en modo celular (--mobile) o normal (sin argumentos extra) en todas las pantallas y estados principales.
#   bash tools/audit_all.sh [--mobile] [carpeta-salida]
cd "$(dirname "$0")/.." || exit 1
# uso: bash tools/audit_all.sh [--mobile] [--lang en] [carpeta-salida]  (con --lang en también lista lo que falta traducir en $OUT/misses.txt)
MOB=""; while [ "${1:0:2}" = "--" ]; do case "$1" in --mobile) MOB="$MOB --mobile";; --lang) MOB="$MOB --lang $2"; shift;; esac; shift; done
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
for c in stamina blocked; do run result-lose-$c Resultado --result lose --cause $c --left 2 --rob 2; done
run result-lose-left0 Resultado --result lose --cause money --left 0; run result-win2 Resultado --result win --stars 2 --record best --rob 1; run result-win3 Resultado --result win --stars 3 --record new
run menu-reto-bloq Menu --daily locked; run menu-reto-pend Menu --daily pending --streak 3; run menu-reto-reint Menu --daily retry; run menu-reto-ok Menu --daily done --streak 12; run menu-reto-3 Menu --daily perfect --streak 100
run nivel-reto Nivel --dlevel; run nivel-reto-sel Nivel --dlevel --select Pantitlan; run result-reto-win Resultado --dresult win --stars 2 --first 1 --streak 8; run result-reto-win3 Resultado --dresult win --stars 3 --better 1 --first 0; run result-reto-lose Resultado --dresult lose
for l in 1 2 3 4 5 6 8; do run nivel$l Nivel --level $l; done; run nivel0-rob Nivel --level 0 --rob 1; run nivel0-late Nivel --level 0 --minute 1100 --stamina 3 --money 5
for p in 0 1 2 3 4 5; do run tut$p Tutorial --page $p; done
node -e "const fs=require('fs'),o=process.argv[1],m={};fs.readdirSync(o).filter(f=>f.endsWith('.json')).forEach(f=>{try{(JSON.parse(fs.readFileSync(o+'/'+f)).misses||[]).forEach(x=>m[x]=1)}catch(e){}});const k=Object.keys(m);fs.writeFileSync(o+'/misses.txt',k.join('\n'));console.log('SIN TRADUCIR: '+k.length)" "$OUT"
echo "TOTAL: $TOTAL aviso(s)"
