import { DIRECTIONS, GAME_STATE } from './engine.js';
import { TILE, fromTileKey } from './maze.js';

const LOGICAL_WIDTH = 560;
const LOGICAL_HEIGHT = 620;
const TILE_SIZE = 20;
const TAU = Math.PI * 2;

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function colorWithAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export class Renderer {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.engine = engine;
    this.time = 0;
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.stars = Array.from({ length: 75 }, (_, index) => ({
      x: (index * 83.17) % LOGICAL_WIDTH,
      y: (index * 47.31) % LOGICAL_HEIGHT,
      size: 0.35 + ((index * 17) % 11) / 12,
      phase: index * 0.71,
    }));
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(LOGICAL_WIDTH * dpr);
    this.canvas.height = Math.round(LOGICAL_HEIGHT * dpr);
    this.canvas.style.aspectRatio = `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
  }

  handleEvent(event) {
    const point = event.col === undefined
      ? null
      : { x: (event.col + 0.5) * TILE_SIZE, y: (event.row + 0.5) * TILE_SIZE };

    if (event.type === 'pellet' && point) {
      this.burst(point.x, point.y, '#91ffff', 2, 28);
    } else if (event.type === 'power' && point) {
      this.burst(point.x, point.y, '#ffe45c', 22, 120);
      this.flash = 0.35;
      this.flashColor = '#fff15c';
    } else if (event.type === 'ghostEaten') {
      this.burst(event.x * TILE_SIZE, event.y * TILE_SIZE, '#ffffff', 18, 145);
      this.floatText(event.x * TILE_SIZE, event.y * TILE_SIZE, `+${event.points}`, '#5ffcff');
      this.shake = 4;
    } else if (event.type === 'fruit') {
      this.burst((event.col + 0.5) * TILE_SIZE, (event.row + 0.5) * TILE_SIZE, '#ff54db', 28, 165);
      this.floatText((event.col + 0.5) * TILE_SIZE, (event.row + 0.5) * TILE_SIZE, `CORE +${event.points}`, '#ff79e5');
    } else if (event.type === 'fruitSpawn') {
      this.flash = 0.18;
      this.flashColor = '#ff35d3';
    } else if (event.type === 'death') {
      this.shake = 11;
      this.flash = 0.4;
      this.flashColor = '#ff286f';
      this.burst(this.engine.player.x * TILE_SIZE, this.engine.player.y * TILE_SIZE, '#ffe75b', 35, 190);
    } else if (event.type === 'levelClear') {
      this.flash = 0.65;
      this.flashColor = '#35f6ff';
      this.shake = 5;
    }
  }

  burst(x, y, color, count, speed) {
    if (this.reducedMotion) count = Math.min(count, 5);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const velocity = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 1 + Math.random() * 2.3,
        color,
      });
    }
  }

  floatText(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1, maxLife: 1 });
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    this.flash = Math.max(0, this.flash - dt * 1.7);

    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const floater of this.floaters) {
      floater.y -= 24 * dt;
      floater.life -= dt;
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(ctx);

    const shakeX = this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake;
    const shakeY = this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawMaze(ctx);
    this.drawPellets(ctx);
    this.drawFruit(ctx);
    this.drawActors(ctx);
    this.drawParticles(ctx);
    this.drawStateMessage(ctx);
    ctx.restore();

    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.24, this.flash * 0.34);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    ctx.restore();
  }

  drawBackground(ctx) {
    const gradient = ctx.createRadialGradient(280, 310, 30, 280, 310, 430);
    gradient.addColorStop(0, '#07152a');
    gradient.addColorStop(0.52, '#030b19');
    gradient.addColorStop(1, '#01040c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.save();
    for (const star of this.stars) {
      const alpha = 0.05 + (Math.sin(this.time * 1.4 + star.phase) + 1) * 0.045;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#77eaff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 0.045;
    ctx.strokeStyle = '#3cecff';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= LOGICAL_WIDTH; x += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, LOGICAL_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= LOGICAL_HEIGHT; y += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(LOGICAL_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMaze(ctx) {
    const { maze } = this.engine;
    ctx.save();

    // Fill wall mass first, then draw only exposed edges so neighboring wall
    // cells read as one continuous neon structure rather than a tile grid.
    ctx.fillStyle = '#061226';
    for (let row = 0; row < maze.height; row += 1) {
      for (let col = 0; col < maze.width; col += 1) {
        if (!maze.isWall(col, row)) continue;
        ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#17dff5';
    ctx.shadowColor = '#00d9ff';
    ctx.shadowBlur = 9;

    const edge = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    for (let row = 0; row < maze.height; row += 1) {
      for (let col = 0; col < maze.width; col += 1) {
        if (!maze.isWall(col, row)) continue;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const inset = 1.5;
        if (!maze.isWall(col, row - 1)) edge(x + inset, y + inset, x + TILE_SIZE - inset, y + inset);
        if (!maze.isWall(col, row + 1)) edge(x + inset, y + TILE_SIZE - inset, x + TILE_SIZE - inset, y + TILE_SIZE - inset);
        if (!maze.isWall(col - 1, row)) edge(x + inset, y + inset, x + inset, y + TILE_SIZE - inset);
        if (!maze.isWall(col + 1, row)) edge(x + TILE_SIZE - inset, y + inset, x + TILE_SIZE - inset, y + TILE_SIZE - inset);
      }
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#6958ff';
    ctx.lineWidth = 0.7;
    for (let row = 0; row < maze.height; row += 1) {
      for (let col = 0; col < maze.width; col += 1) {
        if (!maze.isWall(col, row)) continue;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        if (!maze.isWall(col, row - 1)) edge(x + 3, y + 4, x + TILE_SIZE - 3, y + 4);
      }
    }

    // Ghost-house energy gate.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff4ad8';
    ctx.shadowColor = '#ff2aca';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    for (let row = 0; row < maze.height; row += 1) {
      for (let col = 0; col < maze.width; col += 1) {
        if (maze.cell(col, row) !== TILE.GATE) continue;
        const y = (row + 0.5) * TILE_SIZE;
        edge(col * TILE_SIZE + 2, y, (col + 1) * TILE_SIZE - 2, y);
      }
    }
    ctx.restore();
  }

  drawPellets(ctx) {
    ctx.save();
    for (const key of this.engine.pellets) {
      const [col, row] = fromTileKey(key);
      const x = (col + 0.5) * TILE_SIZE;
      const y = (row + 0.5) * TILE_SIZE;
      if (this.engine.powerPellets.has(key)) {
        const pulse = this.reducedMotion ? 1 : 1 + Math.sin(this.time * 5 + col) * 0.18;
        const radius = 5.1 * pulse;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.6);
        gradient.addColorStop(0, '#fffde5');
        gradient.addColorStop(0.28, '#ffe75b');
        gradient.addColorStop(1, 'rgba(255, 225, 55, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fffbd1';
        ctx.shadowColor = '#ffed52';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#a8ffff';
        ctx.shadowColor = '#49e9ff';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(x, y, 1.65, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawFruit(ctx) {
    const fruit = this.engine.fruit;
    if (!fruit) return;
    const x = (fruit.col + 0.5) * TILE_SIZE;
    const y = (fruit.row + 0.5) * TILE_SIZE;
    const pulse = this.reducedMotion ? 1 : 1 + Math.sin(this.time * 7) * 0.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.reducedMotion ? 0 : this.time * 0.8);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#ff2ed7';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff4bdc';
    ctx.strokeStyle = '#fff0fc';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-1.2, -4.2, 2.4, 8.4);
    ctx.fillRect(-4.2, -1.2, 8.4, 2.4);
    ctx.restore();
  }

  drawActors(ctx) {
    for (const ghost of this.engine.ghosts) this.drawTunnelCopies(ctx, ghost, (x, y) => this.drawGhost(ctx, ghost, x, y));
    this.drawTunnelCopies(ctx, this.engine.player, (x, y) => this.drawPlayer(ctx, x, y));
  }

  drawTunnelCopies(ctx, actor, draw) {
    const x = actor.x * TILE_SIZE;
    const y = actor.y * TILE_SIZE;
    draw(x, y);
    if (actor.x < 1) draw(x + LOGICAL_WIDTH, y);
    if (actor.x > this.engine.maze.width - 1) draw(x - LOGICAL_WIDTH, y);
  }

  drawPlayer(ctx, x, y) {
    const player = this.engine.player;
    const directionAngles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2, none: 0 };
    const angle = directionAngles[player.dir] ?? 0;
    const moving = player.dir !== 'none' && this.engine.state === GAME_STATE.PLAYING;
    let mouth = moving ? 0.12 + Math.abs(Math.sin(this.time * 13)) * 0.28 : 0.18;
    let radius = 8.2;
    let alpha = 1;

    if (this.engine.state === GAME_STATE.DYING) {
      const progress = 1 - Math.max(0, this.engine.stateTimer) / 1.55;
      mouth = Math.min(Math.PI * 0.92, progress * Math.PI);
      radius *= 1 - progress * 0.32;
      alpha = 1 - progress * 0.65;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#ffe84a';
    ctx.shadowBlur = 18;
    const gradient = ctx.createRadialGradient(-2, -3, 1, 0, 0, radius * 1.2);
    gradient.addColorStop(0, '#fffbd0');
    gradient.addColorStop(0.3, '#ffe85a');
    gradient.addColorStop(1, '#ffb800');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, mouth, TAU - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawGhost(ctx, ghost, x, y) {
    const radius = 8.3;
    ctx.save();
    ctx.translate(x, y);

    if (ghost.state === 'eaten') {
      this.drawEyes(ctx, ghost.dir, 1);
      ctx.restore();
      return;
    }

    const flashing = ghost.state === 'frightened' && this.engine.frightenedTimer < 2
      && Math.floor(this.time * 8) % 2 === 0;
    const color = ghost.state === 'frightened'
      ? (flashing ? '#f5f7ff' : '#354cff')
      : ghost.color;

    ctx.globalAlpha = ghost.state === 'home' ? 0.82 : 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    const gradient = ctx.createLinearGradient(0, -radius, 0, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.09, color);
    gradient.addColorStop(1, colorWithAlpha(color, 0.72));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-radius, 7);
    ctx.lineTo(-radius, 0);
    ctx.arc(0, 0, radius, Math.PI, 0);
    ctx.lineTo(radius, 7);
    ctx.lineTo(radius * 0.56, 4.1);
    ctx.lineTo(radius * 0.18, 7);
    ctx.lineTo(-radius * 0.2, 4.1);
    ctx.lineTo(-radius * 0.58, 7);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    if (ghost.state === 'frightened') {
      ctx.fillStyle = flashing ? '#3343b8' : '#fff';
      ctx.beginPath();
      ctx.arc(-3, -1.5, 1.15, 0, TAU);
      ctx.arc(3, -1.5, 1.15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = flashing ? '#3343b8' : '#fff';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-4.5, 3.3);
      ctx.lineTo(-2.2, 1.8);
      ctx.lineTo(0, 3.3);
      ctx.lineTo(2.2, 1.8);
      ctx.lineTo(4.5, 3.3);
      ctx.stroke();
    } else {
      this.drawEyes(ctx, ghost.dir, 0.88);
    }
    ctx.restore();
  }

  drawEyes(ctx, direction, scale) {
    const vector = DIRECTIONS[direction] ?? DIRECTIONS.left;
    for (const offset of [-3.1, 3.1]) {
      ctx.fillStyle = '#f8fdff';
      ctx.beginPath();
      ctx.ellipse(offset, -1.2, 2.45 * scale, 3.25 * scale, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#07142e';
      ctx.beginPath();
      ctx.arc(offset + vector.x * 0.9, -1.2 + vector.y * 0.9, 1.15 * scale, 0, TAU);
      ctx.fill();
    }
  }

  drawParticles(ctx) {
    ctx.save();
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 7;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (const floater of this.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.fillStyle = floater.color;
      ctx.shadowColor = floater.color;
      ctx.shadowBlur = 9;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }

  drawStateMessage(ctx) {
    let title = '';
    let subtitle = '';
    if (this.engine.state === GAME_STATE.READY) {
      title = 'GET READY';
      subtitle = `LEVEL ${String(this.engine.level).padStart(2, '0')}`;
    } else if (this.engine.state === GAME_STATE.LEVEL_CLEAR) {
      title = 'GRID CLEARED';
      subtitle = 'SYNCING NEXT SECTOR';
    }
    if (!title) return;

    ctx.save();
    const width = 250;
    const height = 64;
    const x = (LOGICAL_WIDTH - width) / 2;
    const y = 331;
    ctx.fillStyle = 'rgba(2, 7, 19, 0.9)';
    ctx.strokeStyle = '#39efff';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#13dcff';
    ctx.shadowBlur = 18;
    roundedRect(ctx, x, y, width, height, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 18px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(title, LOGICAL_WIDTH / 2, y + 27);
    ctx.fillStyle = '#66efff';
    ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(subtitle, LOGICAL_WIDTH / 2, y + 46);
    ctx.restore();
  }
}
