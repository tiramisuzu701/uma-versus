import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Two tabs play a local online match; the host forwards it to a third tab through a stand-in spectator
# connection. The spectator must end up with exactly the same match.
import asyncio, json
from playwright.async_api import async_playwright
BOT = open(ROOT+'/tools/test_online.py').read().split('BOT = """')[1].split('"""')[0]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'])
        ctx = await b.new_context(viewport={'width': 960, 'height': 540})
        A, B, C = await ctx.new_page(), await ctx.new_page(), await ctx.new_page(); errs = []
        for n, pg in (('A', A), ('B', B), ('C', C)):
            pg.on('pageerror', lambda e, n=n: errs.append(n + ': ' + str(e)))
            await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(2500)
        for pg in (A, B): await pg.evaluate("() => { UI.screen='online'; showNetPanel(); document.getElementById('netLocal').checked = true; }")
        await A.click('#netHost'); await A.wait_for_timeout(200); await B.click('#netJoin'); await B.wait_for_timeout(1500)
        # the stand-in spectator: whatever the host sends it is queued for the test to carry to tab C
        await A.evaluate("() => { window.SPECQ = []; const c = { open: true, send: m => SPECQ.push(JSON.parse(JSON.stringify(m))), close() {}, on() {} }; c._sent = -1; c._m = 0; Net.specs.push(c); window.FAKE = c; FAKE.send({ t: 'shello', build: BUILD, names: ['Host', 'Guest'] }); }")
        await C.evaluate("""() => { window.CS = {}; const st = step;
          specTick = (esc) => { if (!SPEC.live) return; const ahead = SPEC.frames.length - SPEC.idx, n = ahead > 120 ? 3 : ahead > 40 ? 2 : ahead > 6 ? 1 : 0;
            for (let k = 0; k < n && SPEC.frames[SPEC.idx]; k++) { const [a, b] = SPEC.frames[SPEC.idx]; st([decIn(a), decIn(b)]); if (SPEC.idx % 30 === 0) CS[SPEC.idx] = checksum(); SPEC.idx++; } }; }""")
        await C.evaluate("() => { Net.role = 'spec'; Net.connected = true; Net.lastRecv = performance.now(); Net.code = 'LOCAL'; UI.screen = 'spectate'; }")
        await B.evaluate("() => { Net.myPick = 10; Net.myPal = 2; }"); await A.evaluate("() => { Net.myPick = 9; Net.stage = 1; }")
        await A.keyboard.press('Enter'); await B.keyboard.press('Enter'); await A.wait_for_timeout(1000)
        await A.evaluate("() => (" + BOT + ")(0)"); await B.evaluate("() => (" + BOT + ")(1)")
        async def relay():
            msgs = await A.evaluate("() => SPECQ.splice(0)")
            if msgs: await C.evaluate("(ms) => { for (const m of ms) netRecv(m); }", msgs)
            return len(msgs)
        for i in range(200):
            await relay(); await A.wait_for_timeout(250)
            if await A.evaluate("() => netMatchConfirmedOver()"): break
        for i in range(30): await relay(); await A.wait_for_timeout(200)
        await C.wait_for_timeout(4000)
        sa = await A.evaluate("() => JSON.stringify({ c: G.p.map(p => p.cid), pal: G.p.map(p => p.pal), hp: G.p.map(p => p.hp), w: G.p.map(p => p.wins), phase: G.phase })")
        sc = await C.evaluate("() => JSON.stringify({ c: G.p.map(p => p.cid), pal: G.p.map(p => p.pal), hp: G.p.map(p => p.hp), w: G.p.map(p => p.wins), phase: G.phase })")
        print('host     ', sa); print('spectator', sc, await C.evaluate("() => `played ${SPEC.idx} of ${SPEC.frames.length} frames, mode ${G.mode}`"))
        ca = json.loads(await A.evaluate("() => JSON.stringify(Net.csMine)")); cc = json.loads(await C.evaluate("() => JSON.stringify(CS)"))
        common = [f for f in cc if f in ca]; bad = [f for f in common if ca[f] != cc[f]]
        print(f'checksums compared {len(common)}, mismatches {len(bad)} {bad[:3]}')
        await C.screenshot(path='/tmp/claude-0/-home-claude/beead88c-29e2-5633-85fe-f20dc7826420/scratchpad/spec.png')
        print('ERR', errs[:5]); await b.close()
asyncio.run(main())
