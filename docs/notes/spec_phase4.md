# Phase 4 Spec & Assumptions — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

## Acceptance Criteria
1. **Benchmark mode (`node src/bench.js --seed 42 --duration 30 --out bench.json`):**
   - Launches non-fullscreen 1280×720 Chromium/Edge app window with `--disable-gpu-vsync --disable-frame-rate-limit`.
   - Loads Night 1 with full lighting/effects, 200 wandering Shades (seed 42), 100 Motes, L1–L3 lit at 100 fuel.
   - Disables spawning, damage, pickup, fuel decay, and end-of-night conditions; Shades wander normally.
   - Player stationary at `(0,0,0)`; camera orbits `(30*cos(a), 15, -30*sin(a))` looking at `(0,0,0)` counter-clockwise from top-down, 15s/rev.
   - 3s warmup, then measures `--duration` seconds and auto-exits with code 0.
   - Writes `bench.json` matching Contract v1.3 schema (`contract_version: "1.3"`, `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`).
2. **Soak test (`node src/soak.js --seed 7 --nights 10 --out soak.json`):**
   - Runs 10 consecutive Nights in a single headless Node.js process cycling Night 1 → 2 → 3 with seeds `seed + i`.
   - Seeded random input: new movement vector every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact.
   - Outputs `soak.json` with `crashes = 0` and `mem_end_mb <= 1.2 * mem_start_mb`.
3. **Local Leaderboard:**
   - Prompts for player name after winning Night 3 (Dawn) or losing any Night.
   - Name 3–12 chars `[A-Za-z0-9_]` + Vietnamese accented letters.
   - Stores `{ name, score, nights_won, achieved_at (ISO 8601 + tz), seed }` on local disk (`data/leaderboard.json`).
   - Top 10 sorted by `score` descending, tie-break by earlier `achieved_at`.
   - Accessible from Main Menu; exported via `node server.js --export-leaderboard out.json`.
4. **Accessibility:**
   - Full key rebinding for all 9 actions (4 directions, jump, dash, interact, pulse, pause) with duplicate detection, warning, default reset, and persistence.
   - Visual subtitles / indicators: Shade spawn (+ screen-edge directional arrow), wind warning, last 10s, low-fuel lanterns (< 30).
   - Reduce Motion toggle disabling camera shake, screen flash, and CSS blink animations.
   - Minimum 18px UI font size at 1280×720 + Large Text (`×1.25`) toggle.
5. **Packaging & Documentation:**
   - Three.js r128 bundled locally (`public/lib/three.min.js`) so clean clone runs offline in ≤ 3 commands.
   - `README.md`, `CHANGELOG.md` (all 4 phases), `CREDITS.md`, `LICENSE` (MIT), `docs/retro.md`, `bench.json`, `soak.json`.
   - Contract v1.3 in `game.contract.json` (`bench_cmd`, `soak_cmd`, `run_cmd: "node server.js"`).

## Assumptions & Design Notes
- `run_cmd` was updated from `npm start` to `node server.js` so `<run_cmd> --export-leaderboard out.json` works directly without npm requiring `--`.
- Three.js uses `THREE.InstancedMesh` for Motes and Shades (2 draw calls total for 300 dynamic entities) to maintain high FPS and stable 1% lows on integrated GPUs.
- `src/soak.js` runs a short V8 JIT warmup before Night 1 so `mem_start_mb` reflects steady-state process memory rather than cold JIT compilation overhead.
