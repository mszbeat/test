import { Maze, TILE, tileKey } from './maze.js';

export const GAME_STATE = Object.freeze({
  TITLE: 'title',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DYING: 'dying',
  LEVEL_CLEAR: 'levelClear',
  GAME_OVER: 'gameOver',
});

export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1, opposite: 'down' }),
  left: Object.freeze({ x: -1, y: 0, opposite: 'right' }),
  down: Object.freeze({ x: 0, y: 1, opposite: 'up' }),
  right: Object.freeze({ x: 1, y: 0, opposite: 'left' }),
  none: Object.freeze({ x: 0, y: 0, opposite: 'none' }),
});

const DIRECTION_ORDER = ['up', 'left', 'down', 'right'];

const GHOST_PROFILES = Object.freeze([
  { marker: 'A', name: 'BLITZ', color: '#ff3b8d', personality: 'hunter', scatter: { col: 26, row: 1 }, delay: 0 },
  { marker: 'B', name: 'VECTOR', color: '#24e7ff', personality: 'ambush', scatter: { col: 1, row: 1 }, delay: 1.8 },
  { marker: 'C', name: 'GLITCH', color: '#b866ff', personality: 'vector', scatter: { col: 26, row: 29 }, delay: 4.5 },
  { marker: 'D', name: 'DRIFT', color: '#ff9f43', personality: 'shy', scatter: { col: 1, row: 29 }, delay: 7.5 },
]);

const MODE_SCHEDULE = Object.freeze([
  { mode: 'scatter', duration: 7 },
  { mode: 'chase', duration: 20 },
  { mode: 'scatter', duration: 7 },
  { mode: 'chase', duration: 20 },
  { mode: 'scatter', duration: 5 },
  { mode: 'chase', duration: 28 },
  { mode: 'scatter', duration: 5 },
  { mode: 'chase', duration: Infinity },
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const centerOf = (spawn) => ({ x: spawn.col + 0.5, y: spawn.row + 0.5 });

function createMover(spawn, options = {}) {
  const center = centerOf(spawn);
  return {
    col: spawn.col,
    row: spawn.row,
    x: center.x,
    y: center.y,
    dir: options.dir ?? 'left',
    desiredDir: options.dir ?? 'left',
    speed: options.speed ?? 7.2,
    atCenter: true,
  };
}

function safeStorage(storage) {
  if (!storage) return null;
  try {
    const probe = '__neon_maze_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export class GameEngine {
  constructor(options = {}) {
    this.maze = options.maze ?? new Maze();
    this.random = options.random ?? Math.random;
    this.storage = safeStorage(options.storage ?? null);
    this.highScore = this.readHighScore();
    this.events = [];
    this.state = GAME_STATE.TITLE;
    this.previousState = null;
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.elapsed = 0;
    this.stateTimer = 0;
    this.modeIndex = 0;
    this.modeTimer = 0;
    this.frightenedTimer = 0;
    this.ghostCombo = 0;
    this.fruit = null;
    this.fruitSpawned = false;
    this.pellets = this.maze.clonePellets();
    this.powerPellets = new Set(this.maze.initialPowerPellets);
    this.initialPelletCount = this.pellets.size;
    this.player = createMover(this.maze.playerSpawn, { dir: 'left' });
    this.ghosts = [];
    this.resetActors();
  }

  readHighScore() {
    if (!this.storage) return 0;
    const value = Number.parseInt(this.storage.getItem('neon-maze-high-score') ?? '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  persistHighScore() {
    if (!this.storage) return;
    try {
      this.storage.setItem('neon-maze-high-score', String(this.highScore));
    } catch {
      // Storage may become unavailable mid-session (for example, privacy mode).
    }
  }

  emit(type, payload = {}) {
    this.events.push({ type, ...payload });
  }

  drainEvents() {
    return this.events.splice(0);
  }

  setDirection(direction) {
    if (DIRECTIONS[direction] && direction !== 'none') {
      this.player.desiredDir = direction;
    }
  }

  addScore(points) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.persistHighScore();
    }
  }

  newGame() {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.startLevel();
    this.state = GAME_STATE.READY;
    this.stateTimer = 1.35;
    this.emit('start');
  }

  startLevel() {
    this.pellets = this.maze.clonePellets();
    this.powerPellets = new Set(this.maze.initialPowerPellets);
    this.initialPelletCount = this.pellets.size;
    this.modeIndex = 0;
    this.modeTimer = 0;
    this.frightenedTimer = 0;
    this.ghostCombo = 0;
    this.fruit = null;
    this.fruitSpawned = false;
    this.resetActors();
  }

  resetActors() {
    this.player = createMover(this.maze.playerSpawn, {
      dir: 'left',
      speed: this.playerSpeed(),
    });

    this.ghosts = GHOST_PROFILES.map((profile) => {
      const spawn = this.maze.ghostSpawns.get(profile.marker);
      const mover = createMover(spawn, {
        dir: profile.marker === 'A' ? 'left' : 'up',
        speed: this.ghostSpeed(),
      });
      return {
        ...mover,
        ...profile,
        spawn: { ...spawn },
        state: profile.marker === 'A' ? 'normal' : 'home',
        releaseTimer: profile.delay,
        forceReverse: false,
      };
    });
  }

  playerSpeed() {
    return Math.min(8.6, 7.15 + (this.level - 1) * 0.12);
  }

  ghostSpeed() {
    return Math.min(8.25, 6.55 + (this.level - 1) * 0.13);
  }

  pause() {
    if ([GAME_STATE.PLAYING, GAME_STATE.READY].includes(this.state)) {
      this.previousState = this.state;
      this.state = GAME_STATE.PAUSED;
      this.emit('pause');
      return true;
    }
    return false;
  }

  resume() {
    if (this.state !== GAME_STATE.PAUSED) return false;
    this.state = this.previousState === GAME_STATE.READY ? GAME_STATE.READY : GAME_STATE.PLAYING;
    this.previousState = null;
    this.emit('resume');
    return true;
  }

  togglePause() {
    return this.state === GAME_STATE.PAUSED ? this.resume() : this.pause();
  }

  primaryAction() {
    if ([GAME_STATE.TITLE, GAME_STATE.GAME_OVER].includes(this.state)) {
      this.newGame();
      return;
    }
    if (this.state === GAME_STATE.PAUSED) this.resume();
  }

  update(dt) {
    dt = clamp(dt, 0, 0.05);
    this.elapsed += dt;

    if (this.state === GAME_STATE.READY) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = GAME_STATE.PLAYING;
        this.emit('readyComplete');
      }
      return;
    }

    if (this.state === GAME_STATE.DYING) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.lives <= 0) {
          this.state = GAME_STATE.GAME_OVER;
          this.emit('gameOver');
        } else {
          this.resetActors();
          this.frightenedTimer = 0;
          this.ghostCombo = 0;
          this.state = GAME_STATE.READY;
          this.stateTimer = 1.05;
        }
      }
      return;
    }

    if (this.state === GAME_STATE.LEVEL_CLEAR) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.level += 1;
        this.startLevel();
        this.state = GAME_STATE.READY;
        this.stateTimer = 1.25;
      }
      return;
    }

    if (this.state !== GAME_STATE.PLAYING) return;

    this.updateMode(dt);
    this.updateFrightened(dt);
    this.advancePlayer(dt);
    this.collectPlayerTile();
    this.updateFruit(dt);

    for (const ghost of this.ghosts) {
      this.advanceGhost(ghost, dt);
    }

    this.resolveCollisions();

    if (this.state === GAME_STATE.PLAYING && this.pellets.size === 0) {
      this.state = GAME_STATE.LEVEL_CLEAR;
      this.stateTimer = 1.8;
      this.addScore(500 * this.level);
      this.emit('levelClear', { level: this.level });
    }
  }

  updateMode(dt) {
    if (this.frightenedTimer > 0) return;
    this.modeTimer += dt;
    const current = MODE_SCHEDULE[this.modeIndex];
    if (this.modeTimer >= current.duration && this.modeIndex < MODE_SCHEDULE.length - 1) {
      this.modeTimer = 0;
      this.modeIndex += 1;
      for (const ghost of this.ghosts) {
        if (ghost.state === 'normal') ghost.forceReverse = true;
      }
    }
  }

  currentMode() {
    return MODE_SCHEDULE[this.modeIndex].mode;
  }

  updateFrightened(dt) {
    if (this.frightenedTimer <= 0) return;
    this.frightenedTimer = Math.max(0, this.frightenedTimer - dt);
    if (this.frightenedTimer === 0) {
      this.ghostCombo = 0;
      for (const ghost of this.ghosts) {
        if (ghost.state === 'frightened') ghost.state = 'normal';
      }
      this.emit('powerEnd');
    }
  }

  canMove(mover, direction, actor = 'player', ghostState = 'normal') {
    if (!DIRECTIONS[direction] || direction === 'none') return false;
    const vector = DIRECTIONS[direction];
    return this.maze.isWalkable(mover.col + vector.x, mover.row + vector.y, actor, ghostState);
  }

  advanceMover(mover, dt, actor, chooseDirection, ghostState = 'normal') {
    let remaining = mover.speed * dt;
    let guard = 0;

    while (remaining > 0.00001 && guard < 4) {
      guard += 1;
      if (mover.atCenter) {
        const chosen = chooseDirection(mover);
        if (chosen && this.canMove(mover, chosen, actor, ghostState)) mover.dir = chosen;
        if (!this.canMove(mover, mover.dir, actor, ghostState)) {
          mover.dir = 'none';
          break;
        }
      }

      const direction = DIRECTIONS[mover.dir];
      let targetCol = mover.col + direction.x;
      const targetRow = mover.row + direction.y;
      let targetX = targetCol + 0.5;
      const targetY = targetRow + 0.5;

      // Keep the interpolation moving off-screen before wrapping to the opposite
      // tunnel entrance; drawing code mirrors the sprite during this interval.
      const distance = Math.abs(direction.x ? targetX - mover.x : targetY - mover.y);
      const step = Math.min(remaining, distance);
      mover.x += direction.x * step;
      mover.y += direction.y * step;
      mover.atCenter = false;
      remaining -= step;

      if (distance - step <= 0.00001) {
        targetCol = this.maze.normalizeCol(targetCol);
        mover.col = targetCol;
        mover.row = targetRow;
        mover.x = targetCol + 0.5;
        mover.y = targetRow + 0.5;
        mover.atCenter = true;
      }
    }
  }

  advancePlayer(dt) {
    this.player.speed = this.playerSpeed() * (this.frightenedTimer > 0 ? 1.03 : 1);
    this.advanceMover(
      this.player,
      dt,
      'player',
      (player) => (this.canMove(player, player.desiredDir, 'player') ? player.desiredDir : player.dir),
    );
  }

  advanceGhost(ghost, dt) {
    if (ghost.state === 'home' && ghost.releaseTimer > 0) {
      ghost.releaseTimer = Math.max(0, ghost.releaseTimer - dt);
      return;
    }

    const state = ghost.state;
    ghost.speed = state === 'eaten'
      ? 10.4
      : state === 'frightened'
        ? this.ghostSpeed() * 0.72
        : this.ghostSpeed();

    this.advanceMover(
      ghost,
      dt,
      'ghost',
      () => this.chooseGhostDirection(ghost),
      ghost.state,
    );

    if (ghost.state === 'home' && ghost.col === 13 && ghost.row === 11) {
      ghost.state = this.frightenedTimer > 0 ? 'frightened' : 'normal';
      ghost.dir = 'left';
      ghost.desiredDir = 'left';
    } else if (ghost.state === 'eaten' && ghost.col === 13 && ghost.row === 14) {
      ghost.state = 'home';
      ghost.releaseTimer = 1.3;
      ghost.dir = 'up';
      ghost.desiredDir = 'up';
    }
  }

  validGhostDirections(ghost) {
    return DIRECTION_ORDER.filter((direction) => this.canMove(ghost, direction, 'ghost', ghost.state));
  }

  chooseGhostDirection(ghost) {
    let options = this.validGhostDirections(ghost);
    if (!options.length) return 'none';

    const reverse = DIRECTIONS[ghost.dir]?.opposite ?? 'none';
    if (ghost.forceReverse && options.includes(reverse)) {
      ghost.forceReverse = false;
      return reverse;
    }

    const withoutReverse = options.filter((direction) => direction !== reverse);
    if (withoutReverse.length) options = withoutReverse;

    if (ghost.state === 'frightened') {
      return options[Math.floor(this.random() * options.length) % options.length];
    }

    const target = ghost.state === 'home'
      ? { col: 13, row: 11 }
      : ghost.state === 'eaten'
        ? { col: 13, row: 14 }
        : this.ghostTarget(ghost);

    let best = options[0];
    let bestDistance = Infinity;
    for (const direction of options) {
      const vector = DIRECTIONS[direction];
      const col = this.maze.normalizeCol(ghost.col + vector.x);
      const row = ghost.row + vector.y;
      const rawXDistance = Math.abs(col - target.col);
      const xDistance = Math.min(rawXDistance, this.maze.width - rawXDistance);
      const distance = xDistance ** 2 + (row - target.row) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = direction;
      }
    }
    return best;
  }

  projectedPlayerTile(distance) {
    const direction = DIRECTIONS[this.player.dir] ?? DIRECTIONS.left;
    return {
      col: this.player.col + direction.x * distance,
      row: this.player.row + direction.y * distance,
    };
  }

  ghostTarget(ghost) {
    if (this.currentMode() === 'scatter') return ghost.scatter;

    if (ghost.personality === 'hunter') {
      return { col: this.player.col, row: this.player.row };
    }

    if (ghost.personality === 'ambush') {
      return this.projectedPlayerTile(4);
    }

    if (ghost.personality === 'vector') {
      const ahead = this.projectedPlayerTile(2);
      const hunter = this.ghosts[0];
      return {
        col: ahead.col + (ahead.col - hunter.col),
        row: ahead.row + (ahead.row - hunter.row),
      };
    }

    const dx = ghost.col - this.player.col;
    const dy = ghost.row - this.player.row;
    return dx * dx + dy * dy > 64
      ? { col: this.player.col, row: this.player.row }
      : ghost.scatter;
  }

  collectPlayerTile() {
    const key = tileKey(this.player.col, this.player.row);
    if (!this.pellets.has(key)) return;

    this.pellets.delete(key);
    if (this.powerPellets.has(key)) {
      this.powerPellets.delete(key);
      this.addScore(50);
      this.activatePowerMode();
      this.emit('power', { col: this.player.col, row: this.player.row });
    } else {
      this.addScore(10);
      this.emit('pellet', { col: this.player.col, row: this.player.row });
    }

    const collected = this.initialPelletCount - this.pellets.size;
    if (!this.fruitSpawned && collected >= Math.floor(this.initialPelletCount * 0.55)) {
      this.fruitSpawned = true;
      this.fruit = { col: 13, row: 17, ttl: 10 };
      this.emit('fruitSpawn');
    }
  }

  activatePowerMode() {
    this.frightenedTimer = Math.max(4.2, 7.2 - (this.level - 1) * 0.32);
    this.ghostCombo = 0;
    for (const ghost of this.ghosts) {
      if (ghost.state === 'normal') {
        ghost.state = 'frightened';
        ghost.forceReverse = true;
      }
    }
  }

  updateFruit(dt) {
    if (!this.fruit) return;
    this.fruit.ttl -= dt;
    if (this.player.col === this.fruit.col && this.player.row === this.fruit.row) {
      const points = 500 + this.level * 250;
      this.addScore(points);
      this.emit('fruit', { col: this.fruit.col, row: this.fruit.row, points });
      this.fruit = null;
    } else if (this.fruit.ttl <= 0) {
      this.fruit = null;
    }
  }

  resolveCollisions() {
    for (const ghost of this.ghosts) {
      if (ghost.state === 'eaten') continue;
      const rawDx = Math.abs(this.player.x - ghost.x);
      const dx = Math.min(rawDx, this.maze.width - rawDx);
      const dy = Math.abs(this.player.y - ghost.y);
      if (dx * dx + dy * dy > 0.56 ** 2) continue;

      if (ghost.state === 'frightened') {
        ghost.state = 'eaten';
        ghost.forceReverse = true;
        const points = 200 * (2 ** this.ghostCombo);
        this.ghostCombo = Math.min(3, this.ghostCombo + 1);
        this.addScore(points);
        this.emit('ghostEaten', { ghost: ghost.name, x: ghost.x, y: ghost.y, points });
      } else if (ghost.state !== 'home') {
        this.triggerDeath();
        return;
      }
    }
  }

  triggerDeath() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.lives = Math.max(0, this.lives - 1);
    this.state = GAME_STATE.DYING;
    this.stateTimer = 1.55;
    this.emit('death', { lives: this.lives });
  }

  progress() {
    return this.initialPelletCount === 0
      ? 0
      : 1 - this.pellets.size / this.initialPelletCount;
  }
}
