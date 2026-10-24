export const TILE = {
  WALL: '#',
  PELLET: '.',
  POWER: 'o',
  GATE: '=',
  EMPTY: ' ',
};

// A custom 28 × 31 arcade maze. Spawn markers are converted to empty floor
// during parsing. Keeping the board data-only makes it easy to validate and test.
export const RAW_MAP = Object.freeze([
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##    A     ##.#     ',
  '     #.## ###==### ##.#     ',
  '######.## #      # ##.######',
  '      .   # BCD  #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......P .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
]);

const SPAWN_MARKERS = new Set(['P', 'A', 'B', 'C', 'D']);

export const tileKey = (col, row) => `${col},${row}`;
export const fromTileKey = (key) => key.split(',').map(Number);

export class Maze {
  constructor(rows = RAW_MAP) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Maze must contain at least one row.');
    }

    this.width = rows[0].length;
    this.height = rows.length;
    if (rows.some((row) => row.length !== this.width)) {
      throw new Error('Every maze row must have the same width.');
    }

    this.playerSpawn = null;
    this.ghostSpawns = new Map();
    this.initialPellets = new Set();
    this.initialPowerPellets = new Set();

    this.grid = rows.map((sourceRow, row) => [...sourceRow].map((cell, col) => {
      if (cell === 'P') {
        this.playerSpawn = { col, row };
        return TILE.EMPTY;
      }
      if (SPAWN_MARKERS.has(cell)) {
        this.ghostSpawns.set(cell, { col, row });
        return TILE.EMPTY;
      }
      if (cell === TILE.PELLET) this.initialPellets.add(tileKey(col, row));
      if (cell === TILE.POWER) this.initialPowerPellets.add(tileKey(col, row));
      return cell;
    }));

    if (!this.playerSpawn) throw new Error('Maze is missing the player spawn marker P.');
    for (const marker of ['A', 'B', 'C', 'D']) {
      if (!this.ghostSpawns.has(marker)) throw new Error(`Maze is missing ghost spawn ${marker}.`);
    }

    this.tunnelRows = new Set();
    for (let row = 0; row < this.height; row += 1) {
      if (this.grid[row][0] !== TILE.WALL && this.grid[row][this.width - 1] !== TILE.WALL) {
        this.tunnelRows.add(row);
      }
    }
  }

  clonePellets() {
    return new Set([...this.initialPellets, ...this.initialPowerPellets]);
  }

  normalizeCol(col) {
    return ((col % this.width) + this.width) % this.width;
  }

  cell(col, row) {
    if (row < 0 || row >= this.height) return TILE.WALL;
    if (col < 0 || col >= this.width) {
      if (!this.tunnelRows.has(row)) return TILE.WALL;
      col = this.normalizeCol(col);
    }
    return this.grid[row][col];
  }

  isWall(col, row) {
    return this.cell(col, row) === TILE.WALL;
  }

  isGate(col, row) {
    return this.cell(col, row) === TILE.GATE;
  }

  isWalkable(col, row, actor = 'player', ghostState = 'normal') {
    const cell = this.cell(col, row);
    if (cell === TILE.WALL) return false;
    if (cell !== TILE.GATE) return true;
    return actor === 'ghost' && (ghostState === 'home' || ghostState === 'eaten');
  }

  neighbors(col, row, actor = 'player', ghostState = 'normal') {
    const candidates = [
      { col, row: row - 1, direction: 'up' },
      { col: col - 1, row, direction: 'left' },
      { col, row: row + 1, direction: 'down' },
      { col: col + 1, row, direction: 'right' },
    ];
    return candidates
      .filter((item) => this.isWalkable(item.col, item.row, actor, ghostState))
      .map((item) => ({ ...item, col: this.normalizeCol(item.col) }));
  }
}

export function reachableTiles(maze, start = maze.playerSpawn) {
  const visited = new Set([tileKey(start.col, start.row)]);
  const queue = [{ ...start }];

  while (queue.length) {
    const current = queue.shift();
    for (const next of maze.neighbors(current.col, current.row, 'player')) {
      const key = tileKey(next.col, next.row);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return visited;
}
