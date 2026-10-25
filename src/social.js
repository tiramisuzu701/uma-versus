// Friends (mutual: you both add each other), presence, room invites and leaderboards. All of it goes
// through the Supabase client from account.js and is best-effort: nothing here can interrupt a match.
'use strict';

const FR = { mutual: [], reqIn: [], reqOut: [], invites: [], idx: 0, status: '', ok: true, back: 'mode', loading: false, seenInv: new Set(), beatT: 0, pollT: 0 };
const ONLINE_MS = 75 * 1000;
function frSay(s, ok = true) { FR.status = s; FR.ok = ok; }
function frOnline(f) { return f.seen && Date.now() - new Date(f.seen).getTime() < ONLINE_MS; }

async function friendsLoad() {
  if (!acctOn()) return;
  const db = ACCT.client, me = ACCT.user.id; FR.loading = true;
  try {
    const { data: rows, error } = await db.from('friends').select('user_id, friend_id').or(`user_id.eq.${me},friend_id.eq.${me}`);
    if (error) throw error;
    const mine = new Set(rows.filter(r => r.user_id === me).map(r => r.friend_id)), theirs = new Set(rows.filter(r => r.friend_id === me).map(r => r.user_id));
    const ids = [...new Set([...mine, ...theirs])];
    const prof = {}, pres = {};
    if (ids.length) {
      const [p, s] = await Promise.all([db.from('profiles').select('id, name, fav_runner').in('id', ids), db.from('presence').select('user_id, last_seen, room_code').in('user_id', ids)]);
      for (const r of (p.data || [])) prof[r.id] = r;
      for (const r of (s.data || [])) pres[r.user_id] = r;
    }
    const mk = id => ({ id, name: (prof[id] && prof[id].name) || '?', fav: (prof[id] && prof[id].fav_runner) || 'spe', seen: pres[id] && pres[id].last_seen, room: pres[id] && pres[id].room_code });
    FR.mutual = ids.filter(id => mine.has(id) && theirs.has(id)).map(mk).sort((a, b) => frOnline(b) - frOnline(a) || a.name.localeCompare(b.name));
    FR.reqIn = ids.filter(id => theirs.has(id) && !mine.has(id)).map(mk);
    FR.reqOut = ids.filter(id => mine.has(id) && !theirs.has(id)).map(mk);
    await invitesPoll(true);
  } catch (e) { frSay(acctErr(e), false); }
  FR.loading = false;
}
async function friendAdd(name) {
  if (!acctOn()) return; name = (name || '').trim();
  if (!name) { frSay('Type their display name first.', false); return; }
  try {
    const { data, error } = await ACCT.client.rpc('add_friend', { n: name }); if (error) throw error;
    if (data === 'none') frSay(`Nobody is called "${name}".`, false);
    else if (data === 'self') frSay('That\'s you!', false);
    else if (data === 'friends') { frSay(`You and ${name} are now friends.`); Sfx.play('fanfare'); }
    else { frSay(`Request sent. Once ${name} adds you back, you're friends.`); Sfx.play('ok'); }
    friendsLoad();
  } catch (e) { frSay(acctErr(e), false); }
}
async function friendRemove(f) {
  try { const { error } = await ACCT.client.from('friends').delete().eq('user_id', ACCT.user.id).eq('friend_id', f.id); if (error) throw error; frSay(`Removed ${f.name}.`); friendsLoad(); }
  catch (e) { frSay(acctErr(e), false); }
}
async function friendInvite(f) {
  if (!(Net.role === 'host' && Net.code && Net.code !== 'LOCAL')) { frSay('Host a room first (Online → Host a room), then invite.', false); return; }
  try { const { error } = await ACCT.client.from('invites').insert({ from_id: ACCT.user.id, to_id: f.id, room_code: Net.code }); if (error) throw error; frSay(`Invited ${f.name} to room ${Net.code}.`); Sfx.play('ok'); }
  catch (e) { frSay(acctErr(e), false); }
}
function joinRoom(code) { acctPanel(null); friendPanel(false); UI.screen = 'online'; showNetPanel(); netJoin(code, false); }

// presence every 30 s, invites every 10 s (only while signed in)
function socialTick() {
  if (!acctOn()) return;
  if (++FR.beatT % 1800 === 1) presenceBeat();
  if (++FR.pollT % 600 === 300) invitesPoll(false);
}
function presenceBeat() {
  if (!acctOn()) return;
  const room = Net.role === 'host' && Net.code && Net.code !== 'LOCAL' ? Net.code : null;
  ACCT.client.from('presence').upsert({ user_id: ACCT.user.id, last_seen: new Date().toISOString(), room_code: room }).then(() => { }, () => { });
}
async function invitesPoll(quiet) {
  if (!acctOn()) return;
  try {
    const { data, error } = await ACCT.client.from('invites').select('id, from_id, room_code, created_at').eq('to_id', ACCT.user.id).order('created_at', { ascending: false }).limit(10);
    if (error) throw error;
    const names = {}; for (const f of [...FR.mutual, ...FR.reqIn]) names[f.id] = f.name;
    const missing = [...new Set(data.map(i => i.from_id).filter(id => !names[id]))];
    if (missing.length) { const { data: p } = await ACCT.client.from('profiles').select('id, name').in('id', missing); for (const r of (p || [])) names[r.id] = r.name; }
    FR.invites = data.map(i => ({ ...i, name: names[i.from_id] || 'A friend' }));
    for (const i of FR.invites) if (!FR.seenInv.has(i.id)) {
      FR.seenInv.add(i.id);
      if (!quiet && UI.screen !== 'game') { toast(`${i.name} invited you to room ${i.room_code}. Online → Friends to join`); Sfx.play('power'); }
    }
  } catch (e) { }
}

// ---------------------------------------------------------------- friends screen
function friendRows() {
  const rows = [{ kind: 'add' }];
  for (const i of FR.invites) rows.push({ kind: 'invite', i });
  for (const f of FR.mutual) rows.push({ kind: 'friend', f });
  for (const f of FR.reqIn) rows.push({ kind: 'reqIn', f });
  for (const f of FR.reqOut) rows.push({ kind: 'reqOut', f });
  rows.push({ kind: 'back' });
  return rows;
}
function friendsOpen(back) {
  FR.back = back || 'mode'; FR.idx = 0; FR.status = '';
  UI.screen = 'friends';
  if (!acctOn()) { frSay(ACCT.on ? 'Sign in (main menu → Account) to add friends.' : 'Friends need the online service, which isn\'t available in this copy.', false); return; }
  friendsLoad(); presenceBeat();
}
function friendsLeave() { friendPanel(false); UI.screen = FR.back; if (FR.back === 'online') showNetPanel(); Sfx.play('back'); }
function friendPanel(on) {
  const el = document.getElementById('friendAdd'); if (!el) return;
  el.classList.toggle('hidden', !on);
  if (on) { const i = document.getElementById('frName'); i.value = ''; setTimeout(() => i.focus(), 0); }
  else if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
}
function initFriendPanel() {
  const $ = id => document.getElementById(id);
  const go = () => { friendAdd($('frName').value); friendPanel(false); };
  $('frGo').onclick = go;
  $('frCancel').onclick = () => friendPanel(false);
  $('frName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') friendPanel(false); });
  $('frName').addEventListener('keyup', e => e.stopPropagation());
}
function friendsTick(e, enter, esc) {
  if (!document.getElementById('friendAdd').classList.contains('hidden')) return;   // typing a name
  const rows = friendRows(); FR.idx = Math.min(FR.idx, rows.length - 1);
  if (e.u) { FR.idx = (FR.idx + rows.length - 1) % rows.length; Sfx.play('menu'); }
  if (e.d) { FR.idx = (FR.idx + 1) % rows.length; Sfx.play('menu'); }
  const r = rows[FR.idx];
  if (e.L || e.S || enter) {
    if (r.kind === 'back') return friendsLeave();
    if (!acctOn()) return;
    Sfx.play('ok');
    if (r.kind === 'add') friendPanel(true);
    if (r.kind === 'invite') joinRoom(r.i.room_code);
    if (r.kind === 'friend') { if (r.f.room && frOnline(r.f)) joinRoom(r.f.room); else friendInvite(r.f); }
    if (r.kind === 'reqIn') friendAdd(r.f.name);
    if (r.kind === 'reqOut') friendRemove(r.f);
  }
  if (e.M && r.kind === 'friend') friendRemove(r.f);
  if (e.M && r.kind !== 'friend') friendsLoad();
  if (esc || e.H) friendsLeave();
}
function drawFriends() {
  menuBg(0.8);
  topBar('FRIENDS', acctOn() ? acctName() : 'signed out');
  const rows = friendRows(), top = Math.max(0, Math.min(FR.idx - 6, rows.length - 11));
  panel(40, 56, 880, 420, PAL.turf);
  rows.slice(top, top + 11).forEach((r, k) => {
    const i = top + k, y = 70 + k * 36, s = i === FR.idx, x = 56 + (s ? 8 : 0);
    rowSlant(x, y, 840, 30, 10, s, 'rgba(34,17,60,.7)');
    const ink = s ? PAL.ink : '#fff', dim = s ? '#5e4c80' : PAL.dim;
    if (r.kind === 'add') { label('+  Add a friend by display name', x + 16, y + 15, 18, s ? PAL.ink : PAL.gold, 'left', 900, true); return; }
    if (r.kind === 'back') { label('Back', x + 16, y + 15, 18, s ? PAL.ink : PAL.gold, 'left', 900, true); return; }
    if (r.kind === 'invite') {
      rrect(x + 10, y + 5, 64, 20, 4, PAL.rose); label('INVITE', x + 42, y + 15, 12, '#fff', 'center', 900, true);
      label(`${r.i.name} invited you to room ${r.i.room_code}`, x + 86, y + 15, 17, ink, 'left', 800, true);
      label('confirm to join', x + 826, y + 15, 13, dim, 'right', 700); return;
    }
    const f = r.f, on = r.kind === 'friend' && frOnline(f);
    face(f.fav, 0, x + 10, y + 1, 28);
    label(f.name, x + 46, y + 15, 18, ink, 'left', 900, true);
    let st, act;
    if (r.kind === 'friend') {
      st = on ? (f.room ? `online · hosting ${f.room}` : 'online') : 'offline';
      act = on && f.room ? 'confirm: join their room' : (Net.role === 'host' && Net.code && Net.code !== 'LOCAL') ? `confirm: invite to ${Net.code}` : 'host a room to invite';
      ctx.fillStyle = on ? '#3ddc84' : '#6a7090'; ctx.beginPath(); ctx.arc(x + 260, y + 15, 5, 0, 7); ctx.fill();
    } else if (r.kind === 'reqIn') { st = 'added you'; act = 'confirm: add back'; }
    else { st = 'request sent'; act = 'confirm: cancel request'; }
    label(st, x + 272, y + 15, 14, on ? (s ? '#1d7a3e' : '#7dff9a') : dim, 'left', 700, true);
    label(act + (r.kind === 'friend' ? '   ·   M: remove' : ''), x + 826, y + 15, 13, dim, 'right', 700);
  });
  if (FR.loading) label('loading…', W - 60, 486, 13, PAL.dim, 'right', 700);
  if (FR.status) label(FR.status, W / 2, 492, 15, FR.ok ? PAL.gold : '#ff8a9a', 'center', 700);
  hintBar('↑ ↓ choose    ·    F / Enter confirm    ·    M remove / refresh    ·    Esc back');
}

// ---------------------------------------------------------------- leaderboards
// counts only online matches both players recorded (see supabase/003)
const LB = { rows: null, tab: 0, idx: 0, status: '', back: 'mode' };
const LB_TABS = [['MOST WINS', 'wins'], ['WIN RATE', 'win_rate'], ['MOST MATCHES', 'games']];
function leadersOpen(back) {
  LB.back = back || 'mode'; LB.rows = null; LB.idx = 0; LB.status = 'loading…'; UI.screen = 'leaders';
  if (!ACCT.client) { LB.status = 'Leaderboards need the online service, which isn\'t available in this copy.'; return; }
  ACCT.client.from('leaderboard').select('user_id, name, games, wins, win_rate, main_runner').order('wins', { ascending: false }).limit(200)
    .then(({ data, error }) => { if (error) throw error; LB.rows = data || []; LB.status = LB.rows.length ? '' : 'No ranked matches yet. Play online while signed in!'; })
    .catch(e => { LB.status = acctErr(e); });
}
function leadersSorted() {
  if (!LB.rows) return [];
  const k = LB_TABS[LB.tab][1];
  return LB.rows.filter(r => k !== 'win_rate' || r.games >= 10).slice().sort((a, b) => b[k] - a[k] || b.games - a.games);
}
function leadersTick(e, enter, esc) {
  const rows = leadersSorted();
  if (e.l || e.r) { LB.tab = (LB.tab + (e.r ? 1 : LB_TABS.length - 1)) % LB_TABS.length; LB.idx = 0; Sfx.play('menu'); }
  if (e.u) LB.idx = Math.max(0, LB.idx - 1);
  if (e.d) LB.idx = Math.min(Math.max(0, rows.length - 1), LB.idx + 1);
  if (esc || e.H || ((e.L || e.S || enter) && !rows.length)) { UI.screen = LB.back; if (LB.back === 'online') showNetPanel(); Sfx.play('back'); }
}
function drawLeaders() {
  menuBg(0.82);
  topBar('LEADERBOARDS', 'online matches both players recorded');
  LB_TABS.forEach(([t], k) => { const s = k === LB.tab; slant(250 + k * 160, 52, 150, 30, 8, s ? PAL.gold : 'rgba(255,255,255,.08)'); label(t, 325 + k * 160, 68, 16, s ? PAL.ink : '#ddd2f0', 'center', 900, true); });
  panel(40, 92, 880, 400, PAL.gold);
  const rows = leadersSorted(), me = acctOn() ? ACCT.user.id : null, top = Math.max(0, Math.min(LB.idx - 5, rows.length - 11));
  const cols = [['#', 70], ['RUNNER', 110], ['NAME', 170], ['WINS', 560], ['MATCHES', 660], ['WIN RATE', 770], ['MAIN', 860]];
  cols.forEach(([t, x]) => label(t, x, 110, 13, PAL.gold, x >= 560 ? 'center' : 'left', 900, true));
  rows.slice(top, top + 11).forEach((r, k) => {
    const i = top + k, y = 128 + k * 32, mine = r.user_id === me, s = i === LB.idx;
    slant(56, y, 848, 28, 8, s ? 'rgba(255,255,255,.14)' : mine ? 'rgba(246,195,67,.16)' : 'rgba(255,255,255,.04)');
    const medal = ['#f6c343', '#c9cfe0', '#d08a4a'][i];
    if (medal) { ctx.fillStyle = medal; ctx.beginPath(); ctx.arc(78, y + 14, 11, 0, 7); ctx.fill(); }
    label(String(i + 1), 78, y + 15, 14, medal ? PAL.ink : '#fff', 'center', 900, true);
    if (CHARS[r.main_runner]) face(r.main_runner, 0, 110, y, 28);
    label(r.name + (mine ? '  (you)' : ''), 170, y + 15, 18, mine ? PAL.gold : '#fff', 'left', 900, true);
    label(String(r.wins), 560, y + 15, 17, '#fff', 'center', 800, true);
    label(String(r.games), 660, y + 15, 17, '#fff', 'center', 800, true);
    label(r.win_rate + '%', 770, y + 15, 17, '#fff', 'center', 800, true);
    label(CHARS[r.main_runner] ? CHARS[r.main_runner].short : '', 860, y + 15, 14, PAL.dim, 'center', 800, true);
  });
  if (LB.status) label(LB.status, W / 2, 300, 17, '#d9cdef', 'center', 700);
  if (LB.tab === 1 && LB.rows) label('Win rate counts players with 10 or more ranked matches.', W / 2, 484, 13, PAL.dim, 'center', 600);
  hintBar('← → board    ·    ↑ ↓ scroll    ·    Esc back');
}
