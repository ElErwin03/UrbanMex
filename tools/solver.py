#!/usr/bin/env python3
"""Solucionador de niveles: ¿se puede ganar con la economía configurada?
Uso: python3 tools/solver.py ["My project/data"]
Considera stamina, dinero, tiendas (Monster), rutas de combi y la hora límite, sin noticias aleatorias.
'robusto' = además se pierden 10 de stamina (lluvia) y $40 (un asalto)."""
import json, heapq, collections, sys
D = sys.argv[1] if len(sys.argv) > 1 else 'My project/data'
cfg = json.load(open(f'{D}/config.json')); st = json.load(open(f'{D}/estaciones.json'))
conns = json.load(open(f'{D}/conexiones.json')); levels = json.load(open(f'{D}/niveles.json'))
shop = {s['id'] for s in st['stations'] if s['shop']}
adj = collections.defaultdict(list)
csp, cmp = cfg['staminaPerStation'], cfg['moneyPerStation']; cc = cfg.get('combi', {'stamina': csp, 'money': cmp})
for a, b, c, *rest in conns:   # 4.º valor 'combi': ruta de combi (otra tarifa y esfuerzo)
    sp_, mp_ = (cc['stamina'], cc['money']) if rest and rest[0] == 'combi' else (csp, cmp)
    adj[a].append((b, c, sp_, mp_)); adj[b].append((a, c, sp_, mp_))

def solve(lv, d_stam=0, d_money=0, blocked=None, no_monster=False):
    start, goal = lv['start'], lv['goal']; blocked = set(lv['blocked'] if blocked is None else blocked)
    smax = lv['staminaMax']; s0 = max(0, smax - d_stam); m0 = max(0, lv['moneyStart'] - d_money)
    price, gain = cfg['monsterPrice'], cfg['monsterStamina']
    end = cfg['dayEndMinute'] - cfg['dayStartMinute']
    best = {(start, s0, m0): 0}; pq = [(0, start, s0, m0)]
    while pq:
        t, u, s, m = heapq.heappop(pq)
        if best.get((u, s, m), 1e9) < t: continue
        if u == goal: return t
        opts = [(s, m)]
        if u in shop and not no_monster:
            ss, mm = s, m
            while mm >= price and ss < smax:
                ss = min(smax, ss + gain); mm -= price; opts.append((ss, mm))
        for s2, m2 in opts:
            for v, c, sp, mp in adj[u]:
                if v in blocked or s2 < sp or m2 < mp or t + c > end: continue
                k = (v, s2 - sp, m2 - mp)
                if best.get(k, 1e9) > t + c: best[k] = t + c; heapq.heappush(pq, (t + c, v) + k[1:])
    return None

def need(start, goal, blocked, idx):   # stamina (idx 2) o dinero (idx 3) mínimos para llegar, sin tiendas
    dist = {start: 0}; pq = [(0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == goal: return d
        if d > dist.get(u, 1e9): continue
        for e in adj[u]:
            if e[0] not in blocked and d + e[idx] < dist.get(e[0], 1e9): dist[e[0]] = d + e[idx]; heapq.heappush(pq, (d + e[idx], e[0]))

def steps(start, goal, blocked):
    q = collections.deque([(start, 0)]); seen = {start}
    while q:
        u, k = q.popleft()
        if u == goal: return k
        for v, c, _sp, _mp in adj[u]:
            if v not in blocked and v not in seen: seen.add(v); q.append((v, k + 1))

if __name__ == '__main__':
    ok = True
    for lv in levels:
        base, rob = solve(lv), solve(lv, 10, 40)
        nm = solve(lv, no_monster=True); n = steps(lv['start'], lv['goal'], set(lv['blocked']))
        flag = 'OK ' if base is not None else 'IMPOSIBLE'
        ok &= base is not None
        print(f"N{lv['id']} {lv['day']:<10} {lv['start']}->{lv['goal']}: tramos mín={n} stamina necesaria={need(lv['start'], lv['goal'], set(lv['blocked']), 2)}/{lv['staminaMax']} "
              f"dinero={need(lv['start'], lv['goal'], set(lv['blocked']), 3)}/{lv['moneyStart']} | ganable:{base is not None} robusto:{rob is not None} sin-monster:{nm is not None} {flag}")
    sys.exit(0 if ok else 1)
