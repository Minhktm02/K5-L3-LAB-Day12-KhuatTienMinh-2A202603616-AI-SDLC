# Phase 3 Spec & Acceptance Criteria (TICKET-03 "Đèn cạn dầu", Contract v1.2)

Design decision record: [ADR-0001](../adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG](../../CHANGELOG.md).

| AC | Rule | Verifiable check |
|---|---|---|
| AC-P3-01 | Fuel max 100; lit -> fuel 100; decays 1/s (1/60 per tick) | Lantern with fuel 1.0 goes out at tick 60 (`lantern_out`, `fuel 0`, `deposited 0`, `ever_lit true`) |
| AC-P3-02 | Refuel: `used = min(carried, ceil((100-fuel)/10))`, `+10 fuel/mote`, +5 score/mote | fuel 55, carried 10 -> `refuel {amount 5, fuel 100}`, score 25 |
| AC-P3-03 | Relight costs 5 (ever_lit), first light 10; relight +40, first +100; `lantern_lit.relight` | out-lantern + 5 motes -> `relight:true`, score 65, fuel 100, `relit_count 1` |
| AC-P3-04 | Safe zone only if `fuel >= 30` (exactly 30 safe) | `isSafeLantern` true at 30.0, false after 1 tick |
| AC-P3-05 | `wander` Shades hunt weak lantern, `drain` at <= 2 m, 5 fuel/s each, `fuel_drain` every 60 ticks | drain scenario: state `drain`, event fuel ~14.0, lantern out, Shade back to `wander` |
| AC-P3-06 | Pulse on draining Shade total +15, otherwise +5 | unit checks (15 / 5) |
| AC-P3-07 | Win at dawn iff alive and `lit >= ceil(0.6*total)` (3/5, 4/6, 5/7), reason `dawn_survived`; no early win; `no_flames` beats dawn | 7 threshold checks + "5 lit lanterns for 100 ticks stays `playing`" + flames 0 on last tick |
| AC-P3-08 | Night length 240/270/300 s | contract assertions |
| AC-P3-09 | Capacity `min(20, 10+2*successful_lights)`, scenario lanterns don't count | snapshot `player.capacity` 10/16/20/20 and 12 after one relight |
| AC-P3-10 | Score: dawn bonus `50+floor(fuel)` per lit lantern, +50/flame, no time bonus | dawn scenario = 597 |
| AC-P3-11 | UI: fuel bar, 1 Hz blink < 30, deflated+torn unlit lantern, HUD `x / capacity`, colour-blind setting (saved) | manual check in browser (not covered by headless tests) |

## Assumptions
- Mote spawn / shade spawn / drifter schedules are unchanged from Ticket-02.
- `drain -> chase` uses the Shade-to-player distance <= 6 m.
- A wandering Shade moves toward its target lantern at the Shade speed and stops within 2 m of an *unlit* target (no draining of unlit lanterns).
- `fuel_drain` counter starts at 0 when a Shade enters `drain`; the event is emitted when it reaches 60, 120, ...
