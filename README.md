# Arcade Vault

A growing, dependency-free-at-runtime collection of polished browser mini games and interactive experiences.

## Experiences

### 01 — Neon Maze

A responsive neon maze-chase arcade game with four distinct sentinels, power-core combos, procedural sound effects, touch controls, persistent high scores, and fixed-timestep movement.

**Path:** [`games/neon-maze/`](games/neon-maze/)

### 02 — Relics of Middle-earth

A cinematic Three.js artifact gallery featuring three fully rotatable procedural 3D relics in living environments:

- The One Ring — animated Mordor, Mount Doom, lava rivers, eruption smoke, ash, and embers
- Narsil — Gondor and Númenor-inspired white city, sea, moving waterfalls, clouds, and banners
- Nenya — Rivendell-inspired valley, elven architecture, waterfalls, river, mist, forest, and fireflies

Includes orbit/zoom controls, camera reset, auto-rotation, optional procedural ambience, scene transitions, mobile controls, and adaptive rendering quality.

**Path:** [`games/relics-of-middle-earth/`](games/relics-of-middle-earth/)

> This is an unofficial, non-commercial fan-made interactive tribute. It is not affiliated with or endorsed by the rights holders of *The Lord of the Rings*.

## Run locally

```bash
npm start
```

Then open <http://localhost:4173>.

## Quality checks

```bash
npm test
npm run check
```

The site is static and deploys directly through GitHub Pages. Three.js and OrbitControls are vendored locally so the 3D gallery has no CDN dependency.
