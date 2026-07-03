# Cygnus X-1 — Real-Time Gravitational Lensing

A black hole rendered by actually bending light, not by faking it with sprites.
Every pixel raymarches a ray from the camera, integrates a weak-field
approximation of a photon geodesic around a Schwarzschild-like mass, and
either escapes to a procedural starfield, crosses a shaded accretion disk, or
falls into the event horizon. That's what produces the warped background,
the disk visible "wrapped" above and below the hole, and the dark shadow —
the actual optical effects of gravitational lensing, computed live.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

`npm run build` produces a static `dist/` you can host anywhere.

## What's actually happening

- **`src/shaders/lensing.frag.glsl`** — the whole scene is one fullscreen
  fragment shader. For each pixel it reconstructs a ray from the real
  `THREE.PerspectiveCamera` (driven by OrbitControls), then raymarches it
  through a simplified geodesic deflection formula
  (`accel = -1.5 · rs · |h|² · pos / |pos|⁵`, where `h` is the ray's angular
  momentum about the mass). This is a physically-motivated approximation,
  not a full general-relativistic ray tracer — real GR raytracers integrate
  the null geodesic equation numerically with much smaller steps and exact
  metric terms — but it produces the same qualitative bending, photon-capture
  shadow, and disk-wrapping you'd expect.
- **Accretion disk** is shaded procedurally inside the same shader: radial
  temperature gradient, turbulent noise banding, and a relativistic-beaming
  approximation that brightens/blue-shifts the side spinning toward you and
  dims/red-shifts the side spinning away.
- **`src/skybox.js`** procedurally paints an equirectangular starfield +
  nebula texture on a canvas at load time; the shader samples it whenever a
  ray escapes to infinity, so you see it visibly warp around the hole.
- **Post-processing** is a real `EffectComposer` pipeline
  (`RenderPass → UnrealBloomPass → OutputPass`) for genuine HDR bloom on the
  disk's hot regions, not simulated via blending tricks.
- **`lil-gui`** panel exposes mass, disk geometry/speed/brightness, and
  bloom parameters live.

## Tuning

Push `mass (rs)` up and watch the shadow grow and the lensing ring tighten.
Push `disk speed` up for more visible differential rotation and Doppler
asymmetry. Bloom threshold/strength control how "hot" the disk needs to be
before it blooms.
