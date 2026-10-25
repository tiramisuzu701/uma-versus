import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Drives every tutorial step with scripted inputs and checks each one ticks off.
import asyncio
from playwright.async_api import async_playwright
JS = r"""() => {
  const N = () => ({ ...NEUTRAL }), out = [];
  const f = () => G.p[0].x < G.p[1].x ? 'r' : 'l', b = () => f() === 'r' ? 'l' : 'r';
  const tap = (k, n = 1) => [...Array(n).fill({ [k]: 1 }), {}];
  const close = () => { const [a, d] = G.p; a.x = d.x - (a.x < d.x ? 75 : -75); };
  // per step: a function giving P1's input on frame i (null = no input)
  const scripts = [
    [i => ({ [f()]: 1 }), i => ({ [b()]: 1 }), i => i % 50 === 0 ? { u: 1 } : {}, i => ({ d: 1 }), i => [{ [f()]: 1 }, {}, { [f()]: 1 }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}][i % 20], i => [{ [b()]: 1 }, {}, { [b()]: 1 }, ...Array(37).fill({})][i % 40]],
    [i => ({ L: { 0: 1 }, M: { 40: 1 }, H: { 80: 1 } }) && ({ 0: { L: 1 }, 40: { M: 1 }, 80: { H: 1 } }[i % 120] || {}), i => (i === 0 && close(), i % 30 === 0 ? { L: 1 } : {}), i => (i % 90 === 0 && close(), i % 4 === 0 ? { L: 1 } : {}), i => i % 30 === 0 ? { d: 1, L: 1 } : { d: 1 }],
    [i => ({ [b()]: 1 }), i => ({ [b()]: 1, d: 1 }), i => ({ [b()]: 1 }), i => { const d = G.p[1]; const low = d.state === 'attack' && d.move.hits && d.move.hits.some(h => h.guard === 'low'); return { [b()]: 1, d: low ? 1 : 0 }; }],
    [i => (i % 60 === 0 && close(), i % 60 === 1 ? { L: 1, M: 1 } : {}), i => G.p[0].state === 'thrown' && G.p[0].t === 2 ? { L: 1, M: 1 } : {}],
    [i => ({ 0: { S: 1 }, 60: { [f()]: 1, S: 1 }, 120: { [b()]: 1, S: 1 }, 180: { d: 1, S: 1 } }[i % 240] || {}), i => (tokenInputs(G.p[0], '236M')[i % 50] || {}), i => (tokenInputs(G.p[0], '623M')[i % 60] || {}), i => (tokenInputs(G.p[0], '236H')[i % 50] || {})],
    [i => (i % 120 === 0 && close(), ({ 1: { L: 1 }, 8: { M: 1 }, 20: { H: 1 } })[i % 120] || {}),
     i => { if (i % 120 === 0) close(); const k = i % 120; if (k === 1) return { M: 1 }; if (k >= 9 && k < 15) return tokenInputs(G.p[0], '236M')[k - 9] || {}; return {}; },
     i => { const a = G.p[0]; if (i % 200 === 0) { close(); aiState(a); aiStartRun(a, '2H jc j.M j.H', CPU_LV[4]); } return (a.ai.run && aiRunInput(a, G.p[1], CPU_LV[4])) || {}; }],
    [i => (i % 120 === 0 && close(), i % 120 === 2 ? { S: 1, H: 1 } : {}), i => G.p[0].state === 'block' ? { S: 1, H: 1 } : { [b()]: 1 }],
  ];
  for (let li = 0; li < LESSONS.length; li++) {
    tutStart(li);
    for (let si = 0; si < LESSONS[li].steps.length; si++) {
      let i = 0;
      while (TUT.si === si && !TUT.done && i < 1500) {
        const want = (scripts[li][si](i) || {}); i++;
        const p1 = { ...N(), ...want };
        const ins = [p1, tutDummy()]; step(ins); tutAfterStep();
      }
      out.push(`${li + 1}.${si + 1} ${TUT.si > si || TUT.done ? 'OK  ' : 'FAIL'} ${LESSONS[li].steps[si].text.slice(0, 60)} (${i}f)`);
      if (!(TUT.si > si || TUT.done)) break;
    }
  }
  return out.join('\n');
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(3000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
        print(await pg.evaluate(JS)); print('ERR', errs[:5]); await b.close()
asyncio.run(main())
