# DotDodge

My first game (2020): dodge seven homing missiles for 120 seconds.

### [Play it on itch.io](https://ahamsel.itch.io/dotdodge)

## Web version (2026)

A rebuild for the browser in `web/` (TypeScript, Canvas 2D, Vite; no runtime dependencies). Same game, same missiles and timings, redrawn with crisp shapes and with sound synthesised in the browser.

```bash
cd web
npm install
npm run dev     # play locally
npm test        # unit tests
npm run itch    # build web/dotdodge.zip for itch.io
```

Controls: WASD / arrows to thrust (or drag on touch screens), Esc pause, R restart, M mute. One more key unlocks late in the run.

The font is [Tektur](https://fonts.google.com/specimen/Tektur) (SIL Open Font License, see `web/public/OFL-Tektur.txt`).

## Original Unity version (2020)

The Unity 2019.4 project is in this repo (`Assets/`, `ProjectSettings/`); the Android port lives in `ahamSel/dtddge-android`.
