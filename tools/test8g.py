import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, sys
from playwright.async_api import async_playwright
Q = sys.argv[1] if len(sys.argv)>1 else '?lag=70&jitter=40&loss=0.1'
SECS = int(sys.argv[2]) if len(sys.argv)>2 else 40
BOT = """(side) => { const orig = netGameTick;
  netGameTick = (raw) => { const F = Net.F; const seg = Math.floor(F / 9);
    let h = Math.imul(seg + 1, 2654435761) ^ (side * 97531); h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const i = {u:0,d:0,l:0,r:0,L:0,M:0,H:0,S:0};
    const dirs = [[], ['r'], ['r'], ['l'], ['d'], ['d','r'], ['u','r'], [], ['r']][h % 9];
    for (const k of dirs) i[k] = 1;
    if ((F % 9) < 2) { const b = ['L','M','H','S','L','L'][(h >> 8) % 6]; i[b] = 1; }
    return orig(i); }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'])
        ctx = await b.new_context(viewport={'width':960,'height':540})
        A = await ctx.new_page(); B = await ctx.new_page()
        errs=[]
        for n,pg in (('A',A),('B',B)):
            pg.on('pageerror', lambda e, n=n: errs.append(n+': '+str(e)))
            await pg.goto('file://' + ROOT + '/index.html'+Q); await pg.wait_for_timeout(500)
            await pg.evaluate("() => { UI.screen='online'; showNetPanel(); document.getElementById('netLocal').checked = true; }")
        await A.click('#netHost'); await A.wait_for_timeout(200)
        await B.click('#netJoin'); await B.wait_for_timeout(1500)
        print('screens', await A.evaluate("() => UI.screen+' '+Net.connected"), await B.evaluate("() => UI.screen+' '+Net.connected"))
        await A.screenshot(path=ROOT+'/build/shots/50_netselect.png')
        await B.evaluate("() => { Net.myPick = 7; }")
        await A.evaluate("() => { Net.myPick = 5; Net.stage = 2; Net.music = 'ds'; }"); await A.keyboard.press('Enter'); await B.keyboard.press('Enter')
        await A.wait_for_timeout(1500)
        print('stages', await A.evaluate('() => G.stage'), await B.evaluate('() => G.stage'), 'music', await A.evaluate('() => G.music'), await B.evaluate('() => G.music')); print('screens', await A.evaluate("() => UI.screen+' '+G.mode+' '+G.p.map(p=>p.cid)"), await B.evaluate("() => UI.screen+' '+G.mode+' '+G.p.map(p=>p.cid)"))
        await A.evaluate("() => (" + BOT + ")(0)"); await B.evaluate("() => (" + BOT + ")(1)")
        for i in range(SECS // 5):
            await A.wait_for_timeout(5000)
            if i == 1: await A.screenshot(path=ROOT+'/build/shots/51_netgame.png')
            sa = await A.evaluate("() => `F=${Net.F} rmax=${Net.remoteMax} rb=${Net.rbMax} stalls=${Net.stalls} ping=${Math.round(Net.ping)} desync=${Net.desync} phase=${G.phase} r=${G.round} hp=${G.p.map(p=>p.hp)}`")
            sb = await B.evaluate("() => `F=${Net.F} rmax=${Net.remoteMax} rb=${Net.rbMax} stalls=${Net.stalls} ping=${Math.round(Net.ping)} desync=${Net.desync} phase=${G.phase} r=${G.round} hp=${G.p.map(p=>p.hp)}`")
            print('A', sa); print('B', sb)
        print('over?', await A.evaluate("() => netMatchConfirmedOver()"), await B.evaluate("() => netMatchConfirmedOver()"))
        await A.wait_for_timeout(1500)
        for pg in (A,B): await pg.keyboard.press('Enter')
        await A.wait_for_timeout(500)
        print('after results', await A.evaluate("() => UI.screen"), await B.evaluate("() => UI.screen"))
        await A.screenshot(path=ROOT+'/build/shots/52_after.png')
        for pg in (A,B): await pg.keyboard.press('Enter')
        await A.wait_for_timeout(1500)
        print('rematch', await A.evaluate("() => UI.screen+' m='+Net.matchId+' F='+Net.F"), await B.evaluate("() => UI.screen+' m='+Net.matchId+' F='+Net.F"))
        ca = await A.evaluate("() => JSON.stringify(Object.fromEntries(Object.entries(Net.csMine).filter(([f]) => f % 30 == 0 && +f <= Net.remoteMax)))")
        cb = await B.evaluate("() => JSON.stringify(Object.fromEntries(Object.entries(Net.csMine).filter(([f]) => f % 30 == 0 && +f <= Net.remoteMax)))")
        import json; ca=json.loads(ca); cb=json.loads(cb)
        common=[f for f in ca if f in cb]; bad=[f for f in common if ca[f]!=cb[f]]
        print(f'checksums compared={len(common)} mismatches={len(bad)} first={bad[:3]}')
        print('ERR', errs[:5]); await b.close()
asyncio.run(main())
