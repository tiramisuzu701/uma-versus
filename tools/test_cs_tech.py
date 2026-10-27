import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# 2.0.1: Counter Spurt button, its cooldown, command-grab breaks, throw tech push-apart and the tech lockout.
from playwright.sync_api import sync_playwright
LIB = r"""
window.T = {
  N: (o = {}) => ({ ...NEUTRAL, ...o }),
  setup(c1, c2, gap) { tick = () => {}; startMatch('training', c1, c2); G.training.meter = false; const [a, d] = G.p; a.x = 900; d.x = 900 + gap; a.meter = d.meter = 100; return [a, d]; },
  // run frames: fa(f) / fd(f) give each side's input for frame f
  run(n, fa, fd, watch) { for (let f = 0; f < n; f++) { step([fa(f), fd(f)]); if (watch) watch(f); } },
};
"""
CASES = {
 'throw tech pushes them apart': r"""() => { const [a, d] = T.setup('kb', 'ds', 60);
   T.run(60, f => f === 2 ? T.N({ L: 1, M: 1 }) : T.N(), f => f === 6 ? T.N({ L: 1, M: 1 }) : T.N());
   const gap = Math.abs(a.x - d.x); return [gap >= 130 && gap <= 170, 'gap ' + Math.round(gap)]; }""",
 'Counter Spurt button works while blocking': r"""() => { const [a, d] = T.setup('kb', 'ds', 90); let gc = false;
   T.run(40, f => f === 1 ? T.N({ H: 1 }) : T.N(), f => T.N({ r: 1, C: f === 14 ? 1 : 0 }), () => { if (d.move && d.move.id === 'GC') gc = true; });
   return [gc && d.meter <= 56, 'gc ' + gc + ' meter ' + Math.round(d.meter)]; }""",
 'S+H while blocking no longer Counter Spurts': r"""() => { const [a, d] = T.setup('kb', 'ds', 90); let gc = false;
   T.run(40, f => f === 1 ? T.N({ H: 1 }) : T.N(), f => T.N({ r: 1, S: f === 14 ? 1 : 0, H: f === 14 ? 1 : 0 }), () => { if (d.move && d.move.id === 'GC') gc = true; });
   return [!gc, 'gc ' + gc]; }""",
 'Counter Spurt has a 3 s cooldown': r"""() => { const [a, d] = T.setup('kb', 'ds', 90); let n = 0, was = false;
   // block a 5H, Counter Spurt; walk back in; block again ~100 frames later and try again
   T.run(160, f => (f === 1 || f === 100) ? T.N({ H: 1 }) : f > 40 && f < 90 ? T.N({ r: 1 }) : T.N(), f => T.N({ r: f < 40 || f > 95 ? 1 : 0, C: (f === 14 || f === 113) ? 1 : 0 }),
     () => { const now = !!(d.move && d.move.id === 'GC'); if (now && !was) n++; was = now; });
   return [n === 1 && d.gcCd > 0, 'counter spurts ' + n + ' cd ' + d.gcCd]; }""",
 'Counter Spurt breaks a command grab': r"""() => { const [a, d] = T.setup('jp', 'kb', 70); let broke = false;
   T.run(60, f => f === 1 ? T.N({ r: 1, S: 1 }) : T.N(), f => T.N({ C: f >= 8 && f <= 9 ? 1 : 0 }), () => { if (d.state === 'tech') broke = true; });
   return [broke && d.meter <= 50, 'broke ' + broke + ' meter ' + Math.round(d.meter)]; }""",
 'mashing tech in a combo locks the tech out': r"""() => { const res = [];
   for (const mash of [false, true]) { const [a, d] = T.setup('kb', 'ds', 50); let teched = false, thrown = -1, stun = false;
     // 5L hits; the defender (optionally) mashes L+M in hitstun; the attacker throws as soon as it can and the defender techs on time
     T.run(90, f => f === 1 ? T.N({ L: 1 }) : (a.state === 'idle' && thrown < 0 && f > 10) ? T.N({ L: 1, M: 1 }) : T.N(),
       f => (mash && f % 4 === 1 && d.state === 'hit') ? T.N({ L: 1, M: 1 }) : (thrown >= 0 && f === thrown + 2) ? T.N({ L: 1, M: 1 }) : T.N(),
       f => { if (f === 9 && d.state === 'hit') stun = true; if (d.state === 'thrown' && thrown < 0) thrown = f; if (d.state === 'tech') teched = true; });
     res.push([teched, thrown, stun]); }
   return [res[0][0] && !res[1][0] && res[1][1] >= 0 && res[1][1] < 9 + 20 && res[1][2], JSON.stringify(res)]; }""",
}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(800); pg.evaluate(LIB)
    ok = 0
    for name, js in CASES.items():
        good, info = pg.evaluate(js); ok += good
        print('OK ' if good else 'BAD', f'{name:48s}', info)
    print(f'{ok}/{len(CASES)}', 'ERR', errs); b.close()
