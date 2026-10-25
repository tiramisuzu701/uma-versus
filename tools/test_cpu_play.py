import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# How the CPU plays, per level, against a scripted "human": how often its attacks whiff, how much it walks forward vs
# back, how long and how damaging its combos are, and how many punishes it lands. Run: python3 tools/test_cpu_play.py [cid ...]
import asyncio, sys, json
from playwright.async_api import async_playwright
src = open(ROOT+'/tools/test_cpu_diag.py').read()
HUMAN = src[src.index('  function human(me, seed) {'):src.index('  for (const lv of levels) {')]
JS = r"""([levels, seconds, cids]) => {
""" + HUMAN + r"""
  const out = {};
  for (const lv of levels) {
    const S = { atk: 0, whiff: 0, walkF: 0, walkB: 0, combos: 0, hits: 0, dmg: 0, best: 0, punish: 0, grabs: 0, grabMiss: 0, frames: 0, dealt: 0, taken: 0 };
    cids.forEach((cpu, k) => {
      const hum = ROSTER[(ROSTER.indexOf(cpu) + 3) % ROSTER.length];
      startMatch('cpu', hum, cpu); rs = 2000 + k * 7 + lv * 31;
      const me = G.p[1], h = G.p[0];
      let f = 0, pm = null, conn = false, cur = null, prevHum = h.hp, prevMe = me.hp;
      while (f < 60 * seconds) {
        if (G.phase === 'match') startMatch('cpu', hum, cpu);
        const hBefore = h.state, recov = h.state === 'attack' && h.t > h.move.lastActive;
        step([human(h), cpuInput(me, lv)]); f++;
        if (G.phase !== 'fight') { pm = null; continue; }
        S.frames++;
        if (me.state === 'attack' && me.move !== pm && me.t <= 1) {
          if (pm && !conn) S.whiff++;
          S.atk++; conn = false; pm = me.move;
          if (me.move.kind === 'throw' && me.move.special) S.grabs++;
        }
        if (me.state === 'attack' && me.connected) conn = true;
        if (me.state === 'throwing') conn = true;
        if (me.state !== 'attack' && pm) { if (!conn) { S.whiff++; if (pm.kind === 'throw' && pm.special) S.grabMiss++; } pm = null; }
        if (me.state === 'walk') { if ((me.vx > 0) === (h.x > me.x)) S.walkF++; else S.walkB++; }
        if (h.combo > 0) { if (!cur) { cur = { hits: 0, dmg: 0 }; S.combos++; if (recov || hBefore === 'land') S.punish++; } cur.hits = h.combo; cur.dmg = h.comboDmg; }
        else if (cur) { S.hits += cur.hits; S.dmg += cur.dmg; S.best = Math.max(S.best, cur.dmg); cur = null; }
        if (h.hp < prevHum) S.dealt += prevHum - h.hp; if (me.hp < prevMe) S.taken += prevMe - me.hp; prevHum = h.hp; prevMe = me.hp;
      }
    });
    out[lv] = S;
  }
  return JSON.stringify(out);
}"""
async def main():
    cids = sys.argv[1:] or None
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(3000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
        cids = cids or await pg.evaluate("() => ROSTER")
        res = json.loads(await pg.evaluate(JS, [[1, 2, 3, 4], 120, cids]))
        print('ERR', errs[:3]); await b.close()
    names = {1: 'Rookie', 2: 'Normal', 3: 'Hard', 4: 'G1'}
    for lv, S in res.items():
        c = max(1, S['combos'])
        print(f"{names[int(lv)]:>6}: whiff {100*S['whiff']//max(1,S['atk'])}% of {S['atk']} attacks | walk fwd {S['walkF']} back {S['walkB']} | combos {S['combos']}, avg {S['hits']/c:.1f} hits {S['dmg']//c} dmg, best {S['best']} | punishes {S['punish']} | dmg dealt {S['dealt']} taken {S['taken']}" + (f" | command grabs {S['grabs']} missed {S['grabMiss']}" if S['grabs'] else ''))
asyncio.run(main())
