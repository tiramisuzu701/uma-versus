import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# CPU behaviour against a scripted "human" (not another CPU): idle streaks, combo completion,
# throw tech rate and Counter Spurt use. Run: python3 tools/test_cpu_diag.py [level ...]
import asyncio, sys, json
from playwright.async_api import async_playwright
JS = r"""([levels, seconds]) => {
  const R = ROSTER, out = {};
  // a rough stand-in for a person: walks in, pokes, strings, throws, blocks some of the time
  function human(me, seed) {
    const o = opp(me), d = Math.abs(o.x - me.x), f = o.x > me.x ? 'r' : 'l', b = f === 'r' ? 'l' : 'r';
    const H = me.h || (me.h = { plan: 0, act: null, n: 0 });
    const i = { ...NEUTRAL };
    if (me.state === 'thrown' || me.state === 'block') { i[b] = 1; return i; }
    if (H.n > 0) { H.n--; Object.assign(i, H.act(i, f, b)); return i; }
    const r = rnd();
    if (o.state === 'attack' && d < 200 && r < 0.5) { H.n = 14; H.act = (x, f, b) => ({ [b]: 1, d: rnd() < 0.5 ? 1 : 0 }); }
    else if (d > 160) { H.n = 10 + (r * 20 | 0); H.act = (x, f, b) => ({ [f]: 1 }); }
    else if (r < 0.22) { H.n = 1; H.act = () => ({ L: 1, M: 1 }); H.thr = (H.thr || 0) + 1; }
    else if (r < 0.5) { const seq = [{ d: 1, L: 1 }, {}, {}, {}, {}, {}, { d: 1, M: 1 }]; let k = 0; H.n = seq.length; H.act = () => seq[k++] || {}; }
    else if (r < 0.7) { H.n = 20; H.act = (x, f, b) => ({ [b]: 1 }); }
    else { H.n = 8; H.act = (x, f) => ({ [f]: 1 }); }
    return i;
  }
  for (const lv of levels) {
    const S = { idleMax: 0, idleLong: 0, runs: 0, runsDone: 0, runsHitAll: 0, thrown: 0, techs: 0, blockEvents: 0, cornerBlocks: 0, gc: 0, frames: 0, drops: {} };
    for (let k = 0; k < R.length; k++) {
      const cpu = R[k], hum = R[(k + 3) % R.length];
      startMatch('cpu', hum, cpu); rs = 1000 + k + lv * 31;
      const me = G.p[1], h = G.p[0];
      let idle = 0, prevState = '', prevRun = null, prevBs = 0, f = 0;
      const origStart = aiStartRun;
      while (f < 60 * seconds) {
        if (G.phase === 'match') { startMatch('cpu', hum, cpu); }
        const ci = cpuInput(me, lv), hi = human(h);
        step([hi, ci]); f++;
        if (G.phase !== 'fight') { idle = 0; continue; }
        S.frames++;
        const neutral = !Object.values(ci).some(Boolean);
        if (me.state === 'idle' && neutral && h.state !== 'down') { if (idle === 10) S._ctx = `run=${me.ai.run ? me.ai.run.toks.join(' ') + '@' + me.ai.run.ti + ' q' + me.ai.run.queue.length + ' age' + me.ai.run.age : '-'} seq=${me.ai.seq.length} plan=${me.ai.plan} walk=${me.ai.walk} dist=${Math.abs(me.x-h.x)|0} hum=${h.state} ${cpu}`; idle++; }
        else { if (idle > 45) { S.idleLong++; (S.ctx = S.ctx || []).push(idle + ' ' + S._ctx); } S.idleMax = Math.max(S.idleMax, idle); idle = 0; }
        const run = me.ai && me.ai.run;
        if (run && run !== prevRun) { S.runs++; run._max = 0; }
        if (run) run._max = Math.max(run._max, h.combo);
        if (prevRun && prevRun !== run) {
          if (prevRun.ti >= prevRun.toks.length) S.runsDone++;
          const want = prevRun.toks.filter(t => t !== 'jc' && t !== 'dc').length;
          if (prevRun._max >= want) S.runsHitAll++;
          else if (prevRun.hitOnce) { const key = prevRun.toks.join(' ') + ' @' + prevRun.ti; S.drops[key] = (S.drops[key] || 0) + 1; }
        }
        prevRun = run;
        if (me.state === 'thrown' && prevState !== 'thrown') S.thrown++;
        if (me.state === 'tech' && prevState === 'thrown') S.techs++;
        if (me.state === 'block' && (prevState !== 'block' || me.bs > prevBs)) { S.blockEvents++; if (me.x < 200 || me.x > STAGE_W - 200) S.cornerBlocks++; }
        if (me.state === 'attack' && me.move.kind === 'gc' && prevState !== 'attack') S.gc++;
        prevState = me.state; prevBs = me.bs;
      }
    }
    const drops = Object.entries(S.drops).sort((a, b) => b[1] - a[1]).slice(0, 6);
    out[lv] = { ...S, drops };
  }
  return JSON.stringify(out);
}"""
async def main():
    levels = [int(x) for x in sys.argv[1:]] or [1, 2, 3, 4]
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(3000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
        res = json.loads(await pg.evaluate(JS, [levels, 240]))
        print('ERR', errs[:3]); await b.close()
    for lv, S in res.items():
        print(f"L{lv}: idle max {S['idleMax']}f, idle >45f x{S['idleLong']} | combos started {S['runs']}, all hits {S['runsHitAll']} ({100*S['runsHitAll']//max(1,S['runs'])}%) | techs {S['techs']}/{S['thrown']} ({100*S['techs']//max(1,S['thrown'])}%) | blocks {S['blockEvents']} (corner {S['cornerBlocks']}) counter spurt {S['gc']}")
        for k, v in S['drops']: print('     drop', v, k)
        for c in (S.get('ctx') or [])[:8]: print('     idle', c)
asyncio.run(main())
