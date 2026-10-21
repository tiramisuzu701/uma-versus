import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
STATE = "() => { const a = Music.cur && Music.els[Music.cur]; return `${UI.screen.padEnd(9)} ph=${(G.phase||'').padEnd(5)} r=${G.round} wins=${G.p.map(p=>p.wins).join('-')} cur=${Music.cur} gain=${Music.cur ? Music.gain[Music.cur].toFixed(2) : '-'} t=${a ? a.currentTime.toFixed(1) : '-'} playing=${a ? !a.paused : '-'} | others=${Object.keys(Music.els).filter(k => k !== Music.cur && !Music.els[k].paused).join(',')}`; }"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(2500)
        async def snap(lab, wait=0):
            if wait: await pg.wait_for_timeout(wait)
            print(f'{lab:28s}', await pg.evaluate(STATE))
        await snap('title', 1500)
        await pg.keyboard.press('Enter'); await snap('main menu', 800)
        await pg.evaluate("() => { UI.pendingMode='versus'; UI.screen='select'; UI.sel=[6,2]; UI.selDone=[true,true]; }"); await snap('-> course select', 600)
        await pg.keyboard.press('Enter'); await snap('-> music select (preview)', 1500)
        await pg.keyboard.press('KeyD'); await snap('music: next theme preview', 1500)
        await pg.keyboard.press('KeyA'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Enter'); await snap('-> VS splash', 1200)
        await pg.evaluate("() => { UI.vsT = 200; }"); await snap('round 1 intro', 600)
        await snap('round 1 fight', 2500)
        await pg.evaluate("() => { G.p[1].hp = 0; }"); await snap('round 1 KO (P1 wins)', 800)
        await pg.wait_for_timeout(4500); await snap('round 2 intro/fight', 800)
        await pg.evaluate("() => { G.p[0].hp = 0; }"); await snap('round 2 KO (tie 1-1)', 1200)
        await snap('round 2 KO later', 1800)
        await pg.wait_for_timeout(1500); await snap('round 3 intro', 500)
        await snap('round 3 fight', 2000)
        await pg.evaluate("() => { G.p[1].hp = 0; }"); await pg.wait_for_timeout(5000); await snap('match over / results', 1500)
        await pg.keyboard.press('Enter'); await snap('back to select', 1800)
        # training uses the theme directly
        await pg.evaluate("() => { UI.screen='mode'; }"); await pg.wait_for_timeout(500)
        await pg.evaluate("() => { UI.pendingMode='training'; UI.sel=[7,0]; UI.musicIdx=4; UI.vsStage=3; beginLocalMatch(); }"); await snap('training (Daiwa theme)', 1500)
        await pg.evaluate("() => { UI.paused = true; }"); await snap('paused (ducked)', 600)
        print('volume when paused', await pg.evaluate("() => Music.els[Music.cur].volume.toFixed(2)"))
        print('ERR', errs[:5]); await b.close()
asyncio.run(main())
