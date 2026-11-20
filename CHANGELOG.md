# Changelog

## [Phase 3] Ticket-03 "Đèn cạn dầu" — Contract v1.2

### Breaking changes (replaced rules)
- **[BREAKING] Win rule:** the early win `all_lit` is removed. A Night now ends only at dawn (or when flames reach 0).
  Win = alive at dawn with `lit >= ceil(0.6 * total)` lanterns (3/5, 4/6, 5/7) -> `game_over.reason = dawn_survived`. Loss reasons are `dawn` and `no_flames` only.
- **[BREAKING] Night durations:** 300/330/360 s -> **240/270/300 s**.
- **[BREAKING] Lanterns can go out:** lit lanterns burn 1 fuel/s and are drained 5 fuel/s per Shade; at fuel <= 0 they turn off (`lantern_out`, `deposited = 0`, `ever_lit = true`).
- **[BREAKING] Safe zone:** only lanterns with `fuel >= 30` keep their 6 m safe zone (Shades are no longer blocked by weak lanterns).
- **[BREAKING] Scoring:** per mote 10 -> 5; first light +100; relight +40; Tỏa Sáng +5 (+15 on a draining Shade); dawn bonus `50 + floor(fuel)` per lit lantern and +50 per flame; time bonus removed.
- **[BREAKING] Interaction:** interact now also refuels lit lanterns (`refuel` event). Relight of an `ever_lit` lantern costs 5 motes instead of 10.
- **[BREAKING] Shade states:** new `drain` state; stun now ends in `wander` (was chase/wander by distance); wanderers hunt weak/unlit lanterns.
- **Capacity:** fixed 10 -> `min(20, 10 + 2 * successful_lights)`.

### Contract v1.2 additions
- `game.contract.json`: `contract_version 1.2`; tuning adds `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio, drain_per_s, low_fuel_threshold, capacity_max`; extra score keys `per_relight, per_stun_drain, per_lit_lantern_dawn`.
- Snapshot: lanterns `fuel, ever_lit, relit_count`; player `capacity`.
- Scenario: lanterns `lit/fuel/ever_lit/relit_count`; `player.successful_lights`; `shades[].target_lantern_id`.
- Events: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight`; `game_over.reason = dawn_survived`.

### UI
- Fuel bar over lit lanterns, 1 Hz blink below 30 fuel, deflated (-20%) + torn-paper unlit lanterns, `đang mang / sức chứa` HUD, "cần N đèn" objective.
- Setting "Bảng màu dễ phân biệt" (saved): Shade rim/eyes `#00B3FF`, warning colour `#FFFFFF` + ⚠.

### Tests changed
- Removed `deposit_win_scenario/inputs` (old instant-win rule, score 948) -> replaced by `dawn_win_scenario.json` (score 597). Reason: rule replaced by Ticket-03.
- Added tests 10-16 (fuel/relight/refuel/drain/boundary/win rules/capacity/pulse scoring). Nothing is skipped.

## [Phase 2] Ticket-02 — Contract v1.1
3 Nights, Dash, Gió Lạc, Bùa Gió, jump pads, pause/settings, full HUD, WebAudio.

## [Phase 1] PRD-0 — Contract v1.0
Core Night 1, headless Test Contract, 3D web UI.
