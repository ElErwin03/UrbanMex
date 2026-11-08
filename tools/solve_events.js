#!/usr/bin/env node
/* Solucionador EXACTO de niveles con eventos del día (lluvia, hora pico, huelga), sin noticias ni asaltos: prueba todas las rutas, compras de Monster y esperas.
 * Imprime, por nivel, el mejor final posible (dinero, hora, tramos) contra el "par" y la meta de la 2.ª estrella (65 % del par). Si "money" < goal65, esa estrella no se puede ganar.
 * Uso: node tools/solve_events.js [nivel 0-4] [strip]   ("strip" quita los eventos, para comparar). Tarda de segundos a unos minutos. */
const { loadModules, rawData } = require('../tests/helpers');
const U = loadModules(['core','data','graph','events','rules','news']);
const data = U.Data.normalize(rawData()), R = U.Rules, G = U.Graph;
function clone(r){ const c=Object.assign({},r); c.blocked=Object.assign({},r.blocked); c.striking=Object.assign({},r.striking); c.visited=Object.assign({},r.visited); c.eventQueue=[]; return c; }
function solve(i){
  const root=R.createRun(data,i,()=>0.99); let best=null, seen=new Set(), nodes=0;
  (function dfs(run, path){
    if(best&&best.money>=run.money&&false) return;
    const key=[run.current,run.minute,Math.round(run.stamina),run.money].join('|'); if(seen.has(key)) return; seen.add(key); nodes++;
    if(run.won){ if(!best||run.money>best.money) best={money:run.money,minute:run.minute,steps:run.steps}; return; }
    if(run.over) return;
    const opts=[];
    if(data.stations[run.current].shop){ let r=clone(run); for(let k=0;k<3;k++){ if(!R.buyMonster(r).ok)break; opts.push(clone(r)); } }
    const w=clone(run); if(R.wait(w).ok) opts.push(w);
    for(const base of [run].concat(opts)) for(const n of G.neighbors(base.graph, base.current)){ if(base.blocked[n]) continue; const r=clone(base); if(!R.travel(r,n).ok) continue; dfs(r,path); }
  })(root,[]);
  return {best,nodes};
}
const only=process.argv[2]; const strip=process.argv[3]==="strip"; if(strip) data.levels.forEach(l=>l.events=[]);
for(let i=0;i<5;i++){ if(only!==undefined&&+only!==i) continue; const t=Date.now(); const r=solve(i); const run=R.createRun(data,i); console.log(data.levels[i].id, JSON.stringify(r.best), 'par', R.parMoney(run), 'goal65', Math.ceil(R.parMoney(run)*.65), r.nodes, Date.now()-t+'ms'); }
