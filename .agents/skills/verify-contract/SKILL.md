---
name: verify-contract
description: Automated verification skill to run unit tests, headless scenarios, determinism checks, and performance benchmarks for Test Contract v1.1.
---

# Verification Skill: Test Contract v1.1 (`verify-contract`)

Use this skill after any change to `src/gameEngine.js`, `src/headless.js`, or `game.contract.json`.

## Steps
1. Run the automated verification suite:
   ```bash
   npm test
   ```
2. Verify that all 10 checks pass:
   - Determinism check (identical SHA/content across repeated runs with same seed).
   - Phase 1 regression scenarios (mote pickup, lantern deposit & win with v1.1 numbers).
   - Phase 2 feature scenarios (Dash, Gió Lạc steal & drop, Bùa Gió, Đảo Cau jump pads, Đảo Chuông 3-tier & wind, Pause/Resume, Fall & Respawn).
   - Full Night 3 (21,600 ticks) headless benchmark (`<= 30,000 ms`).
3. Ensure raw `.jsonl` proof files in `docs/proof/phase-2/` are up to date and committed with the phase tag.
