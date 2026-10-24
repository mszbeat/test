import { AudioSystem } from './audio.js';
import { GameEngine, GAME_STATE } from './engine.js';
import { Maze } from './maze.js';
import { Renderer } from './renderer.js';

const canvas = document.querySelector('#game');
const overlay = document.querySelector('#overlay');
const overlayEyebrow = document.querySelector('#overlay-eyebrow');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const primaryAction = document.querySelector('#primary-action');
const primaryLabel = document.querySelector('#primary-label');
const scoreElement = document.querySelector('#score');
const levelElement = document.querySelector('#level');
const highScoreElement = document.querySelector('#high-score');
const livesElement = document.querySelector('#lives');
const pauseButton = document.querySelector('#pause-button');
const soundButton = document.querySelector('#sound-button');
const soundIcon = soundButton.querySelector('.sound-icon');
const frame = document.querySelector('#canvas-frame');

const maze = new Maze();
const engine = new GameEngine({ maze, storage: window.localStorage });
const renderer = new Renderer(canvas, engine);
const audio = new AudioSystem();

const keyDirections = new Map([
  ['ArrowUp', 'up'], ['KeyW', 'up'],
  ['ArrowLeft', 'left'], ['KeyA', 'left'],
  ['ArrowDown', 'down'], ['KeyS', 'down'],
  ['ArrowRight', 'right'], ['KeyD', 'right'],
]);

let lastTime = performance.now();
let accumulator = 0;
const FIXED_STEP = 1 / 120;
let lastUiSignature = '';
let pointerStart = null;

function formatScore(value) {
  return String(value).padStart(6, '0');
}

function setOverlay(visible, eyebrow = '', title = '', copy = '', action = '') {
  overlay.classList.toggle('visible', visible);
  overlay.setAttribute('aria-hidden', String(!visible));
  if (!visible) return;
  overlayEyebrow.textContent = eyebrow;
  overlayTitle.textContent = title;
  overlayCopy.innerHTML = copy;
  primaryLabel.textContent = action;
}

function syncUI(force = false) {
  const signature = [engine.score, engine.highScore, engine.level, engine.lives, engine.state].join('|');
  if (!force && signature === lastUiSignature) return;
  lastUiSignature = signature;

  scoreElement.textContent = formatScore(engine.score);
  highScoreElement.textContent = formatScore(engine.highScore);
  levelElement.textContent = String(engine.level).padStart(2, '0');
  livesElement.replaceChildren(...Array.from({ length: engine.lives }, () => {
    const life = document.createElement('span');
    life.className = 'life';
    return life;
  }));

  pauseButton.classList.toggle('active', engine.state === GAME_STATE.PAUSED);
  pauseButton.setAttribute('aria-label', engine.state === GAME_STATE.PAUSED ? 'Resume game' : 'Pause game');
  pauseButton.setAttribute('title', engine.state === GAME_STATE.PAUSED ? 'Resume game' : 'Pause game');

  if (engine.state === GAME_STATE.TITLE) {
    setOverlay(true, 'INITIALIZE RUN', 'READY?', 'Clear the grid. Outsmart the sentinels.<br>Own the high score.', 'PLAY');
  } else if (engine.state === GAME_STATE.PAUSED) {
    setOverlay(true, 'SYSTEM HOLD', 'PAUSED', 'The simulation is suspended.<br>Your run is safe.', 'RESUME');
  } else if (engine.state === GAME_STATE.GAME_OVER) {
    setOverlay(true, 'RUN TERMINATED', 'GAME OVER', `Final score <strong>${formatScore(engine.score)}</strong><br>Re-enter the grid?`, 'RETRY');
  } else {
    setOverlay(false);
  }
}

function routeEvents() {
  for (const event of engine.drainEvents()) {
    renderer.handleEvent(event);
    audio.handleEvent(event);
  }
}

function frameLoop(now) {
  const frameDelta = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  accumulator += frameDelta;

  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 15) {
    engine.update(FIXED_STEP);
    renderer.update(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }

  // Avoid a spiral of death if the tab was throttled for a long time.
  if (steps === 15) accumulator = 0;

  routeEvents();
  syncUI();
  renderer.render();
  requestAnimationFrame(frameLoop);
}

function activatePrimary() {
  audio.ensureStarted();
  engine.primaryAction();
  syncUI(true);
}

function setDirection(direction) {
  audio.ensureStarted();
  engine.setDirection(direction);
}

primaryAction.addEventListener('click', activatePrimary);

pauseButton.addEventListener('click', () => {
  audio.ensureStarted();
  engine.togglePause();
  routeEvents();
  syncUI(true);
});

soundButton.addEventListener('click', () => {
  audio.ensureStarted();
  const muted = audio.toggleMuted();
  soundButton.classList.toggle('active', muted);
  soundButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  soundButton.setAttribute('title', muted ? 'Unmute sound' : 'Mute sound');
  soundIcon.textContent = muted ? '◖×' : '◖))';
});

document.addEventListener('keydown', (event) => {
  const direction = keyDirections.get(event.code);
  if (direction) {
    event.preventDefault();
    setDirection(direction);
    return;
  }

  if (event.code === 'Enter' || event.code === 'Space') {
    if ([GAME_STATE.TITLE, GAME_STATE.GAME_OVER, GAME_STATE.PAUSED].includes(engine.state)) {
      event.preventDefault();
      activatePrimary();
    }
  } else if (event.code === 'KeyP' || event.code === 'Escape') {
    event.preventDefault();
    audio.ensureStarted();
    engine.togglePause();
    routeEvents();
    syncUI(true);
  } else if (event.code === 'KeyM') {
    event.preventDefault();
    soundButton.click();
  }
});

for (const button of document.querySelectorAll('[data-direction]')) {
  const direction = button.dataset.direction;
  const press = (event) => {
    event.preventDefault();
    button.classList.add('pressed');
    setDirection(direction);
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', () => button.classList.remove('pressed'));
  button.addEventListener('pointercancel', () => button.classList.remove('pressed'));
  button.addEventListener('pointerleave', () => button.classList.remove('pressed'));
}

frame.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
});

frame.addEventListener('pointerup', (event) => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.hypot(dx, dy) < 18) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 'right' : 'left');
  else setDirection(dy > 0 ? 'down' : 'up');
});

frame.addEventListener('pointercancel', () => {
  pointerStart = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && [GAME_STATE.PLAYING, GAME_STATE.READY].includes(engine.state)) {
    engine.pause();
    routeEvents();
    syncUI(true);
  }
});

// Exposed read-only by convention to make browser-level smoke testing and
// debugging easier without coupling the UI to a framework.
window.__NEON_MAZE__ = Object.freeze({ engine, maze });

syncUI(true);
renderer.render();
requestAnimationFrame(frameLoop);
