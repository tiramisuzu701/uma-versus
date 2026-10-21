"""Account flow against a stand-in Supabase server (Playwright intercepts every request to the project URL):
sign up, profile, cloud save push/pull, match recording, rename, favourite runner, sign out / sign in."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, json, base64, time, re, sys
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
GAME = 'file://' + ROOT + '/index.html'
DB = {'users': {}, 'profiles': {}, 'settings': {}, 'results': []}
LOG = []
def jwt(sub):
    enc = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
    return enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({'sub': sub, 'role': 'authenticated', 'exp': int(time.time()) + 3600, 'aud': 'authenticated'}) + '.sig'
def session(u):
    return {'access_token': jwt(u['id']), 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600, 'refresh_token': 'r-' + u['id'], 'user': u}
def eqv(q, k): v = q.get(k, [''])[0]; return v[3:] if v.startswith('eq.') else None
async def handle(route):
    req = route.request; u = urlparse(req.url); path = u.path; q = parse_qs(u.query); body = req.post_data or ''
    auth = req.headers.get('authorization', ''); uid = None
    if auth.startswith('Bearer ') and auth.count('.') == 2:
        try: uid = json.loads(base64.urlsafe_b64decode(auth.split('.')[1] + '==')).get('sub')
        except Exception: pass
    if uid and uid not in DB['users']: uid = None
    LOG.append(f'{req.method} {path}{"?" + u.query if u.query else ""}')
    obj = 'vnd.pgrst.object' in req.headers.get('accept', '')
    J = lambda data, status=200: route.fulfill(status=status, content_type='application/json', body=json.dumps(data), headers={'access-control-allow-origin': '*'})
    if req.method == 'OPTIONS': return await route.fulfill(status=200, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
    if path == '/auth/v1/signup':
        b = json.loads(body); email = b['email']
        if any(x['email'] == email for x in DB['users'].values()): return await J({'code': 422, 'msg': 'User already registered'}, 422)
        nid = f'00000000-0000-4000-8000-{len(DB["users"]) + 1:012d}'; meta = b.get('data', {})
        user = {'id': nid, 'aud': 'authenticated', 'role': 'authenticated', 'email': email, 'user_metadata': meta, 'app_metadata': {}, 'created_at': '2026-10-21T19:00:00Z'}
        DB['users'][nid] = dict(user, password=b['password'])
        name = meta.get('name', 'Runner')
        if any(p['name'].lower() == name.lower() for p in DB['profiles'].values()): name = name[:11] + '-1234'
        DB['profiles'][nid] = {'id': nid, 'name': name, 'fav_runner': meta.get('fav_runner', 'spe'), 'created_at': '2026-10-21T19:00:00Z'}
        DB['settings'][nid] = {'user_id': nid, 'data': {}, 'updated_at': '2026-10-21T19:00:00Z'}
        return await J(session(user))
    if path == '/auth/v1/token':
        b = json.loads(body); m = [x for x in DB['users'].values() if x['email'] == b.get('email') and x['password'] == b.get('password')]
        if not m: return await J({'error': 'invalid_grant', 'error_description': 'Invalid login credentials'}, 400)
        return await J(session({k: v for k, v in m[0].items() if k != 'password'}))
    if path == '/auth/v1/logout': return await route.fulfill(status=204, headers={'access-control-allow-origin': '*'})
    if path == '/auth/v1/user': return await J({k: v for k, v in DB['users'][uid].items() if k != 'password'}) if uid else await J({'msg': 'no'}, 401)
    if path == '/rest/v1/rpc/name_available':
        n = json.loads(body)['n'].strip(); return await J(bool(re.fullmatch(r'[A-Za-z0-9_. -]{3,16}', n)) and not any(p['name'].lower() == n.lower() for p in DB['profiles'].values()))
    tbl = path.rsplit('/', 1)[-1]
    if tbl == 'profiles':
        pid = eqv(q, 'id')
        if req.method == 'GET': rows = [p for p in DB['profiles'].values() if pid in (None, p['id'])]; return await J((rows[0] if rows else None) if obj else rows)
        if req.method == 'PATCH':
            if pid != uid: return await J([], 200)
            b = json.loads(body)
            if 'name' in b and any(p['name'].lower() == b['name'].lower() and p['id'] != uid for p in DB['profiles'].values()):
                return await J({'code': '23505', 'message': 'duplicate key value violates unique constraint "profiles_name_unique"'}, 409)
            DB['profiles'][uid].update(b); return await route.fulfill(status=204, headers={'access-control-allow-origin': '*'})
    if tbl == 'settings':
        if req.method == 'GET': r = DB['settings'].get(uid); return await J(r if obj else ([r] if r else []))
        if req.method == 'POST':
            b = json.loads(body); b = b[0] if isinstance(b, list) else b
            if b['user_id'] != uid: return await J({'code': '42501', 'message': 'row-level security'}, 403)
            DB['settings'][uid] = {'user_id': uid, 'data': b['data'], 'updated_at': 'now'}; return await route.fulfill(status=201, headers={'access-control-allow-origin': '*'})
    if tbl == 'player_stats':
        rs = [r for r in DB['results'] if r['user_id'] == uid]
        rs = [r for r in rs if r['mode'] == 'online']
        st = {'user_id': uid, 'games': len(rs), 'wins': sum(r['won'] for r in rs), 'losses': sum(not r['won'] for r in rs), 'main_runner': rs[0]['my_runner'] if rs else None}
        return await J((st if rs else None) if obj else ([st] if rs else []))
    if tbl == 'match_results':
        if req.method == 'GET': return await J([dict(r, created_at='2026-10-21T19:30:00Z') for r in DB['results'] if r['user_id'] == eqv(q, 'user_id')][::-1])
        if req.method == 'POST':
            b = json.loads(body); b = b[0] if isinstance(b, list) else b
            if b['user_id'] != uid: return await J({'code': '42501', 'message': 'row-level security'}, 403)
            if b['mode'] != 'online': return await J({'code': '23514', 'message': 'violates check constraint "match_results_online_only"'}, 400)
            DB['results'].append(b); return await route.fulfill(status=201, headers={'access-control-allow-origin': '*'})
    return await J({'message': 'unhandled ' + path}, 404)

async def main():
    out = []; ok = lambda k, c, v='': out.append(('PASS ' if c else 'FAIL ') + k + (' · ' + str(v) if v != '' else ''))
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(); errs = []
        await ctx.route(re.compile(r'https://\w+\.supabase\.co/.*'), handle)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME); await pg.wait_for_timeout(1500)
        ev = pg.evaluate
        ok('accounts switched on', await ev('ACCT.on'))
        # guest settings that should go up to the new account
        await ev("() => { Music.vol = 0.33; Music.save(); }")
        await ev("() => { UI.screen = 'mode'; acctOpen(); }")
        ok('sign-in panel shown for guests', await ev("!document.getElementById('acct').classList.contains('hidden')"))
        await pg.click('#acTabUp'); await pg.fill('#acEmail', 'xav@test.local'); await pg.fill('#acPass', 'hunter22'); await pg.fill('#acName', 'Xavier'); await pg.select_option('#acFav', 'tt')
        await pg.click('#acGo'); await pg.wait_for_timeout(1500)
        ok('signed in after sign-up', await ev('acctOn()'), await ev('ACCT.status'))
        ok('profile loaded', await ev("ACCT.profile && ACCT.profile.name === 'Xavier' && ACCT.profile.fav_runner === 'tt'"), await ev('JSON.stringify(ACCT.profile)'))
        ok('panel closed after sign-up', await ev("document.getElementById('acct').classList.contains('hidden')"))
        cloud = list(DB['settings'].values())[0]['data']
        ok('guest settings pushed to the new account', 'umavs.audio' in cloud and '0.33' in cloud['umavs.audio'], list(cloud.keys()))
        # name taken check
        DB['profiles']['x'] = {'id': 'x', 'name': 'Taken Name', 'fav_runner': 'spe', 'created_at': ''}
        # VS CPU match result gets recorded
        await ev("() => { G.cpuLevel = 4; startMatch('cpu', 'tt', 'ds'); G.p[0].wins = 2; G.p[1].wins = 1; G.phase = 'match'; acctTick(); }")
        await pg.wait_for_timeout(800)
        ok('VS CPU match NOT recorded', len(DB['results']) == 0, DB['results'][:1])
        # online result uses the shared match key and the opponent's name
        await ev("() => { Net.side = 1; Net.matchKey = 'sess-3'; Net.theirWho = { id: '', name: 'Rival' }; startMatch('online', 'kb', 'tt'); G.p[1].wins = 0; G.p[0].wins = 2; G.phase = 'match'; acctTick(); }")
        await pg.wait_for_timeout(800)
        await ev("() => { acctTick(); acctTick(); }"); await pg.wait_for_timeout(300)
        ok('online match recorded once', len(DB['results']) == 1, len(DB['results']))
        ok('stats refreshed', await ev("ACCT.stats && ACCT.stats.games === 1 && ACCT.stats.losses === 1 && ACCT.recent.length === 1"), await ev('JSON.stringify(ACCT.stats)'))
        r2 = DB['results'][-1]
        ok('online result: side, key, opponent', r2['mode'] == 'online' and r2['match_key'] == 'sess-3' and r2['my_runner'] == 'tt' and not r2['won'] and r2['opp_name'] == 'Rival' and r2['opp_id'] is None, r2)
        # rename (taken, then free) and favourite runner
        await ev("() => { UI.screen = 'account'; acctPanel('rename'); }"); await pg.fill('#acNewName', 'Taken Name'); await pg.click('#acSaveName'); await pg.wait_for_timeout(600)
        ok('rename to a taken name refused', await ev("ACCT.profile.name === 'Xavier'"), await ev('ACCT.status'))
        await pg.fill('#acNewName', 'Xavier S'); await pg.click('#acSaveName'); await pg.wait_for_timeout(600)
        ok('rename works', await ev("ACCT.profile.name === 'Xavier S'") and list(DB['profiles'].values())[0]['name'] == 'Xavier S')
        await ev("() => { ACCT.idx = 0; acctScreenTick({ ...NEUTRAL, r: 1 }, false, false); }"); await pg.wait_for_timeout(500)
        ok('favourite runner change saved', list(DB['profiles'].values())[0]['fav_runner'] == 'kb', list(DB['profiles'].values())[0]['fav_runner'])
        # cloud save: change a setting locally, autosave pushes it
        await ev("() => { SET.calm = true; saveSet(); for (let i = 0; i < 600; i++) acctTick(); }"); await pg.wait_for_timeout(600)
        ok('changed setting autosaved', '"calm":true' in DB['settings'][list(DB['settings'])[0]]['data'].get('umavs.settings', ''))
        # sign out, change local settings, sign back in: the account's settings come back
        await ev("() => acctSignOut()"); await pg.wait_for_timeout(500)
        ok('signed out', not await ev('acctOn()'))
        await ev("() => { SET.calm = false; saveSet(); Music.vol = 0.9; Music.save(); }")
        await ev("() => { UI.screen = 'mode'; acctOpen(); }"); await pg.click('#acTabIn')
        await pg.fill('#acEmail', 'xav@test.local'); await pg.fill('#acPass', 'wrongpass'); await pg.click('#acGo'); await pg.wait_for_timeout(800)
        ok('wrong password message', 'Wrong email or password' in await ev('ACCT.status'), await ev('ACCT.status'))
        await pg.fill('#acPass', 'hunter22'); await pg.click('#acGo'); await pg.wait_for_timeout(1500)
        ok('signed back in', await ev('acctOn()'))
        ok('account settings restored on sign-in', await ev('SET.calm === true && Math.abs(Music.vol - 0.33) < 0.01'), await ev('JSON.stringify([SET.calm, Music.vol])'))
        # session survives a reload
        await pg.reload(); await pg.wait_for_timeout(2000)
        ok('still signed in after reload', await ev('acctOn() && !!ACCT.profile'), await ev('acctName()'))
        ok('who info for online', await ev("JSON.stringify(acctWho())"))
        print('\n'.join(out)); print('requests', len(LOG)); print('ERR', errs[:5]); await b.close()
asyncio.run(main())
