# HOLOSYSTEM — Keplerian Solar Instrument

Not a toy. A **local-first** WebGL instrument that integrates mean J2000 orbital elements with a Newton-solved Kepler propagator, scale modes, operator HUD, and optional live Earth weather.

**Live repo:** https://github.com/Mellowambience/holosystem-3d-solar-system

## Run

```bash
# any static server — ES modules require http(s), not file://
python -m http.server 8765
# open http://127.0.0.1:8765/
```

No build step. No CDN at runtime. Three.js r160 is vendored under `vendor/`.

## What changed vs the original demo

| Before (toy) | Now |
|---|---|
| Fake spacing + sizes | Mean J2000 Kepler elements, eccentric anomaly solver |
| CDN three r128 + 8 script tags | Vendored ES modules + import map |
| Hologram candy shaders only | Procedural surface maps, atmospheres, multi-band rings |
| One weather fetch as decoration | Optional open-meteo telemetry; fully usable offline |
| Dropdown focus | Click mesh · body list · keys 1–0 · smooth camera tween |
| No time meaning | Epoch clock (JD + UTC), speed 0.05 d/s → years/s, pause, jump-to-now |
| Single layout | Educational / log / **true AU** scale modes |

## Time model

- **Default = LIVE** — epoch locked to the machine wall clock (1:1). Planet/moon positions are Kepler solutions for *now*.
- **Scrub** — move the rate slider or press faster/slower to leave live and run accelerated time.
- **Live / Now / `L` / `N`** — re-lock to wall clock.
- Sidereal spin is absolute from J2000 (no drift), not a cosmetic spin boost.

## Controls

| Input | Action |
|---|---|
| Drag / scroll | Orbit camera |
| Click body | Select + focus |
| `1`–`0` | Sun → Pluto |
| `Space` | Pause / resume |
| `[` `]` | Halve / double sim rate |
| `N` | Jump epoch to now |
| `F` | Refocus selection |
| `H` | Toggle HUD |

## Accuracy notes (honest)

- **Elements** are mean J2000-style values good for visualization and teaching — not a navigation-grade SPICE ephemeris.
- **Planet radii** are hierarchically compressed so Mercury remains visible next to Jupiter. Distances follow the selected scale mode; **TRUE AU** is linear.
- **Moon distances** are readable fractions of parent visual radius (true Hill-sphere scale is often unreadable in overview).
- **Earth weather** samples open-meteo at lat 0 / lon 0 as a telemetry strip. Failure is non-fatal.

## Layout

```
index.html          shell + import map
css/holo.css        operator HUD
js/ephemeris.js     bodies, Kepler solver, formatters
js/app.js           scene, materials, sim loop, UI
vendor/             three.module.js + controls + postprocessing
```

## License

MIT (code). Planetary facts are public-domain science.
