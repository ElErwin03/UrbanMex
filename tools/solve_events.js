#!/usr/bin/env node
/* Solucionador EXACTO de niveles con eventos del día (lluvia, hora pico, huelga), sin noticias ni asaltos: prueba todas las rutas, compras de Monster y esperas.
 * Imprime, por nivel, el mejor final posible (dinero, hora, tramos, Monsters) contra el "par" y la meta de la 2.ª estrella (65 % del par).
 * Si "best" es null el nivel no se puede ganar; si best.money < goal65, la estrella de ahorro es imposible.
 * Uso: node tools/solve_events.js [nivel 0-9] [strip]   ("strip" quita los eventos, para comparar).
 *      node tools/solve_events.js infinite SEMILLA RONDA_DESDE RONDA_HASTA   (rondas del modo infinito). Poda por cota de dinero: segundos a pocos minutos. */
const { loadModules, rawData } = require('../tests/helpers');
const U = loadModules(['core','data','graph','events','rules','news','infinite']);
const data = U.Data.normalize(rawData()), R = U.Rules, G = U.Graph;
function clone(r){ const c=Object.assign({},r); c.blocked=Object.assign({},r.blocked); c.striking=Object.assign({},r.striking); c.visited=Object.assign({},r.visited); c.eventQueue=[]; return c; }
/** Dinero mínimo de cada estación a la meta (ignora bloqueos, tiempo y stamina): cota para podar. */
function lowerBound(run){
  const cfg=run.data.config, goal=run.level.goal, lb={[goal]:0}, done={};
  for(;;){ let u=null; Object.keys(lb).forEach(k=>{ if(!done[k]&&(u===null||lb[k]<lb[u])) u=k; }); if(u===null) return lb; done[u]=true;
    G.neighbors(run.graph,u).forEach(v=>{ const combi=G.isCombi(run.graph,u,v), f=combi?G.fare(run.graph,u,v):{}, w=lb[u]+(combi?(f.money!==undefined?f.money:cfg.combi.money):cfg.moneyPerStation); if(lb[v]===undefined||w<lb[v]) lb[v]=w; }); }
}
function solve(i){
  const root=R.createRun(data,-1,()=>0.99,data.levels[i]), lb=lowerBound(root); let best=null, nodes=0; const seen=new Set(); root._m=0;
  (function dfs(run){
    if(best && run.money-(lb[run.current]||0) <= best.money) return;                // ni con el mejor camino de dinero superaría al mejor final
    const key=[run.current,run.minute,Math.round(run.stamina),run.money].join('|'); if(seen.has(key)) return; seen.add(key); nodes++;
    if(run.won){ best={money:run.money,minute:run.minute,steps:run.steps,monsters:run._m,waited:run.waited||0}; return; }
    if(run.over) return;
    const opts=[run];
    if(data.stations[run.current].shop){ let r=clone(run); r._m=run._m; for(let k=0;k<3;k++){ if(!R.buyMonster(r).ok)break; r._m++; opts.push(Object.assign(clone(r),{_m:r._m})); } }
    const w=clone(run); w._m=run._m; if(R.wait(w).ok) opts.push(w);
    const moves=[]; opts.forEach(base=>G.neighbors(base.graph,base.current).forEach(n=>{ if(!base.blocked[n]) moves.push([base,n]); }));
    moves.sort((a,b)=>(lb[a[1]]||0)-(lb[b[1]]||0));
    for(const [base,n] of moves){ const r=clone(base); r._m=base._m; if(!R.travel(r,n).ok) continue; dfs(r); }
  })(root);
  return {best,nodes};
}
if(process.argv[2]==='infinite'){ const seed=+process.argv[3]||1, from=+process.argv[4]||1, to=+process.argv[5]||from; data.levels=[]; for(let r=from;r<=to;r++) data.levels.push(U.Infinite.level(data,seed,r)); }
const only=process.argv[2]==='infinite'?undefined:process.argv[2]; if(process.argv[3]==="strip") data.levels.forEach(l=>l.events=[]);
for(let i=0;i<data.levels.length;i++){ if(only!==undefined&&+only!==i) continue; const t=Date.now(), r=solve(i), run=R.createRun(data,-1,undefined,data.levels[i]), par=R.parMoney(run), goal=Math.ceil(par*R.SAVER_KEEP);
  console.log(data.levels[i].id, data.levels[i].day.padEnd(12), JSON.stringify(r.best), 'par', par, 'goal65', goal, r.best?(r.best.money>=goal?'ESTRELLA2 OK':'ESTRELLA2 IMPOSIBLE'):'SIN SOLUCION', r.nodes+' nodos', Date.now()-t+'ms'); }
