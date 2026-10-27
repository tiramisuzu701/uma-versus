import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Display-name filter: slurs and swears are blocked (leetspeak, separators, stretched letters), normal and Uma names pass.
from playwright.sync_api import sync_playwright
BAD = ['fuck', 'FuCk3r', 'f.u_c-k', 'fuuuck', '5h1t', 'bullshit', 'ShitHead', 'BigAssRunner', 'ass', 'a s s', 'n1gger', 'Nigga99',
       'faggot', 'RETARD', 'b1tch', 'kys', 'Rapist', 'dickhead', 'sh1tty', 'c0ck', 'KKK', 'tits', 'Pussy Slayer', 'Mother F']
GOOD = ['Glass', 'Assassin', 'Yoshitaka', 'Grape', 'Team Spica', 'Cocoon', 'Torpedo', 'Peacock', 'Bob', 'Connor', 'Pisces', 'Cassidy',
        'Special Week', 'Tokai Teio', 'Classic', 'Massive', 'Rice Shower', 'Matikanefukukitaru', 'Ikuno Dictus', 'Grass Wonder',
        'Essex', 'Analyst', 'Titan', 'Hassan', 'Mitsuki', 'Nice Nature', 'Twin Turbo', 'Haru Urara', 'Hishi Amazon', 'Taiki Shuttle']
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(800)
    missed = pg.evaluate('ns => ns.filter(n => !nameBlocked(n))', BAD)
    falsepos = pg.evaluate('ns => ns.filter(n => nameBlocked(n))', GOOD)
    print('blocked', len(BAD) - len(missed), '/', len(BAD), 'missed', missed)
    print('allowed', len(GOOD) - len(falsepos), '/', len(GOOD), 'wrongly blocked', falsepos)
    print('ERR', errs); b.close()
