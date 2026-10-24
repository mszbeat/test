import * as THREE from 'three';
import { OrbitControls } from '../../../vendor/OrbitControls.js';
import { createWorlds } from './worlds.js';

const canvas = document.querySelector('#world');
const loading = document.querySelector('#loading');
const loadingBar = document.querySelector('#loading-bar');
const loadingLabel = document.querySelector('#loading-label');
const chapterNumber = document.querySelector('#chapter-number');
const realm = document.querySelector('#realm');
const artifactType = document.querySelector('#artifact-type');
const artifactName = document.querySelector('#artifact-name');
const artifactLore = document.querySelector('#artifact-lore');
const specs = document.querySelector('#specs');
const worldLabelMain = document.querySelector('#world-label-main');
const worldLabelSub = document.querySelector('#world-label-sub');
const resetButton = document.querySelector('#reset-camera');
const autoRotateButton = document.querySelector('#auto-rotate');
const soundButton = document.querySelector('#sound-toggle');
const relicButtons = [...document.querySelectorAll('.relic-button')];

loadingBar.style.width = '18%';

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (error) {
  loadingLabel.textContent = 'WEBGL IS REQUIRED FOR THIS EXPERIENCE';
  loadingBar.style.width = '100%';
  loadingBar.style.background = '#d94232';
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.45 : 1.8));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = window.innerWidth >= 700;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 240);
camera.position.set(0.4, 0.35, 10.8);

function createStudioEnvironment() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 1024;
  canvasTexture.height = 512;
  const ctx = canvasTexture.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#647486');
  gradient.addColorStop(0.34, '#151c26');
  gradient.addColorStop(0.58, '#090a0e');
  gradient.addColorStop(1, '#48301f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = 'rgba(255,245,220,.95)';
  ctx.fillRect(115, 65, 110, 240);
  ctx.fillStyle = 'rgba(118,188,255,.75)';
  ctx.fillRect(720, 110, 75, 200);
  ctx.fillStyle = 'rgba(255,146,66,.5)';
  ctx.fillRect(870, 240, 95, 90);
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
scene.environment = createStudioEnvironment();

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI - 0.08;
controls.minDistance = 6.2;
controls.maxDistance = 17;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.68;
controls.target.set(0, -0.1, 0);
controls.update();

loadingBar.style.width = '42%';
const worlds = createWorlds();
worlds.forEach((world, index) => {
  world.root.visible = index === 0;
  scene.add(world.root);
});
loadingBar.style.width = '82%';

let currentIndex = 0;
let switching = false;
let cameraTween = null;
let lastTime = performance.now();
let running = true;

class AmbientAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.filter = null;
    this.noise = null;
    this.oscillator = null;
    this.enabled = false;
    this.profile = worlds[0].audio;
  }

  start() {
    if (this.context) {
      this.context.resume().catch(() => {});
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);

    this.filter = this.context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.profile.filter;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.master);

    const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 2.6;
    }
    this.noise = this.context.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.noise.connect(this.filter);
    this.noise.start();

    this.oscillator = this.context.createOscillator();
    const oscillatorGain = this.context.createGain();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = this.profile.pitch;
    oscillatorGain.gain.value = 0.065;
    this.oscillator.connect(oscillatorGain);
    oscillatorGain.connect(this.filter);
    this.oscillator.start();
  }

  toggle() {
    this.start();
    this.enabled = !this.enabled;
    const now = this.context?.currentTime ?? 0;
    this.master?.gain.cancelScheduledValues(now);
    this.master?.gain.setTargetAtTime(this.enabled ? this.profile.gain : 0, now, 0.12);
    return this.enabled;
  }

  setProfile(profile) {
    this.profile = profile;
    if (!this.context) return;
    const now = this.context.currentTime;
    this.filter.frequency.setTargetAtTime(profile.filter, now, 0.5);
    this.oscillator.frequency.setTargetAtTime(profile.pitch, now, 0.55);
    this.master.gain.setTargetAtTime(this.enabled ? profile.gain : 0, now, 0.3);
  }
}

const audio = new AmbientAudio();

function updateUI(world) {
  const { ui } = world;
  document.body.dataset.world = world.key;
  chapterNumber.textContent = ui.chapter;
  realm.textContent = ui.realm;
  artifactType.textContent = ui.type;
  artifactName.textContent = ui.name;
  artifactLore.textContent = ui.lore;
  specs.replaceChildren(...ui.specs.map(([label, value]) => {
    const element = document.createElement('span');
    const strong = document.createElement('b');
    strong.textContent = label;
    element.append(strong, document.createTextNode(` ${value}`));
    return element;
  }));
  worldLabelMain.textContent = ui.world;
  worldLabelSub.textContent = ui.subtitle;
  relicButtons.forEach((button, index) => {
    const active = index === currentIndex;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'true' : 'false');
  });
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
}

function resetCamera(animated = true) {
  const config = worlds[currentIndex].camera;
  const responsivePosition = config.position.clone();
  if (window.innerWidth < 700) responsivePosition.z *= 1.42;
  controls.minDistance = config.min;
  controls.maxDistance = window.innerWidth < 700 ? config.max * 1.42 : config.max;
  if (!animated) {
    camera.position.copy(responsivePosition);
    controls.target.copy(config.target);
    controls.update();
    return;
  }
  cameraTween = {
    elapsed: 0,
    duration: 1.15,
    startPosition: camera.position.clone(),
    endPosition: responsivePosition,
    startTarget: controls.target.clone(),
    endTarget: config.target.clone(),
  };
}

function switchWorld(index) {
  if (index === currentIndex || switching || !worlds[index]) return;
  switching = true;
  loadingLabel.textContent = worlds[index].ui.loading;
  document.body.classList.add('switching');

  window.setTimeout(() => {
    worlds[currentIndex].root.visible = false;
    currentIndex = index;
    const world = worlds[currentIndex];
    world.root.visible = true;
    scene.background = world.background;
    scene.fog = world.fog;
    updateUI(world);
    audio.setProfile(world.audio);
    resetCamera(true);

    window.setTimeout(() => {
      document.body.classList.remove('switching');
      switching = false;
    }, 360);
  }, 320);
}

function updateCameraTween(delta) {
  if (!cameraTween) return;
  cameraTween.elapsed += delta;
  const progress = Math.min(1, cameraTween.elapsed / cameraTween.duration);
  const eased = easeInOutCubic(progress);
  camera.position.lerpVectors(cameraTween.startPosition, cameraTween.endPosition, eased);
  controls.target.lerpVectors(cameraTween.startTarget, cameraTween.endTarget, eased);
  if (progress >= 1) cameraTween = null;
}

function render(now) {
  if (!running) return;
  const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  const time = now / 1000;

  updateCameraTween(delta);
  worlds.forEach((world, index) => world.update(time, delta, index === currentIndex));
  controls.update(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

relicButtons.forEach((button) => button.addEventListener('click', () => switchWorld(Number(button.dataset.index))));
resetButton.addEventListener('click', () => resetCamera(true));
autoRotateButton.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  autoRotateButton.classList.toggle('active', controls.autoRotate);
  autoRotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
});
soundButton.addEventListener('click', () => {
  const enabled = audio.toggle();
  soundButton.classList.toggle('active', enabled);
  soundButton.setAttribute('aria-pressed', String(enabled));
  soundButton.querySelector('i').textContent = enabled ? '◖))' : '◖×';
});

canvas.addEventListener('dblclick', () => resetCamera(true));
document.addEventListener('keydown', (event) => {
  if (event.code === 'Digit1') switchWorld(0);
  else if (event.code === 'Digit2') switchWorld(1);
  else if (event.code === 'Digit3') switchWorld(2);
  else if (event.code === 'ArrowRight') switchWorld((currentIndex + 1) % worlds.length);
  else if (event.code === 'ArrowLeft') switchWorld((currentIndex + worlds.length - 1) % worlds.length);
  else if (event.code === 'KeyR') resetCamera(true);
  else return;
  event.preventDefault();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.45 : 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false;
  } else {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(render);
  }
});

scene.background = worlds[0].background;
scene.fog = worlds[0].fog;
updateUI(worlds[0]);
resetCamera(false);
loadingBar.style.width = '100%';
loadingLabel.textContent = 'THE ARCHIVE IS OPEN';

window.__RELICS_3D__ = Object.freeze({
  scene,
  camera,
  controls,
  worlds,
  switchWorld,
  getCurrentIndex: () => currentIndex,
});

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    loading.classList.add('hidden');
    requestAnimationFrame(render);
  });
});
