import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
JS = r"""() => {
  const out = [], N = () => ({ ...NEUTRAL });
  for (let ci = 0; ci < ROSTER.length; ci++) {
    const cid = ROSTER[ci], list = trialsFor(cid);
    for (let i = 0; i < list.length; i++) {
      UI.pendingMode = 'training'; UI.sel = [ci, 0]; UI.vsStage = 0; UI.musicIdx = ci; beginLocalMatch(); UI.screen = 'game';
      trialStart(cid, i); demoStart();
      let ok = false, f = 0, maxP = 0;
      for (; f < 600; f++) { const ins = gameInputs([N(), N()]); step(ins); demoAfterStep(); trialTrack(); maxP = Math.max(maxP, TR.progress); if (TR.done) { ok = true; break; } }
      out.push(`${cid} ${String(i + 1).padStart(2)} ${ok ? 'CLEAR' : 'FAIL '} ${list[i].seq.padEnd(40)} progress ${maxP}/${TR.exp.length} [${TR.exp.join(' ')}] got [${TR.hits.join(' ')}]`);
    }
  }
  return out.join('\n');
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/build/uma-versus.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
        print(await pg.evaluate(JS)); print('ERR', errs[:5]); await b.close()
asyncio.run(main())
