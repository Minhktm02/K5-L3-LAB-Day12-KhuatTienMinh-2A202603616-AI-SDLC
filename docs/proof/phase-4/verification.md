# Phase 4 Verification Proof — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

## 1. Automated Test Suite (`npm test`)
- Command: `npm test` (`node tests/run_tests.js`)
- Result: **19/19 PASSED** (0 skipped, all Phase 1–3 regression tests + Contract v1.3 tests passing).
- Full Night 3 headless benchmark (21,600 ticks): **91 ms** (limit `<= 30,000 ms`).
- Proof logs saved in `docs/proof/phase-4/*.jsonl` and `docs/proof/phase-4/exported_lb.json`.

## 2. 3D Benchmark (`bench.json`)
- Command: `node src/bench.js --seed 42 --duration 30 --out bench.json`
- Observed output (committed at root `bench.json`):
  - `contract_version`: `"1.3"`
  - `avg_fps`: **110.2** (threshold `>= 60` ✅)
  - `p1_low_fps`: **35.6** (threshold `>= 30` ✅)
  - `frame_ms_p95`: **16 ms**
  - `frames`: **3300**
  - `load_ms`: **2241 ms** (threshold `<= 10000` ✅)
  - `peak_mem_mb`: **181.2 MB**
  - `vsync_off`: **true** (`--disable-gpu-vsync --disable-frame-rate-limit`)
  - `renderer`: `Three.js r128 WebGLRenderer (ANGLE (Intel, Intel(R) HD Graphics 4600 Direct3D11))`
  - `os`: `Windows_NT 10.0.19045 (x64)`

## 3. Soak Test (`soak.json`)
- Command: `node src/soak.js --seed 7 --nights 10 --out soak.json`
- Observed output (committed at root `soak.json`):
  - `nights`: **10**
  - `crashes`: **0** (threshold `= 0` ✅)
  - `mem_start_mb`: **46.1 MB**
  - `mem_end_mb`: **53.4 MB** (`1.158 × mem_start_mb <= 1.2 × mem_start_mb` ✅)
  - `duration_s`: **0.61 s**

## 4. Local Leaderboard & CLI Export
- Persistent storage: `data/leaderboard.json` via `GET/POST /api/leaderboard`.
- Name validation: 3–12 chars `[A-Za-z0-9_]` + Vietnamese accented letters (verified in test #19).
- Sorting: `score` descending, tie-break by earlier `achieved_at` (ISO 8601 + timezone), capped at top 10 (verified in test #19).
- Export command: `node server.js --export-leaderboard docs/proof/phase-4/exported_lb.json` exits with code 0 and outputs `{"entries": [...]}`.

## 5. Accessibility Checklist
- **Key Rebinding:** All 9 actions (4 movement directions, jump, dash, interact, pulse, pause) rebindable in Settings with duplicate key detection + warning, "Khôi phục mặc định" button, saved in `localStorage`.
- **Subtitles / Visual Indicators:** On-screen subtitle pills for Shade spawn (+ screen-edge directional arrow `#shade-arrow`), Night 3 wind warning, last 10s countdown, and low-fuel lanterns (`< 30`).
- **Reduce Motion:** Toggle in Settings disables camera shake, screen flash, and CSS blink animations.
- **UI Font Size:** Minimum 18px at 1280×720 (`--fs-base: 18px`) + Large Text (`×1.25`) toggle.
- **Colour-blind Mode (from Phase 3):** Toggle switches Shade emissive to `#00B3FF` and warning accent to `#FFFFFF` + `⚠`.
