// Optional accounts (Supabase): sign-in, profile, cloud save of settings and
// online match history. Doesn't touch the sim.
'use strict';

const SYNC_KEYS = ['umavs.controls', 'umavs.audio', 'umavs.settings', 'umavs.trials', 'umavs.picks', 'umavs.tutorial', 'umavs.arcade'];
const SYNC_AT_KEY = 'umavs.sync.at';
const ACCT = {
  on: false, client: null, user: null, profile: null, stats: null, recent: [],
  status: '', statusOk: true, busy: false, recFor: null, lastSnap: '', pushT: 0, pullDone: false,
  idx: 0, nameEdit: false,
};
const acctOn = () => ACCT.on && !!ACCT.user;
const acctName = () => (ACCT.profile && ACCT.profile.name) || null;

function acctSay(msg, ok = true) { ACCT.status = msg; ACCT.statusOk = ok; const el = document.getElementById('acStatus'); if (el) { el.textContent = msg; el.style.color = ok ? '#f6c343' : '#ff8a9a'; } }
function acctErr(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/fetch|network|Failed/i.test(m)) return "Couldn't reach the account server. Check your connection.";
  if (/Invalid login/i.test(m)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first, then sign in.';
  if (/already registered/i.test(m)) return 'That email already has an account. Try signing in.';
  if (/Password should be/i.test(m)) return 'Password must be at least 6 characters.';
  if (/profiles_name_unique|duplicate key/i.test(m)) return 'That name is taken.';
  if (/name_format/i.test(m)) return 'Names are 3–16 letters, numbers, spaces, _ . or -';
  if (/name_blocked/i.test(m)) return "That name isn't allowed. Please pick another.";
  if (/rate limit/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  return m;
}
const NAME_RE = /^[A-Za-z0-9_. -]{3,16}$/;

// ------------------------------------------------------------------ session
// supabase-js shares one browser lock between all tabs of the site, and waits for it forever. A frozen or
// background tab holding it left sign-in stuck on "Signing in…". Wait at most 4 s for the lock, then go ahead.
async function acctLock(name, timeout, fn) {
  if (typeof navigator === 'undefined' || !navigator.locks || !navigator.locks.request) return fn();
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 4000); let got = false;
  try { return await navigator.locks.request(name, { mode: 'exclusive', signal: ac.signal }, async () => { got = true; clearTimeout(t); return fn(); }); }
  catch (e) { clearTimeout(t); if (!got && e && e.name === 'AbortError') return fn(); throw e; }
}
// no account request may leave the panel waiting forever (a dropped connection, a stalled lock)
function acctTimeout(p, ms = 20000) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("The account service didn't answer. Check your connection and try again.")), ms))]);
}
function acctInit() {
  if (!ACCT_CFG.url || !ACCT_CFG.key || typeof supabase === 'undefined') return;
  try {
    ACCT.client = supabase.createClient(ACCT_CFG.url, ACCT_CFG.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'umavs.auth', detectSessionInUrl: location.protocol.startsWith('http'), lock: acctLock } });
    ACCT.on = true;
  } catch (e) { ACCT.on = false; return; }
  ACCT.client.auth.onAuthStateChange((ev, session) => {
    const u = session ? session.user : null, changed = (u && u.id) !== (ACCT.user && ACCT.user.id);
    ACCT.user = u;
    if (!u) { ACCT.profile = null; ACCT.stats = null; ACCT.recent = []; ACCT.pullDone = false; return; }
    if (changed) setTimeout(() => { acctRefresh(); acctPull(); }, 0);   // don't call the API inside the auth callback
  });
}
async function acctSignIn(email, pass) {
  if (!ACCT.on || ACCT.busy) return; ACCT.busy = true; acctSay('Signing in…');
  try { const { error } = await acctTimeout(ACCT.client.auth.signInWithPassword({ email: email.trim(), password: pass })); if (error) throw error; acctSay('Signed in.'); Sfx.play('ok'); return true; }
  catch (e) { acctSay(acctErr(e), false); Sfx.play('deny'); return false; } finally { ACCT.busy = false; }
}
async function acctSignUp(email, pass, name, fav) {
  if (!ACCT.on || ACCT.busy) return; name = name.trim();
  if (!NAME_RE.test(name)) { acctSay('Names are 3–16 letters, numbers, spaces, _ . or -', false); return false; }
  if (nameBlocked(name)) { acctSay("That name isn't allowed. Please pick another.", false); Sfx.play('deny'); return false; }
  if (pass.length < 6) { acctSay('Password must be at least 6 characters.', false); return false; }
  ACCT.busy = true; acctSay('Creating your account…');
  try {
    const { data: free, error: e1 } = await acctTimeout(ACCT.client.rpc('name_available', { n: name })); if (e1) throw e1;
    if (!free) { acctSay('That name is taken.', false); Sfx.play('deny'); return false; }
    const opts = { data: { name, fav_runner: fav } }; if (location.protocol.startsWith('http')) opts.emailRedirectTo = location.origin + location.pathname;
    const { data, error } = await acctTimeout(ACCT.client.auth.signUp({ email: email.trim(), password: pass, options: opts })); if (error) throw error;
    if (!data.session) { acctSay('Check your email for a confirmation link, then sign in.'); Sfx.play('ok'); return 'confirm'; }
    acctSay('Account created. Welcome, ' + name + '!'); Sfx.play('fanfare'); return true;
  } catch (e) { acctSay(acctErr(e), false); Sfx.play('deny'); return false; } finally { ACCT.busy = false; }
}
async function acctSignOut() {
  if (!ACCT.on) return; await acctPush(true);
  try { await acctTimeout(ACCT.client.auth.signOut(), 8000); } catch (e) { }
  ACCT.user = null; ACCT.profile = null; ACCT.stats = null; ACCT.recent = []; acctSay('Signed out.'); Sfx.play('back');
}
async function acctReset(email) {
  if (!ACCT.on || !email.trim()) { acctSay('Type your email first.', false); return; }
  try { const o = location.protocol.startsWith('http') ? { redirectTo: location.origin + location.pathname } : {};
    const { error } = await acctTimeout(ACCT.client.auth.resetPasswordForEmail(email.trim(), o)); if (error) throw error; acctSay('If that email has an account, a reset link is on its way.'); }
  catch (e) { acctSay(acctErr(e), false); }
}

// ------------------------------------------------------------------ profile + stats
async function acctRefresh() {
  if (!acctOn()) return; const id = ACCT.user.id, db = ACCT.client;
  try {
    const [p, s, r] = await Promise.all([
      db.from('profiles').select('name, fav_runner, created_at').eq('id', id).maybeSingle(),
      db.from('player_stats').select('*').eq('user_id', id).maybeSingle(),
      db.from('match_results').select('mode, my_runner, opp_runner, opp_name, won, rounds_won, rounds_lost, created_at').eq('user_id', id).eq('mode', 'online').order('created_at', { ascending: false }).limit(8)]);
    if (p.error) throw p.error;
    ACCT.profile = p.data; ACCT.stats = s.data || { games: 0, wins: 0, losses: 0, main_runner: null }; ACCT.recent = r.data || [];
  } catch (e) { acctSay(acctErr(e), false); }
}
async function acctSetFav(cid) {
  if (!acctOn() || !ACCT.profile) return; ACCT.profile.fav_runner = cid;
  const { error } = await ACCT.client.from('profiles').update({ fav_runner: cid }).eq('id', ACCT.user.id); if (error) acctSay(acctErr(error), false);
}
async function acctRename(name) {
  if (!acctOn()) return false; name = name.trim();
  if (!NAME_RE.test(name)) { acctSay('Names are 3–16 letters, numbers, spaces, _ . or -', false); return false; }
  if (nameBlocked(name)) { acctSay("That name isn't allowed. Please pick another.", false); Sfx.play('deny'); return false; }
  const { error } = await ACCT.client.from('profiles').update({ name }).eq('id', ACCT.user.id);
  if (error) { acctSay(acctErr(error), false); Sfx.play('deny'); return false; }
  ACCT.profile.name = name; acctSay('Name changed to ' + name + '.'); Sfx.play('ok'); return true;
}

// ------------------------------------------------------------------ cloud save
function acctSnap() { const o = {}; for (const k of SYNC_KEYS) { try { const v = localStorage.getItem(k); if (v !== null) o[k] = v; } catch (e) { } } return o; }
function acctApply(data) {
  for (const k of SYNC_KEYS) if (typeof data[k] === 'string') try { localStorage.setItem(k, data[k]); } catch (e) { }
  // reload everything that reads those keys
  try { loadControls(); } catch (e) { }
  try { Music.load(); } catch (e) { }
  try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { }
  try { trialDone = JSON.parse(localStorage.getItem(TRIAL_KEY) || '{}'); } catch (e) { }
  try { tutDone = JSON.parse(localStorage.getItem(TUT_KEY) || '[]'); } catch (e) { }
  try { ARC.rec = JSON.parse(localStorage.getItem(ARC_KEY) || '{}'); } catch (e) { }
}
async function acctPull() {
  if (!acctOn()) return;
  try {
    const { data, error } = await ACCT.client.from('settings').select('data, updated_at').eq('user_id', ACCT.user.id).maybeSingle(); if (error) throw error;
    const cloud = data && data.data && Object.keys(data.data).length ? data.data : null;
    if (cloud) { acctApply(cloud); acctSay('Settings loaded from your account.'); }
    else await acctPush(true);                        // first sign-in: this browser's settings become the account's
    ACCT.lastSnap = JSON.stringify(acctSnap()); ACCT.pullDone = true;
  } catch (e) { acctSay(acctErr(e), false); }
}
async function acctPush(force) {
  if (!acctOn()) return; const snap = acctSnap(), s = JSON.stringify(snap);
  if (!force && s === ACCT.lastSnap) return; ACCT.lastSnap = s;
  try { const { error } = await ACCT.client.from('settings').upsert({ user_id: ACCT.user.id, data: snap }); if (error) throw error; try { localStorage.setItem(SYNC_AT_KEY, String(Date.now())); } catch (e) { } }
  catch (e) { ACCT.lastSnap = ''; }
}

// ------------------------------------------------------------------ match history
function acctWho() { return acctOn() && ACCT.profile ? { id: ACCT.user.id, name: ACCT.profile.name, fav: ACCT.profile.fav_runner } : null; }
async function acctRecord() {
  const side = Net.side, me = G.p[side], them = G.p[1 - side], who = Net.theirWho;
  const row = { user_id: ACCT.user.id, mode: 'online', build: BUILD, my_runner: me.cid, opp_runner: them.cid,
    match_key: Net.matchKey || ('m' + Date.now()),
    opp_id: who && who.id ? who.id : null, opp_name: who && who.name ? who.name : 'Guest',
    won: me.wins > them.wins, rounds_won: Math.min(3, me.wins), rounds_lost: Math.min(3, them.wins), stage: G.stage || 0 };
  try {
    let { error } = await ACCT.client.from('match_results').insert(row);
    if (error && row.opp_id && !/duplicate/i.test(error.message)) { row.opp_id = null; ({ error } = await ACCT.client.from('match_results').insert(row)); }   // bad opp id, save without it
    if (error && !/duplicate/i.test(error.message)) throw error; acctRefresh(); }
  catch (e) { /* history is best-effort: never interrupt play */ }
}
function acctTick() {
  if (!acctOn()) return;
  // 2.0.2: record once the confirmed result has been on screen for 1.5 s with no desync (late checksums get time to arrive);
  // a desynced match is stopped and never recorded
  if (G.phase === 'match' && G.mode === 'online' && G.p.length && ACCT.recFor !== G.p[0] && Net.desync < 0 && netMatchConfirmedOver() && G.phaseT > 90) { ACCT.recFor = G.p[0]; acctRecord(); }
  if (ACCT.pullDone && ++ACCT.pushT % 600 === 0) acctPush(false);   // every 10s if something changed
}

// ------------------------------------------------------------------ the sign-in panel (DOM, for typing)
const AP = { tab: 'in', mode: 'form' };   // mode: form (signed out) | rename | off
function acctPanel(mode) {
  const $ = id => document.getElementById(id);
  AP.mode = mode; $('acct').classList.toggle('hidden', !mode);
  if (!mode) { if (document.activeElement && $('acct').contains(document.activeElement)) document.activeElement.blur(); return; }
  $('acOff').classList.toggle('hidden', mode !== 'off'); $('acForm').classList.toggle('hidden', mode !== 'form'); $('acRename').classList.toggle('hidden', mode !== 'rename');
  $('acTitle').textContent = mode === 'rename' ? 'CHANGE NAME' : 'ACCOUNT';
  acctSay(ACCT.status, ACCT.statusOk);
  if (mode === 'rename') { $('acNewName').value = acctName() || ''; setTimeout(() => $('acNewName').focus(), 0); }
  if (mode === 'form') { acctTab(AP.tab); setTimeout(() => $('acEmail').focus(), 0); }
}
function acctTab(t) {
  const $ = id => document.getElementById(id); AP.tab = t;
  $('acTabIn').className = t === 'in' ? 'on' : 'ghost'; $('acTabUp').className = t === 'up' ? 'on' : 'ghost';
  $('acUpOnly').classList.toggle('hidden', t !== 'up'); $('acForgot').classList.toggle('hidden', t !== 'in');
  $('acGo').textContent = t === 'in' ? 'Sign in' : 'Create account';
  $('acPass').autocomplete = t === 'in' ? 'current-password' : 'new-password';
}
function acctLeave() {   // Back / Esc from the account screen
  if (AP.mode === 'rename') { acctPanel(null); Sfx.play('back'); return; }
  acctPanel(null); UI.screen = 'mode'; Sfx.play('back');
}
function initAcctPanel() {
  const $ = id => document.getElementById(id);
  $('acFav').innerHTML = ROSTER.map(c => `<option value="${c}">${CHARS[c].name.replace('Mcqueen', 'McQueen').replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase()).replace('Mcqueen', 'McQueen')}</option>`).join('');
  for (const el of $('acct').querySelectorAll('input,select,button')) {
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); acctLeave(); } });
    el.addEventListener('keyup', e => e.stopPropagation());
  }
  $('acTabIn').onclick = () => { acctTab('in'); Sfx.play('menu'); };
  $('acTabUp').onclick = () => { acctTab('up'); Sfx.play('menu'); };
  const go = async () => {
    $('acGo').disabled = true;
    const r = AP.tab === 'in' ? await acctSignIn($('acEmail').value, $('acPass').value) : await acctSignUp($('acEmail').value, $('acPass').value, $('acName').value, $('acFav').value);
    $('acGo').disabled = false;
    if (r === true) { $('acPass').value = ''; acctPanel(null); }
    if (r === 'confirm') { acctTab('in'); $('acPass').value = ''; }
  };
  $('acGo').onclick = go;
  for (const id of ['acEmail', 'acPass', 'acName']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  $('acForgot').onclick = () => acctReset($('acEmail').value);
  const save = async () => { if (await acctRename($('acNewName').value)) acctPanel(null); };
  $('acSaveName').onclick = save; $('acNewName').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  $('acBack').onclick = acctLeave;
}
// entering the screen from the main menu
function acctOpen() { UI.screen = 'account'; ACCT.idx = 0; ACCT.status = ''; if (!ACCT.on) acctPanel('off'); else if (!ACCT.user) acctPanel('form'); else { acctPanel(null); acctRefresh(); } }
// signed-in screen: gamepad / keyboard rows
const ACCT_ROWS = ['fav', 'name', 'friends', 'leaders', 'sync', 'out', 'back'];
// Gamepad on the sign-in / rename panel: up/down picks a control, A presses it (or puts the cursor in a text box),
// B always goes back. Before this a pad could get stuck there: the email box takes focus, and B (H) was ignored
// while a text box had focus, so only the keyboard's Esc got out.
const APP = { i: 0 };
function acctPanelPad(e) {
  if (!Object.values(e).some(Boolean)) return;
  if (e.H) { acctLeave(); return; }
  const items = [...document.querySelectorAll('#acct button, #acct input, #acct select')].filter(el => el.offsetParent !== null && !el.disabled);
  if (!items.length) return;
  APP.i = Math.min(APP.i, items.length - 1);
  if (e.u || e.d) { APP.i = (APP.i + (e.d ? 1 : items.length - 1)) % items.length; Sfx.play('menu'); }
  const el = items[APP.i];
  if ((e.l || e.r) && el.tagName === 'SELECT') { el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + (e.r ? 1 : -1))); Sfx.play('menu'); }
  if (e.L || e.S) { if (el.tagName === 'BUTTON') { el.click(); Sfx.play('ok'); } else el.focus(); }
  else if (e.u || e.d) { if (document.activeElement && document.activeElement !== el) document.activeElement.blur(); }
  items.forEach((x, k) => x.classList.toggle('padfocus', k === APP.i));
}
function acctScreenTick(e, enter, esc, pe) {
  if (AP.mode) { if (pe) acctPanelPad(pe); if (esc || (e.H && !document.activeElement.matches('#acct input, #acct select'))) acctLeave(); return; }   // the panel handles typing itself
  if (!ACCT.user) { acctPanel(ACCT.on ? 'form' : 'off'); return; }
  if (e.u) { ACCT.idx = (ACCT.idx + ACCT_ROWS.length - 1) % ACCT_ROWS.length; Sfx.play('menu'); }
  if (e.d) { ACCT.idx = (ACCT.idx + 1) % ACCT_ROWS.length; Sfx.play('menu'); }
  const row = ACCT_ROWS[ACCT.idx];
  if (row === 'fav' && (e.l || e.r) && ACCT.profile) { const i = ROSTER.indexOf(ACCT.profile.fav_runner); acctSetFav(ROSTER[(i + (e.r ? 1 : ROSTER.length - 1)) % ROSTER.length]); Sfx.play('menu'); }
  if (e.L || e.S || enter) {
    if (row === 'name') { Sfx.play('ok'); acctPanel('rename'); }
    if (row === 'friends') { Sfx.play('ok'); friendsOpen('account'); }
    if (row === 'leaders') { Sfx.play('ok'); leadersOpen('account'); }
    if (row === 'sync') { Sfx.play('ok'); acctSay('Saving…'); acctPush(true).then(() => acctSay('Settings saved to your account.')); }
    if (row === 'out') acctSignOut();
    if (row === 'back') acctLeave();
  }
  if (esc || e.H) acctLeave();
}
