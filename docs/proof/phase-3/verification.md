# Verification matrix — Phase 3 (Contract v1.2)

Produced by `npm test` (tests/run_tests.js, 17/17 pass). Raw output in this folder, matching tag `phase-3`.

| AC | Evidence | Result |
|---|---|---|
| Regression P1/P2 (determinism, pickup, dash, drifter, charm, jump pads, pause, fall, benchmark) | det1/det2, pickup, dash, drifter, charm, jumppad_n2, night3_tier, pause jsonl; bench_night3 (21,600 ticks, ~150 ms) | PASS |
| AC-P3-01/03/09 fuel decay, lantern_out, relight, capacity | test 10 (engine-level) | PASS |
| AC-P3-02 refuel | `refuel.jsonl` | PASS |
| AC-P3-04 safe-zone boundary | test 12 | PASS |
| AC-P3-05 drain | `drain.jsonl` | PASS |
| AC-P3-06 pulse scoring | test 14 | PASS |
| AC-P3-07/10 dawn win + score 597 | `dawn_win.jsonl`, test 15 | PASS |
| AC-P3-08 durations | contract assertions in tests | PASS |
| AC-P3-11 UI (fuel bar, blink, colour-blind) | manual only | NOT AUTOMATED |

## Tests changed or removed (with reasons)
- `deposit_win_scenario.json` / `deposit_win_inputs.json` (Phase 1/2: all lanterns lit -> instant win, score 948): **removed**, rule replaced by Ticket-03 (§3, §5). Replaced by `dawn_win_scenario.json`.
- Phase 2 test 2 score assertion (948): **removed** with the above (old score formula replaced).
- No test is skipped or disabled.

## Known limitations / honest notes
- UI behaviour (fuel bar, blinking, colour-blind palette) was checked by code review and JS syntax check only, not by an automated browser test.
- The "full lantern is not selectable" branch cannot occur between ticks because decay precedes interaction (documented in ADR-0001).
