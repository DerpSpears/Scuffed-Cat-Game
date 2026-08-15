'use strict';
/* ===================== low-poly model builders ======================= */

const MATS = {};
function mat(color, opts) {
  const key = color + '|' + JSON.stringify(opts || {});
  if (MATS[key]) return MATS[key];
  const o = Object.assign({ color: color, flatShading: true }, opts || {});
  const m = new THREE.MeshLambertMaterial(o);
  MATS[key] = m;
  return m;
}
function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}
function cyl(rt, rb, h, seg, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, { flatShading: seg <= 12 }));
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}
function cone(r, h, seg, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}
function ico(r, det, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det || 0), mat(color));
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}
function glow(color, opacity) {
  return new THREE.MeshBasicMaterial({ color: color, transparent: opacity !== undefined, opacity: opacity === undefined ? 1 : opacity });
}

/* ------------------------------ the cats ----------------------------- */
/* A cat faces +Z. Body length ~1.5 units at scale 1. */
function makeCat(kind, v) {
  const g = new THREE.Group();
  const parts = { legs: [], stripes: [] };
  const fur = v.fur, belly = v.belly || v.fur;

  const body = new THREE.Group();
  body.position.y = 0.62;
  g.add(body);
  parts.body = body;

  const torso = box(0.68, 0.56, 1.24, fur, 0, 0, 0);
  body.add(torso);
  body.add(box(0.5, 0.16, 1.0, belly, 0, -0.26, 0.02));           // belly
  body.add(box(0.62, 0.44, 0.34, fur, 0, 0.06, 0.72));            // chest/shoulders
  body.add(box(0.6, 0.42, 0.3, fur, 0, 0.02, -0.66));             // haunches

  // head
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.86);
  body.add(head);
  parts.head = head;
  head.add(box(0.46, 0.42, 0.44, fur, 0, 0, 0));
  head.add(box(0.26, 0.18, 0.16, belly, 0, -0.11, 0.26));         // muzzle
  head.add(box(0.07, 0.05, 0.05, 0xE79AA8, 0, -0.04, 0.33));      // nose
  const earL = cone(0.13, 0.24, 4, fur, -0.16, 0.28, 0.02);
  const earR = cone(0.13, 0.24, 4, fur, 0.16, 0.28, 0.02);
  earL.rotation.z = 0.16; earR.rotation.z = -0.16;
  head.add(earL); head.add(earR);
  parts.ears = [earL, earR];
  const eyeL = box(0.09, 0.11, 0.05, v.eyes, -0.13, 0.05, 0.225);
  const eyeR = box(0.09, 0.11, 0.05, v.eyes, 0.13, 0.05, 0.225);
  head.add(eyeL); head.add(eyeR);
  parts.eyes = [eyeL, eyeR];
  // whiskers
  const wm = mat(0xF2EFE9);
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 2; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.012), wm);
      w.position.set(s * 0.2, -0.08 + i * 0.06, 0.28);
      w.rotation.z = s * (0.1 + i * 0.12);
      head.add(w);
    }
  }

  // legs (pivot at hip)
  const legPos = [[-0.24, 0.46], [0.24, 0.46], [-0.24, -0.44], [0.24, -0.44]];
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Group();
    leg.position.set(legPos[i][0], -0.2, legPos[i][1]);
    const upper = box(0.17, 0.44, 0.18, fur, 0, -0.22, 0);
    leg.add(upper);
    leg.add(box(0.19, 0.1, 0.24, v.paws || fur, 0, -0.42, 0.03));
    body.add(leg);
    parts.legs.push(leg);
  }

  // tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.66);
  body.add(tail);
  parts.tail = tail;
  const tailLen = v.stub ? 0.34 : 0.9;
  const t1 = box(0.13, 0.13, tailLen, fur, 0, 0, -tailLen / 2);
  tail.add(t1);
  if (v.tuft) tail.add(ico(0.16, 0, v.mane || 0x6B4A2B, 0, 0, -tailLen - 0.08));
  if (v.stub) tail.add(box(0.14, 0.14, 0.1, 0x2A2320, 0, 0, -tailLen - 0.03));
  tail.rotation.x = -0.5;

  // markings
  if (v.stripes) {
    for (let i = 0; i < 5; i++) {
      const s = box(0.7, 0.06, 0.1, v.stripes, 0, 0.26, -0.42 + i * 0.22);
      body.add(s);
      const sl = box(0.06, 0.4, 0.1, v.stripes, -0.35, 0, -0.42 + i * 0.22);
      const sr = box(0.06, 0.4, 0.1, v.stripes, 0.35, 0, -0.42 + i * 0.22);
      body.add(sl); body.add(sr);
    }
    head.add(box(0.05, 0.24, 0.06, v.stripes, -0.09, 0.2, 0.0));
    head.add(box(0.05, 0.24, 0.06, v.stripes, 0.09, 0.2, 0.0));
  }
  if (v.spots) {
    for (let i = 0; i < 14; i++) {
      const s = box(0.1, 0.1, 0.1, v.spots, rand(-0.36, 0.36), rand(-0.16, 0.28), rand(-0.6, 0.6));
      const side = Math.random() < 0.5 ? -1 : 1;
      if (Math.random() < 0.5) s.position.x = side * 0.35;
      body.add(s);
    }
  }
  if (v.patches) {
    body.add(box(0.5, 0.3, 0.4, v.patches, 0.1, 0.2, -0.3));
    body.add(box(0.3, 0.3, 0.3, 0x4A4136, -0.2, 0.2, 0.3));
    head.add(box(0.24, 0.2, 0.3, v.patches, 0.12, 0.18, 0.02));
  }
  if (v.points) {
    head.add(box(0.3, 0.24, 0.2, v.points, 0, -0.06, 0.2));
    parts.ears.forEach((e) => { e.material = mat(v.points); });
    parts.legs.forEach((l) => { l.children[1].material = mat(v.points); });
    tail.children[0].material = mat(v.points);
  }
  if (v.tufts) {
    parts.ears.forEach((e) => {
      const t = cone(0.03, 0.16, 4, 0x2A2320, e.position.x, 0.44, 0.02);
      head.add(t);
    });
  }
  if (v.mane) {
    const mane = new THREE.Group();
    mane.position.set(0, 0.0, -0.06);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const s = ico(rand(0.16, 0.24), 0, v.mane, Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0);
      mane.add(s);
    }
    mane.add(ico(0.34, 0, v.mane, 0, 0, -0.1));
    head.add(mane);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: g, parts: parts };
}

/* ----------------------------- the player ---------------------------- */
function makePlayer() {
  const g = new THREE.Group();
  const parts = {};
  const body = new THREE.Group();
  g.add(body);
  parts.body = body;

  body.add(box(0.56, 0.66, 0.34, 0x5E9FE8, 0, 1.06, 0));            // jacket
  body.add(box(0.58, 0.14, 0.36, 0x2C4C74, 0, 0.76, 0));            // hem
  body.add(box(0.4, 0.1, 0.36, 0xE97366, 0, 1.34, 0.02));           // scarf

  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  body.add(head);
  parts.head = head;
  head.add(ico(0.26, 1, 0xE8B98F, 0, 0, 0));
  head.add(box(0.3, 0.16, 0.3, 0x3A3A38, 0, 0.16, 0));              // hair
  head.add(box(0.06, 0.06, 0.04, 0x2C2C2B, -0.09, 0.0, 0.23));
  head.add(box(0.06, 0.06, 0.04, 0x2C2C2B, 0.09, 0.0, 0.23));

  const armL = new THREE.Group(); armL.position.set(-0.34, 1.32, 0);
  armL.add(box(0.14, 0.56, 0.14, 0x4A86C8, 0, -0.28, 0));
  armL.add(box(0.15, 0.14, 0.15, 0xE8B98F, 0, -0.6, 0));
  const armR = new THREE.Group(); armR.position.set(0.34, 1.32, 0);
  armR.add(box(0.14, 0.56, 0.14, 0x4A86C8, 0, -0.28, 0));
  armR.add(box(0.15, 0.14, 0.15, 0xE8B98F, 0, -0.6, 0));
  body.add(armL); body.add(armR);
  parts.armL = armL; parts.armR = armR;

  const legL = new THREE.Group(); legL.position.set(-0.16, 0.76, 0);
  legL.add(box(0.19, 0.62, 0.2, 0x39424E, 0, -0.31, 0));
  legL.add(box(0.21, 0.12, 0.28, 0x2C2C2B, 0, -0.6, 0.04));
  const legR = new THREE.Group(); legR.position.set(0.16, 0.76, 0);
  legR.add(box(0.19, 0.62, 0.2, 0x39424E, 0, -0.31, 0));
  legR.add(box(0.21, 0.12, 0.28, 0x2C2C2B, 0, -0.6, 0.04));
  body.add(legL); body.add(legR);
  parts.legL = legL; parts.legR = legR;

  return { group: g, parts: parts };
}

/* ------------------------------ pickups ------------------------------ */
function makeCoin() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), new THREE.MeshLambertMaterial({ color: 0xEAC26B, emissive: 0x6A4E14 }));
  c.rotation.x = Math.PI / 2;
  g.add(c);
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), new THREE.MeshLambertMaterial({ color: 0xF6DFA6, emissive: 0x7A5C1C }));
  r.rotation.x = Math.PI / 2;
  g.add(r);
  return g;
}
function makePowerup(type) {
  const g = new THREE.Group();
  let core, color;
  if (type === 'speed') {
    color = 0x5E9FE8;
    core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color: color, emissive: 0x14314F }));
    core.scale.set(0.7, 1.3, 0.7);
  } else if (type === 'invin') {
    color = 0xEAC26B;
    core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color: color, emissive: 0x6A5216 }));
  } else {
    color = 0xF3F1EC;
    core = new THREE.Group();
    core.add(box(0.3, 0.4, 0.3, 0xF7F5F0, 0, 0, 0));
    core.add(cone(0.2, 0.16, 4, 0x5E9FE8, 0, 0.28, 0));
    core.add(box(0.31, 0.12, 0.31, 0x5E9FE8, 0, -0.08, 0));
  }
  core.position.y = 0.55;
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 5, 18), glow(color, 0.85));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  g.add(ring);
  const light = new THREE.PointLight(color, 0.5, 5);
  light.position.y = 0.7;
  g.add(light);
  return { group: g, core: core, ring: ring, light: light };
}
function makeHeart(color) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glow(color || 0xE97398, 0.95));
  m.scale.set(1, 0.8, 0.55);
  return m;
}

/* ------------------------------ scenery ------------------------------ */
function makeTree() {
  const g = new THREE.Group();
  const h = rand(1.6, 2.6);
  g.add(cyl(0.18, 0.24, h, 6, 0x6B4A32, 0, h / 2, 0));
  const c1 = cone(rand(1.0, 1.4), rand(1.8, 2.4), 6, 0x4E8B57, 0, h + 0.9, 0);
  const c2 = cone(rand(0.7, 1.0), rand(1.2, 1.6), 6, 0x5FA168, 0, h + 1.9, 0);
  g.add(c1); g.add(c2);
  return g;
}
function makeBush() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(ico(rand(0.4, 0.7), 0, i % 2 ? 0x4E8B57 : 0x5FA168, rand(-0.4, 0.4), rand(0.3, 0.6), rand(-0.4, 0.4)));
  return g;
}
function makeCrate(s) {
  s = s || 1;
  const g = new THREE.Group();
  g.add(box(1.3 * s, 1.3 * s, 1.3 * s, 0x8A6A42, 0, 0.65 * s, 0));
  g.add(box(1.34 * s, 0.14 * s, 1.34 * s, 0x6B5236, 0, 0.65 * s, 0));
  g.add(box(0.14 * s, 1.34 * s, 1.34 * s, 0x6B5236, 0, 0.65 * s, 0));
  return g;
}
function makePillar(h, color, accent) {
  const g = new THREE.Group();
  g.add(cyl(0.7, 0.8, h, 8, color, 0, h / 2, 0));
  g.add(box(2, 0.3, 2, accent, 0, 0.15, 0));
  g.add(box(1.9, 0.3, 1.9, accent, 0, h - 0.15, 0));
  return g;
}
function makeTorch(withLight) {
  const g = new THREE.Group();
  g.add(box(0.16, 0.9, 0.16, 0x4A3A2A, 0, 0.45, 0));
  const flame = ico(0.22, 0, 0xE8A33C, 0, 1.0, 0);
  flame.material = glow(0xF0B44C, 0.95);
  g.add(flame);
  let light = null;
  if (withLight) {
    light = new THREE.PointLight(0xFFB25A, 1.1, 16, 2);
    light.position.y = 1.1;
    g.add(light);
  }
  return { group: g, flame: flame, light: light };
}
function makeStairs(accent) {
  const g = new THREE.Group();
  // steps going up and away (-Z)
  for (let i = 0; i < 7; i++) {
    g.add(box(3.4, 0.3, 0.7, i % 2 ? 0x6E6A62 : 0x7C776E, 0, 0.15 + i * 0.32, -0.4 - i * 0.66));
  }
  // arch
  const arch = new THREE.Group();
  arch.add(box(0.5, 4.2, 0.5, 0x55504A, -2.0, 2.1, 0));
  arch.add(box(0.5, 4.2, 0.5, 0x55504A, 2.0, 2.1, 0));
  arch.add(box(4.5, 0.5, 0.5, 0x55504A, 0, 4.2, 0));
  g.add(arch);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.9), glow(accent || 0x5E9FE8, 0.24));
  veil.position.set(0, 2.0, 0.06);
  g.add(veil);
  const light = new THREE.PointLight(accent || 0x5E9FE8, 0, 14);
  light.position.set(0, 2.4, 1.0);
  g.add(light);
  return { group: g, veil: veil, light: light, arch: arch };
}
/* A chunky ink heart, drawn on a 2d canvas. */
function drawHeart(g, cx, cy, s, fill, stroke) {
  const top = cy - s * 0.35;
  g.beginPath();
  g.moveTo(cx, cy + s * 0.58);
  g.bezierCurveTo(cx - s * 1.05, cy - s * 0.15, cx - s * 0.55, top - s * 0.78, cx, top - s * 0.04);
  g.bezierCurveTo(cx + s * 0.55, top - s * 0.78, cx + s * 1.05, cy - s * 0.15, cx, cy + s * 0.58);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = Math.max(5, s * 0.14);
  g.lineJoin = 'round';
  g.strokeStyle = stroke;
  g.stroke();
}

/* The rooftop flag: a get-well banner with a heart, same paper-and-ink look
   as the menus. Two single-sided planes back to back so the lettering reads
   the right way round from either side instead of mirroring. */
function makeFlagBanner(w, h) {
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 360;
  const g = cv.getContext('2d');

  g.fillStyle = '#FFF9EC';
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = 'rgba(51,37,26,0.07)';
  g.lineWidth = 2;
  for (let y = 16; y < cv.height; y += 14) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke();
  }
  g.strokeStyle = '#33251A';
  g.lineWidth = 16;
  g.strokeRect(8, 8, cv.width - 16, cv.height - 16);

  const msg = 'Get well soon';
  let size = 78;
  while (size > 18) {
    g.font = '700 ' + size + 'px Fredoka, "Comic Sans MS", Verdana, sans-serif';
    if (g.measureText(msg).width <= cv.width - 110) break;
    size -= 2;
  }
  g.fillStyle = '#33251A';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(msg, cv.width / 2, 108);

  drawHeart(g, cv.width / 2, 246, 64, '#D4566A', '#33251A');

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: tex });
  const grp = new THREE.Group();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  back.rotation.y = Math.PI;
  back.position.z = -0.012;
  grp.add(front);
  grp.add(back);
  return grp;
}

function makeLabel(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const x = cv.getContext('2d');
  drawLabel(x, cv, text, color);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.6, 0.65, 1);
  sp.userData = { cv: cv, ctx: x, tex: tex, text: text };
  return sp;
}
function drawLabel(x, cv, text, color) {
  x.clearRect(0, 0, cv.width, cv.height);
  x.font = 'bold 30px -apple-system, Helvetica, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const w = Math.min(240, x.measureText(text).width + 34);
  x.fillStyle = 'rgba(16,16,18,0.72)';
  roundRect(x, (cv.width - w) / 2, 12, w, 40, 12);
  x.fill();
  x.fillStyle = color || '#ffffff';
  x.fillText(text, cv.width / 2, 33);
}
function setLabel(sprite, text, color) {
  if (!sprite || sprite.userData.text === text) return;
  sprite.userData.text = text;
  drawLabel(sprite.userData.ctx, sprite.userData.cv, text, color);
  sprite.userData.tex.needsUpdate = true;
}
function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r);
  x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
  x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r);
  x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py);
  x.closePath();
}
