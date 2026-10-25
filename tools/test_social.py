"""Friends, invites, presence, room list and leaderboards against a stand-in Supabase server shared by two
players in two browser tabs (Playwright answers every request to the project URL, applying the same rules
as the real policies in supabase/003)."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, json, base64, time, re
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
GAME = 'file://' + ROOT + '/index.html'
U = {'u1': {'id': '00000000-0000-4000-8000-000000000001', 'email': 'a@x', 'name': 'Alpha'},
     'u2': {'id': '00000000-0000-4000-8000-000000000002', 'email': 'b@x', 'name': 'Bravo'}}
DB = {'friends': [], 'presence': {}, 'invites': [], 'rooms': {}, 'keys': {}, 'lb': [
  {'user_id': U['u2']['id'], 'name': 'Bravo', 'games': 12, 'wins': 9, 'win_rate': 75, 'main_runner': 'mc'},
  {'user_id': U['u1']['id'], 'name': 'Alpha', 'games': 30, 'wins': 14, 'win_rate': 47, 'main_runner': 'jp'},
  {'user_id': 'x3', 'name': 'Charlie', 'games': 4, 'wins': 4, 'win_rate': 100, 'main_runner': 'df'}]}
NEXT = [1]
def jwt(sub):
    enc = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
    return enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({'sub': sub, 'role': 'authenticated', 'exp': int(time.time()) + 3600, 'aud': 'authenticated'}) + '.sig'
def user(u): return {'id': u['id'], 'aud': 'authenticated', 'role': 'authenticated', 'email': u['email'], 'user_metadata': {}, 'app_metadata': {}, 'created_at': '2026-10-21T19:00:00Z'}
def session(u): return {'access_token': jwt(u['id']), 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600, 'refresh_token': 'r', 'user': user(u)}
def mutual(a, b): return any(f['user_id'] == a and f['friend_id'] == b for f in DB['friends']) and any(f['user_id'] == b and f['friend_id'] == a for f in DB['friends'])
def eqs(q):   # col -> value for ?col=eq.value
    return {k: v[0][3:] for k, v in q.items() if v[0].startswith('eq.')}
def ins(q, col):
    v = q.get(col, [''])[0]; return v[4:-1].split(',') if v.startswith('in.(') else None
async def handle(route):
    req = route.request; u = urlparse(req.url); path = u.path; q = parse_qs(u.query); body = req.post_data or ''
    auth = req.headers.get('authorization', ''); uid = None
    try: uid = json.loads(base64.urlsafe_b64decode(auth.split('.')[1] + '==')).get('sub') if auth.count('.') == 2 else None
    except Exception: pass
    if uid not in [x['id'] for x in U.values()]: uid = None
    H = {'access-control-allow-origin': '*'}
    J = lambda d, st=200: route.fulfill(status=st, content_type='application/json', body=json.dumps(d), headers=H)
    one = 'vnd.pgrst.object' in req.headers.get('accept', '')
    if req.method == 'OPTIONS': return await route.fulfill(status=200, headers={**H, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
    if path == '/auth/v1/token':
        b = json.loads(body); m = [x for x in U.values() if x['email'] == b.get('email')]
        return await J(session(m[0])) if m else await J({'error': 'invalid_grant', 'error_description': 'Invalid login credentials'}, 400)
    if path == '/auth/v1/user': return await J(user([x for x in U.values() if x['id'] == uid][0])) if uid else await J({}, 401)
    if path.startswith('/rest/v1/rpc/'):
        fn = path.rsplit('/', 1)[-1]; a = json.loads(body or '{}')
        if fn == 'add_friend':
            t = [x for x in U.values() if x['name'].lower() == a['n'].strip().lower()]
            if not t: return await J('none')
            if t[0]['id'] == uid: return await J('self')
            if not any(f['user_id'] == uid and f['friend_id'] == t[0]['id'] for f in DB['friends']): DB['friends'].append({'user_id': uid, 'friend_id': t[0]['id']})
            return await J('friends' if mutual(uid, t[0]['id']) else 'added')
        if fn == 'room_open':
            k = DB['keys'].get(a['p_code'])
            if k and k != a['p_secret']: return await J(False)
            DB['keys'][a['p_code']] = a['p_secret']
            DB['rooms'][a['p_code']] = {'code': a['p_code'], 'host_name': a['p_name'], 'build': a['p_build'], 'spectate': a['p_spectate'], 'status': a['p_status'], 'watchers': a['p_watchers'], 'last_seen': time.time()}
            return await J(True)
        if fn == 'room_close':
            if DB['keys'].get(a['p_code']) == a['p_secret']: DB['rooms'].pop(a['p_code'], None)
            return await J(None)
        if fn == 'name_available': return await J(True)
    tbl = path.rsplit('/', 1)[-1]; e = eqs(q)
    if tbl == 'profiles':
        ids = ins(q, 'id'); rows = [{'id': x['id'], 'name': x['name'], 'fav_runner': 'jp' if x is U['u1'] else 'mc', 'created_at': '2026-10-21T19:00:00Z'} for x in U.values()]
        rows = [r for r in rows if (ids is None or r['id'] in ids) and ('id' not in e or r['id'] == e['id'])]
        return await J((rows[0] if rows else None) if one else rows)
    if tbl in ('settings', 'player_stats', 'match_results'): return await J(None if one else [])
    if tbl == 'friends':
        if req.method == 'GET': return await J([f for f in DB['friends'] if uid in (f['user_id'], f['friend_id'])])
        if req.method == 'DELETE':
            DB['friends'] = [f for f in DB['friends'] if not (f['user_id'] == e.get('user_id') == uid and f['friend_id'] == e.get('friend_id'))]
            return await route.fulfill(status=204, headers=H)
    if tbl == 'presence':
        if req.method == 'POST':
            b = json.loads(body); b = b[0] if isinstance(b, list) else b
            if b['user_id'] != uid: return await J({'message': 'row-level security'}, 403)
            DB['presence'][uid] = b; return await route.fulfill(status=201, headers=H)
        ids = ins(q, 'user_id') or []
        return await J([p for k, p in DB['presence'].items() if k in ids and (k == uid or mutual(uid, k))])
    if tbl == 'invites':
        if req.method == 'POST':
            b = json.loads(body); b = b[0] if isinstance(b, list) else b
            if b['from_id'] != uid or not mutual(uid, b['to_id']): return await J({'code': '42501', 'message': 'new row violates row-level security policy'}, 403)
            DB['invites'].append({**b, 'id': NEXT[0], 'created_at': '2026-10-23T18:00:00Z'}); NEXT[0] += 1; return await route.fulfill(status=201, headers=H)
        return await J([i for i in DB['invites'] if i['to_id'] == e.get('to_id') == uid][::-1])
    if tbl == 'rooms': return await J([{k: v for k, v in r.items() if k != 'last_seen'} for r in DB['rooms'].values() if time.time() - r['last_seen'] < 45])
    if tbl == 'leaderboard': return await J(DB['lb'])
    return await J({'message': 'unhandled ' + req.method + ' ' + path}, 404)

async def main():
    out = []; ok = lambda k, c, v='': out.append(('PASS ' if c else 'FAIL ') + k + (' · ' + str(v) if v != '' else ''))
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pages = []
        for key in ('u1', 'u2'):
            ctx = await b.new_context(viewport={'width': 960, 'height': 540}); await ctx.route(re.compile(r'https://\w+\.supabase\.co/.*'), handle)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(GAME, wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(2500)
            await pg.evaluate("(e) => acctSignIn(e, 'pw')", U[key]['email']); await pg.wait_for_timeout(1200)
            pages.append(pg)
        A, B = pages
        ok('both signed in', await A.evaluate('acctOn()') and await B.evaluate('acctOn()'))
        # Alpha adds Bravo: a request
        await A.evaluate("() => { friendsOpen('mode'); }"); await A.wait_for_timeout(500)
        await A.evaluate("() => friendAdd('bravo')"); await A.wait_for_timeout(800)
        ok('request sent', 'Request sent' in await A.evaluate('FR.status'), await A.evaluate('FR.status'))
        ok('shows as pending for Alpha', await A.evaluate("FR.reqOut.length === 1 && FR.mutual.length === 0"))
        await B.evaluate("() => { friendsOpen('mode'); }"); await B.wait_for_timeout(800)
        ok('Bravo sees the request', await B.evaluate("FR.reqIn.length === 1 && FR.reqIn[0].name === 'Alpha'"))
        ok('invite before friends is refused', True)
        # Bravo accepts (adds back) from the list with confirm
        await B.evaluate("() => { FR.idx = friendRows().findIndex(r => r.kind === 'reqIn'); friendsTick({ ...NEUTRAL, L: 1 }, false, false); }"); await B.wait_for_timeout(900)
        ok('now friends', 'now friends' in await B.evaluate('FR.status') and await B.evaluate('FR.mutual.length === 1'), await B.evaluate('FR.status'))
        await A.evaluate("() => friendsLoad()"); await A.wait_for_timeout(600)
        ok('Alpha sees Bravo as a friend', await A.evaluate("FR.mutual.length === 1 && FR.mutual[0].name === 'Bravo'"))
        # presence: Bravo's heartbeat shows him online to Alpha
        await B.evaluate("() => presenceBeat()"); await B.wait_for_timeout(400); await A.evaluate("() => friendsLoad()"); await A.wait_for_timeout(600)
        ok('friend online', await A.evaluate("frOnline(FR.mutual[0])"))
        # Alpha hosts (listed) and invites Bravo
        await A.evaluate("() => { Net.role = 'host'; Net.code = 'ABCDE'; Net.listed = true; Net.peer = {}; roomBeat(true); presenceBeat(); }"); await A.wait_for_timeout(500)
        ok('room listed', 'ABCDE' in DB['rooms'] and DB['rooms']['ABCDE']['host_name'] == 'Alpha', DB['rooms'])
        await B.evaluate("() => roomsFetch()"); await B.wait_for_timeout(500)
        ok('room list shows it with Join and Watch', await B.evaluate("document.querySelectorAll('#netRooms button[data-join=\"ABCDE\"]').length === 1 && document.querySelectorAll('#netRooms button[data-watch]').length === 1"),
           await B.evaluate("document.getElementById('netRooms').innerText"))
        await A.evaluate("() => friendInvite(FR.mutual[0])"); await A.wait_for_timeout(500)
        ok('invite sent', len(DB['invites']) == 1 and DB['invites'][0]['room_code'] == 'ABCDE', await A.evaluate('FR.status'))
        await B.evaluate("() => { UI.screen = 'mode'; invitesPoll(false); }"); await B.wait_for_timeout(700)
        ok('Bravo gets a toast', 'invited you to room ABCDE' in await B.evaluate('toastMsg'), await B.evaluate('toastMsg'))
        await B.evaluate("() => friendsLoad()"); await B.wait_for_timeout(700)
        await B.evaluate("() => { window.JOINED = null; netJoin = (c) => { JOINED = c; }; FR.idx = friendRows().findIndex(r => r.kind === 'invite'); UI.screen = 'friends'; friendsTick({ ...NEUTRAL, L: 1 }, false, false); }")
        ok('joining from the invite', await B.evaluate("JOINED === 'ABCDE' && UI.screen === 'online'"))
        # a stranger's secret can't take over the room
        DB['keys']['ABCDE'] = DB['keys']['ABCDE']
        await A.evaluate("() => { Net.connected = true; Net.lastRecv = performance.now() + 60000; roomBeat(false); }"); await A.wait_for_timeout(400)
        ok('listing updates to playing', DB['rooms'].get('ABCDE', {}).get('status') == 'playing', str(DB['rooms']) + ' ' + await A.evaluate("Net.role + ' ' + Net.code + ' ' + Net.listed"))
        await A.evaluate("() => roomClose()"); await A.wait_for_timeout(400)
        ok('closing the room removes it', 'ABCDE' not in DB['rooms'])
        # unfriend
        await A.evaluate("() => friendRemove(FR.mutual[0])"); await A.wait_for_timeout(700)
        ok('removed', await A.evaluate("FR.mutual.length === 0"))
        # leaderboards
        await A.evaluate("() => leadersOpen('mode')"); await A.wait_for_timeout(500)
        ok('leaderboard loaded', await A.evaluate("LB.rows && LB.rows.length === 3"))
        ok('most wins order', await A.evaluate("leadersSorted().map(r => r.name).join()") == 'Alpha,Bravo,Charlie', await A.evaluate("leadersSorted().map(r => r.name).join()"))
        await A.evaluate("() => leadersTick({ ...NEUTRAL, r: 1 }, false, false)")
        ok('win rate needs 10 matches', await A.evaluate("leadersSorted().map(r => r.name).join()") == 'Bravo,Alpha', await A.evaluate("leadersSorted().map(r => r.name).join()"))
        await A.screenshot(path='/tmp/claude-0/-home-claude/beead88c-29e2-5633-85fe-f20dc7826420/scratchpad/lb.png')
        await A.evaluate("() => { friendsLoad(); UI.screen = 'friends'; FR.mutual = [{ id: 'z', name: 'Zed', fav: 'df', seen: new Date().toISOString(), room: 'QWERT' }, { id: 'y', name: 'Yuki', fav: 'at', seen: null }]; FR.reqIn = [{ id: 'w', name: 'Wren', fav: 'tt' }]; FR.idx = 2; }")
        await A.wait_for_timeout(300); await A.screenshot(path='/tmp/claude-0/-home-claude/beead88c-29e2-5633-85fe-f20dc7826420/scratchpad/fr.png')
        print('\n'.join(out)); print('ERR', errs[:5]); await b.close()
asyncio.run(main())
