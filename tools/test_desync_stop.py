"""2.0.2: a desync stops an online match for both players, no result is recorded, and both go back to the lobby.
One side plays with modified character data (like a modded copy that kept the same build number).
Usage: python3 test_desync_stop.py [page url]"""
import asyncio, sys
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = sys.argv[1] if len(sys.argv) > 1 else 'file://' + ROOT + '/build/uma-versus.html'
BOT = """(side) => { const orig = netGameTick;
  netGameTick = (raw) => { const F = Net.F, seg = Math.floor(F / 9); let h = Math.imul(seg + 1, 2654435761) ^ (side * 97531); h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const i = {u:0,d:0,l:0,r:0,L:0,M:0,H:0,S:0}; for (const k of [[], ['r'], ['r'], ['l'], ['d'], ['d','r']][h % 6]) i[k] = 1;
    if ((F % 9) < 2) i[['L','M','H','L'][(h >> 8) % 4]] = 1; return orig(i); }; }"""
async def main():
    ok = n = 0
    def check(label, got, want):
        nonlocal ok, n
        good = got == want; ok += good; n += 1; print('OK ' if good else 'BAD', f'{label:58}', got)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'])
        ctx = await b.new_context(viewport={'width': 960, 'height': 540})
        A = await ctx.new_page(); B = await ctx.new_page(); errs = []
        for nm, pg in (('A', A), ('B', B)):
            pg.on('pageerror', lambda e, nm=nm: errs.append(nm + ': ' + str(e)))
            await pg.goto(URL); await pg.wait_for_timeout(800)
            await pg.evaluate("() => { UI.screen='online'; showNetPanel(); document.getElementById('netLocal').checked = true; }")
        two_step = await A.evaluate("() => !!document.getElementById('netGoCreate')")   # 2.5 lobby (Create / Browse) or the 2.0 one
        if two_step: await A.click('#netGoCreate')
        await A.click('#netHost'); await A.wait_for_timeout(200)
        if two_step: await B.click('#netGoBrowse')
        await B.click('#netJoin'); await B.wait_for_timeout(1500)
        await A.evaluate("() => { Net.myPick = 0; }"); await B.evaluate("() => { Net.myPick = 1; }")
        await A.keyboard.press('Enter'); await B.keyboard.press('Enter'); await A.wait_for_timeout(1500)
        check('match started on both', [await A.evaluate("() => UI.screen + ' ' + G.mode"), await B.evaluate("() => UI.screen + ' ' + G.mode")], ['game online', 'game online'])
        # B is a "modded copy": same build number, but Suzuka walks and hits differently
        await B.evaluate("() => { const c = CHARS[G.p[1].cid]; c.walk *= 1.6; for (const m of Object.values(c.moves)) for (const h of m.hits || []) h.dmg *= 2; }")
        await A.evaluate("() => (" + BOT + ")(0)"); await B.evaluate("() => (" + BOT + ")(1)")
        await A.evaluate("() => { window.__rec = 0; const o = acctRecord; acctRecord = (...a) => { window.__rec++; return o(...a); }; }")
        seen = None
        for i in range(30):
            await A.wait_for_timeout(500)
            d = [await A.evaluate("() => Net.desync"), await B.evaluate("() => Net.desync")]
            if d[0] >= 0 and d[1] >= 0: seen = d; break
        check('both sides see the desync', seen is not None, True)
        await A.wait_for_timeout(1000)
        await A.screenshot(path=ROOT + '/build/shots/52_desync_stop.png')
        check('the match is stopped (frames stop advancing)', await A.evaluate("() => { const f = Net.F; return new Promise(r => setTimeout(() => r(Net.F === f), 700)); }"), True)
        await A.wait_for_timeout(4000)
        check('both back in the lobby', [await A.evaluate("() => UI.screen"), await B.evaluate("() => UI.screen")], ['netselect', 'netselect'])
        check('still connected', [await A.evaluate("() => Net.connected"), await B.evaluate("() => Net.connected")], [True, True])
        check('no result recorded', await A.evaluate("() => window.__rec"), 0)
        check('desync flag cleared for the next match', [await A.evaluate("() => Net.desync"), await B.evaluate("() => Net.desync")], [-1, -1])
        check('no page errors', errs, [])
        print(f'{ok}/{n}'); await b.close()
asyncio.run(main())
