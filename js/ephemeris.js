// J2000.0 mean orbital elements (sufficient for visualization-grade ephemeris).
// Distances AU, angles degrees, periods Earth days, radii km, mass Earth=1.
// Sources: NASA planetary fact sheets / approximate mean elements.

export const AU_KM = 149597870.7;
export const J2000_JD = 2451545.0;

export const SUN = {
  id: 'sun',
  name: 'Sun',
  class: 'G2V main-sequence star',
  radiusKm: 695700,
  massEarth: 332946,
  rotationHours: 609.12, // equatorial ~25.38 d
  axialTiltDeg: 7.25,
  color: 0xffd27a,
  emissive: 0xffb020,
  blurb:
    'The system barycenter almost always sits inside the solar photosphere. All planetary positions here are heliocentric mean elements, not barycentric.',
};

// a AU, e, i deg, Omega (LAN) deg, w (arg peri) deg, M0 deg at J2000, period days
export const PLANETS = [
  {
    id: 'mercury',
    name: 'Mercury',
    class: 'Terrestrial · highly eccentric',
    a: 0.387098,
    e: 0.20563,
    i: 7.0049,
    Omega: 48.331,
    w: 29.124,
    M0: 174.796,
    period: 87.969,
    radiusKm: 2439.7,
    massEarth: 0.0553,
    rotationHours: 1407.6,
    axialTiltDeg: 0.034,
    color: 0xb0a090,
    blurb: 'No atmosphere to speak of. Day length is 176 Earth days due to 3:2 spin-orbit resonance.',
  },
  {
    id: 'venus',
    name: 'Venus',
    class: 'Terrestrial · runaway greenhouse',
    a: 0.723332,
    e: 0.006772,
    i: 3.3947,
    Omega: 76.68,
    w: 54.884,
    M0: 50.115,
    period: 224.701,
    radiusKm: 6051.8,
    massEarth: 0.815,
    rotationHours: -5832.5, // retrograde
    axialTiltDeg: 177.36,
    color: 0xe8c87a,
    atmosphere: 0xffcc88,
    blurb: 'Spins backwards. Surface pressure ~92 bar. The bright cloud deck is what we render, not the crust.',
  },
  {
    id: 'earth',
    name: 'Earth',
    class: 'Terrestrial · liquid-water world',
    a: 1.00000011,
    e: 0.01671022,
    i: 0.00005,
    Omega: -11.26064,
    w: 102.94719,
    M0: 100.46435,
    period: 365.256,
    radiusKm: 6371.0,
    massEarth: 1,
    rotationHours: 23.934,
    axialTiltDeg: 23.439,
    color: 0x3b82f6,
    atmosphere: 0x7dd3fc,
    hasClouds: true,
    blurb: 'Reference body for AU, day, and mass. Live weather telemetry samples open-meteo at the subsolar equatorial belt when online.',
  },
  {
    id: 'mars',
    name: 'Mars',
    class: 'Terrestrial · thin CO₂ atmosphere',
    a: 1.523662,
    e: 0.093412,
    i: 1.8506,
    Omega: 49.578,
    w: 286.462,
    M0: 19.373,
    period: 686.98,
    radiusKm: 3389.5,
    massEarth: 0.107,
    rotationHours: 24.623,
    axialTiltDeg: 25.19,
    color: 0xc45c3e,
    atmosphere: 0xff8866,
    blurb: 'Day length nearly terrestrial. Polar caps and dust storms dominate seasonal appearance.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    class: 'Gas giant · system mass anchor',
    a: 5.203363,
    e: 0.048393,
    i: 1.3053,
    Omega: 100.556,
    w: 274.197,
    M0: 19.65,
    period: 4332.59,
    radiusKm: 69911,
    massEarth: 317.8,
    rotationHours: 9.925,
    axialTiltDeg: 3.13,
    color: 0xc4a574,
    blurb: 'Contains more than twice the mass of all other planets combined. Fast rotator; slight polar flatten not modeled.',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    class: 'Gas giant · ringed',
    a: 9.53707,
    e: 0.054151,
    i: 2.4845,
    Omega: 113.715,
    w: 338.717,
    M0: 317.51,
    period: 10759.22,
    radiusKm: 58232,
    massEarth: 95.2,
    rotationHours: 10.656,
    axialTiltDeg: 26.73,
    color: 0xe6d3a3,
    hasRings: true,
    ringInner: 1.11,
    ringOuter: 2.27,
    blurb: 'Lowest mean density of the planets. Rings are ice-rich particles; rendered as a multi-band translucent disk.',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    class: 'Ice giant · extreme axial tilt',
    a: 19.19126,
    e: 0.047168,
    i: 0.7699,
    Omega: 74.23,
    w: 96.734,
    M0: 142.24,
    period: 30685.4,
    radiusKm: 25362,
    massEarth: 14.5,
    rotationHours: -17.24,
    axialTiltDeg: 97.77,
    color: 0x7ec8c8,
    hasRings: true,
    ringInner: 1.45,
    ringOuter: 2.0,
    ringOpacity: 0.25,
    blurb: 'Rotates on its side. Seasons last decades. Faint dark rings included at reduced opacity.',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    class: 'Ice giant · supersonic winds',
    a: 30.06896,
    e: 0.008586,
    i: 1.7692,
    Omega: 131.722,
    w: 273.249,
    M0: 256.23,
    period: 60189.0,
    radiusKm: 24622,
    massEarth: 17.1,
    rotationHours: 16.11,
    axialTiltDeg: 28.32,
    color: 0x4169e1,
    blurb: 'Farthest known giant. Discovered by mathematics before the telescope. Triton orbits retrograde.',
  },
  {
    id: 'pluto',
    name: 'Pluto',
    class: 'Dwarf planet · Kuiper belt',
    a: 39.482,
    e: 0.2488,
    i: 17.16,
    Omega: 110.3,
    w: 113.76,
    M0: 14.86,
    period: 90560,
    radiusKm: 1188.3,
    massEarth: 0.0022,
    rotationHours: -153.29,
    axialTiltDeg: 122.53,
    color: 0xc4b7a6,
    blurb: 'Included because the public mental model of the system still expects it. Not a classical planet; still a real world.',
  },
];

// Moons: parent id, a in parent-radii (mean), period days, radius km
export const MOONS = [
  {
    id: 'moon',
    parent: 'earth',
    name: 'Moon',
    class: 'Natural satellite',
    aParentRadii: 60.3,
    period: 27.3217,
    radiusKm: 1737.4,
    color: 0xbbbbbb,
    M0: 120,
    blurb: 'Tidally locked. Distance exaggerated slightly in inspect mode for readability when scale allows.',
  },
  {
    id: 'io',
    parent: 'jupiter',
    name: 'Io',
    class: 'Galilean · volcanic',
    aParentRadii: 5.9,
    period: 1.769,
    radiusKm: 1821.6,
    color: 0xf0d060,
    M0: 10,
    blurb: 'Most geologically active body in the system.',
  },
  {
    id: 'europa',
    parent: 'jupiter',
    name: 'Europa',
    class: 'Galilean · ice shell',
    aParentRadii: 9.4,
    period: 3.551,
    radiusKm: 1560.8,
    color: 0xc9d6e3,
    M0: 80,
    blurb: 'Subsurface ocean candidate. Smooth ice crust.',
  },
  {
    id: 'ganymede',
    parent: 'jupiter',
    name: 'Ganymede',
    class: 'Galilean · largest moon',
    aParentRadii: 15.0,
    period: 7.155,
    radiusKm: 2634.1,
    color: 0x9a8b7a,
    M0: 200,
    blurb: 'Larger than Mercury. Own magnetosphere.',
  },
  {
    id: 'callisto',
    parent: 'jupiter',
    name: 'Callisto',
    class: 'Galilean · cratered',
    aParentRadii: 26.3,
    period: 16.689,
    radiusKm: 2410.3,
    color: 0x6b5e54,
    M0: 300,
    blurb: 'Most heavily cratered large icy body.',
  },
  {
    id: 'titan',
    parent: 'saturn',
    name: 'Titan',
    class: 'Atmosphere-bearing moon',
    aParentRadii: 20.3,
    period: 15.945,
    radiusKm: 2574.7,
    color: 0xd4a574,
    M0: 40,
    blurb: 'Thick N₂ atmosphere. Hydrocarbon lakes.',
  },
  {
    id: 'triton',
    parent: 'neptune',
    name: 'Triton',
    class: 'Retrograde capture',
    aParentRadii: 14.3,
    period: -5.877, // retrograde
    radiusKm: 1353.4,
    color: 0xc8d0d8,
    M0: 15,
    blurb: 'Retrograde orbit implies capture. Geysers of nitrogen.',
  },
];

export const SCALE_MODES = {
  // Visual AU units for layout. Planet radii are always exaggerated for visibility
  // unless radiusMode === 'true' (then still a minimum pixel floor).
  educational: {
    id: 'educational',
    label: 'EDUCATIONAL',
    // power compress so Neptune isn't off-screen forever
    mapA: (a) => Math.pow(a, 0.55) * 18,
    radiusScale: 1.0,
    desc: 'Compressed distances (a^0.55). Best overview of the whole system.',
  },
  log: {
    id: 'log',
    label: 'LOG DISTANCE',
    mapA: (a) => Math.log10(1 + a * 9) * 22,
    radiusScale: 1.1,
    desc: 'Logarithmic spacing. Emphasizes inner system structure.',
  },
  trueau: {
    id: 'trueau',
    label: 'TRUE AU',
    mapA: (a) => a * 40,
    radiusScale: 1.35,
    desc: 'Linear AU. Outer giants are far — use focus + scroll. Radii still exaggerated.',
  },
};

export function julianDay(date = new Date()) {
  // Civil date → JD (Gregorian)
  const t = date.getTime() / 86400000;
  return t + 2440587.5;
}

export function dateFromJD(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

/** Solve Kepler's equation M = E - e sin E (radians) via Newton. */
export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 12; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

/**
 * Heliocentric ecliptic J2000-ish position in AU (x,y,z).
 * z is north ecliptic. x toward vernal equinox approx.
 */
export function helioPositionAU(body, jd) {
  const d = jd - J2000_JD;
  const n = (360 / body.period) * Math.PI / 180; // rad/day
  const M0 = (body.M0 * Math.PI) / 180;
  const M = ((M0 + n * d) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const e = body.e;
  const E = solveKepler(M, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const xv = body.a * (cosE - e);
  const yv = body.a * Math.sqrt(1 - e * e) * sinE;

  const w = (body.w * Math.PI) / 180;
  const Om = (body.Omega * Math.PI) / 180;
  const i = (body.i * Math.PI) / 180;

  const cosw = Math.cos(w);
  const sinw = Math.sin(w);
  const cosO = Math.cos(Om);
  const sinO = Math.sin(Om);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);

  // periapsis frame → ecliptic
  const xh = (cosw * cosO - sinw * sinO * cosi) * xv + (-sinw * cosO - cosw * sinO * cosi) * yv;
  const yh = (cosw * sinO + sinw * cosO * cosi) * xv + (-sinw * sinO + cosw * cosO * cosi) * yv;
  const zh = (sinw * sini) * xv + (cosw * sini) * yv;

  return { x: xh, y: zh, z: -yh }; // map ecliptic y→scene -z so +Y is north
}

export function formatAU(v) {
  if (v < 0.01) return `${(v * AU_KM).toFixed(0)} km`;
  if (v < 10) return `${v.toFixed(4)} AU`;
  return `${v.toFixed(2)} AU`;
}

export function formatKm(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} M km`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} k km`;
  return `${v.toFixed(0)} km`;
}

export function formatMass(m) {
  if (m >= 1000) return `${(m / 332946).toFixed(3)} M☉`;
  if (m >= 1) return `${m.toFixed(2)} M⊕`;
  if (m >= 0.01) return `${m.toFixed(3)} M⊕`;
  return `${m.toExponential(2)} M⊕`;
}

export function formatPeriod(days) {
  const a = Math.abs(days);
  if (a < 2) return `${(a * 24).toFixed(1)} h`;
  if (a < 400) return `${a.toFixed(2)} d`;
  if (a < 10000) return `${(a / 365.25).toFixed(2)} yr`;
  return `${(a / 365.25).toFixed(1)} yr`;
}
