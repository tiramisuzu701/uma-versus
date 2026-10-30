// Rollback netcode over PeerJS (WebRTC).
//
// Each side only sends inputs, one byte per frame, with some redundancy. If the
// other side's input for a frame hasn't arrived we assume it's the same as their
// last one and keep going. When the real input shows up and doesn't match, we
// restore the snapshot from that frame and re-simulate to the present.
// Checksums of confirmed frames are compared every 30 frames to catch desyncs.
'use strict';

const NET_PREFIX = 'umavs-proto-';
const RING = 40;          // snapshots kept
const MAX_RB = 10;        // max frames we run ahead of confirmed remote input
const CS_EVERY = 30;

// ------------------------------------------------------------------ input bytes
const encIn = i => (i.u ? 1 : 0) | (i.d ? 2 : 0) | (i.l ? 4 : 0) | (i.r ? 8 : 0) | (i.L ? 16 : 0) | (i.M ? 32 : 0) | (i.H ? 64 : 0) | (i.S ? 128 : 0) | (i.C ? 256 : 0);
const decIn = n => ({ u: n & 1, d: (n >> 1) & 1, l: (n >> 2) & 1, r: (n >> 3) & 1, L: (n >> 4) & 1, M: (n >> 5) & 1, H: (n >> 6) & 1, S: (n >> 7) & 1, C: (n >> 8) & 1 });

// ------------------------------------------------------------------ snapshots
const P_SKIP = new Set(['c', 'ai', 'trail', 'dispHp', 'redHp']);
function snapFighter(p) {
  const o = {};
  for (const k of Object.keys(p)) {
    if (P_SKIP.has(k)) continue;
    const v = p[k];
    if (k === 'move') o.move = v ? v.id : null;
    else if (Array.isArray(v)) o[k] = v.slice();
    else if (v && typeof v === 'object') o[k] = { ...v };
    else o[k] = v;
  }
  return o;
}
function loadFighter(p, o) {
  for (const k of Object.keys(p)) if (!P_SKIP.has(k) && !(k in o)) delete p[k];
  for (const k in o) {
    const v = o[k];
    if (k === 'move') p.move = v ? p.c.moves[v] : null;
    else if (Array.isArray(v)) p[k] = v.slice();
    else if (v && typeof v === 'object') p[k] = { ...v };
    else p[k] = v;
  }
}
const G_KEYS = ['freeze', 'flashT', 'cam', 'phase', 'phaseT', 'round', 'timer', 'timerSub', 'slow', 'frameCount', 'koType', 'roundWinner', 'posed'];
function snapshot() {
  const s = { rs, p: G.p.map(snapFighter), projs: G.projs.map(q => ({ ...q })), flash: G.flashOwner ? G.flashOwner.side : -1 };
  for (const k of G_KEYS) s[k] = G[k];
  return s;
}
function restore(s) {
  rs = s.rs;
  G.p.forEach((p, i) => loadFighter(p, s.p[i]));
  G.projs = s.projs.map(q => ({ ...q }));
  G.flashOwner = s.flash >= 0 ? G.p[s.flash] : null;
  for (const k of G_KEYS) G[k] = s[k];
}
function checksum() {
  let h = 2166136261 ^ rs;
  const mix = v => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
  for (const p of G.p) {
    mix(Math.round(p.x * 64)); mix(Math.round(p.y * 64)); mix(p.hp); mix(p.t); mix(Math.round(p.meter * 64));
    for (let i = 0; i < p.state.length; i++) mix(p.state.charCodeAt(i));
    if (p.c.puppet) { mix(Math.round(p.pupX * 64)); mix(Math.round(p.pupY * 64)); mix(p.pupT); mix(p.pupCd); }
  }
  mix(G.timer); mix(G.projs.length); mix(G.freeze);
  return h >>> 0;
}

// ------------------------------------------------------------------ state
const Net = {
  peer: null, conn: null, bc: null, transport: null, role: null, side: 0, connected: false,
  status: '', code: '', delay: 2, inbox: [], lastRecv: 0, ping: 0, pingT: 0,
  // lobby
  myPick: 0, myReady: false, theirPick: 1, theirReady: false, myPal: 0, theirPal: 0, start: null, lobbyT: 0, stage: 0, theirStage: 0, music: null, theirMusic: null, focus: 0,
  // match
  matchId: 0, F: 0, local: [], remote: [], pred: [], snaps: [], rb: null, remoteMax: -1, ack: -1, remoteF: 0,
  rbFrames: 0, rbMax: 0, stalls: 0, waiting: false, csMine: {}, csTheirs: {}, csNext: 0, desync: -1, menu: false, rbSum: 0, rbN: 0,
  // room browser + spectators (host side): specs are extra connections that only receive confirmed inputs
  listed: true, spectate: true, region: '', regionRpc: undefined, specs: [], secret: '', listT: 0, rooms: [], roomsAt: 0, statsOn: false,
  // test-only fake network conditions (?lag=80&jitter=20&loss=0.05)
  sim: (() => { const q = new URLSearchParams(location.search); return { lag: +q.get('lag') || 0, jitter: +q.get('jitter') || 0, loss: +q.get('loss') || 0 }; })(),
};

function netSend(obj) {
  const go = () => {
    try {
      if (Net.transport === 'bc' && Net.bc) Net.bc.postMessage({ from: Net.role, ...obj });
      else if (Net.conn && Net.conn.open) Net.conn.send(obj);
    } catch (e) { /* channel closing */ }
  };
  const S = Net.sim;
  if (S.loss && Math.random() < S.loss && obj.t === 'in') return;
  if (S.lag || S.jitter) setTimeout(go, S.lag + Math.random() * S.jitter); else go();
}

function netBye() { for (let i = 0; i < 3; i++) netSend({ t: 'bye' }); }   // the match channel doesn't resend, so say it three times
function setStatus(s) { Net.status = s; const el = document.getElementById('netStatus'); if (el) el.textContent = s; }
// STUN servers find each player's public address; the PeerJS TURN relays are the fallback when a direct
// connection can't be made (strict NATs, some school/work networks). More STUN servers = fewer failed joins.
const ICE = { iceServers: [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }],
  sdpSemantics: 'unified-plan' };
const PEER_OPTS = { debug: 1, config: ICE };
function randCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }

// ------------------------------------------------------------------ connecting
function netHost(local) {
  netClose(true);
  Net.role = 'host'; Net.side = 0;
  if (local) {
    Net.transport = 'bc'; Net.bc = new BroadcastChannel('umavs-local');
    Net.bc.onmessage = e => { if (e.data.from !== Net.role) netRecv(e.data); };
    Net.code = 'LOCAL'; setStatus('Hosting on this computer. In another tab, tick Same computer and press Join.'); { const pr = document.getElementById('netPracticeRow'); if (pr) pr.classList.remove('hidden'); }
    return;
  }
  if (typeof Peer === 'undefined') { setStatus('PeerJS failed to load.'); return; }
  Net.transport = 'peer';
  // The public signalling server is sometimes slow to answer. If it hasn't opened the room in 8 s, try again with a
  // new code (up to 3 times) rather than sitting on "Creating room…"; a lost signalling connection is reopened too.
  let tries = 0;
  const tryOpen = () => {
    if (++tries > 4) { setStatus('Couldn\'t reach the online service. Check your connection and press Host again.'); netLog('host failed', { tries: tries - 1 }); return; }
    Net.code = randCode();
    setStatus(tries > 1 ? `Creating room… (try ${tries} of 4)` : 'Creating room…');
    const peer = new Peer(NET_PREFIX + Net.code, PEER_OPTS);
    Net.peer = peer;
    const slow = setTimeout(() => { if (Net.peer === peer && !peer.open && !Net.connected) { netLog('host slow', { tries }); Net.peer = null; peer.destroy(); tryOpen(); } }, 8000);
    peer.on('open', () => { clearTimeout(slow); setStatus(hostReadyText()); showCode(Net.code); roomBeat(true); });
    peer.on('connection', conn => {
      if (conn.metadata && conn.metadata.watch) { if (!Net.spectate || Net.specs.length >= 4) { conn.on('open', () => conn.close()); return; } bindSpec(conn); return; }
      if (Net.conn && (Net.connected || Net.conn.open)) { conn.close(); return; }   // room's full
      if (Net.conn) { const old = Net.conn; Net.conn = null; try { old.close(); } catch (e) { } }   // a guest retrying a join that never opened
      bindConn(conn);
    });
    peer.on('error', e => {
      if (Net.peer !== peer) return;
      if (e.type === 'unavailable-id') { clearTimeout(slow); Net.peer = null; peer.destroy(); tryOpen(); }
      else { setStatus('Network error: ' + (e.type || e.message || e)); netLog('host error', { type: e.type || String(e) }); }
    });
    peer.on('disconnected', () => {   // the room still works for a joined friend; reopen it so new joins and the listing keep working
      if (Net.peer !== peer || peer.destroyed) return;
      netLog('signalling lost', { connected: Net.connected });
      try { peer.reconnect(); } catch (e) { if (!Net.connected) setStatus('Lost the signalling server. Try hosting again.'); }
    });
  };
  tryOpen();
}
function netJoin(code, local) {
  netClose(true);
  Net.role = 'guest'; Net.side = 1;
  if (local) {
    Net.transport = 'bc'; Net.bc = new BroadcastChannel('umavs-local');
    Net.bc.onmessage = e => { if (e.data.from !== Net.role) netRecv(e.data); };
    Net.code = 'LOCAL'; setStatus('Looking for a host tab on this computer…');
    netSend({ t: 'hello' });
    Net.helloTimer = setInterval(() => { if (!Net.connected) netSend({ t: 'hello' }); else clearInterval(Net.helloTimer); }, 300);
    return;
  }
  if (typeof Peer === 'undefined') { setStatus('PeerJS failed to load.'); return; }
  code = (code || '').trim().toUpperCase();
  if (code.length < 4) { setStatus('Enter the room code your friend gave you.'); return; }
  Net.transport = 'peer'; Net.code = code;
  setStatus('Connecting…');
  const peer = new Peer(undefined, PEER_OPTS);
  Net.peer = peer;
  // The first offer sometimes gets lost on the way through the signalling server; if the connection hasn't opened
  // after 6 s, ask again (twice) before telling the player it's stuck.
  let attempt = 0;
  const dial = () => {
    if (Net.peer !== peer || Net.connected) return;
    attempt++;
    if (Net.conn) { const old = Net.conn; Net.conn = null; try { old.close(); } catch (e) { } }
    const conn = peer.connect(NET_PREFIX + code, { reliable: false, serialization: 'json' });
    bindConn(conn);
    if (attempt > 1) { setStatus(`Connecting… (try ${attempt} of 3)`); netLog('join retry', { attempt }); }
    setTimeout(() => {
      if (Net.connected || Net.peer !== peer) return;
      if (attempt < 3) dial(); else setStatus('Still connecting. Check the code. Some school and work networks block this.');
    }, 6000);
  };
  peer.on('open', dial);
  peer.on('error', e => setStatus(e.type === 'peer-unavailable' ? `No room called ${code}.` : 'Network error: ' + (e.type || e.message || e)));
}
function bindConn(conn) {
  Net.conn = conn;   // events from a connection that has been replaced (a retried join) are ignored
  conn.on('open', () => { if (Net.conn === conn) onConnected(); });
  conn.on('data', d => { if (Net.conn === conn) netRecv(d); });
  conn.on('close', () => { if (Net.conn === conn) onDisconnected('Opponent disconnected.'); });
  conn.on('error', e => { if (Net.conn === conn) onDisconnected('Connection error.'); });
}
// Training while your room waits for an opponent: the room stays open and listed, and the match lobby opens
// as soon as someone joins.
function netPractice() {
  if (Net.role !== 'host' || Net.connected) return;
  hideNetPanel();
  const picks = lastPicks('training'); UI.pendingMode = 'training'; const ok = i => i >= 0 && i < ROSTER.length; UI.sel = [ok(Net.myPick) ? Net.myPick : ok(picks[0]) ? picks[0] : 0, ok(picks[1]) ? picks[1] : 1]; UI.pal = [Net.myPal || 0, 0]; UI.vsStage = Net.stage || 0;
  beginLocalMatch(); Net.practice = true; toast('Practising · your room stays open. The match lobby opens when someone joins.');
}
function netPracticeEnd() { if (!Net.practice) return; Net.practice = false; UI.paused = false; UI.pauseSub = null; recStop(); }
function onConnected() {
  if (Net.connected) return;
  if (Net.practice) { netPracticeEnd(); toast('Someone joined your room!'); }
  Net.connected = true; Net.lastRecv = performance.now();
  netLog('connected', { role: Net.role, via: Net.transport, build: BUILD });
  Net.myReady = false; Net.theirReady = false; Net.start = null; Net.matchId = 0; Net.theirBuild = ''; Net.theirWho = null;
  Net.sessKey = Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);   // names this pairing's matches in the history
  netSend({ t: 'who', who: acctWho() });
  netSend({ t: 'lobby', stage: Net.stage, music: Net.side === 0 ? netMusic() : null, build: BUILD, pick: Net.side === 0 ? 0 : 1, ready: false, start: null });
  Net.myPick = Net.side === 0 ? 0 : 1; Net.theirPick = Net.side === 0 ? 1 : 0;
  hideNetPanel(); UI.screen = 'netselect'; Sfx.play('ok');
  if (Net.transport === 'bc' && Net.role === 'host') netSend({ t: 'welcome' });
}
function onDisconnected(msg) {
  if (!Net.connected && !Net.conn) return;
  netLog('disconnected', { why: msg, ...netStats() });
  netClose(false);
  if (['netselect', 'game', 'spectate'].includes(UI.screen) && (UI.screen !== 'game' || G.mode === 'online')) {
    UI.screen = 'online'; showNetPanel();
  }
  setStatus(msg);
}
function netClose(silent) {
  Net.practice = false; { const pr = document.getElementById('netPracticeRow'); if (pr) pr.classList.add('hidden'); }
  if (Net.role === 'host' && Net.code && Net.code !== 'LOCAL') roomClose();
  for (const c of Net.specs) { try { c.close(); } catch (e) { } } Net.specs = [];
  Net.connected = false;
  try { Net.conn && Net.conn.close(); } catch (e) { }
  { const pr = Net.peer; Net.peer = null; try { pr && pr.destroy(); } catch (e) { } }   // cleared first so its 'disconnected' event doesn't reconnect it
  try { Net.bc && Net.bc.close(); } catch (e) { }
  clearInterval(Net.helloTimer);
  Net.conn = null; Net.peer = null; Net.bc = null; Net.inbox = [];
  if (!silent) showCode('');
}

// ------------------------------------------------------------------ receiving
function netRecv(m) { Net.inbox.push(m); Net.lastRecv = performance.now(); }   // arrival counts as alive even while the tab can't process it

// ------------------------------------------------------------------ connection log (for players reporting kicks)
// The last 40 connection events, kept in this browser. "Copy connection log" in the Online panel puts it on the clipboard.
const NETLOG_KEY = 'umavs.netlog';
function netLog(ev, detail) {
  try {
    const log = JSON.parse(localStorage.getItem(NETLOG_KEY) || '[]');
    log.push({ at: new Date().toISOString(), ev, ...(detail || {}) });
    localStorage.setItem(NETLOG_KEY, JSON.stringify(log.slice(-40)));
  } catch (e) { }
}
function netStats() {
  return { role: Net.role, via: Net.transport, build: BUILD, ping: Math.round(Net.ping || 0), frame: Net.F || 0, rbMax: Net.rbMax || 0, stalls: Net.stalls || 0,
    hidden: document.hidden, screen: UI.screen, sinceRecv: Net.lastRecv ? Math.round(performance.now() - Net.lastRecv) : null };
}
function netLogText() {
  let log = []; try { log = JSON.parse(localStorage.getItem(NETLOG_KEY) || '[]'); } catch (e) { }
  const head = `Uma Versus ${typeof VERSION !== 'undefined' ? VERSION : ''} build ${BUILD} · ${navigator.userAgent}`;
  return [head, ...log.map(e => { const { at, ev, ...d } = e; return `${at} ${ev} ${Object.entries(d).map(([k, v]) => k + '=' + v).join(' ')}`; })].join('\n');
}
// A hidden tab stops drawing frames, which used to stop the connection's heartbeat too, so the other player got
// "Connection timed out" after 6 s. Keep a heartbeat going from a timer (browsers still run those about once a second).
setInterval(() => { if (Net.connected && document.hidden && Net.role !== 'spec') { try { netSend({ t: 'ping', ts: performance.now() }); } catch (e) { } } }, 1000);
addEventListener('visibilitychange', () => { if (Net.connected) netLog(document.hidden ? 'tab hidden' : 'tab visible', netStats()); });
function netPump() {
  const now = performance.now();
  if (Net.role === 'host' && Net.peer && Net.code !== 'LOCAL' && ++Net.listT % 900 === 0) roomBeat(false);   // keep the listing alive every 15s
  if (Net.role === 'spec') { specPump(now); return; }
  if (Net.role === 'host' && Net.specs.length && Net.lobbyT % 120 === 0) specSend({ t: 'skeep', names: [netName(0) || 'P1', netName(1) || 'P2'] });
  for (const m of Net.inbox.splice(0)) {
    Net.lastRecv = now;
    switch (m.t) {
      case 'hello': if (Net.role === 'host' && Net.transport === 'bc') { netSend({ t: 'welcome' }); onConnected(); } break;
      case 'welcome': if (Net.role === 'guest') onConnected(); break;
      case 'ping': netSend({ t: 'pong', ts: m.ts }); break;
      case 'pong': { const r = now - m.ts; Net.ping = Net.ping ? Net.ping * 0.8 + r * 0.2 : r; break; }
      case 'who': Net.theirWho = m.who && typeof m.who.name === 'string' ? { id: String(m.who.id || ''), name: m.who.name.slice(0, 16), fav: m.who.fav } : null; break;
      case 'lobby':
        Net.theirPick = m.pick; Net.theirPal = (m.pal | 0) % PALETTE_COUNT; Net.theirReady = m.ready; Net.theirBuild = m.build || '?'; Net.theirStage = m.stage ?? 0; if (m.music) Net.theirMusic = m.music;
        if (Net.role === 'guest' && m.start && m.start.m > Net.matchId && UI.screen === 'netselect') startNetMatch(m.start);
        break;
      case 'in': onInputs(m); break;
      case 'cs': onChecksum(m); break;
      case 'bye': onDisconnected('Opponent left the match.'); break;
      case 'void': if (m.m === Net.matchId && Net.desync < 0) { Net.desync = m.f | 0; netLog('desync (theirs)', { at: Net.desync, ...netStats() }); } break;   // 2.0.2: their game found the desync
    }
  }
  if (!Net.connected) return;
  if (++Net.pingT % 30 === 0) netSend({ t: 'ping', ts: now });
  if (Net.lobbyT % 120 === 0) netSend({ t: 'who', who: acctWho() });
  if (++Net.lobbyT % 15 === 0) netSend({ t: 'lobby', stage: Net.stage, music: Net.side === 0 ? netMusic() : null, build: BUILD, pick: Net.myPick, pal: Net.myPal, ready: Net.myReady, start: Net.role === 'host' ? Net.start : null });
  if (now - Net.lastRecv > 6000) onDisconnected('Connection timed out.');
}

// ------------------------------------------------------------------ lobby (character select)
// battle theme: P1 (host) picks; it follows P1's runner until it is changed by hand
function netMusic() { return Net.music || ROSTER[Net.side === 0 ? Net.myPick : Net.theirPick] || 'spe'; }
function netSelectTick(e, enter, esc) {
  if (esc) { netBye(); netClose(false); UI.screen = 'online'; showNetPanel(); setStatus('Left the room.'); return; }
  const mismatch = Net.theirBuild && Net.theirBuild !== BUILD;
  if (mismatch) Net.myReady = false;
  // the host (P1) has three rows: runner, course, battle music
  if (Net.role === 'host') {
    if (e.u || e.d) { Net.focus = (Net.focus + (e.d ? 1 : 2)) % 3; Sfx.play('menu'); }
    if (Net.focus === 1 && (e.l || e.r)) { const n = STAGE_LIST.length + 1; Net.stage = (Net.stage + (e.r ? 1 : n - 1)) % n; Sfx.play('menu'); return; }
    if (Net.focus === 2 && (e.l || e.r)) { const n = THEME_IDS.length, i = THEME_IDS.indexOf(netMusic()); Net.music = THEME_IDS[(i + (e.r ? 1 : n - 1)) % n]; Sfx.play('menu'); return; }
  } else Net.focus = 0;
  if (!Net.myReady) {
    if ((e.l || e.r) && Net.focus === 0) { const n = ROSTER.length + 1; Net.myPick = (Net.myPick + (e.r ? 1 : n - 1)) % n; Sfx.play('menu'); }
    // colour: M (the host's ↑ ↓ move between runner / course / music, so M works for both sides)
    if (e.M || (Net.role !== 'host' && (e.u || e.d))) { Net.myPal = (Net.myPal + (e.u ? PALETTE_COUNT - 1 : 1)) % PALETTE_COUNT; Sfx.play('menu'); }
    if ((e.L || e.S || enter) && !mismatch && Net.theirBuild) { if (Net.myPick === ROSTER.length) Net.myPick = Math.floor(Math.random() * ROSTER.length); Net.myReady = true; Sfx.play('stamp'); netSend({ t: 'lobby', stage: Net.stage, music: Net.side === 0 ? netMusic() : null, build: BUILD, pick: Net.myPick, pal: Net.myPal, ready: true, start: null }); }
  } else if (e.H) { Net.myReady = false; Sfx.play('menu'); }
  if (Net.role === 'host' && Net.myReady && Net.theirReady) {
    const stage = Net.stage === STAGE_LIST.length ? Math.floor(Math.random() * STAGE_LIST.length) : Net.stage;
    Net.start = { m: Net.matchId + 1, c: [ROSTER[Net.myPick], ROSTER[Net.theirPick]], pal: [Net.myPal, Net.theirPal], delay: Net.delay, stage, music: netMusic(), key: Net.sessKey + '-' + (Net.matchId + 1) };
    netSend({ t: 'lobby', stage: Net.stage, music: Net.side === 0 ? netMusic() : null, build: BUILD, pick: Net.myPick, pal: Net.myPal, ready: true, start: Net.start });
    startNetMatch(Net.start);
  }
}
function startNetMatch(st) {
  netLog('match start', { m: st.m, delay: st.delay, ping: Math.round(Net.ping || 0) });
  Object.assign(Net, {
    matchId: st.m, delay: st.delay, F: 0, local: [], remote: [], pred: [], snaps: [], rb: null,
    remoteMax: st.delay - 1, ack: st.delay - 1, remoteF: 0, rbFrames: 0, rbMax: 0, stalls: 0,
    csMine: {}, csTheirs: {}, csNext: 0, desync: -1, voidT: -1, menu: false, myReady: false, theirReady: false, phaseAt: [], recDone: false,
    matchKey: typeof st.key === 'string' ? st.key.slice(0, 64) : 'm' + st.m + '-' + Date.now(),
  });
  for (let f = 0; f < st.delay; f++) { Net.local[f] = 0; Net.remote[f] = 0; }
  leaveSideModes('online');
  startMatch('online', st.c[0], st.c[1], Array.isArray(st.pal) ? st.pal.map(v => (v | 0) % PALETTE_COUNT) : null);
  if (Net.role === 'host') for (const c of Net.specs) specStart(c, st);
  G.stage = st.stage || 0; G.music = st.music || st.c[0];
  UI.screen = 'game'; UI.paused = false;
  Sfx.play('ok');
}

// ------------------------------------------------------------------ rollback core
function inputsFor(f) {
  const mine = Net.local[f] ?? 0;
  let theirs;
  if (Net.remote[f] !== undefined) theirs = Net.remote[f];
  else { theirs = Net.remote[Net.remoteMax] ?? 0; Net.pred[f] = theirs; }
  const a = decIn(mine), b = decIn(theirs);
  return Net.side === 0 ? [a, b] : [b, a];
}
function onInputs(m) {
  if (m.m !== Net.matchId || UI.screen !== 'game') return;
  for (let k = 0; k < m.d.length; k++) {
    const f = m.s + k;
    if (Net.remote[f] !== undefined) continue;
    Net.remote[f] = m.d[k];
    if (f < Net.F && Net.pred[f] !== undefined && Net.pred[f] !== m.d[k]) Net.rb = Net.rb === null ? f : Math.min(Net.rb, f);
    delete Net.pred[f];
  }
  while (Net.remote[Net.remoteMax + 1] !== undefined) Net.remoteMax++;
  Net.ack = Math.max(Net.ack, m.ack);
  Net.remoteF = Math.max(Net.remoteF, m.f);
}
function sendInputs() {
  const to = Net.F + Net.delay, from = Math.max(Net.ack + 1, to - 60);
  netSend({ t: 'in', m: Net.matchId, s: from, d: Net.local.slice(from, to + 1), ack: Net.remoteMax, f: Net.F });
}

// one 60 Hz tick of an online match
function netGameTick(localRaw) {
  const N = Net;
  // 1) roll back if a late input contradicted our prediction
  if (N.rb !== null) {
    const from = N.rb; N.rb = null;
    if (from >= N.F - RING + 1 && N.snaps[from % RING]) {
      restore(N.snaps[from % RING]);
      G.resim = true;
      for (let f = from; f < N.F; f++) {
        if (f !== from) N.snaps[f % RING] = snapshot();
        step(inputsFor(f));
        N.csMine[f] = checksum(); N.phaseAt[f] = G.phase;
      }
      G.resim = false;
      N.rbFrames = N.F - from; N.rbMax = Math.max(N.rbMax, N.rbFrames); N.rbSum += N.rbFrames; N.rbN++;
    } else { if (N.desync < 0) netLog('desync', { at: from, ...netStats() }); N.desync = from; }
  } else N.rbFrames = 0;

  // 2) checksums for newly-confirmed frames
  for (; N.csNext <= Math.min(N.remoteMax, N.F - 1); N.csNext++) {
    const f = N.csNext;
    if (f % CS_EVERY === 0 && N.csMine[f] !== undefined) {
      netSend({ t: 'cs', m: N.matchId, f, h: N.csMine[f] });
      if (N.csTheirs[f] !== undefined && N.csTheirs[f] !== N.csMine[f]) { if (N.desync < 0) netLog('desync', { at: f, ...netStats() }); N.desync = f; }
    }
    if ((f - RING) % CS_EVERY !== 0) delete N.csMine[f - RING];
  }

  // 3) don't run too far ahead of the opponent
  N.waiting = N.F - N.remoteMax > MAX_RB;
  if (N.waiting) { N.stalls++; sendInputs(); return; }
  const rttF = N.ping / (1000 / 60);
  const ahead = N.F - (N.remoteF + rttF / 2);
  if (ahead > 2 && N.F % 12 === 0) { sendInputs(); return; }   // gentle time sync

  // 4) simulate the next frame
  N.local[N.F + N.delay] = encIn(N.menu ? NEUTRAL : localRaw);
  sendInputs();
  N.snaps[N.F % RING] = snapshot();
  step(inputsFor(N.F));
  N.csMine[N.F] = checksum(); N.phaseAt[N.F] = G.phase;
  N.F++;
  if (N.role === 'host' && N.specs.length) specFeed();
}

// ------------------------------------------------------------------ spectators
// The host forwards both players' confirmed inputs; a spectator just plays them back a little behind
// (no prediction, no rollback), so what they see is exactly the match.
function specSend(obj) { for (const c of Net.specs) { try { if (c.open) c.send(obj); } catch (e) { } } }
function bindSpec(conn) {
  conn._sent = -1; conn._m = 0;
  conn.on('open', () => {
    Net.specs.push(conn); conn.send({ t: 'shello', build: BUILD, names: [netName(0) || 'P1', netName(1) || 'P2'] });
    if (UI.screen === 'game' && G.mode === 'online' && Net.start) specStart(conn, Net.start);   // joined mid-match: send it from the start
    roomBeat(false);
  });
  conn.on('data', d => { if (d && d.t === 'ping') conn.send({ t: 'pong', ts: d.ts }); });
  const gone = () => { Net.specs = Net.specs.filter(c => c !== conn); };
  conn.on('close', gone); conn.on('error', gone);
}
function specStart(c, st) { c._sent = -1; c._m = st.m; try { c.send({ t: 'sstart', st, names: [netName(0) || 'P1', netName(1) || 'P2'] }); } catch (e) { } }
function specFeed() {
  const upto = Math.min(Net.remoteMax, Net.F - 1);
  for (const c of Net.specs) {
    if (!c.open || c._m !== Net.matchId || c._sent >= upto) continue;
    const from = c._sent + 1, to = Math.min(upto, from + 180), d = [];
    for (let f = from; f <= to; f++) { const mine = Net.local[f] ?? 0, theirs = Net.remote[f] ?? 0; d.push(Net.side === 0 ? [mine, theirs] : [theirs, mine]); }
    try { c.send({ t: 'sin', m: Net.matchId, s: from, d }); c._sent = to; } catch (e) { }
  }
}
const SPEC = { m: 0, frames: [], idx: 0, names: ['P1', 'P2'], live: false, buildOk: true, voided: false };
function netWatch(code) {
  netClose(true);
  if (typeof Peer === 'undefined') { setStatus('PeerJS failed to load.'); return; }
  code = (code || '').trim().toUpperCase();
  Net.role = 'spec'; Net.side = 0; Net.transport = 'peer'; Net.code = code;
  Object.assign(SPEC, { m: 0, frames: [], idx: 0, live: false, buildOk: true });
  setStatus('Connecting to watch…');
  const peer = new Peer(undefined, PEER_OPTS); Net.peer = peer;
  peer.on('open', () => {
    const conn = peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json', metadata: { watch: true } });
    Net.conn = conn;
    conn.on('open', () => { Net.connected = true; Net.lastRecv = performance.now(); hideNetPanel(); UI.screen = 'spectate'; Sfx.play('ok'); });
    conn.on('data', d => netRecv(d));
    conn.on('close', () => onDisconnected('The room closed or stopped letting people watch.'));
    conn.on('error', () => onDisconnected('Connection error.'));
    setTimeout(() => { if (!Net.connected && Net.peer === peer) setStatus('Couldn\'t connect. The room may not allow spectators.'); }, 8000);
  });
  peer.on('error', e => setStatus(e.type === 'peer-unavailable' ? `No room called ${code}.` : 'Network error: ' + (e.type || e.message || e)));
}
function specPump(now) {
  for (const m of Net.inbox.splice(0)) {
    Net.lastRecv = now;
    if (m.t === 'shello' || m.t === 'skeep') { if (m.names) SPEC.names = m.names.map(n => String(n).slice(0, 16)); if (m.build) SPEC.buildOk = m.build === BUILD; }
    if (m.t === 'pong') { const r = now - m.ts; Net.ping = Net.ping ? Net.ping * 0.8 + r * 0.2 : r; }
    if (m.t === 'sstart' && m.st) {
      const st = m.st; if (m.names) SPEC.names = m.names.map(n => String(n).slice(0, 16));
      Object.assign(SPEC, { m: st.m, frames: [], idx: 0, live: true, voided: false });
      leaveSideModes('spectate');
      startMatch('spectate', st.c[0], st.c[1], Array.isArray(st.pal) ? st.pal : null);
      G.stage = st.stage || 0; G.music = st.music || st.c[0];
    }
    if (m.t === 'sin' && m.m === SPEC.m) for (let k = 0; k < m.d.length; k++) SPEC.frames[m.s + k] = m.d[k];
    if (m.t === 'svoid' && m.m === SPEC.m) { SPEC.live = false; SPEC.voided = true; }   // 2.0.2: the players' games went out of sync: the match was stopped
  }
  if (Net.connected && ++Net.pingT % 60 === 0) netSend({ t: 'ping', ts: now });
  if (Net.connected && now - Net.lastRecv > 9000) onDisconnected('Lost the connection to the room.');
}
// one tick while watching: play confirmed frames, catching up if far behind
function specTick(esc) {
  if (esc) { netClose(false); UI.screen = 'online'; showNetPanel(); setStatus('Stopped watching.'); return; }
  if (!SPEC.live) return;
  const ahead = SPEC.frames.length - SPEC.idx, n = ahead > 120 ? 3 : ahead > 40 ? 2 : ahead > 6 ? 1 : 0;
  for (let k = 0; k < n && SPEC.frames[SPEC.idx]; k++) { const [a, b] = SPEC.frames[SPEC.idx++]; step([decIn(a), decIn(b)]); }
}

// ------------------------------------------------------------------ room browser (Supabase)
// Regions: the host picks one each time they host (no guessing); the room list shows it and puts rooms from your
// last picked region first.
const REGIONS = { nae: 'NA East', naw: 'NA West', sa: 'South America', eu: 'Europe', me: 'Middle East', as: 'Asia', oc: 'Oceania', af: 'Africa' };
const REGION_KEY = 'umavs.region';
function myRegion() { try { const r = localStorage.getItem(REGION_KEY) || ''; return REGIONS[r] ? r : ''; } catch (e) { return ''; } }
function roomSecret() { if (!Net.secret) { const a = new Uint8Array(16); crypto.getRandomValues(a); Net.secret = [...a].map(v => v.toString(16).padStart(2, '0')).join(''); } return Net.secret; }
function roomBeat(first) {
  if (!ACCT.client || Net.role !== 'host' || !Net.code || Net.code === 'LOCAL') return;
  if (!Net.listed) { if (!first) roomClose(); return; }
  const args = { p_code: Net.code, p_name: acctName() || 'Guest', p_build: BUILD, p_spectate: Net.spectate,
    p_status: Net.connected ? 'playing' : 'open', p_watchers: Net.specs.length, p_secret: roomSecret() };
  // the region version of room_open needs migration 006; until it's run, fall back to the old one
  const old = () => ACCT.client.rpc('room_open', args).then(() => { }, () => { });
  if (Net.regionRpc === false) { old(); return; }
  ACCT.client.rpc('room_open', { ...args, p_region: Net.region || null }).then(r => { if (r && r.error) { Net.regionRpc = false; old(); } else Net.regionRpc = true; }, () => { Net.regionRpc = false; old(); });
}
function roomClose() { if (ACCT.client && Net.secret && Net.code && Net.code !== 'LOCAL') ACCT.client.rpc('room_close', { p_code: Net.code, p_secret: Net.secret }).then(() => { }, () => { }); }
async function roomsFetch() {
  if (!ACCT.client) { renderRooms(null); return; }
  try {
    const q = cols => ACCT.client.from('rooms').select(cols).order('last_seen', { ascending: false }).limit(20);
    let { data, error } = await q('code, host_name, build, spectate, status, watchers, region');
    if (error) ({ data, error } = await q('code, host_name, build, spectate, status, watchers'));   // before migration 006
    if (error) throw error; Net.rooms = data || []; Net.roomsAt = Date.now(); renderRooms(Net.rooms);
  } catch (e) { renderRooms(null, "Couldn't load the room list."); }
}
function renderRooms(list, err) {
  const el = document.getElementById('netRooms'); if (!el) return;
  if (!list) { el.innerHTML = `<div class="empty">${err || 'The room list needs the online service, which isn\'t available in this copy.'}</div>`; return; }
  const mine = Net.role === 'host' ? Net.code : '';
  const me = myRegion(), rows = list.filter(r => r.code !== mine);
  if (me) rows.sort((a, b) => (b.region === me) - (a.region === me));   // stable: same-region rooms first, newest first within each
  if (!rows.length) { el.innerHTML = '<div class="empty">No open rooms right now. Host one and it shows up here.</div>'; return; }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  el.innerHTML = rows.map(r => {
    const same = r.build === BUILD, open = r.status === 'open';
    const rg = REGIONS[r.region] ? `<span class="rg${r.region === me ? ' mine' : ''}">${REGIONS[r.region]}</span>` : '<span class="rg none">Region ?</span>';
    return `<div class="room"><span class="rc">${esc(r.code)}</span><span class="rn">${esc(r.host_name)}${same ? '' : ' <em>other version</em>'}</span>${rg}` +
      `<span class="rs">${open ? 'waiting' : 'in a match'}${r.watchers ? ' · ' + r.watchers + ' watching' : ''}</span>` +
      (open && same ? `<button data-join="${esc(r.code)}">Join</button>` : '') + (r.spectate && same ? `<button class="ghost" data-watch="${esc(r.code)}">Watch</button>` : '') + '</div>';
  }).join('');
  for (const b of el.querySelectorAll('button[data-join]')) b.onclick = () => { Sfx.unlock(); netJoin(b.dataset.join, false); };
  for (const b of el.querySelectorAll('button[data-watch]')) b.onclick = () => { Sfx.unlock(); netWatch(b.dataset.watch); };
}
function onChecksum(m) {
  if (m.m !== Net.matchId) return;
  Net.csTheirs[m.f] = m.h;
  if (Net.csMine[m.f] !== undefined && m.f <= Net.remoteMax && Net.csMine[m.f] !== m.h) Net.desync = m.f;
}
// 2.0.2: a desync stops the match for both players. The two games no longer agree on what happened (a bug, or a modified
// copy), so neither result can be trusted: tell the other side (and the spectators), record nothing, and go back to
// the lobby after a few seconds.
function netVoidTick() {
  const N = Net;
  if (N.voidT < 0) {
    N.voidT = 0; N.menu = false;
    for (let i = 0; i < 3; i++) netSend({ t: 'void', m: N.matchId, f: N.desync });   // the match channel doesn't resend
    if (N.role === 'host') specSend({ t: 'svoid', m: N.matchId });
    netLog('match stopped (desync)', { at: N.desync, ...netStats() }); Sfx.play('deny');
  }
  sendInputs();   // keep their game fed so it reaches the same frame and sees the desync too
  return ++N.voidT >= 240;   // 4 s on screen, then back to the lobby
}
// over once the newest frame simulated with fully-known inputs is already in the 'match' phase
function netMatchConfirmedOver() { return Net.phaseAt[Math.min(Net.remoteMax, Net.F - 1)] === 'match'; }

// ------------------------------------------------------------------ DOM lobby panel
function showNetPanel() {
  const el = document.getElementById('net'), reopened = el.classList.contains('hidden') && Net.role !== 'host';
  if (reopened) { Net.region = ''; const s = document.getElementById('netRegion'); if (s) s.value = ''; }   // the host picks a region each time
  el.classList.remove('hidden'); roomsFetch();
}
function hostReadyText() { return `Room code: ${Net.code}. Send it to your friend${Net.listed ? ', or they can find it in the room list' : ''}.` + (Net.region ? '' : ' Pick your region so people nearby can find you.'); }
function hideNetPanel() { document.getElementById('net').classList.add('hidden'); }
function showCode(code) {
  const el = document.getElementById('netCode');
  el.textContent = code; el.parentElement.classList.toggle('hidden', !code);
  document.getElementById('netPracticeRow').classList.toggle('hidden', !code || Net.role !== 'host');
}
function initNetPanel() {
  const $ = id => document.getElementById(id);
  const local = () => $('netLocal').checked;
  $('netHost').onclick = () => { Sfx.unlock(); Net.delay = +$('netDelay').value; netHost(local()); };
  $('netJoin').onclick = () => { Sfx.unlock(); netJoin($('netCodeIn').value, local()); };
  $('netCodeIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') $('netJoin').click(); };
  $('netCodeIn').onkeyup = e => e.stopPropagation();
  $('netCopy').onclick = () => { try { navigator.clipboard.writeText(Net.code); $('netCopy').textContent = 'Copied!'; setTimeout(() => $('netCopy').textContent = 'Copy', 1200); } catch (e) { } };
  $('netBack').onclick = () => { netClose(false); hideNetPanel(); UI.screen = 'mode'; setStatus(''); };
  $('netDelay').onchange = e => { Net.delay = +e.target.value; };
  $('netListed').onchange = e => { Net.listed = e.target.checked; roomBeat(false); };
  $('netRegion').onchange = e => { Net.region = REGIONS[e.target.value] ? e.target.value : ''; if (Net.region) { try { localStorage.setItem(REGION_KEY, Net.region); } catch (er) { } }
    roomBeat(false); if (Net.rooms) renderRooms(Net.rooms); if (Net.role === 'host' && Net.peer && Net.peer.open) setStatus(hostReadyText()); };
  $('netSpectate').onchange = e => { Net.spectate = e.target.checked; roomBeat(false); };
  $('netRefresh').onclick = () => roomsFetch();
  $('netFriends').onclick = () => { hideNetPanel(); friendsOpen('online'); };
  $('netLeaders').onclick = () => { hideNetPanel(); leadersOpen('online'); };
  $('netPractice').onclick = () => { Sfx.unlock(); netPractice(); };
  $('netLog').onclick = () => { try { navigator.clipboard.writeText(netLogText()); $('netLog').textContent = 'Copied!'; setTimeout(() => $('netLog').textContent = 'Copy connection log', 1500); } catch (e) { } };
}

// ------------------------------------------------------------------ drawing

// ------------------------------------------------------------------ gamepad control of the room panel
const NP = { i: 0, pos: 0 };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function netPanelItems() { return [...document.querySelectorAll('#net button, #net select, #net input')].filter(el => el.offsetParent !== null); }
function netPanelPad(e) {
  const any = Object.values(e).some(Boolean); if (!any) return;   // check input first: listing the panel's controls forces a layout
  const items = netPanelItems(); if (!items.length) return;
  NP.i = Math.min(NP.i, items.length - 1);
  const el = items[NP.i];
  if (e.u || e.d) {
    if (el.id === 'netCodeIn') {   // up/down cycles the letter under the cursor
      const v = (el.value.toUpperCase() + '     ').slice(0, 5).split(''), c = CODE_CHARS.indexOf(v[NP.pos]), n = CODE_CHARS.length;
      v[NP.pos] = CODE_CHARS[((c < 0 ? (e.d ? -1 : 0) : c) + (e.d ? 1 : n - 1)) % n]; el.value = v.join('').trimEnd();
    } else NP.i = (NP.i + (e.d ? 1 : items.length - 1)) % items.length;
    Sfx.play('menu');
  }
  if (e.l || e.r) {
    if (el.id === 'netCodeIn') NP.pos = Math.max(0, Math.min(4, NP.pos + (e.r ? 1 : -1)));
    else if (el.tagName === 'SELECT') { el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + (e.r ? 1 : -1))); el.dispatchEvent(new Event('change')); }
    else if (el.id === 'netDelay') el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + (e.r ? 1 : -1)));
    else NP.i = (NP.i + (e.r ? 1 : items.length - 1)) % items.length;
    Sfx.play('menu');
  }
  if (e.L || e.S) {
    if (el.tagName === 'BUTTON') { el.click(); Sfx.play('ok'); }
    else if (el.type === 'checkbox') { el.checked = !el.checked; Sfx.play('menu'); }
    else if (el.id === 'netCodeIn') { NP.i = items.findIndex(x => x.id === 'netJoin'); }
  }
  items.forEach((x, k) => x.classList.toggle('padfocus', k === NP.i));
  if (el.id === 'netCodeIn') el.setSelectionRange && el.setSelectionRange(NP.pos, NP.pos + 1);
}
