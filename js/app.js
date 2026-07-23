import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  SUN, PLANETS, MOONS, SCALE_MODES, AU_KM,
  julianDay, dateFromJD, helioPositionAU,
  formatAU, formatKm, formatMass, formatPeriod,
} from './ephemeris.js';

// ---------------------------------------------------------------------------
// Error surface
// ---------------------------------------------------------------------------
const errbox = document.getElementById('errbox');
window.addEventListener('error', (e) => {
  if (!errbox) return;
  errbox.style.display = 'block';
  errbox.textContent += `\nERR: ${e.message} @${e.filename}:${e.lineno}`;
});
window.addEventListener('unhandledrejection', (e) => {
  if (!errbox) return;
  errbox.style.display = 'block';
  errbox.textContent += `\nREJ: ${e.reason}`;
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  jd: julianDay(new Date()),
  speed: 1, // simulated days per real second
  paused: false,
  scaleMode: 'educational',
  showOrbits: true,
  showLabels: true,
  showMoons: true,
  showBloom: true,
  selectedId: 'earth',
  focusId: 'earth',
  weather: null,
};

const bodies = new Map(); // id -> runtime record
let sunMesh, scene, camera, renderer, controls, composer, bloomPass;
let orbitGroup, starField;
const clock = new THREE.Clock();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// Procedural textures (local-first — zero CDN textures)
// ---------------------------------------------------------------------------
function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function noise2(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(x, y, oct = 5) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise2(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return v;
}

function texFromCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function planetTexture(kind, baseHex) {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const r0 = (baseHex >> 16) & 255;
  const g0 = (baseHex >> 8) & 255;
  const b0 = baseHex & 255;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // spherical-ish sampling bias near poles
      const lat = (v - 0.5) * Math.PI;
      let n = fbm(u * 6, v * 3, 5);
      let r = r0, g = g0, b = b0;

      if (kind === 'gas') {
        const bands = 0.55 + 0.45 * Math.sin(lat * 14 + n * 4);
        const storm = fbm(u * 10 + 3, v * 4, 3);
        r = Math.min(255, r0 * bands + storm * 40);
        g = Math.min(255, g0 * bands + storm * 20);
        b = Math.min(255, b0 * bands * 0.9);
      } else if (kind === 'ice') {
        n = fbm(u * 4, v * 4, 4);
        r = r0 * (0.7 + 0.4 * n);
        g = g0 * (0.75 + 0.35 * n);
        b = b0 * (0.8 + 0.3 * n);
      } else if (kind === 'earth') {
        // continents vs ocean — slightly smoother than raw multi-octave noise
        const land = fbm(u * 4.2 + 1.7, v * 2.6, 5);
        const detail = fbm(u * 9, v * 5, 3);
        const ice = Math.abs(lat) > 1.15 ? 1 : Math.abs(lat) > 1.0 ? (Math.abs(lat) - 1.0) / 0.15 : 0;
        if (land > 0.54) {
          const veg = 0.55 + 0.45 * detail;
          r = 42 + land * 55;
          g = 85 + land * 70 * veg;
          b = 38 + land * 28;
        } else {
          const deep = (0.54 - land) / 0.54;
          r = 12 + deep * 18;
          g = 55 + deep * 50;
          b = 130 + deep * 70;
        }
        if (ice > 0) {
          r = r * (1 - ice) + 230 * ice;
          g = g * (1 - ice) + 238 * ice;
          b = b * (1 - ice) + 248 * ice;
        }
      } else if (kind === 'mars') {
        n = fbm(u * 7, v * 4, 5);
        const polar = Math.abs(lat) > 1.2 ? 1 : 0;
        r = r0 * (0.7 + 0.5 * n);
        g = g0 * (0.6 + 0.4 * n);
        b = b0 * (0.5 + 0.3 * n);
        if (polar) {
          r = 220; g = 230; b = 240;
        }
      } else if (kind === 'venus') {
        const swirl = fbm(u * 3 + v * 2, v * 2, 4);
        r = r0 * (0.85 + 0.3 * swirl);
        g = g0 * (0.8 + 0.25 * swirl);
        b = b0 * (0.7 + 0.2 * swirl);
      } else if (kind === 'rock') {
        n = fbm(u * 10, v * 6, 4);
        const cr = fbm(u * 20, v * 12, 2);
        const shade = 0.55 + 0.5 * n - (cr > 0.75 ? 0.15 : 0);
        r = r0 * shade;
        g = g0 * shade;
        b = b0 * shade;
      } else if (kind === 'sun') {
        n = fbm(u * 8 + 2, v * 4, 4);
        r = 255;
        g = 180 + n * 60;
        b = 40 + n * 30;
      } else {
        const shade = 0.65 + 0.45 * n;
        r = r0 * shade; g = g0 * shade; b = b0 * shade;
      }

      const i = (y * size + x) * 4;
      d[i] = Math.max(0, Math.min(255, r));
      d[i + 1] = Math.max(0, Math.min(255, g));
      d[i + 2] = Math.max(0, Math.min(255, b));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return texFromCanvas(c);
}

function cloudTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm(u * 6 + 4, v * 3, 5);
      const a = n > 0.55 ? (n - 0.55) / 0.45 * 220 : 0;
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = texFromCanvas(c);
  return t;
}

function ringTexture(tint = 0xe6d3a3) {
  const w = 1024, h = 64;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const r0 = (tint >> 16) & 255, g0 = (tint >> 8) & 255, b0 = tint & 255;
  for (let x = 0; x < w; x++) {
    const u = x / w;
    // Cassini-ish gaps
    let a = 0;
    if (u < 0.05 || u > 0.98) a = 0;
    else if (Math.abs(u - 0.42) < 0.02) a = 10;
    else if (Math.abs(u - 0.7) < 0.01) a = 20;
    else {
      const n = fbm(u * 30, 0.5, 3);
      a = 40 + n * 180;
      if (u > 0.15 && u < 0.35) a *= 1.1;
      if (u > 0.75) a *= 0.7;
    }
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      d[i] = r0; d[i + 1] = g0; d[i + 2] = b0; d[i + 3] = Math.min(255, a);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
// Scene bootstrap
// ---------------------------------------------------------------------------
function init() {
  const stage = document.getElementById('stage');
  scene = new THREE.Scene();
  // Light fog so far-out overview still reads orbits/planets
  scene.fog = new THREE.FogExp2(0x03060c, 0.00055);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 50000);
  camera.position.set(0, 28, 62);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  stage.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.4;
  controls.maxDistance = 12000;
  controls.target.set(0, 0, 0);

  // Key sun light + enough fill that night sides still read form (not pure black)
  const ambient = new THREE.AmbientLight(0x6b8cbe, 0.38);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x9ec9ff, 0x0a0c14, 0.35);
  scene.add(hemi);
  const sunLight = new THREE.PointLight(0xfff2d0, 3.2, 0, 0);
  sunLight.name = 'sunLight';
  scene.add(sunLight);

  // Stars
  starField = buildStars(6000);
  scene.add(starField);

  orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  buildSun();
  for (const p of PLANETS) buildPlanet(p);
  for (const m of MOONS) buildMoon(m);

  // Composer / bloom
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.82);
    composer.addPass(bloomPass);
  } catch (e) {
    console.warn('Bloom unavailable', e);
    composer = null;
  }

  buildUI();
  bindEvents();
  selectBody('earth');
  focusBody('earth', true);
  fetchWeather();
  setInterval(fetchWeather, 10 * 60 * 1000);

  window.addEventListener('resize', onResize);
  requestAnimationFrame(frame);
}

function buildStars(n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // shell distribution
    const r = 800 + Math.random() * 2200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const t = Math.random();
    // slight spectral variety
    if (t < 0.15) { col[i * 3] = 0.7; col[i * 3 + 1] = 0.8; col[i * 3 + 2] = 1.0; }
    else if (t < 0.3) { col[i * 3] = 1.0; col[i * 3 + 1] = 0.85; col[i * 3 + 2] = 0.6; }
    else { col[i * 3] = 0.9; col[i * 3 + 1] = 0.95; col[i * 3 + 2] = 1.0; }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.4,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

function visualRadius(radiusKm) {
  // Map physical radius into scene units with compression so Jupiter isn't absurd
  // vs Mercury while still feeling hierarchical.
  const mode = SCALE_MODES[state.scaleMode];
  const rEarth = 6371;
  const ratio = radiusKm / rEarth;
  // soft compress
  const base = Math.pow(ratio, 0.55) * 0.85 * (mode.radiusScale || 1);
  return Math.max(0.12, base);
}

function kindFor(body) {
  if (body.id === 'sun') return 'sun';
  if (body.id === 'earth') return 'earth';
  if (body.id === 'mars') return 'mars';
  if (body.id === 'venus') return 'venus';
  if (['jupiter', 'saturn'].includes(body.id)) return 'gas';
  if (['uranus', 'neptune'].includes(body.id)) return 'ice';
  if (['moon', 'europa', 'ganymede', 'callisto', 'triton', 'pluto'].includes(body.id)) return 'ice';
  if (body.id === 'io' || body.id === 'titan') return 'rock';
  return 'rock';
}

function buildSun() {
  const r = visualRadius(SUN.radiusKm) * 1.8;
  const tex = planetTexture('sun', SUN.color);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 64), mat);
  mesh.name = 'sun';

  // corona
  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.35, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffb040,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.BackSide,
    })
  );
  mesh.add(corona);

  // soft glow sprite
  const glow = makeGlowSprite(0xffc060, 6.5 * r);
  mesh.add(glow);

  scene.add(mesh);
  sunMesh = mesh;
  bodies.set('sun', {
    id: 'sun',
    def: SUN,
    mesh,
    group: mesh,
    isSun: true,
    radiusScene: r,
    baseRadius: r,
    labelEl: null,
  });
}

function makeGlowSprite(color, scale) {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,200,0.9)');
  g.addColorStop(0.35, 'rgba(255,180,60,0.35)');
  g.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

function buildPlanet(def) {
  const group = new THREE.Group();
  group.name = def.id;
  scene.add(group);

  const r = visualRadius(def.radiusKm);
  const tex = planetTexture(kindFor(def), def.color);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: def.id === 'venus' ? 0.55 : 0.82,
    metalness: 0.04,
    // faint emissive so terminator/night still shows surface structure
    emissive: new THREE.Color(def.color).multiplyScalar(0.08),
    emissiveIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 48), mat);
  // axial tilt
  mesh.rotation.z = (def.axialTiltDeg * Math.PI) / 180;
  group.add(mesh);

  if (def.atmosphere) {
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.045, 32, 32),
      new THREE.MeshBasicMaterial({
        color: def.atmosphere,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.BackSide,
      })
    );
    group.add(atm);
  }

  let clouds = null;
  if (def.hasClouds) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.02, 48, 48),
      new THREE.MeshStandardMaterial({
        map: cloudTexture(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      })
    );
    clouds.rotation.z = mesh.rotation.z;
    group.add(clouds);
  }

  if (def.hasRings) {
    const inner = r * (def.ringInner || 1.2);
    const outer = r * (def.ringOuter || 2.2);
    const ringGeo = new THREE.RingGeometry(inner, outer, 128);
    // fix UVs for radial texture
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const radius = Math.sqrt(x * x + y * y);
      const u = (radius - inner) / (outer - inner);
      uv.setXY(i, u, 0.5);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTexture(def.color),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: def.ringOpacity ?? 0.9,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = (def.axialTiltDeg * Math.PI) / 180;
    group.add(ring);
  }

  // selection marker — thin billboard ring (NOT a thick torus that reads as planetary rings)
  const sel = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.28, r * 1.38, 64),
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  sel.rotation.x = Math.PI / 2;
  group.add(sel);

  // orbit line (rebuilt on scale change)
  const orbitLine = makeOrbitLine(def);
  orbitGroup.add(orbitLine);

  bodies.set(def.id, {
    id: def.id,
    def,
    group,
    mesh,
    clouds,
    sel,
    orbitLine,
    radiusScene: r,
    baseRadius: r,
    isPlanet: true,
    labelEl: null,
  });
}

function buildMoon(def) {
  const parent = bodies.get(def.parent);
  if (!parent) return;
  const group = new THREE.Group();
  group.name = def.id;
  parent.group.add(group);

  // Moon visual radius relative to parent visual radius
  const parentKm = parent.def.radiusKm;
  const ratio = def.radiusKm / parentKm;
  const r = Math.max(parent.radiusScene * ratio * 1.4, 0.06);
  const tex = planetTexture(kindFor(def), def.color);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 24),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 })
  );
  group.add(mesh);

  const sel = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.4, r * 1.55, 48),
    new THREE.MeshBasicMaterial({
      color: 0xa5f3fc,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  sel.rotation.x = Math.PI / 2;
  group.add(sel);

  bodies.set(def.id, {
    id: def.id,
    def,
    group,
    mesh,
    sel,
    parentId: def.parent,
    radiusScene: r,
    isMoon: true,
    labelEl: null,
  });
}

function makeOrbitLine(def, segments = 256) {
  // Sample true ellipse in current scale mode around current epoch geometry
  // using elements only (shape doesn't depend on time for fixed elements)
  const pts = [];
  const mode = SCALE_MODES[state.scaleMode];
  // Build from eccentric anomaly sampling of the orbit
  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * Math.PI * 2;
    const e = def.e;
    const xv = def.a * (Math.cos(E) - e);
    const yv = def.a * Math.sqrt(1 - e * e) * Math.sin(E);
    const w = (def.w * Math.PI) / 180;
    const Om = (def.Omega * Math.PI) / 180;
    const inc = (def.i * Math.PI) / 180;
    const cosw = Math.cos(w), sinw = Math.sin(w);
    const cosO = Math.cos(Om), sinO = Math.sin(Om);
    const cosi = Math.cos(inc), sini = Math.sin(inc);
    const xh = (cosw * cosO - sinw * sinO * cosi) * xv + (-sinw * cosO - cosw * sinO * cosi) * yv;
    const yh = (cosw * sinO + sinw * cosO * cosi) * xv + (-sinw * sinO + cosw * cosO * cosi) * yv;
    const zh = (sinw * sini) * xv + (cosw * sini) * yv;
    // same axis remap as helioPositionAU
    const x = xh, y = zh, z = -yh;
    const r = Math.sqrt(x * x + y * y + z * z) || 1;
    const mapped = mode.mapA(r);
    pts.push(new THREE.Vector3((x / r) * mapped, (y / r) * mapped, (z / r) * mapped));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: def.color,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.userData.bodyId = def.id;
  return line;
}

function rebuildOrbits() {
  while (orbitGroup.children.length) {
    const c = orbitGroup.children.pop();
    c.geometry?.dispose?.();
    c.material?.dispose?.();
  }
  for (const p of PLANETS) {
    const rec = bodies.get(p.id);
    if (!rec) continue;
    rec.orbitLine = makeOrbitLine(p);
    rec.orbitLine.visible = state.showOrbits;
    orbitGroup.add(rec.orbitLine);
  }
  // rescale body radii
  rescaleBodies();
}

function rescaleBodies() {
  // Scale planet visuals in-place — never dispose/recreate geometries (WebGL thrash
  // under bloom caused VALIDATE_STATUS / context-lost spam). Do NOT scale the whole
  // group (moons are children; their local orbits would double-scale).
  const sunRec = bodies.get('sun');
  if (sunRec) {
    const r = visualRadius(SUN.radiusKm) * 1.8;
    const s = r / (sunRec.baseRadius || r);
    sunRec.radiusScene = r;
    sunRec.mesh.scale.setScalar(s);
  }
  for (const p of PLANETS) {
    const rec = bodies.get(p.id);
    if (!rec) continue;
    const r = visualRadius(p.radiusKm);
    const s = r / (rec.baseRadius || r);
    rec.radiusScene = r;
    // scale only visual children, not moon groups
    for (const child of rec.group.children) {
      if (child === rec.mesh || child === rec.sel || child === rec.clouds) {
        child.scale.setScalar(s);
      } else if (child.isMesh && child.geometry?.type === 'RingGeometry' && child !== rec.sel) {
        // planet rings (saturn/uranus)
        child.scale.setScalar(s);
      } else if (child.isMesh && child.material && child.material.side === THREE.BackSide) {
        // atmosphere shell
        child.scale.setScalar(s);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Simulation step
// ---------------------------------------------------------------------------
function updateBodies(dt) {
  if (!state.paused) {
    state.jd += state.speed * dt;
  }

  const mode = SCALE_MODES[state.scaleMode];

  // planets
  for (const p of PLANETS) {
    const rec = bodies.get(p.id);
    if (!rec) continue;
    const pos = helioPositionAU(p, state.jd);
    const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) || 1;
    const mapped = mode.mapA(r);
    rec.group.position.set((pos.x / r) * mapped, (pos.y / r) * mapped, (pos.z / r) * mapped);

    // spin
    const spin = ((2 * Math.PI) / (Math.abs(p.rotationHours) * 3600)) * (state.speed * 86400) * dt * Math.sign(p.rotationHours || 1);
    // scale spin for visibility when speed is low — use at least a gentle spin at 1x
    const spinVis = state.speed === 0 ? 0 : spin * Math.max(1, 40 / Math.max(0.05, Math.abs(state.speed)));
    rec.mesh.rotation.y += (state.paused ? 0 : spinVis);
    if (rec.clouds) rec.clouds.rotation.y += (state.paused ? 0 : spinVis * 1.15);
  }

  // moons
  for (const m of MOONS) {
    const rec = bodies.get(m.id);
    const parent = bodies.get(m.parent);
    if (!rec || !parent) continue;
    rec.group.visible = state.showMoons;
    if (!state.showMoons) continue;

    const ang = ((state.jd - 2451545.0) / m.period) * Math.PI * 2 + ((m.M0 || 0) * Math.PI) / 180;
    // separation in parent-local units from current visual radius
    const pr = parent.radiusScene || 1;
    const sep = Math.max(pr * 2.4, pr * (m.aParentRadii * 0.2));
    rec.group.position.set(Math.cos(ang) * sep, Math.sin(ang * 0.02) * sep * 0.05, Math.sin(ang) * sep);
    rec.mesh.rotation.y += dt * 0.4;
  }

  // sun light at origin
  const light = scene.getObjectByName('sunLight');
  if (light) light.position.set(0, 0, 0);
}

function updateLabels() {
  const layer = document.getElementById('labels');
  if (!layer) return;
  const w = window.innerWidth, h = window.innerHeight;

  for (const [id, rec] of bodies) {
    if (!rec.labelEl) {
      const el = document.createElement('div');
      el.className = 'bodylabel';
      el.textContent = rec.def.name.toUpperCase();
      layer.appendChild(el);
      rec.labelEl = el;
    }
    const el = rec.labelEl;
    if (!state.showLabels || (rec.isMoon && !state.showMoons)) {
      el.classList.remove('on');
      continue;
    }
    rec.mesh.getWorldPosition(_v);
    _v.project(camera);
    if (_v.z > 1) { el.classList.remove('on'); continue; }
    const x = (_v.x * 0.5 + 0.5) * w;
    const y = (-_v.y * 0.5 + 0.5) * h;
    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) { el.classList.remove('on'); continue; }

    // hide far tiny labels except selected/focused
    const dist = camera.position.distanceTo(rec.group.getWorldPosition(_v2));
    const important = id === state.selectedId || id === state.focusId || id === 'sun' || rec.isPlanet;
    if (!important && dist > 120) { el.classList.remove('on'); continue; }

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.add('on');
    el.classList.toggle('sel', id === state.selectedId);
  }
}

function updateSelectionVisual() {
  for (const [id, rec] of bodies) {
    if (!rec.sel) continue;
    const on = id === state.selectedId;
    rec.sel.material.opacity = on ? 0.9 : 0.0;
    if (on) {
      // face camera so the ring never reads as a planetary ring plane
      rec.sel.lookAt(camera.position);
    }
  }
}

function systemOverviewDistance() {
  // Frame outermost classical planet in current scale mode.
  const mode = SCALE_MODES[state.scaleMode];
  const outer = mode.mapA(30.07); // Neptune a
  return Math.max(outer * 1.65, 40);
}

function focusBody(id, instant = false) {
  const rec = bodies.get(id);
  if (!rec) return;
  state.focusId = id;
  rec.group.getWorldPosition(_v);

  let dist;
  if (id === 'sun') {
    // System overview — not a surface close-up of the photosphere
    dist = systemOverviewDistance();
    _v.set(0, 0, 0);
  } else {
    const r = rec.radiusScene || 1;
    dist = Math.max(r * 7.2, 2.8);
  }

  // Prefer a high 3/4 view on first focus / sun overview
  if (id === 'sun' || _v2.copy(camera.position).sub(controls.target).lengthSq() < 1e-6) {
    _v2.set(0.55, 0.42, 1).normalize().multiplyScalar(dist);
  } else {
    _v2.copy(camera.position).sub(controls.target);
    if (_v2.lengthSq() < 1e-6) _v2.set(0, 0.35, 1);
    _v2.normalize().multiplyScalar(dist);
  }
  const destCam = _v.clone().add(_v2);
  const destTarget = _v.clone();

  if (instant) {
    camera.position.copy(destCam);
    controls.target.copy(destTarget);
    controls.update();
  } else {
    state._camTween = {
      t: 0,
      dur: 0.85,
      fromCam: camera.position.clone(),
      toCam: destCam,
      fromT: controls.target.clone(),
      toT: destTarget,
    };
  }
  selectBody(id);
}

function selectBody(id) {
  const rec = bodies.get(id);
  if (!rec) return;
  state.selectedId = id;
  // nav buttons
  document.querySelectorAll('#nav .body-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.id === id);
  });
  renderDossier(rec);
  // on narrow screens: after picking a body from the list, show dossier + hide nav
  if (window.matchMedia('(max-width: 720px)').matches) {
    document.body.classList.remove('show-nav');
    document.body.classList.add('show-dossier');
    document.getElementById('btn-tog-nav')?.classList.remove('active');
    document.getElementById('btn-tog-dossier')?.classList.add('active');
  }
}

function renderDossier(rec) {
  const d = rec.def;
  const root = document.getElementById('dossier');
  if (!root) return;

  let posLine = '—';
  let velHint = '—';
  if (rec.isPlanet) {
    const p = helioPositionAU(d, state.jd);
    const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    posLine = formatAU(r);
    velHint = `e=${d.e.toFixed(4)} · i=${d.i.toFixed(2)}°`;
  } else if (rec.isMoon) {
    posLine = `${d.aParentRadii.toFixed(1)} R_${d.parent}`;
    velHint = `P=${formatPeriod(d.period)}`;
  } else if (rec.isSun) {
    posLine = '0 AU (origin)';
    velHint = 'system reference';
  }

  const weatherBlock = d.id === 'earth' && state.weather
    ? `<div class="telemetry"><div class="t-title">LIVE EARTH TELEMETRY · OPEN-METEO</div>
        Wind ${state.weather.wind.toFixed(1)} km/h · Clouds ${state.weather.clouds}% · Temp ${state.weather.temp.toFixed(1)}°C
        <div style="color:var(--mute);margin-top:4px;font-size:10px">Sample: lat 0°, lon 0° (equatorial reference). Offline-safe fallback if blocked.</div>
      </div>`
    : d.id === 'earth'
      ? `<div class="telemetry"><div class="t-title">LIVE EARTH TELEMETRY</div>Awaiting open-meteo… (works offline without it)</div>`
      : '';

  root.innerHTML = `
    <header>
      <div class="kicker">${rec.isMoon ? 'SATELLITE' : rec.isSun ? 'PRIMARY' : 'PLANETARY BODY'}</div>
      <h2>${d.name}</h2>
      <div class="class">${d.class || ''}</div>
    </header>
    <div class="body">
      <div class="grid2">
        <div class="metric"><span class="lbl">Radius</span><span class="val">${formatKm(d.radiusKm)}</span></div>
        <div class="metric"><span class="lbl">Mass</span><span class="val">${formatMass(d.massEarth ?? 0)}</span></div>
        <div class="metric"><span class="lbl">Helio / orbit</span><span class="val accent">${posLine}</span></div>
        <div class="metric"><span class="lbl">Elements</span><span class="val">${velHint}</span></div>
        ${d.period ? `<div class="metric"><span class="lbl">Orbital period</span><span class="val">${formatPeriod(d.period)}</span></div>` : ''}
        ${d.rotationHours ? `<div class="metric"><span class="lbl">Rotation</span><span class="val">${formatPeriod(Math.abs(d.rotationHours) / 24)}${d.rotationHours < 0 ? ' · ret.' : ''}</span></div>` : ''}
        ${d.axialTiltDeg != null ? `<div class="metric"><span class="lbl">Axial tilt</span><span class="val">${d.axialTiltDeg.toFixed(2)}°</span></div>` : ''}
        ${d.a ? `<div class="metric"><span class="lbl">Semi-major a</span><span class="val">${d.a.toFixed(4)} AU</span></div>` : ''}
      </div>
      <div class="blurb">${d.blurb || ''}</div>
      ${weatherBlock}
      <div class="row" style="margin-top:12px;gap:8px">
        <button type="button" id="btn-focus-sel">Focus</button>
        <button type="button" id="btn-now">Jump epoch → now</button>
      </div>
    </div>
  `;
  root.querySelector('#btn-focus-sel')?.addEventListener('click', () => focusBody(d.id));
  root.querySelector('#btn-now')?.addEventListener('click', () => {
    state.jd = julianDay(new Date());
    syncTransportReadouts();
  });
}

async function fetchWeather() {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m,cloud_cover,wind_speed_10m',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('weather http ' + res.status);
    const data = await res.json();
    state.weather = {
      wind: data.current?.wind_speed_10m ?? 0,
      clouds: data.current?.cloud_cover ?? 0,
      temp: data.current?.temperature_2m ?? 0,
    };
    const chip = document.getElementById('wx-chip');
    if (chip) {
      chip.innerHTML = `<span class="dot"></span> EARTH WX ${state.weather.wind.toFixed(0)} km/h · ${state.weather.clouds}% CLD`;
    }
    if (state.selectedId === 'earth') {
      const rec = bodies.get('earth');
      if (rec) renderDossier(rec);
    }
  } catch {
    const chip = document.getElementById('wx-chip');
    if (chip) chip.innerHTML = `<span class="dot warn"></span> WX OFFLINE · EPHEMERIS LOCAL`;
  }
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
function buildUI() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  const addSection = (label) => {
    const s = document.createElement('div');
    s.className = 'section-label';
    s.textContent = label;
    nav.appendChild(s);
  };
  const addBtn = (id, name, color) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'body-btn';
    b.dataset.id = id;
    const hex = color.toString(16).padStart(6, '0');
    b.innerHTML = `<span>${name}</span><span class="swatch" style="background:#${hex}"></span>`;
    b.addEventListener('click', () => focusBody(id));
    nav.appendChild(b);
  };
  addSection('Primary');
  addBtn('sun', 'Sun', SUN.color);
  addSection('Planets');
  for (const p of PLANETS) addBtn(p.id, p.name, p.color);
  addSection('Moons');
  for (const m of MOONS) addBtn(m.id, m.name, m.color);

  // scale mode select
  const scaleSel = document.getElementById('scaleMode');
  scaleSel.innerHTML = '';
  for (const k of Object.keys(SCALE_MODES)) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = SCALE_MODES[k].label;
    if (k === state.scaleMode) o.selected = true;
    scaleSel.appendChild(o);
  }
  document.getElementById('scaleDesc').textContent = SCALE_MODES[state.scaleMode].desc;

  syncTransportReadouts();
}

function syncTransportReadouts() {
  const date = dateFromJD(state.jd);
  const dateEl = document.getElementById('date-read');
  if (dateEl) {
    dateEl.textContent = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }
  const epochEl = document.getElementById('epoch-read');
  if (epochEl) epochEl.textContent = `JD ${state.jd.toFixed(4)}`;

  const sp = document.getElementById('speed-read');
  if (sp) {
    const s = state.paused ? 0 : state.speed;
    let label;
    if (s === 0) label = 'PAUSED';
    else if (Math.abs(s) < 1) label = `${s.toFixed(2)} d/s`;
    else if (Math.abs(s) < 100) label = `${s.toFixed(1)} d/s`;
    else label = `${s.toFixed(0)} d/s`;
    if (!state.paused && Math.abs(s) >= 365) label += `  (${(s / 365.25).toFixed(1)} yr/s)`;
    sp.textContent = label;
  }

  const clockMain = document.getElementById('clock-main');
  if (clockMain) clockMain.textContent = date.toISOString().replace('T', ' · ').replace(/\.\d+Z$/, ' UTC');
  const clockEpoch = document.getElementById('clock-epoch');
  if (clockEpoch) clockEpoch.textContent = `JD ${state.jd.toFixed(3)} · ${SCALE_MODES[state.scaleMode].label}`;
}

function bindEvents() {
  document.getElementById('btn-pause').addEventListener('click', () => {
    state.paused = !state.paused;
    document.getElementById('btn-pause').classList.toggle('active', state.paused);
    document.getElementById('btn-pause').textContent = state.paused ? 'Resume' : 'Pause';
    syncTransportReadouts();
  });
  document.getElementById('btn-now').addEventListener('click', () => {
    state.jd = julianDay(new Date());
    syncTransportReadouts();
  });
  document.getElementById('btn-slower').addEventListener('click', () => {
    state.speed = clampSpeed(state.speed / 2);
    document.getElementById('speed').value = speedToSlider(state.speed);
    syncTransportReadouts();
  });
  document.getElementById('btn-faster').addEventListener('click', () => {
    state.speed = clampSpeed(state.speed * 2 || 1);
    document.getElementById('speed').value = speedToSlider(state.speed);
    syncTransportReadouts();
  });
  document.getElementById('speed').addEventListener('input', (e) => {
    state.speed = sliderToSpeed(+e.target.value);
    state.paused = false;
    document.getElementById('btn-pause').classList.remove('active');
    document.getElementById('btn-pause').textContent = 'Pause';
    syncTransportReadouts();
  });

  document.getElementById('scaleMode').addEventListener('change', (e) => {
    state.scaleMode = e.target.value;
    document.getElementById('scaleDesc').textContent = SCALE_MODES[state.scaleMode].desc;
    rebuildOrbits();
    // re-place bodies immediately
    updateBodies(0);
    focusBody(state.focusId, true);
    syncTransportReadouts();
  });

  const bindToggle = (id, key) => {
    document.getElementById(id).addEventListener('change', (e) => {
      state[key] = e.target.checked;
      if (key === 'showOrbits') orbitGroup.visible = state.showOrbits;
      if (key === 'showBloom' && bloomPass) bloomPass.enabled = state.showBloom;
      if (key === 'showMoons') {
        for (const m of MOONS) {
          const rec = bodies.get(m.id);
          if (rec) rec.group.visible = state.showMoons;
        }
      }
    });
  };
  bindToggle('tog-orbits', 'showOrbits');
  bindToggle('tog-labels', 'showLabels');
  bindToggle('tog-moons', 'showMoons');
  bindToggle('tog-bloom', 'showBloom');

  // click to select
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    // ignore if user is dragging — simple movement threshold
    const startX = ev.clientX, startY = ev.clientY;
    const up = (ev2) => {
      window.removeEventListener('pointerup', up);
      if (Math.hypot(ev2.clientX - startX, ev2.clientY - startY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev2.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev2.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const meshes = [];
      for (const rec of bodies.values()) if (rec.mesh && rec.group.visible !== false) meshes.push(rec.mesh);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length) {
        const mesh = hits[0].object;
        for (const [id, rec] of bodies) {
          if (rec.mesh === mesh) {
            focusBody(id);
            break;
          }
        }
      }
    };
    window.addEventListener('pointerup', up);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input,select,textarea')) return;
    const map = {
      ' ': () => document.getElementById('btn-pause').click(),
      '[': () => document.getElementById('btn-slower').click(),
      ']': () => document.getElementById('btn-faster').click(),
      n: () => document.getElementById('btn-now').click(),
      N: () => document.getElementById('btn-now').click(),
      h: () => document.body.classList.toggle('hud-hidden'),
      H: () => document.body.classList.toggle('hud-hidden'),
      f: () => focusBody(state.selectedId),
      F: () => focusBody(state.selectedId),
      '1': () => focusBody('sun'),
      '2': () => focusBody('mercury'),
      '3': () => focusBody('venus'),
      '4': () => focusBody('earth'),
      '5': () => focusBody('mars'),
      '6': () => focusBody('jupiter'),
      '7': () => focusBody('saturn'),
      '8': () => focusBody('uranus'),
      '9': () => focusBody('neptune'),
      '0': () => focusBody('pluto'),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  });

  // Mobile panel drawers
  const navBtn = document.getElementById('btn-tog-nav');
  const dosBtn = document.getElementById('btn-tog-dossier');
  navBtn?.addEventListener('click', () => {
    document.body.classList.toggle('show-nav');
    document.body.classList.remove('show-dossier');
    navBtn.classList.toggle('active', document.body.classList.contains('show-nav'));
    dosBtn?.classList.remove('active');
  });
  dosBtn?.addEventListener('click', () => {
    document.body.classList.toggle('show-dossier');
    document.body.classList.remove('show-nav');
    dosBtn.classList.toggle('active', document.body.classList.contains('show-dossier'));
    navBtn?.classList.remove('active');
  });
}

function clampSpeed(s) {
  if (Math.abs(s) < 0.01) return 0.01 * Math.sign(s || 1);
  return Math.max(-50000, Math.min(50000, s));
}

// slider 0..100 → speed days/sec geometric
function sliderToSpeed(v) {
  // 0 = 0.05 d/s, 50 ~= 1 d/s, 100 ~= 3650 d/s (~10 yr/s)
  const t = v / 100;
  return 0.05 * Math.pow(3650 / 0.05, t);
}
function speedToSlider(s) {
  const a = Math.abs(s);
  const t = Math.log(a / 0.05) / Math.log(3650 / 0.05);
  return Math.max(0, Math.min(100, t * 100));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
let _uiAcc = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);

  // camera tween
  if (state._camTween) {
    const tw = state._camTween;
    tw.t += dt;
    const u = Math.min(1, tw.t / tw.dur);
    const e = 1 - Math.pow(1 - u, 3);
    camera.position.lerpVectors(tw.fromCam, tw.toCam, e);
    controls.target.lerpVectors(tw.fromT, tw.toT, e);
    if (u >= 1) state._camTween = null;
  } else if (state.focusId && state.focusId !== 'free') {
    // gently keep target on focused body
    const rec = bodies.get(state.focusId);
    if (rec) {
      rec.group.getWorldPosition(_v);
      controls.target.lerp(_v, 1 - Math.pow(0.0001, dt));
    }
  }

  updateBodies(dt);
  updateSelectionVisual();
  controls.update();

  _uiAcc += dt;
  if (_uiAcc > 0.1) {
    _uiAcc = 0;
    syncTransportReadouts();
    // live-update dossier distance
    if (state.selectedId) {
      const rec = bodies.get(state.selectedId);
      // light touch: only refresh metrics that change — full re-render is ok at 10Hz
      const posEl = document.querySelector('#dossier .val.accent');
      if (posEl && rec?.isPlanet) {
        const p = helioPositionAU(rec.def, state.jd);
        const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        posEl.textContent = formatAU(r);
      }
    }
  }

  updateLabels();

  if (composer && state.showBloom) composer.render();
  else renderer.render(scene, camera);
}

// expose for headless verify
window.__HOLO = {
  get state() { return state; },
  bodies,
  focusBody,
  selectBody,
  THREE,
};

init();
