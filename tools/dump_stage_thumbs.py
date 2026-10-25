import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(3000)
        d = await pg.evaluate("""() => STAGES.map((S, i) => { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d');
          x.drawImage(S.thumb, 0, 0, 480, 270); return { name: STAGE_LIST[i].name, sub: STAGE_LIST[i].sub, img: c.toDataURL('image/jpeg', 0.85) }; })""")
        json.dump(d, open(ROOT+'/build/wiki/wiki_stages.json', 'w')); print(len(d)); await b.close()
asyncio.run(main())
