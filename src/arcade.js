// Arcade: seven CPU races that get harder, then the runner's rival as the final boss, then their ending.
// Clear times and the fewest continues are saved per runner.
'use strict';

const ARC_KEY = 'umavs.arcade';
const ARC_LEVELS = [1, 2, 2, 3, 3, 3, 4];   // CPU level for races 1-7; the rival (race 8) is G1 with boss buffs
const RIVAL = { spe: 'suz', suz: 'spe', gs: 'mm', vo: 'ds', ds: 'vo', mm: 'tt', tt: 'mm', kb: 'tt', jp: 'at', at: 'mc', mc: 'at', df: 'jp' };

// what each runner says before a race (when she's the opponent) and after winning
const LINES = {
  spe: { intro: ['I promised Mom I\'d become the best in Japan. Let\'s both give it everything!', 'Ready? I won\'t hold back, not even a little!'],
    win: ['I did it! Mom, did you see that?', 'That was so much fun! Let\'s race again sometime!', 'One step closer to number one!'] },
  suz: { intro: ['...I just want to run. Out in front, where it\'s quiet.', 'Let\'s see who reaches the view first.'],
    win: ['The view from the front... it\'s still beautiful.', 'Thank you for the race.', 'Nobody ahead of me. That\'s how I like it.'] },
  gs: { intro: ['Golshi-chan has arrived! Ready to get dropkicked into next week?', 'Wanna hear a secret? Nah, I\'ll tell you after I win!'],
    win: ['Ahahaha! Golshi wins again! Somebody get me yakisoba!', 'That was a seven out of ten. Bring snacks next time!', 'Did you know the moon is made of... never mind, I won!'] },
  vo: { intro: ['Let\'s make this cool. The coolest race you\'ve ever seen.', 'Bring it. I\'m not losing before Scarlet does.'],
    win: ['Heh. Now THAT was cool.', 'Tell Scarlet I said hi. And that I\'m faster.', 'A cool finish for a cool umamusume.'] },
  ds: { intro: ['First place belongs to me. Don\'t forget it.', 'I\'ll show you exactly how far ahead I can be.'],
    win: ['First place! Obviously.', 'Write it down: Daiwa Scarlet, number one.', '...Not bad. But I was better.'] },
  mm: { intro: ['As a member of the Mejiro family, I will not lose.', 'Shall we? Allow me to show you the elegance of a Mejiro.'],
    win: ['A Mejiro does not fall. Now, if you\'ll excuse me, there is cake waiting.', 'Elegance and stamina. You saw both.', 'A worthy race. I shall remember it.'] },
  tt: { intro: ['The invincible Teio-sama is here! You know how this ends, right?', 'I\'m going to be just like Kaichou. Starting now!'],
    win: ['Teio-sama wins! Did you see that, Kaichou?', 'Invincible! Just like I said!', 'Heh-heh. That\'s the Teio Step for you!'] },
  kb: { intro: ['Wasshoi! Let\'s make this race a festival!', 'I\'ve trained hard for this. Here I come!'],
    win: ['Wasshoi! Wasshoi! That\'s a win!', 'Thanks for the race! Let\'s get festival food after!', 'Everyone\'s cheering... I can hear them!'] },
  jp: { intro: ['I\'m going to be the strongest. You\'re just the next step!', 'Grrr... come at me with everything you\'ve got!'],
    win: ['Told you! The strongest is me!', 'Rawr! That\'s how it\'s done!', 'Tachyon, are you watching? I\'m coming for you!'] },
  at: { intro: ['Fufufu... the perfect test subject has arrived.', 'Let\'s find out exactly how fast you are. For science, of course.'],
    win: ['Fascinating! The data is beautiful!', 'Hypothesis confirmed. Now drink this. It\'s perfectly safe. Probably.', 'Another sample collected. Thank you for your cooperation!'] },
  mc: { intro: ['My friend says you\'re fast. Let\'s find out.', '...Shall we? She\'s already waiting at the gate.'],
    win: ['...She says you did well. So did you.', 'I need a coffee. Black, please.', 'I\'m still chasing her. Not you.'] },
  df: { intro: ['Stay right there. That\'s exactly the distance I want.', 'Step in, step out... you\'ll slip up eventually.'],
    win: ['Perfect distance, every time.', 'Victory tastes like aged cheddar.', 'Now that\'s a well-aged win. Cheese to celebrate!'] },
};
// the rival's line before the final race, keyed by the player's runner
const RIVAL_LINE = {
  spe: 'Spe-chan... I\'ve been waiting at the front. Come and catch me.',
  suz: 'Suzuka-san! I\'ve chased your back for so long. Today I\'m passing you!',
  gs: 'Gold Ship. Whatever you are planning, a Mejiro will not be dropkicked.',
  vo: 'Of course it\'s you at the end. First place is mine, Vodka!',
  ds: 'Scarlet. Figures. Let\'s settle this the cool way.',
  mm: 'McQueen! You know I\'ve been waiting for this rematch, right?',
  tt: 'Teio. I won\'t go easy on you, not even for old times\' sake.',
  kb: 'Kita-chan! Show me how much you\'ve grown. I\'m not holding back!',
  jp: 'Ah, Jungle Pocket. My data on you is nearly complete. One more run should do it.',
  at: 'Tachyon-san... please don\'t put anything in my coffee this time.',
  mc: 'Cafe! Bring your Friend along. I\'d love to measure her too.',
  df: 'Dantsu! You came close last time. Close isn\'t winning!',
};
// three short pages per runner
const ENDINGS = {
  spe: ['The last race is over, and Special Week is still catching her breath when the stands start chanting her name.',
    'That night she writes home to Hokkaido: "Mom, I\'m not the best in Japan yet. But today I was the best on that track."',
    'She seals the letter, sets her alarm for morning training, and falls asleep smiling.'],
  suz: ['After the final race, Suzuka keeps running. One more lap, alone, with the stands emptying behind her.',
    'Nobody ahead. Nothing but wind and the sound of her own steps. The view she has always loved.',
    'Spe is waiting at the gate with two drinks. "One more lap?" Suzuka asks. For once, she lets someone run beside her.'],
  gs: ['Gold Ship accepts the trophy, holds it over her head, and immediately walks off with it in the wrong direction.',
    'She is found three hours later on the roof of the dorm, using it to cook yakisoba for anyone who walks by.',
    'McQueen sighs, takes a plate, and admits it is very good yakisoba. Gold Ship calls it her greatest victory.'],
  vo: ['Vodka stands on the podium and tries to think of the coolest possible thing to say.',
    'She is still thinking when Scarlet shouts from the crowd that she\'ll win next time. Vodka grins. That\'s cool enough.',
    'Later, she polishes her bike, puts on her jacket, and rides out to find a road nobody has raced yet.'],
  ds: ['First place. Of course. Daiwa Scarlet always knew it would end this way.',
    'She keeps her smile perfect for every photo, every interview, every handshake. Then she gets back to her room and screams into her pillow with joy.',
    'Vodka texts her: "lucky." She texts back a single number. "1."'],
  mm: ['The Mejiro family sends flowers, a letter, and a stern reminder about posture during the victory lap.',
    'McQueen reads the letter twice, smiles, and quietly orders the largest cake the bakery makes. Just this once.',
    'Teio finds her halfway through it. McQueen offers her a slice. It is, after all, a celebration.'],
  tt: ['"Undefeated!" Teio announces to the reporters, the crowd, and three confused pigeons.',
    'Kaichou watches from the stands and gives the smallest nod. Teio sees it. It\'s worth more than the trophy.',
    'That night she practises the Teio Step in the mirror. Tomorrow, she\'s going to make it even better.'],
  kb: ['Kitasan Black stands in front of the crowd and does what she does best: she sings.',
    'The whole stadium joins in, clapping along to a festival song nobody expected at a racecourse.',
    'Teio texts her one word, "Wasshoi!", and Kitasan reads it about a hundred times on the train home.'],
  jp: ['Jungle Pocket roars at the finish, loud enough that half the stadium roars back.',
    '"The strongest!" she yells. Then she spots Tachyon in the stands, writing notes, and marches straight over.',
    '"Write this down," she says. "Next time I\'m even faster." Tachyon smiles and turns to a fresh page.'],
  at: ['Tachyon finishes the race and immediately sits down on the track to write.',
    'Pages of numbers, graphs and a very messy diagram labelled "the limit?" with three question marks crossed out.',
    'She reaches the last line and writes one word: "further." Then she goes to find her next test subject.'],
  mc: ['The race is over, but Manhattan Cafe is still looking down the track at a shadow only she can see.',
    'For a moment, she swears they were side by side at the finish. Her Friend turns, and almost smiles.',
    'Cafe goes back to her room, makes two cups of coffee, and leaves one on the windowsill. Just in case.'],
  df: ['Dantsu Flame crosses the line at exactly the distance she planned. Not a step more.',
    'At the party afterwards, she brings a cheese board so large it needs its own table.',
    'Jungle Pocket asks for the recipe for winning. Dantsu hands her a wedge of aged gouda and says, "Patience."'],
};

const ARC = { on: false, cid: null, pal: 0, ladder: [], idx: 0, cont: 0, frames: 0, t: 0, page: 0, rec: {}, quote: '', newRec: false, gameOver: false };
try { ARC.rec = JSON.parse(localStorage.getItem(ARC_KEY) || '{}'); } catch (e) { ARC.rec = {}; }
function arcRecord(cid) { return ARC.rec[cid] || {}; }
function arcSave() { try { localStorage.setItem(ARC_KEY, JSON.stringify(ARC.rec)); } catch (e) { } }

// main menu → pick a runner (the normal select screen, P1 only)
function arcOpen() { UI.pendingMode = 'arcade'; UI.screen = 'select'; UI.selDone = [false, false]; UI.sel = lastPicks('arcade'); }
function arcBegin(cid, pal) {
  const others = ROSTER.filter(c => c !== cid && c !== RIVAL[cid]);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const stages = STAGE_LIST.map((_, i) => i);
  ARC.ladder = others.slice(0, 7).map((c, i) => ({ cid: c, lv: ARC_LEVELS[i], stage: stages[(i + 1) % stages.length] }));
  ARC.ladder.push({ cid: RIVAL[cid], lv: 4, stage: STAGE_LIST.length - 1, boss: true });
  Object.assign(ARC, { on: true, cid, pal, idx: 0, cont: 0, frames: 0, t: 0, page: 0, newRec: false, gameOver: false });
  UI.screen = 'arcladder'; Sfx.play('ok');
}
function arcFight() {
  const L = ARC.ladder[ARC.idx];
  startMatch('cpu', ARC.cid, L.cid, [ARC.pal, 0]);
  if (L.boss) { G.p[1].boss = true; G.p[1].meter = 100; }
  G.stage = L.stage; G.music = L.boss ? L.cid : ARC.cid; G.cpuLevel = L.lv;
  recStart('cpu', ARC.cid, L.cid);
  UI.screen = 'game'; UI.paused = false; ARC.t = 0;
}
function arcQuit() { ARC.on = false; UI.screen = 'mode'; }
// called every tick while an Arcade match is on screen; returns true when it took over the results
function arcGameTick(conf, esc) {
  if (G.phase === 'fight') ARC.frames++;
  if (G.phase !== 'match') return false;
  recFinish();
  if (++ARC.t < 100) return true;
  const won = G.p[0].wins >= 2 && G.p[1].wins < 2;
  if (won) {
    const q = LINES[ARC.cid].win; ARC.quote = q[(ARC.idx + ARC.cont) % q.length];
    UI.screen = 'arcwin'; ARC.t = 0; Sfx.play('fanfare');
  } else { UI.screen = 'arccont'; ARC.t = 0; }
  return true;
}
function arcScreenTick(e, conf, esc) {
  ARC.t++;
  const s = UI.screen;
  if (s === 'arcladder') {
    if (ARC.t > 20 && conf) { UI.screen = 'arcvs'; ARC.t = 0; Sfx.play('vs'); }
    if (esc) { Sfx.play('back'); arcQuit(); }
  } else if (s === 'arcvs') {
    if (ARC.t > 200 || (ARC.t > 30 && conf)) arcFight();
  } else if (s === 'arcwin') {
    if (ARC.t > 40 && conf) {
      Sfx.play('ok');
      if (ARC.idx < ARC.ladder.length - 1) { ARC.idx++; UI.screen = 'arcladder'; ARC.t = 0; }
      else arcCleared();
    }
  } else if (s === 'arccont') {
    const left = 10 - Math.floor(ARC.t / 60);
    if (conf && ARC.t > 20) { ARC.cont++; Sfx.play('ok'); UI.screen = 'arcvs'; ARC.t = 0; }
    else if (esc || left < 0) { UI.screen = 'arcover'; ARC.t = 0; Sfx.play('back'); }
  } else if (s === 'arcover') {
    if (ARC.t > 60 && (conf || esc)) arcQuit();
  } else if (s === 'arcend') {
    if (ARC.t > 20 && conf) { ARC.page++; ARC.t = 0; Sfx.play('page'); if (ARC.page >= ENDINGS[ARC.cid].length) { UI.screen = 'arcdone'; ARC.t = 0; Sfx.play('fanfare'); } }
  } else if (s === 'arcdone') {
    if (ARC.t > 60 && (conf || esc)) arcQuit();
  }
}
function arcCleared() {
  const r = ARC.rec[ARC.cid] || { clears: 0 }, sec = Math.round(ARC.frames / 60);
  ARC.newRec = !r.clears || sec < r.best || ARC.cont < (r.cont ?? 99);
  r.clears = (r.clears || 0) + 1; r.best = Math.min(r.best || 1e9, sec); r.cont = Math.min(r.cont ?? 99, ARC.cont);
  ARC.rec[ARC.cid] = r; arcSave();
  UI.screen = 'arcend'; ARC.page = 0; ARC.t = 0;
}
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------------------------------------------------------------- drawing
function speech(x, y, w, text, col) {   // a speech panel with wrapped text
  ctx.font = font(18, 700, false);
  const words = text.split(' '), lines = []; let line = '';
  for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w - 36 && line) { lines.push(line); line = wd; } else line = t; }
  lines.push(line);
  const h = 24 + lines.length * 24;
  rrect(x, y, w, h, 10, 'rgba(250,248,240,.97)', col, 3);
  lines.forEach((l, i) => label(l, x + 18, y + 24 + i * 24, 18, PAL.ink, 'left', 700));
  return h;
}
function drawArcLadder() {
  menuBg(0.7);
  topBar('ARCADE', `${nameOf(ARC.cid)}   ·   ${mmss(Math.round(ARC.frames / 60))}   ·   continues ${ARC.cont}`);
  const n = ARC.ladder.length, cw = 104, gap = 8, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y = 150;
  label('RACE CARD', W / 2, 80, 16, PAL.gold, 'center', 900, true);
  txt(ARC.idx === n - 1 ? 'FINAL RACE' : `RACE ${ARC.idx + 1}`, W / 2, 114, 40, '#fff');
  ARC.ladder.forEach((L, k) => {
    const x = x0 + k * (cw + gap), cur = k === ARC.idx, done = k < ARC.idx, hidden = L.boss && !cur;
    rrect(x - 3, y - 3, cw + 6, 166, 6, cur ? PAL.gold : L.boss ? PAL.rose : '#3a2a5c');
    ctx.fillStyle = vgradC(y, y + 160, cur ? CHARS[L.cid].color : '#2a1748', '#170c2c'); ctx.fillRect(x, y, cw, 160);
    if (hidden) txt('?', x + cw / 2, y + 70, 64, '#fff');
    else face(L.cid, 0, x + 12, y + 22, 80, true);
    ctx.fillStyle = GATE[k % 8][0]; ctx.fillRect(x, y, cw, 16); label(L.boss ? 'RIVAL' : String(k + 1), x + cw / 2, y + 9, 13, GATE[k % 8][1], 'center', 900, true);
    ctx.fillStyle = 'rgba(24,11,42,.85)'; ctx.fillRect(x, y + 108, cw, 52);
    const nm = hidden ? '???' : nameOf(L.cid), wd = nm.split(' ');
    label(wd[0], x + cw / 2, y + 120, 12, '#fff', 'center', 800, true); if (wd[1]) label(wd.slice(1).join(' '), x + cw / 2, y + 134, 12, '#fff', 'center', 800, true);
    label(L.boss ? 'BOSS' : CPU_NAMES[L.lv], x + cw / 2, y + 151, 11, L.boss ? PAL.rose : PAL.gold, 'center', 900, true);
    if (done) { ctx.fillStyle = 'rgba(24,11,42,.55)'; ctx.fillRect(x, y, cw, 160); ctx.save(); ctx.translate(x + cw / 2, y + 70); ctx.rotate(-0.2); rrect(-40, -16, 80, 32, 5, PAL.turf); label('WON', 0, 1, 20, '#fff', 'center', 900, true); ctx.restore(); }
  });
  drawSpr(ARC.cid, ARC.pal, '800', Math.floor(UI.t / 9) % SPR[ARC.cid].anims['800'][1], 140, 480, 1, 2.6);
  const r = arcRecord(ARC.cid);
  if (r.clears) label(`Best: ${mmss(r.best)}, ${r.cont} continue${r.cont === 1 ? '' : 's'}  ·  cleared ${r.clears}×`, W / 2, 350, 15, PAL.dim, 'center', 700);
  if (ARC.t % 60 < 42) txt('PRESS CONFIRM', W / 2, 400, 28, '#fff');
  hintBar('F / Enter race    ·    Esc give up');
}
function drawArcVS() {
  const L = ARC.ladder[ARC.idx];
  UI.vsT = Math.min(ARC.t, 60); UI.sel = [ROSTER.indexOf(ARC.cid), ROSTER.indexOf(L.cid)]; UI.pal = [ARC.pal, 0]; UI.vsStage = L.stage;
  const pm = UI.pendingMode; UI.pendingMode = 'arcade'; drawVS(); UI.pendingMode = pm;
  label(L.boss ? 'FINAL RACE · RIVAL' : `ARCADE · RACE ${ARC.idx + 1} · ${CPU_NAMES[L.lv]}`, W / 2, 492, 20, L.boss ? PAL.rose : '#fff', 'center', 800, true);
  if (ARC.t > 24) {
    const line = L.boss ? RIVAL_LINE[ARC.cid] : LINES[L.cid].intro[ARC.idx % 2];
    ctx.save(); ctx.globalAlpha = Math.min(1, (ARC.t - 24) / 10);
    const h = speech(W - 470, 72, 440, line, CHARS[L.cid].color);
    label(nameOf(L.cid), W - 46, 72 + h + 14, 14, CHARS[L.cid].color2, 'right', 900, true);
    ctx.restore();
  }
}
function drawArcWin() {
  menuBg(0.6);
  topBar('ARCADE', `${mmss(Math.round(ARC.frames / 60))}   ·   continues ${ARC.cont}`);
  const c = CHARS[ARC.cid], wa = winAnim({ cid: ARC.cid, c, side: 0 });
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(250, 470, 130, 18, 0, 0, 7); ctx.fill();
  drawSpr(ARC.cid, ARC.pal, wa, Math.min(Math.floor(ARC.t / 8), SPR[ARC.cid].anims[wa][1] - 1), 250, 470, 1, 5);
  txt(ARC.idx === ARC.ladder.length - 1 ? 'RIVAL DEFEATED!' : 'YOU WIN!', 640, 120, 54, PAL.gold);
  const h = speech(420, 170, 470, ARC.quote, c.color);
  label(nameOf(ARC.cid), 890, 170 + h + 14, 14, c.color2, 'right', 900, true);
  if (ARC.t > 40 && ARC.t % 60 < 42) label('press confirm', 655, 470, 16, '#fff', 'center', 700);
}
function drawArcCont() {
  renderGame();
  ctx.fillStyle = 'rgba(24,11,42,.78)'; ctx.fillRect(0, 0, W, HGT);
  const left = Math.max(0, 10 - Math.floor(ARC.t / 60));
  txt('CONTINUE?', W / 2, 190, 72, '#fff');
  ledText(String(left), W / 2, 290, 9, left <= 3 ? '#ff5a4a' : PAL.led, 'center', 'rgba(255,180,58,.08)');
  label('F / Enter to race again    ·    Esc to stop', W / 2, 380, 18, '#ddd2f0', 'center', 700);
}
function drawArcOver() {
  menuBg(0.85);
  txt('GAME OVER', W / 2, 220, 80, '#ff5a6a');
  label(`${nameOf(ARC.cid)} made it to race ${ARC.idx + 1} of ${ARC.ladder.length}.`, W / 2, 300, 20, '#fff', 'center', 700);
}
function drawArcEnd() {
  const pages = ENDINGS[ARC.cid], c = CHARS[ARC.cid];
  drawStage(STAGE_W / 2 + Math.sin(UI.t / 400) * 300, ARC.page % STAGES.length);
  ctx.fillStyle = 'rgba(24,11,42,.45)'; ctx.fillRect(0, 0, W, HGT);
  const pose = ARC.page === pages.length - 1 ? winAnim({ cid: ARC.cid, c, side: 1 }) : '800';
  drawSpr(ARC.cid, ARC.pal, pose, Math.floor(UI.t / 9) % SPR[ARC.cid].anims[pose][1], 480, 330, 1, 4.6);
  ctx.fillStyle = 'rgba(24,11,42,.9)'; ctx.fillRect(0, 360, W, 180); ctx.fillStyle = c.color; ctx.fillRect(0, 360, W, 3);
  label(`${nameOf(ARC.cid)} · ENDING`, 40, 386, 16, c.color2, 'left', 900, true);
  ctx.font = font(21, 600, false); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const shown = pages[ARC.page].slice(0, Math.floor(ARC.t * 1.6));
  wrap(shown, 40, 422, W - 80, 30);
  label(`${ARC.page + 1} / ${pages.length}`, W - 40, 386, 14, PAL.dim, 'right', 700);
  if (ARC.t > 20 && UI.t % 60 < 42) label('▼', W - 40, 512, 18, PAL.gold, 'right', 900);
}
function drawArcDone() {
  menuBg(0.7);
  const c = CHARS[ARC.cid], r = arcRecord(ARC.cid);
  topBar('ARCADE CLEAR', nameOf(ARC.cid));
  drawSpr(ARC.cid, ARC.pal, winAnim({ cid: ARC.cid, c, side: 0 }), 0, 230, 470, 1, 5);
  txt('ARCADE CLEAR!', 620, 120, 56, PAL.gold);
  rrect(420, 170, 420, 200, 8, '#120b05', PAL.goldD, 3);
  ledText('RESULT', 630, 196, 3, PAL.led, 'center');
  label('TIME', 450, 240, 18, PAL.dim, 'left', 800, true); ledText(mmss(Math.round(ARC.frames / 60)), 810, 240, 4, PAL.led, 'right');
  label('CONTINUES', 450, 286, 18, PAL.dim, 'left', 800, true); ledText(String(ARC.cont), 810, 286, 4, PAL.led, 'right');
  label('BEST', 450, 332, 18, PAL.dim, 'left', 800, true); label(`${mmss(r.best)} · ${r.cont} cont.`, 810, 332, 18, '#fff', 'right', 800, true);
  if (ARC.newRec) { ctx.save(); ctx.translate(830, 160); ctx.rotate(0.15); rrect(-70, -18, 140, 36, 5, PAL.rose); label('NEW RECORD', 0, 1, 20, '#fff', 'center', 900, true); ctx.restore(); }
  if (ARC.t > 60) label('press confirm', 630, 420, 16, '#fff', 'center', 700);
}
