# Neon Maze

A polished, dependency-free neon maze-chase arcade game built with HTML5 Canvas, modern CSS, and vanilla JavaScript.

## Highlights

- Responsive neon arcade presentation with no external assets
- Fixed-timestep game loop for consistent movement across frame rates
- Four sentinels with distinct targeting personalities
- Chase, scatter, frightened, home, and eaten AI states
- Power-core combos, bonus data core, lives, levels, and persistent high score
- Keyboard, touch D-pad, and swipe controls
- Procedural Web Audio sound effects with mute support
- Pause/resume, visibility handling, and reduced-motion support
- Unit tests for maze connectivity and core game rules

## Run locally

```bash
npm start
```

Then open <http://localhost:4173>.

## Controls

| Action | Control |
| --- | --- |
| Move | Arrow keys, WASD, swipe, or touch D-pad |
| Start / restart | Enter or on-screen button |
| Pause / resume | P, Escape, or pause button |
| Mute | M or sound button |

## Quality checks

```bash
npm test
npm run check
```

The project is intentionally build-free, so it can be deployed directly to GitHub Pages or any static host.
