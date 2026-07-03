import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import { generateSkybox } from './skybox.js';
import vertexShader from './shaders/lensing.vert.glsl?raw';
import fragmentShader from './shaders/lensing.frag.glsl?raw';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---------- fullscreen raymarch quad ----------
const scene = new THREE.Scene();
const quadGeo = new THREE.PlaneGeometry(2, 2);

const skyTexture = new THREE.CanvasTexture(generateSkybox());
skyTexture.colorSpace = THREE.SRGBColorSpace;
skyTexture.wrapS = THREE.RepeatWrapping;
skyTexture.wrapT = THREE.ClampToEdgeWrapping;
skyTexture.needsUpdate = true;

const params = {
  rs: 1.25,
  diskInner: 2.6,
  diskOuter: 9.0,
  diskSpeed: 6.0,
  diskBrightness: 1.0,
  bloomStrength: 0.75,
  bloomRadius: 0.28,
  bloomThreshold: 0.5,
  autoRotate: true,
};

const uniforms = {
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uCamPos: { value: new THREE.Vector3() },
  uCamMatrix: { value: new THREE.Matrix3() },
  uFovScale: { value: 1 },
  uAspect: { value: window.innerWidth / window.innerHeight },
  uTime: { value: 0 },
  uSkybox: { value: skyTexture },
  uRs: { value: params.rs },
  uDiskInner: { value: params.diskInner },
  uDiskOuter: { value: params.diskOuter },
  uDiskSpeed: { value: params.diskSpeed },
  uDiskBrightness: { value: params.diskBrightness },
};

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
  depthTest: false,
  depthWrite: false,
});

const quad = new THREE.Mesh(quadGeo, material);
quad.frustumCulled = false;
scene.add(quad);

// A real perspective camera drives ray reconstruction inside the shader (position + orientation
// are read every frame as uniforms). It is also passed to RenderPass to satisfy the API, but the
// quad's own vertex shader ignores its view/projection matrices entirely.
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 7, 27);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 42;
controls.autoRotate = params.autoRotate;
controls.autoRotateSpeed = 0.4;

// ---------- postprocessing: real bloom pipeline ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.bloomStrength,
  params.bloomRadius,
  params.bloomThreshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---------- live tweak panel ----------
const gui = new GUI({ title: 'Black Hole Parameters' });
gui.add(params, 'rs', 0.3, 2.5, 0.01).name('mass (rs)').onChange((v) => (uniforms.uRs.value = v));
gui.add(params, 'diskInner', 1.2, 5, 0.05).name('disk inner r').onChange((v) => (uniforms.uDiskInner.value = v));
gui.add(params, 'diskOuter', 5, 16, 0.1).name('disk outer r').onChange((v) => (uniforms.uDiskOuter.value = v));
gui.add(params, 'diskSpeed', 0.5, 14, 0.1).name('disk speed').onChange((v) => (uniforms.uDiskSpeed.value = v));
gui.add(params, 'diskBrightness', 0.2, 4, 0.05).name('disk brightness').onChange((v) => (uniforms.uDiskBrightness.value = v));
gui.add(params, 'bloomStrength', 0, 3, 0.05).name('bloom strength').onChange((v) => (bloomPass.strength = v));
gui.add(params, 'bloomRadius', 0, 1.5, 0.01).name('bloom radius').onChange((v) => (bloomPass.radius = v));
gui.add(params, 'bloomThreshold', 0, 1, 0.01).name('bloom threshold').onChange((v) => (bloomPass.threshold = v));
gui.add(params, 'autoRotate').name('auto orbit').onChange((v) => (controls.autoRotate = v));

// ---------- resize ----------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  uniforms.uResolution.value.set(w, h);
  uniforms.uAspect.value = w / h;
  const res = document.getElementById('res');
  if (res) res.textContent = `${w}×${h}`;
}
window.addEventListener('resize', onResize);
onResize();

// ---------- animation loop ----------
const camMat3 = new THREE.Matrix3();
const clock = new THREE.Clock();
let fpsFrames = 0;
let fpsTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  controls.update();

  uniforms.uTime.value = clock.elapsedTime;
  uniforms.uCamPos.value.copy(camera.position);
  camMat3.setFromMatrix4(camera.matrixWorld);
  uniforms.uCamMatrix.value.copy(camMat3);
  uniforms.uFovScale.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

  composer.render();

  fpsFrames++;
  fpsTimer += delta;
  if (fpsTimer >= 0.5) {
    const fpsEl = document.getElementById('fps');
    if (fpsEl) fpsEl.textContent = Math.round(fpsFrames / fpsTimer);
    fpsFrames = 0;
    fpsTimer = 0;
  }
}

requestAnimationFrame(() => {
  document.body.classList.add('loaded');
  animate();
});
