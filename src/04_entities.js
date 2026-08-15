'use strict';
/* ========================= collision helpers ========================= */
function resolveWorld(pos, radius) {
  const b = World.bounds;
  if (b.type === 'circle') {
    const d = Math.hypot(pos.x, pos.z);
    const max = b.r - radius;
    if (d > max && d > 0.0001) { const s = max / d; pos.x *= s; pos.z *= s; }
  } else {
    pos.x = clamp(pos.x, b.minX + radius, b.maxX - radius);
    pos.z = clamp(pos.z, b.minZ + radius, b.maxZ - radius);
  }
  for (let i = 0; i < World.obstacles.length; i++) {
    const o = World.obstacles[i];
    const dx = pos.x - o.x, dz = pos.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + radius;
    if (d < min) {
      if (d < 0.0001) { pos.x += min; }
      else { const s = (min - d) / d; pos.x += dx * s; pos.z += dz * s; }
    }
  }
}

/* =============================== player ============================== */
const Player = {
  obj: null, parts: null,
  pos: new THREE.Vector3(),
  facing: Math.PI,
  radius: 0.55,
  y: 0, vy: 0, onGround: true,
  hurtT: 0, petAnim: 0, walkT: 0, speedNow: 0, bobT: 0,

  init: function () {
    const m = makePlayer();
    this.obj = m.group;
    this.parts = m.parts;
    scene.add(this.obj);
  },
  place: function () {
    this.pos.copy(World.playerStart);
    this.facing = World.playerFacing;
    this.y = 0; this.vy = 0; this.onGround = true;
    this.hurtT = 0; this.petAnim = 0;
    Cam.yaw = World.playerFacing + Math.PI;
    Cam.pitch = 0.28;
    this.obj.position.set(this.pos.x, 0, this.pos.z);
    this.obj.rotation.y = this.facing;
  },
  speed: function () {
    let s = CFG.playerSpeed * State.speedMul;
    if (Input.keys.ShiftLeft || Input.keys.ShiftRight) s *= CFG.sprintMul;
    if (State.buffs.speed > 0) s *= 1.6;
    return s;
  },
  petRange: function () { return CFG.petRange + State.petRangeBonus; },

  update: function (dt) {
    const mv = moveInput();
    const sp = this.speed();
    // Camera-relative movement. The camera orbits to (sin yaw, cos yaw)
    // behind the player, so the direction it looks is forward = (-sin, -cos)
    // and screen-right = (cos, -sin). W gives mv.z = -1, hence the -mv.z.
    const sin = Math.sin(Cam.yaw), cos = Math.cos(Cam.yaw);
    let wx = mv.x * cos + mv.z * sin;
    let wz = mv.z * cos - mv.x * sin;
    const target = mv.len > 0.01 ? sp : 0;
    this.speedNow = damp(this.speedNow, target, CFG.accel, dt);
    if (mv.len > 0.01) {
      this.pos.x += wx * this.speedNow * dt;
      this.pos.z += wz * this.speedNow * dt;
      this.facing = Math.atan2(wx, wz);
    }
    // jump / gravity
    if ((Input.keys.Space) && this.onGround) {
      this.vy = CFG.jumpVel; this.onGround = false; Sfx.thud();
    }
    if (!this.onGround) {
      this.vy -= CFG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    }
    resolveWorld(this.pos, this.radius);

    // model transform
    this.obj.position.set(this.pos.x, this.y, this.pos.z);
    let ry = this.obj.rotation.y;
    let diff = ((this.facing - ry + Math.PI * 3) % TAU) - Math.PI;
    this.obj.rotation.y = ry + diff * Math.min(1, dt * 14);

    // animation
    const moving = this.speedNow > 0.4;
    this.walkT += dt * (moving ? this.speedNow * 1.5 : 0);
    const swing = Math.sin(this.walkT) * (moving ? 0.7 : 0);
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.8;
    this.bobT += dt * (moving ? this.speedNow * 3 : 2);
    this.parts.body.position.y = moving ? Math.abs(Math.sin(this.walkT)) * 0.06 : Math.sin(this.bobT * 0.6) * 0.02;
    // pet arm animation
    if (this.petAnim > 0) {
      this.petAnim = Math.max(0, this.petAnim - dt);
      const t = 1 - this.petAnim / 0.45;
      this.parts.armR.rotation.x = -2.1 + Math.sin(t * Math.PI * 3) * 0.5;
    } else {
      this.parts.armR.rotation.x = damp(this.parts.armR.rotation.x, swing * 0.8, 12, dt);
    }
    if (this.hurtT > 0) this.hurtT -= dt;
    // hurt flicker
    const vis = this.hurtT > 0 ? (Math.floor(this.hurtT * 18) % 2 === 0) : true;
    this.obj.visible = vis || State.buffs.invin > 0;
    // invincibility shimmer
    if (State.buffs.invin > 0) {
      this.obj.visible = true;
      const s = 1 + Math.sin(Game.t * 12) * 0.03;
      this.obj.scale.setScalar(s);
    } else {
      this.obj.scale.setScalar(1);
    }
  }
};

/* =============================== camera ============================== */
const Cam = {
  yaw: 0, pitch: 0.28, shake: 0, dist: CFG.camDist,
  update: function (dt) {
    const sens = 0.0026;
    this.yaw -= Input.dx * sens;
    this.pitch = clamp(this.pitch + Input.dy * sens, -0.28, 1.05);
    Input.dx = 0; Input.dy = 0;
    // keyboard camera nudge (also lets the game be played without a mouse)
    if (Input.keys.KeyQ) this.yaw += dt * 1.9;
    if (Input.keys.KeyE) this.yaw -= dt * 1.9;

    const tx = Player.pos.x, ty = Player.y + 1.5, tz = Player.pos.z;
    const d = this.dist;
    const h = Math.sin(this.pitch) * d;
    const flat = Math.cos(this.pitch) * d;
    let cx = tx + Math.sin(this.yaw) * flat;
    let cz = tz + Math.cos(this.yaw) * flat;
    let cy = ty + h + 1.2;
    // keep the camera inside the room so we do not see through walls
    const b = World.bounds;
    if (b.type === 'circle') {
      const dd = Math.hypot(cx, cz);
      const max = b.r - 0.4;
      if (dd > max) { const s = max / dd; cx *= s; cz *= s; cy += (dd - max) * 0.35; }
    } else {
      cx = clamp(cx, b.minX - 1, b.maxX + 1);
      cz = clamp(cz, b.minZ - 1, b.maxZ + 6);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      cx += rand(-1, 1) * this.shake * 0.5;
      cy += rand(-1, 1) * this.shake * 0.5;
    }
    camera.position.set(cx, Math.max(0.8, cy), cz);
    camera.lookAt(tx, ty + 0.2, tz);
  }
};

/* ================================ cats =============================== */
const Cats = [];

class Cat {
  constructor(kind, variant, pos) {
    this.kind = kind;
    this.k = CAT_KINDS[kind];
    this.v = variant;
    this.name = variant.name;
    const m = makeCat(kind, variant);
    this.obj = m.group;
    this.parts = m.parts;
    this.obj.scale.setScalar(this.k.scale);
    this.pos = pos.clone();
    this.obj.position.copy(this.pos);
    this.heading = rand(0, TAU);
    this.obj.rotation.y = this.heading;
    this.radius = 0.55 * this.k.scale;
    this.state = 'roam';
    this.stateT = 0;
    this.wanderT = rand(0.5, 2.5);
    this.stamina = rand(2.6, 4.2);
    this.cool = rand(0.4, 1.6);
    this.walkT = rand(0, 6);
    this.speedNow = 0;
    this.petted = false;
    this.sitT = 0;
    this.hitDone = false;
    this.purrT = 0;
    this.aggroed = false;
    this.label = makeLabel(this.name, '#ffffff');
    World.group.add(this.obj);
    World.group.add(this.label);
  }

  setState(s) { this.state = s; this.stateT = 0; }

  get pettable() {
    if (this.petted) return false;
    if (!this.k.aggressive) return true;
    if (State.buffs.invin > 0) return true;
    return this.state === 'roam' || this.state === 'recover';
  }

  distTo(p) { return Math.hypot(this.pos.x - p.x, this.pos.z - p.z); }

  pet() {
    this.petted = true;
    this.setState('petted');
    this.speedNow = 0;
    Sfx.purr();
    // big cats meow lower; small ones chirp
    Sfx.meowHappy(this.k.scale > 1.4 ? 0.55 : 1.05);
    Particles.hearts(this.pos, this.k.scale, 7);
    setLabel(this.label, '<3 ' + this.name, '#72BC8F');
  }

  hurtPlayer() {
    if (this.hitDone) return;
    const d = this.distTo(Player.pos);
    if (d < this.radius + Player.radius + 0.85) {
      this.hitDone = true;
      Game.damagePlayer(this.k.damage, this);
    }
  }

  update(dt) {
    this.stateT += dt;
    if (this.petted) { this.animateSit(dt); this.updateLabel(); return; }

    const d = this.distTo(Player.pos);
    const toPX = Player.pos.x - this.pos.x, toPZ = Player.pos.z - this.pos.z;
    const toAngle = Math.atan2(toPX, toPZ);
    let speed = 0;
    const k = this.k;

    switch (this.state) {
      case 'roam': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = rand(1.4, 3.4);
          this.heading += rand(-1.5, 1.5);
          this.pauseT = Math.random() < 0.35 ? rand(0.6, 1.6) : 0;
        }
        if (this.pauseT > 0) { this.pauseT -= dt; speed = 0; }
        else speed = 1.7;
        if (!k.aggressive && d < 8.5) { this.setState('flee'); Sfx.meow(rand(0.9, 1.2)); }
        if (k.aggressive && d < k.aggro) {
          this.setState('chase');
          if (!this.aggroed) { this.aggroed = true; Sfx.growl(); }
          setLabel(this.label, this.name, '#E97366');
        }
        break;
      }
      case 'flee': {
        this.stamina -= dt;
        const tired = this.stamina <= 0;
        if (tired && this.stamina < -1.5) { this.stamina = rand(2.4, 3.6); }
        speed = tired ? k.speed * 0.42 : k.speed;
        // run away, and steer toward open space
        let away = toAngle + Math.PI;
        const b = World.bounds;
        let cx = 0, cz = 0;
        if (b.type === 'rect') { cx = (b.minX + b.maxX) / 2; cz = (b.minZ + b.maxZ) / 2; }
        const edge = b.type === 'circle'
          ? Math.hypot(this.pos.x, this.pos.z) > b.r - 4
          : (this.pos.x < b.minX + 4 || this.pos.x > b.maxX - 4 || this.pos.z < b.minZ + 4 || this.pos.z > b.maxZ - 4);
        if (edge) {
          const toCenter = Math.atan2(cx - this.pos.x, cz - this.pos.z);
          away = angleLerp(away, toCenter, 0.55);
        }
        this.heading = angleLerp(this.heading, away + Math.sin(Game.t * 2 + this.walkT) * 0.35, Math.min(1, dt * 6));
        if (d > 13) this.setState('roam');
        break;
      }
      case 'chase': {
        speed = k.speed;
        this.heading = angleLerp(this.heading, toAngle, Math.min(1, dt * 5));
        this.cool -= dt;
        if (d < 3.6 && this.cool <= 0) { this.setState('telegraph'); Sfx.hiss(); }
        if (d > k.aggro + 6) { this.setState('roam'); setLabel(this.label, this.name, '#ffffff'); }
        break;
      }
      case 'telegraph': {
        speed = 0;
        this.heading = angleLerp(this.heading, toAngle, Math.min(1, dt * 8));
        if (this.stateT > 0.5) { this.setState('lunge'); this.hitDone = false; this.lungeDir = this.heading; }
        break;
      }
      case 'lunge': {
        speed = k.lunge;
        this.heading = this.lungeDir;
        this.hurtPlayer();
        if (this.stateT > 0.36) { this.setState('recover'); setLabel(this.label, 'PET ME!', '#72BC8F'); }
        break;
      }
      case 'recover': {
        speed = 0;
        if (this.stateT > 1.45) {
          this.cool = 1.1;
          this.setState(d < k.aggro ? 'chase' : 'roam');
          setLabel(this.label, this.name, d < k.aggro ? '#E97366' : '#ffffff');
        }
        break;
      }
    }

    this.speedNow = damp(this.speedNow, speed, 10, dt);
    if (this.speedNow > 0.05) {
      this.pos.x += Math.sin(this.heading) * this.speedNow * dt;
      this.pos.z += Math.cos(this.heading) * this.speedNow * dt;
      resolveWorld(this.pos, this.radius);
    }
    this.obj.position.set(this.pos.x, 0, this.pos.z);
    let ry = this.obj.rotation.y;
    const diff = ((this.heading - ry + Math.PI * 3) % TAU) - Math.PI;
    this.obj.rotation.y = ry + diff * Math.min(1, dt * 10);

    this.animateWalk(dt);
    this.updateLabel();
  }

  animateWalk(dt) {
    const p = this.parts;
    const moving = this.speedNow > 0.2;
    this.walkT += dt * (moving ? 3 + this.speedNow * 1.9 : 1.2);
    const s = moving ? Math.sin(this.walkT) * clamp(this.speedNow * 0.12, 0.15, 0.8) : 0;
    p.legs[0].rotation.x = s;
    p.legs[1].rotation.x = -s;
    p.legs[2].rotation.x = -s;
    p.legs[3].rotation.x = s;
    p.body.position.y = 0.62 + (moving ? Math.abs(Math.sin(this.walkT * 2)) * 0.045 : Math.sin(this.walkT * 0.8) * 0.012);
    // tail
    let tailBase = -0.5;
    if (this.state === 'flee') tailBase = -1.5;
    if (this.state === 'telegraph' || this.state === 'chase') tailBase = -0.1;
    p.tail.rotation.x = damp(p.tail.rotation.x, tailBase, 6, dt);
    p.tail.rotation.y = Math.sin(this.walkT * 1.4) * (this.state === 'flee' ? 0.12 : 0.3);
    // crouch when telegraphing, stunned slump when recovering
    let bodyRotX = 0, bodyY = 1, headY = 0.36;
    if (this.state === 'telegraph') { bodyRotX = 0.12; bodyY = 0.72; }
    if (this.state === 'lunge') { bodyRotX = -0.16; }
    if (this.state === 'recover') { bodyRotX = 0.05; bodyY = 0.8; headY = 0.24; }
    p.body.rotation.x = damp(p.body.rotation.x, bodyRotX, 9, dt);
    p.body.scale.y = damp(p.body.scale.y, bodyY, 9, dt);
    p.head.position.y = damp(p.head.position.y, headY, 9, dt);
    p.head.rotation.z = this.state === 'recover' ? Math.sin(Game.t * 9) * 0.12 : damp(p.head.rotation.z, 0, 8, dt);
    p.eyes.forEach(function (e) { e.scale.y = damp(e.scale.y, 1, 8, dt); });
    // ears flatten when hostile
    const earTilt = (this.state === 'chase' || this.state === 'telegraph') ? 0.9 : 0;
    p.ears[0].rotation.z = damp(p.ears[0].rotation.z, 0.16 + earTilt, 8, dt);
    p.ears[1].rotation.z = damp(p.ears[1].rotation.z, -0.16 - earTilt, 8, dt);
  }

  animateSit(dt) {
    const p = this.parts;
    this.sitT += dt;
    p.body.rotation.x = damp(p.body.rotation.x, -0.34, 5, dt);
    p.body.position.y = damp(p.body.position.y, 0.52 + Math.sin(this.sitT * 2.2) * 0.014, 5, dt);
    p.legs[0].rotation.x = damp(p.legs[0].rotation.x, 0.34, 5, dt);
    p.legs[1].rotation.x = damp(p.legs[1].rotation.x, 0.34, 5, dt);
    p.legs[2].rotation.x = damp(p.legs[2].rotation.x, -1.35, 5, dt);
    p.legs[3].rotation.x = damp(p.legs[3].rotation.x, -1.35, 5, dt);
    p.tail.rotation.x = damp(p.tail.rotation.x, -1.75, 4, dt);
    p.tail.rotation.y = Math.sin(this.sitT * 2.4) * 0.5;
    p.head.rotation.x = damp(p.head.rotation.x, -0.16, 5, dt);
    p.head.rotation.z = damp(p.head.rotation.z, 0, 6, dt);
    p.eyes.forEach(function (e) { e.scale.y = damp(e.scale.y, 0.22, 5, dt); });
    p.ears[0].rotation.z = damp(p.ears[0].rotation.z, 0.05, 6, dt);
    p.ears[1].rotation.z = damp(p.ears[1].rotation.z, -0.05, 6, dt);
    p.body.scale.y = damp(p.body.scale.y, 1, 6, dt);
    this.purrT -= dt;
    if (this.purrT <= 0) {
      this.purrT = rand(2.4, 5);
      Particles.hearts(this.pos, this.k.scale, 2);
    }
    this.obj.position.set(this.pos.x, 0, this.pos.z);
  }

  updateLabel() {
    const d = this.distTo(Player.pos);
    const vis = d < 17;
    this.label.visible = vis;
    if (!vis) return;
    const h = 2.05 * this.k.scale + (this.petted ? -0.1 : 0);
    this.label.position.set(this.pos.x, h + 0.5, this.pos.z);
    const sc = clamp(0.9 + d * 0.035, 0.9, 1.5);
    this.label.scale.set(2.5 * sc, 0.62 * sc, 1);
  }

  dispose() {
    World.group.remove(this.obj);
    World.group.remove(this.label);
  }
}

function angleLerp(a, b, t) {
  const diff = ((b - a + Math.PI * 3) % TAU) - Math.PI;
  return a + diff * t;
}

/* ============================== pickups ============================== */
const Pickups = [];
class Pickup {
  constructor(type, pos) {
    this.type = type;
    this.pos = pos.clone();
    if (type === 'coin') {
      this.obj = makeCoin();
      this.obj.position.set(pos.x, 0.7, pos.z);
      this.r = 1.1;
    } else {
      const p = makePowerup(type);
      this.obj = p.group;
      this.core = p.core;
      this.ring = p.ring;
      this.obj.position.set(pos.x, 0, pos.z);
      this.r = 1.3;
    }
    this.t = rand(0, 6);
    this.taken = false;
    this.respawn = 0;
    World.group.add(this.obj);
  }
  update(dt) {
    this.t += dt;
    if (this.taken) {
      if (this.respawn > 0) {
        this.respawn -= dt;
        if (this.respawn <= 0) { this.taken = false; this.obj.visible = true; Sfx.coin(); }
      }
      return;
    }
    if (this.type === 'coin') {
      this.obj.rotation.y += dt * 2.6;
      this.obj.position.y = 0.7 + Math.sin(this.t * 2.4) * 0.12;
    } else {
      this.core.rotation.y += dt * 1.6;
      this.core.position.y = 0.62 + Math.sin(this.t * 2) * 0.14;
      this.ring.rotation.z += dt * 0.8;
      this.ring.scale.setScalar(1 + Math.sin(this.t * 3) * 0.07);
    }
    const d = Math.hypot(this.pos.x - Player.pos.x, this.pos.z - Player.pos.z);
    if (d < this.r) Game.collect(this);
  }
}

/* ============================= particles ============================= */
const Particles = {
  list: [],
  spawn: function (mesh, vel, life, spin) {
    World.group.add(mesh);
    this.list.push({ obj: mesh, vel: vel, life: life, max: life, spin: spin || 0 });
  },
  hearts: function (pos, scale, n) {
    for (let i = 0; i < n; i++) {
      const h = makeHeart(pick([0xE97398, 0xF4A0B8, 0xE7C34C]));
      h.position.set(pos.x + rand(-0.3, 0.3), 1.0 * scale + rand(0, 0.4), pos.z + rand(-0.3, 0.3));
      h.scale.multiplyScalar(rand(0.7, 1.3) * Math.max(0.8, scale * 0.8));
      this.spawn(h, new THREE.Vector3(rand(-0.5, 0.5), rand(1.4, 2.4), rand(-0.5, 0.5)), rand(0.9, 1.5), rand(-3, 3));
    }
  },
  puff: function (pos, color, n, power) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), glow(color, 0.9));
      m.position.set(pos.x, 1.0, pos.z);
      this.spawn(m, new THREE.Vector3(rand(-1, 1), rand(0.6, 2.2), rand(-1, 1)).multiplyScalar(power || 2), rand(0.4, 0.8), rand(-6, 6));
    }
  },
  update: function (dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        World.group.remove(p.obj);
        if (p.obj.geometry) p.obj.geometry.dispose();
        this.list.splice(i, 1);
        continue;
      }
      p.vel.y -= 2.2 * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      p.obj.rotation.z += p.spin * dt;
      const f = p.life / p.max;
      if (p.obj.material) { p.obj.material.opacity = Math.min(1, f * 1.6); p.obj.material.transparent = true; }
    }
  },
  clear: function () {
    this.list.forEach(function (p) { World.group.remove(p.obj); });
    this.list.length = 0;
  }
};
