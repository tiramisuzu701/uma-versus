// Music. <audio> tracks with frame-timed fades, picked by musicDirector():
//   menus        menu theme (loops)
//   round 1      character theme fades in
//   tied after 2 theme fades out during the KO
//   round 3      third round theme fades in with the countdown
//   match end    fade out
'use strict';

const THEME_IDS = ['spe', 'suz', 'gs', 'vo', 'ds', 'mm', 'tt', 'kb', 'jp', 'at', 'mc', 'df'];
const TRACK_TITLE = id => id === 'menu' ? 'MENU THEME' : id === 'round3' ? 'THIRD ROUND THEME' : `${nameOf(id)} THEME`;
const AUDIO_KEY = 'umavs.audio';
const Music = {
  els: {}, urls: {}, cur: null, gain: {}, target: {}, rate: {}, vol: 0.7, duck: 1, blocked: false, retryT: 0,
  // tracks sit in <script type="text/plain" id="mus-…"> blocks after the game code (see build.py)
  // (null while the page is still arriving, since a block can be half-downloaded)
  src(id) { if (document.readyState === 'loading') return null; const el = document.getElementById('mus-' + id); return el ? el.textContent : null; },
  url(id) {
    if (this.urls[id]) return this.urls[id];
    // the website build keeps the tracks as separate files next to the page (streamed, cached by the browser);
    // the single-file build carries them inside the page
    if (typeof MUSIC_URL === 'string') return (this.urls[id] = MUSIC_URL + id + '.mp3');
    const b64 = this.src(id); if (!b64) return null;
    // not prewarmed yet: decode now (slow, ~30 ms for a full track)
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return (this.urls[id] = URL.createObjectURL(new Blob([u8], { type: 'audio/mpeg' })));
  },
  // decode the tracks one at a time in the background, once the page has finished arriving,
  // so starting a theme never freezes a frame. The menu theme goes first.
  async prewarm() {
    if (typeof MUSIC_URL === 'string') { this.el('menu'); this.unlock(); return; }   // website build: only the menu theme starts downloading now, the rest when they're needed
    if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    const ids = [...document.querySelectorAll('script.track')].map(el => el.id.slice(4)).sort((a, b) => (b === 'menu') - (a === 'menu'));
    for (const id of ids) {
      if (this.urls[id]) continue;
      try {
        const blob = await (await fetch('data:audio/mpeg;base64,' + this.src(id))).blob();
        if (!this.urls[id]) this.urls[id] = URL.createObjectURL(blob);
      } catch (e) { }
      await new Promise(r => setTimeout(r, 50));
    }
    this.unlock();
  },
  el(id) {
    if (!this.els[id]) {
      const u = this.url(id); if (!u) return null;
      const a = new Audio(u); a.loop = true; a.preload = 'auto'; a.volume = 0;
      this.els[id] = a; this.gain[id] = 0; this.target[id] = 0;
    }
    return this.els[id];
  },
  // switch to `id` (null = silence). fadeIn / fadeOut are in seconds.
  play(id, fadeIn = 1.2, fadeOut = 1.2, restart = false) {
    if (id === this.cur && !restart) {
      if (id) {
        const late = !this.els[id] && this.el(id);   // the track hadn't finished downloading when it was first asked for
        this.target[id] = 1; this.rate[id] = 1 / Math.max(1, fadeIn * 60);
        if (late) this.start(late);
      }
      return;
    }
    if (this.cur) { this.target[this.cur] = 0; this.rate[this.cur] = 1 / Math.max(1, fadeOut * 60); }
    this.cur = id;
    if (!id) return;
    const a = this.el(id); if (!a) return;
    if (restart || a.paused) { try { a.currentTime = 0; } catch (e) { } this.gain[id] = 0; }
    this.target[id] = 1; this.rate[id] = 1 / Math.max(1, fadeIn * 60);
    this.start(a);
  },
  start(a) { const p = a.play(); if (p && p.then) p.then(() => { this.blocked = false; }, () => { this.blocked = true; }); },
  // browsers only allow audio after a key press, click or tap: retry on every one of those (and now and then)
  unlock() {
    const a = this.cur && this.els[this.cur];
    if (a && a.paused && this.target[this.cur] > 0) this.start(a);
  },
  tick() {
    if (++this.retryT % 90 === 0) this.unlock();
    for (const id in this.els) {
      const a = this.els[id], t = this.target[id], g = this.gain[id];
      if (g !== t) this.gain[id] = t > g ? Math.min(t, g + this.rate[id]) : Math.max(t, g - this.rate[id]);
      a.volume = Math.max(0, Math.min(1, this.gain[id] * this.vol * this.duck));
      if (this.gain[id] <= 0 && t === 0 && !a.paused) { a.pause(); try { a.currentTime = 0; } catch (e) { } }
    }
  },
  load() { try { const o = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}'); if (o.music !== undefined) this.vol = o.music; if (o.sfx !== undefined) Sfx.vol = o.sfx; } catch (e) { } },
  save() { try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ music: this.vol, sfx: Sfx.vol })); } catch (e) { } },
};

// ---------------------------------------------------------------- director
const MD = { pRef: null, lastRound: 0, battle: null, jukebox: null };
const MENU_SCREENS = ['friends', 'leaders', 'title', 'mode', 'select', 'stage', 'replays', 'repwarn', 'arcladder', 'arcwin', 'arccont', 'arcover', 'arcdone', 'controls', 'moves', 'online', 'netselect', 'sound', 'account'];
function decidingRound() { return G.p.length === 2 && G.p[0].wins === 1 && G.p[1].wins === 1; }
function musicDirector() {
  Music.duck = UI.paused || (G.mode === 'online' && Net.menu) ? 0.4 : 1;
  const s = UI.screen;
  if (s === 'sound') { Music.play(MD.jukebox || 'menu', 0.6, 0.6); Music.tick(); return; }
  if (s === 'music') { Music.play(UI.musicIdx === undefined ? 'menu' : THEME_IDS[UI.musicIdx], 0.8, 0.8); Music.tick(); return; }   // preview
  if (MENU_SCREENS.includes(s)) { MD.pRef = null; Music.play('menu', 1.5, 1.2); Music.tick(); return; }
  if (s === 'vs' || s === 'arcvs') { Music.play(null, 1, 1.4); Music.tick(); return; }
  if (s === 'arcend') { Music.play(ARC.cid, 1.5, 1); Music.tick(); return; }
  if (s === 'spectate' && !SPEC.live) { Music.play('menu', 1.5, 1.2); Music.tick(); return; }
  if (s === 'game' || s === 'replay' || s === 'spectate') {
    const theme = G.music || (G.p[0] && G.p[0].cid) || 'spe';
    const fresh = MD.pRef !== G.p;                      // a new match started (or a replay was loaded)
    if (fresh) { MD.pRef = G.p; MD.lastRound = 0; }
    if (G.mode === 'training') { Music.play(theme, 1.5, 1, fresh); Music.tick(); return; }
    if (G.phase === 'match') { Music.play(null, 1, 2.5); Music.tick(); return; }
    if (G.phase === 'intro') {
      const want = decidingRound() ? 'round3' : theme;
      const newRound = MD.lastRound !== G.round; MD.lastRound = G.round;
      // round 1 (or a replay seek back to it) starts the theme from the top; round 3 brings in its own theme
      Music.play(want, want === 'round3' ? 2 : 1.6, 1.2, fresh || (newRound && G.round === 1) || (newRound && want === 'round3' && Music.cur !== 'round3'));
    } else if (G.phase === 'ko') {
      // tie going into a final round: let the character theme fade away during the KO
      const w = G.roundWinner, wins = G.p.map((p, i) => p.wins + (!G.posed && (w === i || w === -1) ? 1 : 0));
      const nextDeciding = wins[0] === 1 && wins[1] === 1 && Music.cur !== 'round3';
      if (nextDeciding) Music.play(null, 1, 3);
      else if (!Music.cur) Music.play(theme, 1.6, 1);
    } else if (!Music.cur || (Music.cur !== theme && Music.cur !== 'round3')) Music.play(decidingRound() ? 'round3' : theme, 1.6, 1);
  }
  Music.tick();
}
