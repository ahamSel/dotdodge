# DotDodge — Web Remake Design

Date: 2026-10-04
Status: Approved (written spec reviewed 2026-10-04)

## Goal

Rebuild the 2020 Unity game DotDodge (repo `ahamSel/dtddge`, live at `ahamsel.itch.io/dotdodge` as an old Unity WebGL build) as a polished browser game that is clearly better but recognisably the same game, then update the itch page (new build, cover, screenshots, description).

## Constraints

- Lives in `web/`. The Unity project (`Assets/`, `Packages/`, `ProjectSettings/`, `UserSettings/`) is untouched. `~/projects/dev/dotdodge-android` is reference only.
- TypeScript + Canvas 2D + Vite. No runtime dependencies. Dev dependencies: `vite`, `typescript`, `vitest`.
- Architecture follows the Game Without Art remake (`~/projects/dev/gwa/web`): pure fixed-step sim emitting events; renderer, effects, DOM-overlay UI and synthesised audio consume them.
- Desktop keyboard and mobile touch. Must work inside the itch iframe.
- No third-party assets from `Assets/` ship. The font "Big Space" (© Nurf Designs, All Rights Reserved), the theme ("Power Blast" by Xack) and the SFX (partly tagged "SFX Producer") are not cleared for redistribution. Replacements: the OFL font **Tektur** (Google Fonts, bundled locally with its OFL licence) and synthesised sound and music.
- All art is drawn with canvas shapes or CSS. The only shipped binary asset is the font.

## Success Criteria

1. Every original mechanic is present: momentum player with wall bounces, 7 homing missiles with warnings on the original schedule, stage-6 cannons with spike arrows, hidden X slow-mo, 120 s countdown, 6 stages, Congrats win screen, pause with options (volume).
2. 60 fps on a mid-range phone during stage 6.
3. `npm test` passes. `npm run build` produces a relative-path build. `npm run itch` produces `web/dotdodge.zip` with `index.html` at the zip root.
4. Plays correctly at desktop 1024×576 (itch embed), on a landscape phone and on a portrait phone.

## World Model

- Units are the original Unity world units. The sim is always landscape.
- The inner arena (orange field) is centred on the origin, +y up, with half-size `HW = 312`, `HH = 160` (624 × 320, aspect 1.95). It was derived from the original clamps: player centre ±302 × ±150 with radius 9.6.
- Fixed step 1/60 s with an accumulator. The frame delta is clamped to ≥ 0 and capped at 0.25 s.
- `world.time` is world time. Slow-mo scales the world dt: everything in the sim (player, missiles, arrows, cannons, schedule, countdown) advances by `dt × timeScale`. Only the slow-mo meter runs on real dt.

## Gameplay Rules

### Player
- Circle, radius 9.6. Starts at the origin at rest.
- Thrust: input direction (keyboard normalised to length 1; joystick analog, magnitude ≤ 1) × 1400 u/s². During slow-mo, thrust × (3000 / 1400).
- Drag: `v *= 1 / (1 + 0.5·dt)` per step (Box2D linear damping, drag 0.5).
- Walls: the centre is clamped to `±(HW − r)`, `±(HH − r)`. On contact the normal velocity becomes `max(0.55·|vₙ|, 180)` pointing away from the wall. A `bounce` event (position, wall, impact speed) is emitted when `|vₙ| > 40`, so resting against a wall while thrusting doesn't spam sounds.
- Dies on contact with a missile or a spike arrow. No HP and no invulnerability.

### Missiles
Seven missiles, all capsules 16 long with radius 3.5:

| # | Colour | Speed | Turn (°/s) | Spawn (outside the wall) | Warning at countdown elapsed |
|---|---|---|---|---|---|
| 0 | white `#ffffff` | 300 | 470 | (−336, 0) | intro (see Timeline) |
| 1 | red `#ec1c24` | 400 | 550 | (0, 179) | 17 s |
| 2 | green `#0ed145` | 450 | 600 | (336, 0) | 37 s |
| 3 | blue `#00a8f3` | 500 | 640 | (0, −182) | 57 s |
| 4 | purple `#b83dba` | 600 | 765 | (331, −177) | 80 s |
| 5 | yellow `#ffd900` | 650 | 800 | (−331, 174) | 80 s |
| 6 | orange `#ff7f27` | 700 | 830 | (332, 180) | 97 s |

- A warning lasts 2.75 s: a black chevron on the wall where the missile will enter, pointing inward, blinking 3 times (on at 0.67–1.0 s, 1.33–1.67 s, 2.0–2.33 s, like the original animation). Then the missile launches.
- On launch the missile appears at its spawn point facing the arena centre.
- Homing (original formula): `err` = signed angle from the heading to the direction to the player. `angularVelocity = sin(err) × turnRate`. Heading advances by `angularVelocity × dt`. Velocity is `heading × speed`.
- Once a missile's centre is at least 8 units inside the arena on both axes, it is "entered" and its centre is clamped to `±(HW − 8)`, `±(HH − 8)` from then on.
- Missiles never die. Overlapping missiles (centre distance < 14) are pushed apart by half the overlap each, along the line between centres. Missiles ignore spike arrows.

### Stage 6 hazards
- From countdown elapsed 97 s, two corner cannons fire spike arrows every 0.3 s (world time):
  - the top-left cannon fires rightward along the lane `y = +156`, arrows pointing down
  - the bottom-right cannon fires leftward along `y = −156`, arrows pointing up
- Arrows are triangles 12 wide and 10.7 tall, moving at 70 u/s along the lane. They spawn at the cannon and are removed once they pass the far wall.
- Contact test: circle vs triangle (point inside the triangle, or distance to an edge < r).

### Slow-mo (the hidden key)
- Unlocks at stage 6. The hint "'X' for SlowMo" appears then. Phones get an on-screen button that appears at the same time.
- X or the button toggles slow-mo. Starting needs a meter of at least 0.25 s.
- While on: `timeScale = 0.1`, the player's thrust is multiplied as above, and the meter drains at 1 per real second. At 0 it switches off.
- The meter holds 5 real seconds and refills at 0.5 per real second while slow-mo is off (empty to full in 10 s).
- Pausing freezes the meter. Death or a win switches slow-mo off.

### Timeline, countdown and stages
- **Intro:** the run starts with missile 0's warning at world time 0. At 2.75 s missile 0 launches **and the countdown starts** at 120.
- `elapsed` = world seconds since the countdown started. `remaining = 120 − elapsed`.
- Stage = 1 + the number of thresholds passed among elapsed 17, 37, 57, 80, 97 (so stage 6 from 97 s). A `stage` event fires on each change.
- Display = `ceil(remaining)` while running, so the last second shows "1". Shows 120 during the intro.
- The last 10 seconds emit a `tick` event each whole second.
- **Win:** `remaining ≤ 0` emits `win`. The world freezes (no movement, no hazards). After the win effects, the Congrats screen shows.
- **Death:** emits `death` with the position. The player stops. Missiles stop homing and clamping and coast in a straight line (they leave the arena). Arrows keep sliding. The countdown stops. After 1.2 s the retry screen appears.

### Near miss
- When a missile's capsule comes within 14 units of the player's circle edge without touching, emit `nearMiss` once.
- It re-arms after that missile moves more than 60 units away.

### Best record
- Stored via safe storage as the best seconds survived on the countdown (0–120). 120 means cleared.
- Shown on the title screen as "Best 1:23 · Stage 5" or "Cleared ★", and on the retry screen with a "New best!" badge.
- Written only when a run ends (death, win, quit, pagehide), never every frame.

## Gameplay Changes vs 2020 (approved)

1. Slow-mo uses a 5 real-second meter that drains and refills over 10 s. The original counted 5 slowed seconds, about 50 real seconds, and reset instantly.
2. Wall bounce is one clean reflection (55%, minimum 180 u/s) instead of subtracting 220 u/s every frame against the wall.
3. Diagonal thrust is normalised (it was 41% stronger).
4. Missiles nudge apart instead of physically bumping each other, and pass through arrows.
5. Arrows despawn at the far wall.
6. Missiles start facing the arena centre.
7. The countdown display rounds up.
8. Best record (new).
9. Auto-pause on blur and on tab hide.
10. The broken Level Menu button is removed.
11. Death shows a retry screen instead of a silent 3 s auto-restart.

## Controls

- **Keyboard** (physical key codes, so AZERTY ZQSD works):
  - WASD or arrows to thrust
  - X slow-mo
  - Esc or P pause/resume
  - R restart (playing, paused, retry screen)
  - M mute
  - Enter or Space starts from the title, resumes when paused, retries from the retry screen
- Shortcuts are ignored while Ctrl, Cmd or Alt is held. Arrows and Space never scroll the embedding page. Keys are released on blur.
- **Touch:** a floating thrust joystick. Press anywhere on the canvas (not on UI) to set the anchor and drag to steer. Magnitude is analog and clamps at the radius, and the anchor follows past the radius. It is only enabled while playing.
- **Portrait:** when the viewport is taller than wide, the arena is drawn rotated 90°. Screen-space input (keyboard directions and joystick) is rotated into world space, so "up" on screen is always up on screen.

## Look

- **Palette:**
  - frame red `#ff0000`
  - field orange `#ffad00`
  - outline black `#000000`
  - player white
  - missile colours as in the table
  - UI text white with a black outline
- **Layout:**
  - The canvas fills the viewport in frame red.
  - The red frame is the same thickness on all four sides: `clamp(40px, 8% of the shorter screen side, 52px)`. The arena fits inside it, keeping aspect 1.95 (portrait: 1/1.95), centred. The HUD lives in the top frame strip.
  - The arena has rounded corners (radius ≈ 12 units) and a thick black outline.
  - The arena rectangle in CSS pixels is published as CSS variables (`--ax`, `--ay`, `--aw`, `--ah`), so the HUD and buttons are positioned from it and never sit on the walls.
- **Outline:** one width for everything, 2.4 world units, with a minimum of 2 CSS px.
- **Player:** a white dot with an outline.
  - Squash and stretch: a spring on velocity, stretching along motion up to about 15%.
  - On a bounce it flattens against the wall, anchored at the contact point, and wobbles back. It flashes white on death.
  - A short tapering trail behind it.
- **Missiles:** a capsule in its colour with an outline, rotated to its heading, with a short tapering colour trail (about 0.25 s) and three cartoon speed lines behind it (like the cover art).
- **Warning:** a black chevron with a white outline, drawn on the wall and blinking. Launching flashes the wall at the entry point.
- **Cannons:** a stubby black barrel with a thick muzzle ring on a round mount in the corner wall; it recoils and shows a white muzzle flash on each shot. **Arrows:** white triangles with outlines.
- **Title logo:** the "sun" from the original start art, redrawn: the dot in the centre with 7 coloured capsules radiating outward with speed lines, slowly breathing. "DotDodge" set in Tektur 900 at 75% width, white with a black outline.
- **Font:** Tektur (variable, weight 900, width 75%), a subset woff2 bundled by Vite from `web/src/ui/fonts/`, with its licence shipped at the zip root as `OFL-Tektur.txt`.

## Feel (juice)

- **Bounce:** player squash, a small dust puff at the contact point, a soft thump whose pitch follows impact speed.
- **Warning:** chevron blink plus a tick per blink. **Launch:** wall flash, a small shake (trauma 0.25), a whoosh.
- **Near miss:** a white streak along the missile plus a whoosh.
- **Stage up:** a "STAGE N" banner swoops across the arena, the timer pops, the frame pulses.
- **Last 10 s:** the timer turns red and pulses with a tick each second.
- **Slow-mo:** the field desaturates and darkens slightly with a vignette, there's a low "whomp" in and a rising "whomp" out, and trails lengthen. The meter shows in the HUD.
- **Death:** 80 ms hit-stop while the dot flips to black and swells, then it bursts into outlined shards. Big shake (trauma 1), a red flash, and "GOTCHA!" slams in.
- **Win:** missiles pop one by one into confetti in their colours. A fanfare plays, then an iris wipe into Congrats.
- **Screen transitions:** an iris wipe for title → play, restart and win → Congrats. DOM screens crossfade.
- **Buttons:** cartoon style with a white fill, black outline and offset black shadow. Hover lifts, press sinks into the shadow.
- `prefers-reduced-motion`: no shake, flashes at 40%, half the particles, no iris (crossfade instead).

## Screens

- **Title:** logo, Play, Options, best record, and the hint lines "WASD / arrows / drag to dodge", "You win when the timer hits 0 (but not impossible)", "The last bit is tricky… and there's one hidden key". Missiles idly orbit the logo.
- **Options** (from the title or pause): Music and SFX volume sliders (0–100, saved), mute toggle, Back.
- **Playing HUD:**
  - countdown big at top centre
  - "Stage N" at top left
  - pause button at top right
  - slow-mo meter and hint from stage 6
  - on touch devices, a slow-mo button at the bottom right of the arena from stage 6
- **Paused:** Resume, Restart, Options, Quit (to title).
- **Retry (game over):** "GOTCHA!", time survived and stage reached, best plus "New best!", Retry and Menu.
- **Congrats:** "Congrats! You're a Legend", "By ahamsel", Play again and Menu.

## Sound (WebAudio, synthesised)

- **Effects:** bounce, warn tick, launch whoosh, near-miss whoosh, stage jingle, last-10 tick, gotcha, win fanfare, slow-mo in/out, cannon pop (quiet, rate-limited), button hover and click.
- **Music:** a synthesised chiptune loop at about 140 BPM.
  - Layers are added by stage: bass and drums from stage 1, arpeggio from stage 3, lead from stage 5, double-time hats in stage 6.
  - It is pitched down and low-passed during slow-mo, ducked while paused, and stops on death.
  - It starts on the first user gesture.
- **Volumes:** separate Music (default 60) and SFX (default 80) buses into a master gain. M mutes everything. All saved via safe storage.
- `AudioContext` is created lazily on the first gesture and resumed if suspended or interrupted. No audio support means silence, never an error.

## Architecture

```
web/
  index.html            canvas + UI overlay root
  vite.config.ts        base './', vitest config
  package.json          dev, build, test, typecheck, itch
  public/OFL-Tektur.txt font licence (src/ui/fonts/tektur.woff2 is bundled by Vite)
  scripts/zip-itch.mjs  zips dist/ into dotdodge.zip (system `zip`)
  tools/                shots.html, shots.ts, vite.config.ts: store art from the real sim + renderer
  marketing/            cover.png (1260×1000) and screenshots
  src/
    main.ts             boot, loop, screen state machine
    loop.ts             fixed-step planner
    storage.ts          safe localStorage
    best.ts             best record
    game/
      config.ts         every tuning number and colour
      rng.ts            seedable RNG (confetti, demo orbit)
      types.ts          World, Player, Missile, Arrow, Cannon, Warning, SimEvent
      arena.ts          bounds, clamp
      collide.ts        circle–capsule, circle–triangle, segment distance
      schedule.ts       stage thresholds, missile warning times, countdown helpers
      player.ts         thrust, drag, wall bounce
      missile.ts        homing, entering/clamp, separation, coasting
      hazards.ts        cannons and arrows
      slowmo.ts         meter and toggling
      sim.ts            createWorld, step, drainEvents
    render/
      view.ts           arena fit, portrait rotation, screen↔world transforms
      renderer.ts       draws the world (+ interpolation)
      fx.ts             particles, shards, rings, shake, flash, confetti
      motion.ts         squash/stretch spring and bounce wobble
      trails.ts         tapered trails
      shapes.ts         capsule, chevron, triangle, rounded rect (roundRect fallback)
      tween.ts          easing, colour helpers
    input/
      keyboard.ts, shortcuts.ts, touch.ts
    ui/
      screens.ts, styles.css
    audio/
      sfx.ts, music.ts, events.ts
  tests/
```

**Data flow:** input (screen space) → `view` rotates it to world space → `sim.step` mutates the `World` and pushes typed events (`warn`, `launch`, `stage`, `bounce`, `nearMiss`, `fire`, `slowmo`, `tick`, `death`, `win`) → `fx`, `sfx`, `music` and `ui` consume the events → `renderer` draws the world and fx → `ui` reads the world for the HUD. The sim never touches the DOM, canvas or audio.

## Error Handling and Robustness

- `requestAnimationFrame` schedules the next frame first, so one exception can't stop the loop. Frame and effect deltas are clamped to ≥ 0.
- `localStorage` access is always wrapped in try/catch.
- Auto-pause on `blur` and `visibilitychange`. Best saved on `pagehide`.
- Canvas sized by devicePixelRatio (capped at 2), re-fitted on resize and orientation change. The sim is unaffected because its arena is fixed.
- No `ctx.roundRect` without a fallback (Safari < 16).
- Pointer events only on the canvas for the joystick. UI buttons stop propagation, so tapping a button never thrusts.

## Testing

Vitest unit tests on pure modules (seeded where randomness matters):
- **schedule:** stage numbers at threshold boundaries, warning and launch times, countdown display (ceil, 120 during the intro, ticks in the last 10 s).
- **player:** thrust acceleration, drag decay matching Box2D damping, diagonal normalisation, wall bounce (55% / minimum 180, a single event, no event below 40).
- **missile:** turns toward the target at `sin(err)·turnRate`, constant speed, entering then clamping, separation, coasting after death.
- **hazards:** cannons start at stage 6, fire every 0.3 s, arrows move at 70 and despawn past the far wall.
- **collide:** circle–capsule and circle–triangle hit and miss cases.
- **slowmo:** locked before stage 6, minimum to start, drain and refill rates, auto-off at empty, scales world dt but not the meter.
- **sim:** death on missile and on arrow contact, win at 0 freezes the world, near miss fires once and re-arms.
- **view:** arena fit in landscape and portrait, portrait input rotation, screen↔world round trip.
- **Infrastructure:** loop planner (no spiral, no negative), storage with blocked localStorage, shortcuts (modifiers, no page scroll, per screen), keyboard release on blur, best record, fx never runs backwards.

Then a manual play-test in a real browser at 1024×576, a landscape phone (844×390) and a portrait phone (390×844), and inside an iframe. Then a final fresh review on the most capable model, with findings graded by what a player would notice.

## Shipping

1. Commit on the worktree branch. Ask before merging to `main` and pushing to `ahamSel/dtddge`.
2. Store art from the game itself: a 1260×1000 cover and 4–5 screenshots (title, early chase, stage 6 spikes, slow-mo, Congrats).
3. itch (`ahamsel.itch.io/dotdodge`) via Edge and the Claude browser extension:
   - upload `dotdodge.zip` as HTML5, playable in browser
   - hide the old Unity build (never delete; never click the unlabelled "…" controls)
   - embed at 1024×576, fullscreen button on, mobile friendly ticked
   - new cover and screenshots, a rewritten description
   - AI disclosure: Code, Text & Dialog
   - show the user every change before clicking Save

## Out of Scope

Extra levels, online leaderboards, accounts, PWA/offline, native builds, using the original audio or font, any change to the Unity project.
