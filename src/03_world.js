'use strict';
/* =========================== world building ========================== */

const World = {
  group: null,
  bounds: { type: 'rect', minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  obstacles: [],
  spawns: [],
  portal: null,
  playerStart: new THREE.Vector3(0, 0, 12),
  playerFacing: Math.PI,
  flames: [],
  indoor: false
};

function disposeGroup(g) {
  if (!g) return;
  g.traverse(function (o) {
    if (o.isMesh || o.isSprite) {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m && m !== undefined) {
        const arr = Array.isArray(m) ? m : [m];
        arr.forEach(function (mm) {
          // shared cached materials are reused: only dispose one-offs
          if (mm && !mm.__cached) { if (mm.map) mm.map.dispose(); }
        });
      }
    }
  });
  if (g.parent) g.parent.remove(g);
}
Object.keys(MATS).forEach(function (k) { MATS[k].__cached = true; });

function farEnough(x, z, list, minD) {
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (Math.hypot(x - o.x, z - o.z) < (o.r || 1) + minD) return false;
  }
  return true;
}
function randomSpot(minD, avoidPlayer) {
  const b = World.bounds;
  for (let tries = 0; tries < 120; tries++) {
    let x, z;
    if (b.type === 'circle') {
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (b.r - 2.5);
      x = Math.cos(a) * r; z = Math.sin(a) * r;
    } else {
      x = rand(b.minX + 2.5, b.maxX - 2.5);
      z = rand(b.minZ + 2.5, b.maxZ - 2.5);
    }
    if (!farEnough(x, z, World.obstacles, minD || 1.4)) continue;
    if (World.portal && Math.hypot(x - World.portal.pos.x, z - World.portal.pos.z) < 5) continue;
    if (avoidPlayer && Math.hypot(x - World.playerStart.x, z - World.playerStart.z) < 6) continue;
    return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(rand(-6, 6), 0, rand(-6, 6));
}

function buildLevel(idx) {
  const L = LEVELS[idx];
  if (World.group) disposeGroup(World.group);
  World.group = new THREE.Group();
  World.obstacles = [];
  World.spawns = [];
  World.flames = [];
  World.portal = null;
  scene.add(World.group);

  // clear old lights
  Lights.forEach(function (l) { scene.remove(l); });
  Lights.length = 0;

  if (L.env === 'courtyard') buildCourtyard(L);
  else if (L.env === 'interior') buildInterior(L);
  else buildRoof(L);

  return L;
}

const Lights = [];
function addLight(l) { scene.add(l); Lights.push(l); return l; }

/* ----------------------------- level 1 ------------------------------- */
function buildCourtyard(L) {
  const G = World.group;
  World.indoor = false;
  World.bounds = { type: 'rect', minX: -23, maxX: 23, minZ: -24, maxZ: 19 };
  World.playerStart.set(0, 0, 14);
  World.playerFacing = Math.PI;

  scene.background = new THREE.Color(0x8FC0E8);
  scene.fog = new THREE.Fog(0x8FC0E8, 55, 130);

  addLight(new THREE.HemisphereLight(0xBFE0FF, 0x4E7A46, 0.95));
  const sun = new THREE.DirectionalLight(0xFFF3DC, 1.25);
  sun.position.set(-18, 30, 16);
  addLight(sun);

  // ground
  const ground = box(150, 1, 150, 0x5B9450, 0, -0.5, -10);
  G.add(ground);
  for (let i = 0; i < 40; i++) {
    const p = box(rand(2, 6), 0.06, rand(2, 6), i % 2 ? 0x67A159 : 0x538A4A, rand(-45, 45), 0.02, rand(-45, 30));
    G.add(p);
  }
  // stone path to the door
  for (let z = 17; z > -24; z -= 2.2) {
    G.add(box(5.4, 0.12, 1.9, z % 4 < 2 ? 0x9A958C : 0x8D887F, 0, 0.05, z));
  }

  // the tower itself
  const tower = new THREE.Group();
  tower.position.set(0, 0, -38);
  const bodyR = 13;
  tower.add(cyl(bodyR - 1.5, bodyR, 46, 16, 0x8D887F, 0, 23, 0));
  for (let i = 0; i < 5; i++) {
    tower.add(cyl(bodyR - 1.2 - i * 0.28, bodyR - 1.1 - i * 0.28, 0.6, 16, 0x777268, 0, 9 + i * 9, 0));
  }
  // windows
  for (let f = 0; f < 4; f++) {
    for (let a = 0; a < 5; a++) {
      const ang = -0.9 + a * 0.45;
      const w = box(1.5, 2.4, 0.5, 0x2A2A2E, Math.sin(ang) * (bodyR - 1.4), 7 + f * 9, Math.cos(ang) * (bodyR - 1.4) + 0.2);
      w.rotation.y = ang;
      tower.add(w);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.9), glow(0xF0B44C, 0.75));
      gl.position.set(Math.sin(ang) * (bodyR - 1.1), 7 + f * 9, Math.cos(ang) * (bodyR - 1.1) + 0.28);
      gl.rotation.y = ang;
      tower.add(gl);
    }
  }
  // battlements + roof cone
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    tower.add(box(2.6, 1.8, 1.6, 0x777268, Math.cos(a) * (bodyR - 1.6), 46.4, Math.sin(a) * (bodyR - 1.6)));
  }
  tower.add(cone(9.5, 9, 8, 0xB5544A, 0, 51.5, 0));
  G.add(tower);

  // door frame at the tower base = the portal
  const st = makeStairs(0x5E9FE8);
  st.group.position.set(0, 0, -24.2);
  G.add(st.group);
  const doorway = box(6.4, 8.4, 1.2, 0x6B655C, 0, 4.2, -25.6);
  G.add(doorway);
  G.add(box(5.0, 7.0, 1.0, 0x201E1C, 0, 3.6, -25.2));
  World.portal = { pos: new THREE.Vector3(0, 0, -23.2), veil: st.veil, light: st.light, group: st.group };

  // hedge perimeter
  const b = World.bounds;
  for (let x = b.minX; x <= b.maxX; x += 3) {
    G.add(box(3.1, 1.5, 1.4, 0x3F7A44, x, 0.75, b.maxZ + 0.7));
    if (Math.abs(x) > 4) G.add(box(3.1, 1.5, 1.4, 0x3F7A44, x, 0.75, b.minZ - 0.7));
  }
  for (let z = b.minZ; z <= b.maxZ; z += 3) {
    G.add(box(1.4, 1.5, 3.1, 0x3F7A44, b.minX - 0.7, 0.75, z));
    G.add(box(1.4, 1.5, 3.1, 0x3F7A44, b.maxX + 0.7, 0.75, z));
  }

  // fountain
  const fx = 10, fz = 2;
  const fount = new THREE.Group();
  fount.position.set(fx, 0, fz);
  fount.add(cyl(2.4, 2.6, 0.9, 12, 0x9A958C, 0, 0.45, 0));
  fount.add(cyl(2.0, 2.0, 0.2, 12, 0x5E9FE8, 0, 0.86, 0));
  fount.add(cyl(0.3, 0.4, 1.8, 8, 0x8D887F, 0, 1.2, 0));
  fount.add(ico(0.5, 0, 0x7CB2EC, 0, 2.2, 0));
  G.add(fount);
  World.obstacles.push({ x: fx, z: fz, r: 2.7 });

  // trees, bushes, benches, flowers
  const spots = [[-15, 10], [-17, -2], [-12, -14], [14, -12], [17, 12], [-6, -18], [8, -18], [19, -4], [-19, 16]];
  spots.forEach(function (s) {
    const t = makeTree();
    t.position.set(s[0], 0, s[1]);
    G.add(t);
    World.obstacles.push({ x: s[0], z: s[1], r: 0.9 });
  });
  for (let i = 0; i < 14; i++) {
    const bs = makeBush();
    const p = randomSpot(2.2, false);
    bs.position.copy(p);
    G.add(bs);
    World.obstacles.push({ x: p.x, z: p.z, r: 1.0 });
  }
  [[-8, 8], [7, 12]].forEach(function (s) {
    const bench = new THREE.Group();
    bench.position.set(s[0], 0, s[1]);
    bench.add(box(3.2, 0.24, 1.0, 0x8A6A42, 0, 0.62, 0));
    bench.add(box(3.2, 0.9, 0.2, 0x8A6A42, 0, 1.05, -0.4));
    bench.add(box(0.24, 0.62, 0.9, 0x6B5236, -1.4, 0.31, 0));
    bench.add(box(0.24, 0.62, 0.9, 0x6B5236, 1.4, 0.31, 0));
    G.add(bench);
    World.obstacles.push({ x: s[0], z: s[1], r: 1.5 });
  });
  for (let i = 0; i < 60; i++) {
    const c = pick([0xE97398, 0xEAC26B, 0xF3F1EC, 0xBF8EDA]);
    G.add(box(0.16, 0.3, 0.16, c, rand(b.minX + 1, b.maxX - 1), 0.2, rand(b.minZ + 1, b.maxZ - 1)));
  }
}

/* --------------------------- levels 2 - 4 ---------------------------- */
function buildInterior(L) {
  const G = World.group;
  World.indoor = true;
  const R = 20;
  World.bounds = { type: 'circle', r: R - 1.4 };
  World.playerStart.set(0, 0, R - 6);
  World.playerFacing = Math.PI;

  scene.background = new THREE.Color(L.sky);
  scene.fog = new THREE.Fog(L.fog, 16, 62);

  addLight(new THREE.HemisphereLight(0xFFDFB0, 0x1A1512, 0.42));
  const key = new THREE.DirectionalLight(0xFFE0B4, 0.5);
  key.position.set(10, 24, 8);
  addLight(key);

  // floor + ceiling + wall
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.8, 24), mat(L.floor));
  floor.position.y = -0.4;
  G.add(floor);
  const inlay = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.1, 24), mat(L.accent));
  inlay.position.y = 0.03;
  G.add(inlay);
  const inlay2 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.45, R * 0.45, 0.12, 24), mat(L.floor));
  inlay2.position.y = 0.05;
  G.add(inlay2);

  const wallGeo = new THREE.CylinderGeometry(R + 0.6, R + 0.6, 11, 24, 1, true);
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ color: L.wall, side: THREE.BackSide, flatShading: true }));
  wall.position.y = 5.5;
  G.add(wall);
  const ceil = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.6, 0.6, 24), mat(0x14100E));
  ceil.position.y = 11.2;
  G.add(ceil);
  // rib arches on the wall
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const rib = box(0.8, 11, 0.8, L.accent, Math.cos(a) * (R - 0.1), 5.5, Math.sin(a) * (R - 0.1));
    rib.rotation.y = -a;
    G.add(rib);
  }

  // pillars
  const pillars = 6;
  for (let i = 0; i < pillars; i++) {
    const a = (i / pillars) * TAU + 0.4;
    const px = Math.cos(a) * 12.5, pz = Math.sin(a) * 12.5;
    const p = makePillar(11, L.wall, L.accent);
    p.position.set(px, 0, pz);
    G.add(p);
    World.obstacles.push({ x: px, z: pz, r: 1.15 });
  }

  // wall torches (only 4 carry real lights, for performance)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const t = makeTorch(i % 2 === 0);
    t.group.position.set(Math.cos(a) * (R - 0.9), 3.4, Math.sin(a) * (R - 0.9));
    G.add(t.group);
    World.flames.push(t);
  }

  // stairs up (the portal)
  const st = makeStairs(L.accent);
  st.group.position.set(0, 0, -(R - 3.4));
  G.add(st.group);
  G.add(box(7, 11, 1.4, L.wall, 0, 5.5, -(R - 1.6)));
  World.portal = { pos: new THREE.Vector3(0, 0, -(R - 4.6)), veil: st.veil, light: st.light, group: st.group };

  // stairs down (where you came from) - decoration
  const down = new THREE.Group();
  down.position.set(0, 0, R - 3.4);
  down.rotation.y = Math.PI;
  for (let i = 0; i < 5; i++) down.add(box(3.4, 0.3, 0.7, i % 2 ? 0x6E6A62 : 0x7C776E, 0, -0.15 - i * 0.0, -0.4 - i * 0.66));
  down.add(box(4.6, 0.4, 0.4, L.accent, 0, 0.2, -0.1));
  G.add(down);

  // clutter: crates, barrels, rugs, and level flavour
  const clutter = L.no === 2 ? 12 : L.no === 3 ? 8 : 6;
  for (let i = 0; i < clutter; i++) {
    const p = randomSpot(2.6, true);
    const c = makeCrate(rand(0.8, 1.25));
    c.position.copy(p);
    c.rotation.y = rand(0, TAU);
    G.add(c);
    World.obstacles.push({ x: p.x, z: p.z, r: 0.95 });
  }
  if (L.no === 3) {
    // gallery: statues on plinths
    for (let i = 0; i < 5; i++) {
      const p = randomSpot(3.0, true);
      const st2 = new THREE.Group();
      st2.position.copy(p);
      st2.add(box(1.6, 1.0, 1.6, L.accent, 0, 0.5, 0));
      const catStatue = makeCat('house', { fur: 0xBFC6CE, belly: 0xD6DCE2, eyes: 0x8FA3B8 });
      catStatue.group.position.y = 1.0;
      catStatue.group.scale.setScalar(1.1);
      catStatue.group.rotation.y = rand(0, TAU);
      st2.add(catStatue.group);
      G.add(st2);
      World.obstacles.push({ x: p.x, z: p.z, r: 1.2 });
    }
  }
  if (L.no === 4) {
    // throne
    const throne = new THREE.Group();
    throne.position.set(0, 0, 0);
    throne.add(box(4, 1.2, 4, 0x4A2A2A, 0, 0.6, 0));
    throne.add(box(3, 1.0, 3, 0x5B2E2E, 0, 1.6, 0));
    throne.add(box(3, 4.0, 0.6, 0xE0B45E, 0, 3.6, -1.4));
    throne.add(cone(0.5, 1.2, 6, 0xE0B45E, 0, 5.9, -1.4));
    G.add(throne);
    World.obstacles.push({ x: 0, z: 0, r: 2.6 });
    // banners
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const ban = box(2.4, 6, 0.2, 0x8A2E2E, Math.cos(a) * (R - 1.2), 6.5, Math.sin(a) * (R - 1.2));
      ban.rotation.y = -a;
      G.add(ban);
    }
  }
  // rug
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.08, 16), mat(L.accent));
  rug.position.set(0, 0.06, R - 9);
  G.add(rug);
}

/* ------------------------------ rooftop ------------------------------ */
function buildRoof(L) {
  const G = World.group;
  World.indoor = false;
  const R = 15;
  World.bounds = { type: 'circle', r: R - 1.2 };
  World.playerStart.set(0, 0, R - 5);
  World.playerFacing = Math.PI;
  World.portal = null;

  scene.background = new THREE.Color(0xF2B888);
  scene.fog = new THREE.Fog(0xF2B888, 40, 150);
  addLight(new THREE.HemisphereLight(0xFFD9B0, 0x8A6A52, 1.15));
  const sun = new THREE.DirectionalLight(0xFFD08A, 1.3);
  sun.position.set(-14, 18, -20);
  addLight(sun);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.2, 20), mat(0x9A958C));
  floor.position.y = -0.6;
  G.add(floor);
  const inlay = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.6, 0.12, 20), mat(0xEAC26B));
  inlay.position.y = 0.04;
  G.add(inlay);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    G.add(box(2.8, 1.9, 1.6, 0x777268, Math.cos(a) * (R - 0.7), 0.95, Math.sin(a) * (R - 0.7)));
  }
  // clouds below
  for (let i = 0; i < 22; i++) {
    const c = new THREE.Group();
    c.position.set(rand(-70, 70), rand(-16, -4), rand(-70, 70));
    for (let j = 0; j < 4; j++) c.add(ico(rand(2, 5), 0, 0xFFF3E4, rand(-4, 4), rand(-1, 1), rand(-4, 4)));
    G.add(c);
  }
  // a flag: a get-well banner with a heart, hung facing the way you arrive
  const pole = new THREE.Group();
  pole.position.set(0, 0, -R + 4);
  pole.add(cyl(0.16, 0.2, 8, 6, 0x6B655C, 0, 4, 0));
  pole.add(cyl(0.3, 0.3, 0.34, 8, 0xC9A227, 0, 8.06, 0));
  const banner = makeFlagBanner(3.5, 2.0);
  banner.position.set(1.9, 6.85, 0);
  pole.add(banner);
  G.add(pole);
  World.obstacles.push({ x: 0, z: -R + 4, r: 0.6 });
}
