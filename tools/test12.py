import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
CASES = [
  # (label, tokens "dir*frames", button, expected)
  ('clean 623',                 '6*2 2*2 3*2', 'L', '4S.L'),
  ('623 rolled to 6 (6236)',    '6*2 2*2 3*2 6*2', 'L', '4S'),
  ('623 as 6323',               '6*2 3*1 2*2 3*2', 'L', '4S'),
  ('623 slow button',           '6*3 2*3 3*5', 'L', '4S'),
  ('623 via 1 + H = EX',        '6*2 1*1 2*1 3*2', 'H', '4SX'),
  ('clean 236',                 '2*2 3*2 6*2', 'L', '5S'),
  ('walk fwd then 236',         '6*30 5*2 2*2 3*2 6*2', 'L', '5S'),
  ('walk fwd rolled into 236',  '6*30 3*2 2*2 3*2 6*2', 'L', '5S'),
  ('fast 236',                  '2*1 3*1 6*1', 'M', '5S'),
  ('214 (Spe: Spurt Tornado)',  '2*2 1*2 4*2', 'L', '6S'),
  ('41236 (Spe: Guts)',         '4*2 1*2 2*2 3*2 6*2', 'L', '2S'),
  ('block then 41236',          '4*40 1*2 2*2 3*2 6*2', 'L', '2S'),
  ('66L dash attack',           '6*2 5*2 6*1', 'L', 'dL'),
  ('66M (button on 2nd tap)',   '6*1 5*1 6*1', 'M', 'dM'),
  ('66H dash attack',           '6*3 5*3 6*2', 'H', 'dH'),
  ('22L is just 2L now',        '2*3 5*2 2*2', 'L', '2L'),
  ('walk fwd + L stays 5L',     '6*20', 'L', '5L'),
  ('236 after dash still 5S',   '6*2 5*2 2*2 3*2 6*2', 'L', '5S'),
  ('held 2 + L stays 2L',       '2*10', 'L', '2L'),
  ('623 + H with meter = EX',   '6*2 2*2 3*2', 'H', '4SX'),
  ('236 + H no meter = M ver.', '2*2 3*2 6*2', 'H!', '5S'),
  ('6 + S = simple 6S',         '6*4', 'S', '6S'),
  ('dash then M',               '6*1 5*2 6*8', 'M', 'dM'),
]
JS = """([tokens, btn]) => {
  const N=()=>({...NEUTRAL});
  const D={1:{d:1,l:1},2:{d:1},3:{d:1,r:1},4:{l:1},5:{},6:{r:1},7:{u:1,l:1},8:{u:1},9:{u:1,r:1}};
  startMatch('training','spe','suz'); G.training.meter=false; const [a,d]=G.p; a.x=700; d.x=1300;
  let noMeter = btn.endsWith('!'); btn = btn.replace('!','');
  a.meter = noMeter ? 0 : 100;
  const seq=[]; for (const t of tokens.split(' ')) { const [dd,n]=t.split('*'); for (let i=0;i<+n;i++) seq.push({...N(),...D[dd]}); }
  seq[seq.length-1] = {...seq[seq.length-1], [btn]:1};
  let got=null;
  for (let f=0; f<seq.length+6; f++) { step([seq[f] || (f<seq.length+2 ? seq[seq.length-1] : N()), N()]); if (a.state==='attack' && !got) got=a.move.id; }
  return got;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/build/uma-versus.html'); await pg.wait_for_timeout(500)
        await pg.evaluate("() => { tick = () => {}; }")
        ok=0
        for label,tok,btn,exp in CASES:
            got = await pg.evaluate(JS, [tok, btn])
            good = got==exp or (got or '').split('.')[0]==exp.split('.')[0] and not exp.endswith('X')
            mark = 'OK ' if good else 'BAD'
            ok += good
            print(f'{mark} {label:30s} -> {got} (want {exp})')
        print(f'{ok}/{len(CASES)}', 'ERR', errs); await b.close()
asyncio.run(main())
