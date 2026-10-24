import test from 'node:test';
import assert from 'node:assert/strict';

import { DIRECTIONS, GAME_STATE, GameEngine } from '../src/engine.js';
import { Maze, RAW_MAP, reachableTiles, tileKey } from '../src/maze.js';

test('maze is rectangular and contains every required spawn', () => {
  const maze = new Maze();
  assert.equal(maze.width, 28);
  assert.equal(maze.height, 31);
  assert.ok(RAW_MAP.every((row) => row.length === maze.width));
  assert.deepEqual([...maze.ghostSpawns.keys()].sort(), ['A', 'B', 'C', 'D']);
  assert.ok(maze.initialPellets.size > 200, 'maze should contain a full arcade-sized pellet field');
  assert.equal(maze.initialPowerPellets.size, 4);
});

test('every pellet is reachable by the player', () => {
  const maze = new Maze();
  const reachable = reachableTiles(maze);
  for (const key of maze.initialPellets) {
    assert.ok(reachable.has(key), `unreachable pellet at ${key}`);
  }
  for (const key of maze.initialPowerPellets) {
    assert.ok(reachable.has(key), `unreachable power pellet at ${key}`);
  }
});

test('ghost gate permissions prevent the player and active ghosts from entering', () => {
  const maze = new Maze();
  let gate = null;
  for (let row = 0; row < maze.height; row += 1) {
    for (let col = 0; col < maze.width; col += 1) {
      if (maze.isGate(col, row)) gate = { col, row };
    }
  }
  assert.ok(gate);
  assert.equal(maze.isWalkable(gate.col, gate.row, 'player'), false);
  assert.equal(maze.isWalkable(gate.col, gate.row, 'ghost', 'normal'), false);
  assert.equal(maze.isWalkable(gate.col, gate.row, 'ghost', 'frightened'), false);
  assert.equal(maze.isWalkable(gate.col, gate.row, 'ghost', 'home'), true);
  assert.equal(maze.isWalkable(gate.col, gate.row, 'ghost', 'eaten'), true);
});

test('collecting a pellet updates score and removes it exactly once', () => {
  const engine = new GameEngine({ random: () => 0 });
  engine.newGame();
  const key = [...engine.maze.initialPellets][0];
  const [col, row] = key.split(',').map(Number);
  Object.assign(engine.player, { col, row, x: col + 0.5, y: row + 0.5 });

  engine.collectPlayerTile();
  assert.equal(engine.score, 10);
  assert.equal(engine.pellets.has(key), false);
  engine.collectPlayerTile();
  assert.equal(engine.score, 10, 'a consumed pellet cannot score twice');
});

test('power pellet frightens active ghosts and starts a combo window', () => {
  const engine = new GameEngine({ random: () => 0 });
  engine.newGame();
  const key = [...engine.maze.initialPowerPellets][0];
  const [col, row] = key.split(',').map(Number);
  Object.assign(engine.player, { col, row, x: col + 0.5, y: row + 0.5 });

  engine.collectPlayerTile();
  assert.equal(engine.score, 50);
  assert.ok(engine.frightenedTimer >= 4.2);
  assert.equal(engine.ghosts[0].state, 'frightened');
  assert.ok(engine.ghosts.slice(1).every((ghost) => ghost.state === 'home'));
});

test('frightened ghost collision awards points instead of taking a life', () => {
  const engine = new GameEngine({ random: () => 0 });
  engine.newGame();
  engine.state = GAME_STATE.PLAYING;
  const ghost = engine.ghosts[0];
  ghost.state = 'frightened';
  Object.assign(ghost, { x: engine.player.x, y: engine.player.y, col: engine.player.col, row: engine.player.row });

  engine.resolveCollisions();
  assert.equal(ghost.state, 'eaten');
  assert.equal(engine.score, 200);
  assert.equal(engine.lives, 3);
  assert.equal(engine.state, GAME_STATE.PLAYING);
});

test('normal ghost collision takes one life and cannot double-trigger', () => {
  const engine = new GameEngine({ random: () => 0 });
  engine.newGame();
  engine.state = GAME_STATE.PLAYING;
  const ghost = engine.ghosts[0];
  ghost.state = 'normal';
  Object.assign(ghost, { x: engine.player.x, y: engine.player.y, col: engine.player.col, row: engine.player.row });

  engine.resolveCollisions();
  engine.resolveCollisions();
  assert.equal(engine.lives, 2);
  assert.equal(engine.state, GAME_STATE.DYING);
});

test('tunnel movement wraps cleanly from the left edge to the right edge', () => {
  const engine = new GameEngine({ random: () => 0 });
  const row = [...engine.maze.tunnelRows].find((candidate) => engine.maze.isWalkable(0, candidate));
  assert.notEqual(row, undefined);
  Object.assign(engine.player, {
    col: 0,
    row,
    x: 0.5,
    y: row + 0.5,
    dir: 'left',
    desiredDir: 'left',
    atCenter: true,
    speed: 8,
  });
  assert.equal(engine.canMove(engine.player, 'left', 'player'), true);

  for (let i = 0; i < 20; i += 1) engine.advancePlayer(1 / 120);
  assert.equal(engine.player.col, engine.maze.width - 1);
  assert.ok(engine.player.x <= engine.maze.width - 0.5);
});

test('ghost chooser always returns a legal direction', () => {
  const engine = new GameEngine({ random: () => 0.5 });
  engine.newGame();
  for (const ghost of engine.ghosts) {
    const direction = engine.chooseGhostDirection(ghost);
    assert.ok(DIRECTIONS[direction]);
    if (direction !== 'none') {
      assert.equal(engine.canMove(ghost, direction, 'ghost', ghost.state), true);
    }
  }
});

test('clearing the final pellet enters level-clear state and advances safely', () => {
  const engine = new GameEngine({ random: () => 0 });
  engine.newGame();
  engine.state = GAME_STATE.PLAYING;
  const key = [...engine.pellets][0];
  engine.pellets = new Set([key]);
  engine.powerPellets.delete(key);
  const [col, row] = key.split(',').map(Number);
  Object.assign(engine.player, { col, row, x: col + 0.5, y: row + 0.5, dir: 'none', desiredDir: 'left', atCenter: true });
  engine.ghosts.forEach((ghost) => Object.assign(ghost, { state: 'home', releaseTimer: 999 }));

  engine.update(1 / 120);
  assert.equal(engine.state, GAME_STATE.LEVEL_CLEAR);
  const level = engine.level;
  engine.update(2);
  assert.equal(engine.level, level, 'update delta is clamped to protect simulation stability');
  for (let i = 0; i < 220; i += 1) engine.update(1 / 120);
  assert.equal(engine.level, level + 1);
  assert.equal(engine.state, GAME_STATE.READY);
  assert.equal(engine.pellets.size, engine.initialPelletCount);
});

test('a deterministic two-minute simulation stays finite and valid', () => {
  let seed = 0x5eed1234;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const engine = new GameEngine({ random });
  engine.newGame();

  for (let tick = 0; tick < 120 * 120; tick += 1) {
    if (engine.state === GAME_STATE.GAME_OVER) engine.newGame();
    if (engine.player.atCenter && engine.state === GAME_STATE.PLAYING) {
      const options = ['up', 'left', 'down', 'right']
        .filter((direction) => engine.canMove(engine.player, direction, 'player'));
      if (options.length) engine.setDirection(options[Math.floor(random() * options.length)]);
    }
    engine.update(1 / 120);

    if (tick % 120 === 0) {
      for (const actor of [engine.player, ...engine.ghosts]) {
        assert.equal(Number.isFinite(actor.x) && Number.isFinite(actor.y), true);
        assert.ok(actor.row >= 0 && actor.row < engine.maze.height);
        assert.ok(actor.col >= 0 && actor.col < engine.maze.width);
        assert.equal(engine.maze.isWall(actor.col, actor.row), false);
      }
      assert.ok(engine.lives >= 0 && engine.lives <= 3);
      assert.ok(engine.score >= 0);
    }
  }
});

test('tile keys remain stable for scoring and reachability sets', () => {
  assert.equal(tileKey(12, 23), '12,23');
});
