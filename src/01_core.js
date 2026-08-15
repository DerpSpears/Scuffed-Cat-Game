'use strict';
/* =====================================================================
   CAT TOWER - pet every cat, climb to the roof.
   Low-poly three.js. Everything is procedural geometry, no assets.
   ===================================================================== */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const $ = (id) => document.getElementById(id);
function show(el, v) { if (el) el.classList.toggle('hidden', !v); }

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

/* ------------------------------- tuning ------------------------------ */
const CFG = {
  petRange: 2.6,
  playerSpeed: 7.0,
  sprintMul: 1.42,
  accel: 14,
  gravity: 28,
  jumpVel: 9.2,
  camDist: 8.6,
  camHeight: 3.9,
  hurtIFrames: 0.9,
  speedBuffTime: 10,
  invinBuffTime: 8,
  milkHeal: 35,
  coinRespawn: 0,
  powerRespawn: 20
};

/* ------------------------------ cat kinds ---------------------------- */
const CAT_KINDS = {
  house:  { scale: 0.80, speed: 6.5, aggressive: false, damage: 0,  coins: 3,  aggro: 0,  lunge: 0,  label: 'House cat' },
  bobcat: { scale: 1.15, speed: 5.4, aggressive: true,  damage: 12, coins: 6,  aggro: 15, lunge: 13, label: 'Bobcat' },
  tiger:  { scale: 1.75, speed: 6.0, aggressive: true,  damage: 22, coins: 10, aggro: 17, lunge: 16, label: 'Tiger' },
  lion:   { scale: 1.95, speed: 5.7, aggressive: true,  damage: 34, coins: 15, aggro: 19, lunge: 15, label: 'Lion' }
};

const HOUSE_VARIANTS = [
  { name: 'Marmalade', fur: 0xE0913F, belly: 0xF6E3C8, stripes: 0xB56A22, eyes: 0x3FA46A },
  { name: 'Domino',    fur: 0x2E2E31, belly: 0xF3F1EC, paws: 0xF3F1EC,    eyes: 0xE7C34C },
  { name: 'Pearl',     fur: 0xF2EFE9, belly: 0xFFFFFF, eyes: 0x4FA3D8 },
  { name: 'Smoke',     fur: 0x8A8F98, belly: 0xC9CDD3, stripes: 0x63676E, eyes: 0x7FD08A },
  { name: 'Patches',   fur: 0xF4EDE2, belly: 0xFFFFFF, patches: 0xD9752F, eyes: 0xE7A94C },
  { name: 'Coco',      fur: 0xE8D9BE, belly: 0xF7EEDD, points: 0x6B4A34,  eyes: 0x63B7E8 },
  { name: 'Biscuit',   fur: 0xC98A55, belly: 0xF2DFC4, stripes: 0x8A5A30, eyes: 0x8FD07A }
];
const WILD_VARIANTS = {
  bobcat: [
    { name: 'Rusty',   fur: 0xC08B52, belly: 0xEEDCC0, spots: 0x6E4A2A, eyes: 0xE0B24A, tufts: true, stub: true },
    { name: 'Bramble', fur: 0xA97A4B, belly: 0xE7D3B4, spots: 0x5E3F22, eyes: 0xD9A63F, tufts: true, stub: true },
    { name: 'Thistle', fur: 0xD09B62, belly: 0xF1E0C6, spots: 0x79512C, eyes: 0xC9E06B, tufts: true, stub: true },
    { name: 'Juniper', fur: 0xB58455, belly: 0xEBD8BA, spots: 0x674627, eyes: 0xE8C25A, tufts: true, stub: true },
    { name: 'Birch',   fur: 0xCFA173, belly: 0xF3E4CB, spots: 0x7E5735, eyes: 0xEFD37A, tufts: true, stub: true }
  ],
  tiger: [
    { name: 'Rajah',   fur: 0xE07B2A, belly: 0xF6E7D2, stripes: 0x241A14, eyes: 0xF0C24A },
    { name: 'Ember',   fur: 0xD86F22, belly: 0xF3E0C8, stripes: 0x1E1610, eyes: 0xEFB93F },
    { name: 'Saffron', fur: 0xE68A33, belly: 0xF8EBD8, stripes: 0x2C2018, eyes: 0xF7D060 },
    { name: 'Cinder',  fur: 0xC96A25, belly: 0xEFDCC2, stripes: 0x191310, eyes: 0xE9AE3C }
  ],
  lion: [
    { name: 'Kingsley', fur: 0xD9A85E, belly: 0xF0DFBE, mane: 0x8A5A2B, eyes: 0xE9B94C, tuft: true },
    { name: 'Solara',   fur: 0xE0B36C, belly: 0xF4E6C8, mane: 0x9A6733, eyes: 0xF2C65C, tuft: true },
    { name: 'Nimbus',   fur: 0xCC9C54, belly: 0xEBD8B4, mane: 0x76451F, eyes: 0xDFAE43, tuft: true }
  ]
};

/* ------------------------------- levels ------------------------------ */
const LEVELS = [
  { no: 1, name: 'The Courtyard', kind: 'house', count: 6, env: 'courtyard',
    eyebrow: 'Level 1 of 4', sub: 'Ordinary house cats. They will run. Corner them and press P.',
    coins: 16, powerups: ['speed', 'speed', 'milk'] },
  { no: 2, name: 'The Storeroom', kind: 'bobcat', count: 5, env: 'interior',
    eyebrow: 'Level 2 of 4 - Floor One', sub: 'Bobcats. These ones bite. Dodge the pounce, pet the recovery.',
    coins: 18, powerups: ['speed', 'invin', 'milk', 'milk'],
    wall: 0x6B5236, floor: 0x8A7350, accent: 0xC79A55, fog: 0x2A2118, sky: 0x2A2118 },
  { no: 3, name: 'The Gallery', kind: 'tiger', count: 4, env: 'interior',
    eyebrow: 'Level 3 of 4 - Floor Two', sub: 'Tigers. Faster, heavier, meaner. Same job.',
    coins: 20, powerups: ['speed', 'invin', 'invin', 'milk', 'milk'],
    wall: 0x40536B, floor: 0x5A6B80, accent: 0x8FB6DE, fog: 0x18202A, sky: 0x18202A },
  { no: 4, name: 'The Throne Room', kind: 'lion', count: 3, env: 'interior',
    eyebrow: 'Level 4 of 4 - Floor Three', sub: 'Lions. One mistake is most of your health bar.',
    coins: 24, powerups: ['speed', 'speed', 'invin', 'invin', 'milk', 'milk'],
    wall: 0x5B2E2E, floor: 0x6E4038, accent: 0xE0B45E, fog: 0x1E1212, sky: 0x1E1212 },
  { no: 5, name: 'The Rooftop', kind: null, count: 0, env: 'roof',
    eyebrow: 'The top of the tower', sub: 'Nothing left to climb.', coins: 0, powerups: [] }
];

/* -------------------------------- shop ------------------------------- */
const SHOP = [
  { id: 'hp',    name: 'Extra Vitality',  desc: '+25 max health, and a full heal right now.', base: 14, grow: 1.55, max: 8,
    apply() { State.maxHp += 25; State.hp = State.maxHp; } },
  { id: 'speed', name: 'Springy Boots',   desc: '+8% movement speed, permanently.',            base: 12, grow: 1.55, max: 6,
    apply() { State.speedMul += 0.08; } },
  { id: 'range', name: 'Long Arms',       desc: '+0.35 petting reach. Safer pets.',            base: 10, grow: 1.6,  max: 4,
    apply() { State.petRangeBonus += 0.35; } },
  { id: 'dur',   name: 'Battery Pack',    desc: '+30% power-up duration.',                     base: 12, grow: 1.6,  max: 4,
    apply() { State.powerDurMul += 0.3; } },
  { id: 'heal',  name: 'Bowl of Cream',   desc: 'Restore all health immediately.',             base: 6,  grow: 1.25, max: 99,
    apply() { State.hp = State.maxHp; } }
];

/* -------------------------------- state ------------------------------ */
const State = {
  mode: 'title',          // title | playing | shop | dead | paused | win
  level: 0,               // index into LEVELS
  coins: 0,
  coinsTotal: 0,
  hp: 100,
  maxHp: 100,
  speedMul: 1,
  petRangeBonus: 0,
  powerDurMul: 1,
  bought: {},
  buffs: { speed: 0, invin: 0 },
  petted: 0,
  total: 0,
  pettedAll: 0,
  trophies: [],
  deaths: 0,
  time: 0,
  unlocked: false,
  lastKiller: 'bobcat'
};
function resetRun() {
  State.level = 0; State.coins = 0; State.coinsTotal = 0;
  State.hp = 100; State.maxHp = 100; State.speedMul = 1;
  State.petRangeBonus = 0; State.powerDurMul = 1; State.bought = {};
  State.buffs.speed = 0; State.buffs.invin = 0;
  State.petted = 0; State.total = 0; State.pettedAll = 0;
  State.deaths = 0; State.time = 0; State.unlocked = false;
  State.trophies = [];
}

/* ------------------ new game + / persistent progress ----------------- */
/* Beating the tower once unlocks the "bring more cats" dial. Meta lives in
   localStorage so the unlock survives a reload. */
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
const MAX_EXTRA = 8;
const Meta = { cleared: false, clears: 0, extra: 0, best: 0 };

function metaLoad() {
  try {
    const raw = localStorage.getItem('catTower.meta');
    if (!raw) return;
    const m = JSON.parse(raw);
    Meta.cleared = !!m.cleared;
    Meta.clears = m.clears || 0;
    Meta.extra = clamp(m.extra || 0, 0, MAX_EXTRA);
    Meta.best = (typeof m.best === 'number' && m.best > 0) ? m.best : 0;
  } catch (e) { /* private mode / no storage */ }
}
function metaSave() {
  try { localStorage.setItem('catTower.meta', JSON.stringify(Meta)); } catch (e) {}
}
metaLoad();

/* how many cats a floor actually spawns, after the new-game+ bonus */
function catCountFor(L) { return L.count > 0 ? L.count + Meta.extra : 0; }
function totalCatsPlanned() {
  let n = 0;
  for (let i = 0; i < LEVELS.length; i++) n += catCountFor(LEVELS[i]);
  return n;
}

/* -------------------------------- audio ------------------------------ */
const Sfx = (function () {
  let ctx = null, master = null, muted = false;
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ensure(); if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(24, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0002, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.06);
  }
  function noise(dur, vol, lp) {
    const c = ensure(); if (!c || muted) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 700;
    const g = c.createGain(); g.gain.value = vol || 0.15;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  return {
    resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    toggle() { muted = !muted; if (!muted) this.coin(); return muted; },
    isMuted() { return muted; },
    // two-syllable "mee-oww" with a little wobble so repeats never match
    meow(p) {
      p = (p || 1) * rand(0.94, 1.07);
      tone(600 * p, 0.10, 'triangle', 0.15, 910 * p);
      tone(900 * p, 0.22, 'triangle', 0.17, 430 * p, 0.09);
      tone(1340 * p, 0.15, 'sine', 0.05, 720 * p, 0.11);
    },
    // happy chirpy meow for a successful pet
    meowHappy(p) {
      p = (p || 1) * rand(0.97, 1.05);
      tone(720 * p, 0.09, 'triangle', 0.15, 1080 * p);
      tone(1080 * p, 0.18, 'triangle', 0.15, 880 * p, 0.08);
      tone(1500 * p, 0.14, 'sine', 0.06, 1180 * p, 0.14);
    },
    purr() { noise(0.55, 0.1, 300); tone(170, 0.45, 'sine', 0.09, 130); },
    coin() { tone(1180, 0.07, 'square', 0.1); tone(1720, 0.11, 'square', 0.08, 1720, 0.055); },
    hurt() { tone(250, 0.24, 'sawtooth', 0.16, 70); noise(0.18, 0.12, 480); },
    power() { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'square', 0.09, null, i * 0.06)); },
    growl() { tone(112, 0.34, 'sawtooth', 0.13, 78); noise(0.28, 0.09, 220); },
    hiss() { noise(0.32, 0.14, 2600); tone(900, 0.12, 'sawtooth', 0.06, 1400); },
    unlock() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, null, i * 0.09)); },
    fail() { tone(190, 0.13, 'square', 0.08, 140); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.32, 'triangle', 0.11, null, i * 0.13)); },
    thud() { tone(90, 0.16, 'sine', 0.14, 55); }
  };
})();

/* -------------------------------- input ------------------------------ */
const Input = {
  keys: {}, dx: 0, dy: 0, locked: false, dragging: false,
  stick: { x: 0, z: 0, len: 0 }
};

/* Is this a phone or tablet? ?touch=1 forces the on-screen pad on and
   ?touch=0 forces it off, so both layouts are testable from a desktop. */
const IS_TOUCH = (function () {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('touch')) return q.get('touch') !== '0';
  } catch (e) { /* no URL api */ }
  return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window ||
    !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
})();

/* run timer formatting: 4:07.3 and 4:07 */
function fmtTime(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
  return m + ':' + (s < 10 ? '0' : '') + s + '.' + d;
}
function fmtTimeShort(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function initInput(canvas) {
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    if (!Input.keys[e.code]) Game.onKeyPress(e.code);
    Input.keys[e.code] = true;
  });
  window.addEventListener('keyup', function (e) { Input.keys[e.code] = false; });
  window.addEventListener('blur', function () { Input.keys = {}; Input.dragging = false; });

  canvas.addEventListener('mousedown', function () {
    Sfx.resume();
    Input.dragging = true;
    // never grab the pointer on a touch device: it swallows taps meant for
    // the on-screen controls, and releasing it would pause the game
    if (!IS_TOUCH && State.mode === 'playing' && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (err) { /* headless / unsupported */ }
    }
  });
  window.addEventListener('mouseup', function () { Input.dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (Input.locked || Input.dragging) {
      Input.dx += e.movementX || 0;
      Input.dy += e.movementY || 0;
    }
  });
  document.addEventListener('pointerlockchange', function () {
    const wasLocked = Input.locked;
    Input.locked = (document.pointerLockElement === canvas);
    if (wasLocked && !Input.locked && State.mode === 'playing') Game.pause();
  });
  // touch look + move fallback
  let tid = null, tx = 0, ty = 0;
  canvas.addEventListener('touchstart', function (e) {
    Sfx.resume();
    const t = e.changedTouches[0]; tid = t.identifier; tx = t.clientX; ty = t.clientY;
  }, { passive: true });
  canvas.addEventListener('touchmove', function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === tid) {
        Input.dx += (t.clientX - tx) * 1.6;
        Input.dy += (t.clientY - ty) * 1.6;
        tx = t.clientX; ty = t.clientY;
      }
    }
  }, { passive: true });
}

function axis(neg, pos) {
  let v = 0;
  if (Input.keys[neg]) v -= 1;
  if (Input.keys[pos]) v += 1;
  return v;
}
function moveInput() {
  let x = 0, z = 0;
  if (Input.keys.KeyA || Input.keys.ArrowLeft) x -= 1;
  if (Input.keys.KeyD || Input.keys.ArrowRight) x += 1;
  if (Input.keys.KeyW || Input.keys.ArrowUp) z -= 1;
  if (Input.keys.KeyS || Input.keys.ArrowDown) z += 1;
  // the thumbstick adds into the same vector, so a keyboard and a finger
  // behave identically from here on
  if (Input.stick.len > 0) { x += Input.stick.x; z += Input.stick.z; }
  const l = Math.hypot(x, z);
  if (l > 1) { x /= l; z /= l; }
  return { x: x, z: z, len: Math.min(1, l) };
}

/* -------------------- on-screen controls (touch) --------------------- */
/* These use pointer events rather than touch events, so one code path
   serves a thumb on a phone and a mouse in a test harness. */
function bindHold(el, onDown, onUp) {
  if (!el) return;
  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    Sfx.resume();
    el.classList.add('down');
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
    onDown();
  });
  const up = function () { el.classList.remove('down'); if (onUp) onUp(); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

function initTouchControls() {
  if (!IS_TOUCH) return;
  document.body.classList.add('touch');

  const pad = $('stick'), nub = $('stickNub');
  let pid = null, cx = 0, cy = 0, rad = 52;

  function release() {
    pid = null;
    Input.stick.x = 0; Input.stick.z = 0; Input.stick.len = 0;
    if (nub) nub.style.transform = 'translate(0px,0px)';
  }
  function drive(e) {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / rad);
    dx /= d; dy /= d;
    // small dead zone so resting a thumb does not creep forward
    const dead = 0.16;
    const amt = k < dead ? 0 : (k - dead) / (1 - dead);
    Input.stick.x = dx * amt;
    Input.stick.z = dy * amt;
    Input.stick.len = amt;
    nub.style.transform = 'translate(' + (dx * k * rad).toFixed(1) + 'px,' +
      (dy * k * rad).toFixed(1) + 'px)';
  }

  if (pad && nub) {
    pad.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      Sfx.resume();
      pid = e.pointerId;
      const r = pad.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      rad = r.width * 0.40;
      if (pad.setPointerCapture) { try { pad.setPointerCapture(pid); } catch (err) {} }
      drive(e);
    });
    pad.addEventListener('pointermove', function (e) {
      if (e.pointerId === pid) { e.preventDefault(); drive(e); }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) {
      pad.addEventListener(n, function (e) {
        if (pid === null || e.pointerId === pid) release();
      });
    });
  }

  bindHold($('btnPet'), function () { Game.onKeyPress('KeyP'); });
  bindHold($('btnJump'),
    function () { Input.keys.Space = true; },
    function () { setTimeout(function () { Input.keys.Space = false; }, 90); });
  // sprint is a toggle: holding a run button with the other thumb busy is
  // no fun on a phone
  bindHold($('btnRun'), function () {
    const on = !Input.keys.ShiftLeft;
    Input.keys.ShiftLeft = on;
    $('btnRun').classList.toggle('on', on);
  });
  bindHold($('btnPause'), function () { Game.onKeyPress('Escape'); });
  bindHold($('btnFinish'), function () { Game.onKeyPress('Enter'); });

  window.addEventListener('blur', release);
  release();
}
