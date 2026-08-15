'use strict';
/* ============================ game flow ============================== */
let renderer, scene, camera, clock, canvas;

const Game = {
  t: 0,
  pendingLevel: 1,
  bannerT: 0,
  hudT: 0,

  init: function () {
    canvas = $('c');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
    clock = new THREE.Clock();
    initInput(canvas);
    initTouchControls();
    Player.init();

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    });

    $('startBtn').addEventListener('click', function () { Game.start(); });
    $('resumeBtn').addEventListener('click', function () { Game.resume(); });
    $('restartLevelBtn').addEventListener('click', function () { show($('ovPause'), false); Game.startLevel(State.level); Game.setMode('playing'); });
    $('retryBtn').addEventListener('click', function () { Game.retry(); });
    $('deadShopBtn').addEventListener('click', function () { Game.openShop(true); });
    $('shopGo').addEventListener('click', function () { Game.leaveShop(); });
    $('shopBack').addEventListener('click', function () { Game.leaveShop(); });
    $('againBtn').addEventListener('click', function () { resetRun(); Game.start(); });
    $('ngMinus').addEventListener('click', function () { Game.setExtra(Meta.extra - 1); });
    $('ngPlusBtn').addEventListener('click', function () { Game.setExtra(Meta.extra + 1); });
    $('tnMinus').addEventListener('click', function () { Game.setExtra(Meta.extra - 1); });
    $('tnPlus').addEventListener('click', function () { Game.setExtra(Meta.extra + 1); });
    $('moreCatsBtn').addEventListener('click', function () {
      Game.setExtra(Meta.extra + 1);
      resetRun();
      Game.start();
    });
    this.renderNgPlus();

    // idle title scene so the canvas is never empty
    buildLevel(0);
    Player.place();
    Cam.yaw = Math.PI * 0.15; Cam.pitch = 0.35;
    Cam.update(0.016);
    this.loop();
  },

  setMode: function (m) {
    State.mode = m;
    show($('hud'), m === 'playing' || m === 'paused');
    show($('ovTitle'), m === 'title');
    show($('ovShop'), m === 'shop');
    show($('ovPause'), m === 'paused');
    show($('ovDead'), m === 'dead');
    show($('ovWin'), m === 'win');
    show($('touch'), IS_TOUCH && m === 'playing');
    if (m !== 'playing' && document.exitPointerLock && document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }
  },

  start: function () {
    Sfx.resume();
    resetRun();
    this.startLevel(0);
    this.setMode('playing');
    if (!IS_TOUCH && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  },

  /* ------------------------- level lifecycle ------------------------- */
  startLevel: function (idx) {
    State.level = idx;
    const L = buildLevel(idx);
    Cats.length = 0;
    Pickups.length = 0;
    Particles.clear();
    Player.place();
    State.hp = Math.max(1, State.hp);
    State.petted = 0;
    State.total = catCountFor(L);
    State.unlocked = State.total === 0;
    State.buffs.speed = 0;
    State.buffs.invin = 0;

    if (L.env === 'roof') {
      // every cat you actually petted is up here waiting for you
      this.buildTrophyRoof();
      const n = State.trophies.length;
      this.banner(L.eyebrow, L.name,
        n ? 'All ' + n + ' of them came up with you. Have a wander.' : L.sub);
    } else {
      this.spawnCats(L);
      for (let i = 0; i < L.coins; i++) Pickups.push(new Pickup('coin', randomSpot(1.2, false)));
      L.powerups.forEach(function (t) { Pickups.push(new Pickup(t, randomSpot(1.8, true))); });
      this.banner(L.eyebrow, L.name, L.sub);
    }
    this.refreshHud(true);
    this.updatePortal(0);
  },

  spawnCats: function (L) {
    let variants;
    if (L.kind === 'house') {
      variants = HOUSE_VARIANTS.slice();
      for (let i = variants.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        const tmp = variants[i]; variants[i] = variants[j]; variants[j] = tmp;
      }
    } else {
      variants = WILD_VARIANTS[L.kind].slice();
    }
    const n = catCountFor(L);
    for (let i = 0; i < n; i++) {
      // new game+ can ask for more cats than we have variants, so repeats
      // get a numeral: Marmalade, Marmalade II, Marmalade III...
      const base = variants[i % variants.length];
      const loop = Math.floor(i / variants.length);
      const v = loop > 0
        ? Object.assign({}, base, { name: base.name + (ROMAN[loop] || ' ' + (loop + 1)) })
        : base;
      const c = new Cat(L.kind, v, randomSpot(1.6, true));
      Cats.push(c);
    }
  },

  /* ----------------------------- actions ----------------------------- */
  tryPet: function () {
    let best = null, bestD = 1e9;
    const range = Player.petRange();
    for (let i = 0; i < Cats.length; i++) {
      const c = Cats[i];
      if (c.petted) continue;
      const d = c.distTo(Player.pos) - c.radius;
      if (d < range && d < bestD) { best = c; bestD = d; }
    }
    Player.petAnim = 0.45;
    if (!best) { Sfx.fail(); return; }
    if (!best.pettable) {
      Sfx.hiss();
      Particles.puff(best.pos, 0xE97366, 5, 1.4);
      this.toast('Too feisty! Wait for it to pounce, then pet.', 'red');
      return;
    }
    best.pet();
    State.petted++;
    State.pettedAll++;
    State.trophies.push({ kind: best.kind, variant: best.v, level: State.level });
    State.coins += best.k.coins;
    State.coinsTotal += best.k.coins;
    this.toast('Petted ' + best.name + ' the ' + best.k.label.toLowerCase() + '  +' + best.k.coins + ' coins', 'green');
    this.refreshHud(true);
    if (State.petted >= State.total && !State.unlocked) {
      State.unlocked = true;
      Sfx.unlock();
      const last = State.level >= 3;
      this.banner('All cats petted', last ? 'The roof is open' : 'The stairs are unlocked',
        last ? 'Climb up to the rooftop.' : 'Head through the glowing arch.');
    }
  },

  damagePlayer: function (dmg, cat) {
    if (State.mode !== 'playing') return;
    if (State.buffs.invin > 0) {
      Particles.puff(Player.pos, 0xEAC26B, 6, 2);
      Sfx.power();
      return;
    }
    if (Player.hurtT > 0) return;
    State.hp -= dmg;
    Player.hurtT = CFG.hurtIFrames;
    Cam.shake = 1.1;
    Sfx.hurt();
    Particles.puff(Player.pos, 0xE97366, 7, 2.4);
    const fl = $('flash');
    fl.style.opacity = '0.34';
    setTimeout(function () { fl.style.opacity = '0'; }, 110);
    // knockback
    if (cat) {
      const dx = Player.pos.x - cat.pos.x, dz = Player.pos.z - cat.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      Player.pos.x += (dx / l) * 2.1;
      Player.pos.z += (dz / l) * 2.1;
      resolveWorld(Player.pos, Player.radius);
      State.lastKiller = cat.name + ' the ' + cat.k.label.toLowerCase();
    }
    this.refreshHud(true);
    if (State.hp <= 0) { State.hp = 0; this.die(); }
  },

  collect: function (p) {
    p.taken = true;
    p.obj.visible = false;
    if (p.type === 'coin') {
      State.coins += 1; State.coinsTotal += 1;
      Sfx.coin();
      Particles.puff(p.pos, 0xEAC26B, 3, 1.6);
    } else if (p.type === 'speed') {
      State.buffs.speed = CFG.speedBuffTime * State.powerDurMul;
      Sfx.power();
      this.toast('Speed boost! ' + Math.round(State.buffs.speed) + 's', 'blue');
      p.respawn = CFG.powerRespawn;
      Particles.puff(p.pos, 0x5E9FE8, 8, 2.2);
    } else if (p.type === 'invin') {
      State.buffs.invin = CFG.invinBuffTime * State.powerDurMul;
      Sfx.power();
      this.toast('Invincible! Big cats can be petted freely.', 'gold');
      p.respawn = CFG.powerRespawn;
      Particles.puff(p.pos, 0xEAC26B, 8, 2.2);
    } else if (p.type === 'milk') {
      const before = State.hp;
      State.hp = Math.min(State.maxHp, State.hp + CFG.milkHeal);
      Sfx.power();
      this.toast('Milk. +' + Math.round(State.hp - before) + ' health', 'green');
      p.respawn = CFG.powerRespawn * 1.4;
      Particles.puff(p.pos, 0xF3F1EC, 6, 1.8);
    }
    this.refreshHud(true);
  },

  die: function () {
    State.deaths++;
    $('deadTitle').textContent = State.lastKiller ? State.lastKiller.charAt(0).toUpperCase() + State.lastKiller.slice(1) + ' disagreed with you' : 'You got mauled';
    $('deadPetted').textContent = State.petted + ' / ' + State.total;
    $('deadCoins').textContent = State.coins;
    this.setMode('dead');
  },

  retry: function () {
    State.hp = State.maxHp;
    State.pettedAll -= State.petted;
    // the floor resets, so its cats stop counting as rooftop trophies
    const lvl = State.level;
    State.trophies = State.trophies.filter(function (t) { return t.level !== lvl; });
    this.startLevel(State.level);
    this.setMode('playing');
  },

  enterPortal: function () {
    this.pendingLevel = State.level + 1;
    if (this.pendingLevel >= LEVELS.length - 1) {
      // straight to the rooftop
      this.startLevel(LEVELS.length - 1);
      this.setMode('playing');
      return;
    }
    this.openShop(false);
  },

  /* ------------------------------- shop ------------------------------ */
  openShop: function (fromDeath) {
    this.shopFromDeath = !!fromDeath;
    $('shopEyebrow').textContent = fromDeath ? 'Regroup' : 'Floor cleared - ' + LEVELS[State.level].name;
    $('shopSub').textContent = fromDeath
      ? 'Spend what you have, then get back in there.'
      : 'Upgrades are permanent and carry across floors. Click, or press the number key.';
    $('shopGo').textContent = fromDeath ? 'Back to the floor' : 'Next floor: ' + LEVELS[Math.min(this.pendingLevel, LEVELS.length - 1)].name;
    this.renderShop();
    this.setMode('shop');
  },

  renderShop: function () {
    $('shopWallet').textContent = State.coins + (State.coins === 1 ? ' coin' : ' coins');
    const host = $('shopItems');
    host.innerHTML = '';
    SHOP.forEach(function (item, i) {
      const owned = State.bought[item.id] || 0;
      const price = Game.priceOf(item);
      const maxed = owned >= item.max;
      const el = document.createElement('div');
      el.className = 'item' + (maxed ? ' maxed' : '');
      const lvTxt = item.id === 'heal' ? '' : '<div class="lv">Owned ' + owned + ' / ' + item.max + '</div>';
      el.innerHTML =
        '<div class="idx">' + (i + 1) + '</div>' +
        '<div class="txt"><div class="nm">' + item.name + '</div><div class="ds">' + item.desc + '</div>' + lvTxt + '</div>' +
        '<button class="btn buy" ' + (maxed || State.coins < price ? 'disabled' : '') + '>' + (maxed ? 'Maxed' : price + ' coins') + '</button>';
      el.querySelector('button').addEventListener('click', function () { Game.buy(i); });
      host.appendChild(el);
    });
  },
  priceOf: function (item) {
    const owned = State.bought[item.id] || 0;
    return Math.round(item.base * Math.pow(item.grow, owned));
  },
  buy: function (i) {
    const item = SHOP[i];
    if (!item) return;
    const owned = State.bought[item.id] || 0;
    const price = this.priceOf(item);
    if (owned >= item.max || State.coins < price) { Sfx.fail(); return; }
    State.coins -= price;
    State.bought[item.id] = owned + 1;
    item.apply();
    Sfx.power();
    this.renderShop();
    this.refreshHud(true);
  },
  leaveShop: function () {
    if (this.shopFromDeath) { this.retry(); return; }
    this.startLevel(this.pendingLevel);
    this.setMode('playing');
    if (!IS_TOUCH && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  },

  setExtra: function (v) {
    Meta.extra = clamp(Math.round(v), 0, MAX_EXTRA);
    metaSave();
    Sfx.coin();
    this.renderNgPlus();
  },

  renderNgPlus: function () {
    show($('ngPlus'), !!Meta.cleared);
    show($('titleNg'), !!Meta.cleared);
    const label = Meta.extra === 0 ? 'Standard tower' : '+' + Meta.extra + ' per floor';
    const total = totalCatsPlanned() + ' cats';
    ['ngExtra', 'tnExtra'].forEach(function (id) { if ($(id)) $(id).textContent = label; });
    ['ngTotal', 'tnTotal', 'catTotalTxt'].forEach(function (id) { if ($(id)) $(id).textContent = total; });
  },

  /* The rooftop is a gallery of the cats this run actually petted. */
  buildTrophyRoof: function () {
    let tro = State.trophies.slice();
    if (!tro.length) {
      tro = [
        { kind: 'house', variant: HOUSE_VARIANTS[0] },
        { kind: 'house', variant: HOUSE_VARIANTS[1] },
        { kind: 'bobcat', variant: WILD_VARIANTS.bobcat[0] },
        { kind: 'tiger', variant: WILD_VARIANTS.tiger[0] },
        { kind: 'lion', variant: WILD_VARIANTS.lion[0] }
      ];
    }
    // concentric rings, outer rings hold more, everyone faces the middle
    const rings = [];
    let left = tro.length, r = 0;
    while (left > 0) { const n = Math.min(6 + r * 5, left); rings.push(n); left -= n; r++; }
    const cz = -1.5;
    let idx = 0;
    rings.forEach(function (n, ri) {
      const rad = Math.min(12.4, 4.4 + ri * 3.1);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (ri % 2 ? Math.PI / n : 0);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad + cz;
        const t = tro[idx++];
        const c = new Cat(t.kind, t.variant, new THREE.Vector3(x, 0, z));
        c.heading = Math.atan2(-x, cz - z);
        c.obj.rotation.y = c.heading;
        c.petted = true;
        c.setState('petted');
        Cats.push(c);
      }
    });
  },

  /* Wall of fame: every cat this climb actually petted, by species. */
  renderRoster: function () {
    const box = $('winRoster');
    if (!box) return;
    const order = ['house', 'bobcat', 'tiger', 'lion'];
    const nice = { house: 'House cats', bobcat: 'Bobcats', tiger: 'Tigers', lion: 'Lions' };
    const groups = {};
    State.trophies.forEach(function (t) {
      const n = t.variant && t.variant.name ? t.variant.name : 'Cat';
      (groups[t.kind] = groups[t.kind] || []).push(n);
    });
    let html = '';
    order.forEach(function (k) {
      const names = groups[k];
      if (!names || !names.length) return;
      html += '<div class="rgroup"><div class="rhead">' + nice[k] +
        ' <span>' + names.length + '</span></div><div class="rnames">';
      names.forEach(function (n) { html += '<span class="cchip ' + k + '">' + n + '</span>'; });
      html += '</div></div>';
    });
    box.innerHTML = html || '<div class="rgroup"><div class="rhead">No cats petted this time</div></div>';
  },

  win: function () {
    Sfx.win();
    Meta.cleared = true;
    Meta.clears = (Meta.clears || 0) + 1;
    metaSave();
    this.renderNgPlus();
    this.renderRoster();
    $('winPetted').textContent = State.pettedAll;
    const isPb = !Meta.best || State.time < Meta.best;
    if (isPb) { Meta.best = State.time; metaSave(); }
    $('winTime').textContent = fmtTimeShort(State.time);
    const bestEl = $('winBest');
    if (bestEl) {
      bestEl.textContent = isPb
        ? 'New best time: ' + fmtTime(State.time)
        : 'Your best is ' + fmtTime(Meta.best) + ', this climb took ' + fmtTime(State.time);
      bestEl.classList.toggle('pb', isPb);
    }
    $('winCoins').textContent = State.coinsTotal;
    $('winDeaths').textContent = State.deaths;
    this.setMode('win');
  },

  pause: function () { if (State.mode === 'playing') this.setMode('paused'); },
  resume: function () {
    if (State.mode !== 'paused') return;
    this.setMode('playing');
    if (!IS_TOUCH && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
  },

  onKeyPress: function (code) {
    if (code === 'KeyM') { const m = Sfx.toggle(); this.toast(m ? 'Sound off' : 'Sound on', 'blue'); return; }
    if (State.mode === 'playing') {
      if (code === 'KeyP') this.tryPet();
      else if (code === 'Enter' && LEVELS[State.level].env === 'roof') this.win();
      else if (code === 'Escape' || code === 'KeyEscape') this.pause();
    } else if (State.mode === 'paused') {
      if (code === 'Escape' || code === 'Enter') this.resume();
    } else if (State.mode === 'shop') {
      if (code === 'Enter' || code === 'Escape') this.leaveShop();
      else if (code.indexOf('Digit') === 0) this.buy(parseInt(code.slice(5), 10) - 1);
    } else if (State.mode === 'dead') {
      if (code === 'Enter' || code === 'KeyR') this.retry();
      else if (code === 'KeyB') this.openShop(true);
    } else if (State.mode === 'title') {
      if (code === 'Enter' || code === 'Space') this.start();
    } else if (State.mode === 'win') {
      if (code === 'Enter') { resetRun(); this.start(); }
    }
  },

  /* -------------------------------- UI ------------------------------- */
  toast: function (msg, cls) {
    const host = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = msg;
    host.appendChild(el);
    if (host.children.length > 4) host.removeChild(host.firstChild);
    setTimeout(function () {
      el.style.transition = 'opacity .4s ease';
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
    }, 2600);
  },

  banner: function (eyebrow, title, sub) {
    $('bannerEyebrow').textContent = eyebrow || '';
    $('bannerTitle').textContent = title || '';
    $('bannerSub').textContent = sub || '';
    $('banner').style.opacity = '1';
    this.bannerT = 3.0;
  },

  refreshHud: function (force) {
    const L = LEVELS[State.level];
    $('levelNo').textContent = L.env === 'roof' ? 'Rooftop' : 'Level ' + L.no;
    $('levelName').textContent = L.name;
    $('catCount').textContent = L.env === 'roof'
      ? String(State.trophies.length)
      : State.petted + ' / ' + State.total;
    $('coinCount').textContent = State.coins;
    $('timeCount').textContent = fmtTime(State.time);
    $('timeCap').textContent = Meta.best ? 'best ' + fmtTimeShort(Meta.best) : 'time';
    // the roof has no stairs to walk into, so touch players need a button
    show($('btnFinish'), IS_TOUCH && L.env === 'roof' && State.mode === 'playing');
    const pct = clamp(State.hp / State.maxHp, 0, 1);
    $('hpfill').style.width = (pct * 100).toFixed(1) + '%';
    $('hpfill').style.background = pct > 0.5 ? 'var(--green)' : pct > 0.25 ? 'var(--orange)' : 'var(--red)';
    $('hpText').textContent = Math.max(0, Math.ceil(State.hp)) + ' / ' + State.maxHp;
    const chips = [];
    if (State.buffs.speed > 0) chips.push('<div class="chip speed">Speed ' + State.buffs.speed.toFixed(1) + 's</div>');
    if (State.buffs.invin > 0) chips.push('<div class="chip invin">Invincible ' + State.buffs.invin.toFixed(1) + 's</div>');
    if (State.unlocked && State.total > 0) chips.push('<div class="chip" style="color:var(--green)">Stairs open</div>');
    $('buffs').innerHTML = chips.join('');
  },

  updatePrompt: function () {
    const el = $('prompt');
    let txt = null, warn = false;
    let best = null, bestD = 1e9;
    const range = Player.petRange();
    for (let i = 0; i < Cats.length; i++) {
      const c = Cats[i];
      if (c.petted) continue;
      const d = c.distTo(Player.pos) - c.radius;
      if (d < bestD) { best = c; bestD = d; }
    }
    if (best && bestD < range) {
      if (best.pettable) txt = '<span class="key">P</span> Pet ' + best.name;
      else { txt = 'Dodge the pounce, then pet ' + best.name + ' while it recovers'; warn = true; }
    } else if (best && bestD < range + 2.4 && !best.pettable && best.k.aggressive) {
      txt = 'Wait for the pounce'; warn = true;
    }
    if (State.unlocked && World.portal) {
      const pd = Math.hypot(Player.pos.x - World.portal.pos.x, Player.pos.z - World.portal.pos.z);
      if (pd < 7) txt = 'Walk into the arch to climb';
    }
    if (LEVELS[State.level].env === 'roof') {
      txt = '<span class="key">Enter</span> Finish the climb';
      warn = false;
    }
    if (txt) { el.innerHTML = txt; el.classList.toggle('warn', warn); show(el, true); }
    else show(el, false);
  },

  updatePortal: function (dt) {
    const p = World.portal;
    if (!p) return;
    const on = State.unlocked;
    const target = on ? 0.55 + Math.sin(this.t * 3) * 0.18 : 0.1;
    p.veil.material.opacity = damp(p.veil.material.opacity, target, 6, dt || 0.016);
    p.light.intensity = damp(p.light.intensity, on ? 1.6 : 0, 5, dt || 0.016);
    if (on && State.mode === 'playing') {
      const d = Math.hypot(Player.pos.x - p.pos.x, Player.pos.z - p.pos.z);
      if (d < 2.6) this.enterPortal();
    }
  },

  /* ------------------------------- loop ------------------------------ */
  update: function (dt) {
    this.t += dt;
    if (State.mode === 'playing') {
      State.time += dt;
      if (State.buffs.speed > 0) State.buffs.speed = Math.max(0, State.buffs.speed - dt);
      if (State.buffs.invin > 0) State.buffs.invin = Math.max(0, State.buffs.invin - dt);
      Player.update(dt);
      for (let i = 0; i < Cats.length; i++) Cats[i].update(dt);
      for (let i = 0; i < Pickups.length; i++) Pickups[i].update(dt);
      Particles.update(dt);
      this.updatePortal(dt);
      this.updatePrompt();
      this.hudT -= dt;
      if (this.hudT <= 0) { this.hudT = 0.12; this.refreshHud(); }
    } else {
      // gentle idle animation everywhere else
      for (let i = 0; i < Cats.length; i++) {
        if (Cats[i].petted) Cats[i].animateSit(dt);
      }
      Particles.update(dt);
    }
    // torch flicker
    for (let i = 0; i < World.flames.length; i++) {
      const f = World.flames[i];
      const s = 0.85 + Math.sin(this.t * 9 + i * 2.1) * 0.12 + Math.random() * 0.06;
      f.flame.scale.setScalar(s);
      if (f.light) f.light.intensity = 0.95 + Math.sin(this.t * 11 + i) * 0.22;
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) $('banner').style.opacity = '0';
    }
    Cam.update(dt);
  },

  loop: function () {
    const self = this;
    function frame() {
      const dt = Math.min(clock.getDelta(), 0.05);
      self.update(dt);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
};

/* --------------------------- test/debug hooks ------------------------ */
window.GAME = {
  State: State, Game: Game, Player: Player, Cats: Cats, Pickups: Pickups, World: World, Cam: Cam,
  petAll: function () { Cats.forEach(function (c) { if (!c.petted) { c.pet(); State.petted++; State.pettedAll++; State.trophies.push({ kind: c.kind, variant: c.v, level: State.level }); State.coins += c.k.coins; State.coinsTotal += c.k.coins; } }); State.unlocked = true; Game.refreshHud(true); },
  teleport: function (x, z) { Player.pos.set(x, 0, z); },
  toPortal: function () { if (World.portal) Player.pos.set(World.portal.pos.x, 0, World.portal.pos.z + 3); },
  gotoLevel: function (i) { Game.startLevel(i); Game.setMode('playing'); },
  look: function (yaw, pitch) { Cam.yaw = yaw; if (pitch !== undefined) Cam.pitch = pitch; },
  press: function (code, ms) { Input.keys[code] = true; setTimeout(function () { Input.keys[code] = false; }, ms || 100); },
  errors: []
};
window.addEventListener('error', function (e) { window.GAME.errors.push(String(e.message)); });

Game.init();

/* ------------------- URL boot hooks (dev / QA only) ------------------
   index.html?level=2&pet=all&coins=40&cam=0.6,0.35  etc.               */
(function boot() {
  const q = new URLSearchParams(location.search);
  if (!q.has('level') && !q.has('shop') && !q.has('dead') && !q.has('win')) return;
  const lvl = clamp(parseInt(q.get('level') || '1', 10), 1, LEVELS.length) - 1;
  resetRun();
  Game.startLevel(lvl);
  Game.setMode('playing');
  if (q.get('pet') === 'all') window.GAME.petAll();
  if (q.has('coins')) State.coins = parseInt(q.get('coins'), 10);
  if (q.has('hp')) State.hp = parseInt(q.get('hp'), 10);
  if (q.has('buffs')) { State.buffs.speed = 9.4; State.buffs.invin = 6.2; }
  if (q.has('pos')) { const p = q.get('pos').split(','); Player.pos.set(+p[0], 0, +p[1]); }
  if (q.has('cam')) { const c = q.get('cam').split(','); Cam.yaw = +c[0]; if (c[1] !== undefined) Cam.pitch = +c[1]; }
  if (q.has('near')) {
    // drag every cat close to the player so a screenshot shows them
    const r = parseFloat(q.get('near')) || 6;
    Cats.forEach(function (c, i) {
      const a = (i / Math.max(1, Cats.length)) * TAU;
      c.pos.set(Player.pos.x + Math.cos(a) * r, 0, Player.pos.z + Math.sin(a) * r);
      c.obj.position.set(c.pos.x, 0, c.pos.z);
      c.heading = Math.atan2(Player.pos.x - c.pos.x, Player.pos.z - c.pos.z);
      c.obj.rotation.y = c.heading;
    });
  }
  if (q.has('toast')) Game.toast('Petted Marmalade the house cat  +3 coins', 'green');
  if (q.has('shop')) { Game.pendingLevel = Math.min(lvl + 1, LEVELS.length - 1); Game.openShop(false); }
  if (q.has('dead')) { State.lastKiller = 'Bramble the bobcat'; State.petted = 2; Game.die(); }
  if (q.has('win')) { State.pettedAll = 18; State.time = 372; State.coinsTotal = 61; State.deaths = 2; Game.win(); }
  Game.refreshHud(true);
})();
