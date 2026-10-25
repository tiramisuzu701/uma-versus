"""Frame-time profile: a CPU-vs-CPU match on each stage at a given graphics level, with the main draw and sim
functions wrapped in timers. Reports average and worst cost per part, the slow frames, and GC pauses."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, sys, json
from playwright.async_api import async_playwright
GFX = sys.argv[1] if len(sys.argv) > 1 else 'medium'
JS = r"""async (gfx) => {
  loop = () => {}; SET.gfx = gfx; fit();
  const parts = {}, wrap = (name, obj, key) => { const f = obj[key]; if (typeof f !== 'function') return; obj[key] = function () {
    const t0 = performance.now(); try { return f.apply(this, arguments); } finally { const d = performance.now() - t0; const p = parts[name] || (parts[name] = { sum: 0, max: 0, n: 0 }); p.sum += d; p.n++; if (d > p.max) p.max = d; } }; };
  for (const n of ['tick', 'render', 'step', 'cpuInput', 'musicDirector', 'acctTick', 'netPump', 'drawStage', 'drawStageFront', 'drawFighter', 'drawProj', 'drawHUD',
                   'txt', 'label', 'ledText', 'drawFx', 'updateFx', 'spark', 'drawSuperFlash', 'drawRoundIntro', 'drawKO', 'drawResults', 'comboCounter', 'hpBar', 'spurtGauge', 'padInput', 'drawFrameMeter', 'drawInputDisplay'])
    wrap(n, window, n);
  // stage back/front passes
  STAGES.forEach((S, i) => { if (S.back) { const f = S.back; S.back = function () { const t0 = performance.now(); f.apply(this, arguments); const d = performance.now() - t0; const p = parts['stage.back.' + i] || (parts['stage.back.' + i] = { sum: 0, max: 0, n: 0 }); p.sum += d; p.n++; p.max = Math.max(p.max, d); }; }
                             if (S.front) { const f = S.front; S.front = function () { const t0 = performance.now(); f.apply(this, arguments); const d = performance.now() - t0; const p = parts['stage.front.' + i] || (parts['stage.front.' + i] = { sum: 0, max: 0, n: 0 }); p.sum += d; p.n++; p.max = Math.max(p.max, d); }; } });
  const frames = [];
  const pairs = [['mc', 'at'], ['jp', 'df'], ['at', 'mc'], ['df', 'suz']];
  for (let s = 0; s < STAGES.length; s++) {
    const [c1, c2] = pairs[s % pairs.length];
    startMatch('cpu', c1, c2); G.stage = s; G.cpuLevel = 4; UI.screen = 'game'; UI.paused = false; rs = 3 + s;
    // drive both sides with the CPU
    const real = gameInputs; window.gameInputs = () => [cpuInput(G.p[0], 4), cpuInput(G.p[1], 3)];
    for (let f = 0; f < 60 * 45; f++) {
      const t0 = performance.now(); tick(); const t1 = performance.now(); render(); ctx.getImageData(0, 0, 1, 1); const t2 = performance.now();
      frames.push({ s, tick: t1 - t0, render: t2 - t1, phase: G.phase, fx: G.fx.length, texts: G.texts.length, projs: G.projs.length });
      if (G.phase === 'match') break;
    }
    window.gameInputs = real;
  }
  return { parts, frames };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--js-flags=--expose-gc'])
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
        cdp = await pg.context.new_cdp_session(pg)
        await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(6000)
        print('music tracks decoded in the background:', await pg.evaluate('Object.keys(Music.urls).length'), 'of', await pg.evaluate("document.querySelectorAll('script.track').length"))
        await cdp.send('Performance.enable')
        m0 = {m['name']: m['value'] for m in (await cdp.send('Performance.getMetrics'))['metrics']}
        r = await pg.evaluate(JS, GFX)
        m1 = {m['name']: m['value'] for m in (await cdp.send('Performance.getMetrics'))['metrics']}
        fr = r['frames']; n = len(fr)
        tot = sorted(f['tick'] + f['render'] for f in fr)
        print(f'gfx={GFX} canvas frames={n}  frame ms: median {tot[n//2]:.2f}  p95 {tot[int(n*.95)]:.2f}  p99 {tot[int(n*.99)]:.2f}  max {tot[-1]:.2f}')
        print(f"slow frames >16.7ms: {sum(t > 16.7 for t in tot)}   >10ms: {sum(t > 10 for t in tot)}")
        print('JS heap used MB', round(m1.get('JSHeapUsedSize', 0) / 1e6, 1), ' GC-ish: script ms', round((m1.get('ScriptDuration', 0) - m0.get('ScriptDuration', 0)) * 1000), ' layout', round((m1.get('LayoutDuration', 0) - m0.get('LayoutDuration', 0)) * 1000))
        print('per part (avg ms per frame over the run / worst single call ms):')
        for k, v in sorted(r['parts'].items(), key=lambda kv: -kv[1]['sum']):
            print(f'  {k:22s} avg/frame {v["sum"] / n:6.3f}   calls/frame {v["n"] / n:6.1f}   worst {v["max"]:6.2f}')
        worst = sorted(fr, key=lambda f: -(f['tick'] + f['render']))[:8]
        print('worst frames:', [(round(f['tick'], 1), round(f['render'], 1), f['phase'], 'stage', f['s'], 'fx', f['fx'], 'texts', f['texts']) for f in worst])
        print('max fx', max(f['fx'] for f in fr), 'max texts', max(f['texts'] for f in fr))
        await b.close()
asyncio.run(main())
