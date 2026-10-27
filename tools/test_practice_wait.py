import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# 2.0.1: the host can play Training while the room waits; the match lobby opens for both when someone joins.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'])
        ctx = await b.new_context(viewport={'width': 960, 'height': 540})
        A = await ctx.new_page(); B = await ctx.new_page(); errs = []
        for n, pg in (('A', A), ('B', B)):
            pg.on('pageerror', lambda e, n=n: errs.append(n + ': ' + str(e)))
            await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(500)
            await pg.evaluate("() => { UI.screen='online'; showNetPanel(); document.getElementById('netLocal').checked = true; }")
        await A.click('#netHost'); await A.wait_for_timeout(300)
        vis = await A.evaluate("() => !document.getElementById('netPracticeRow').classList.contains('hidden')")
        await A.click('#netPractice'); await A.wait_for_timeout(600)
        st1 = await A.evaluate("() => [UI.screen, G.mode, Net.practice, document.getElementById('net').classList.contains('hidden')]")
        await A.keyboard.down('KeyD'); await A.wait_for_timeout(300); await A.keyboard.up('KeyD')
        moved = await A.evaluate("() => Math.round(G.p[0].x)")
        await A.screenshot(path=ROOT+'/build/shots/52_practice_wait.png')
        await A.keyboard.press('Escape'); await A.wait_for_timeout(100)
        await B.click('#netJoin'); await B.wait_for_timeout(1500)
        st2 = await A.evaluate("() => [UI.screen, Net.connected, Net.practice, UI.paused]")
        stB = await B.evaluate("() => [UI.screen, Net.connected]")
        ok = vis and st1[:3] == ['game', 'training', True] and st1[3] and st2 == ['netselect', True, False, False] and stB == ['netselect', True]
        print('OK ' if ok else 'BAD', 'button shown', vis, '| practising', st1, 'x', moved, '| after join host', st2, 'guest', stB)
        print('ERR', errs); await b.close()
asyncio.run(main())
