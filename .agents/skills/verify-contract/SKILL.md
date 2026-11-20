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
2. Verify that all 17 checks pass (Contract v1.2):
   - Determinism, Phase 1/2 regressions (pickup, dash, drifter, charm, jump pads, pause, fall).
   - Phase 3: fuel decay / `lantern_out` / relight / refuel / safe-zone boundary (fuel == 30) / Shade `drain` / pulse scoring (+5 vs +15) / dawn win thresholds (3/5, 4/6, 5/7) / no early win / `no_flames` beats dawn / capacity growth.
   - Full Night 3 (21,600 ticks) headless benchmark (`<= 30,000 ms`).
3. Ensure raw `.jsonl` proof files in `docs/proof/phase-3/` are regenerated and committed with the phase tag.
4. If a test fails because a RULE changed, update `docs/adr/` + `CHANGELOG.md` and fix/remove the test with a reason; never skip it.
