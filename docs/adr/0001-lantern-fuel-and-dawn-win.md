# ADR-0001: Lantern fuel model and "hold the island until dawn" win rule (Ticket-03)

Status: accepted · Phase 3 · Contract v1.2

## Context
Playtests showed strong players light every lantern in ~2 minutes and the Night ends (old rule: instant win when all lanterns are lit).
Ticket-03 changes the core loop: lit lanterns can go out and the goal becomes *surviving until dawn with enough lanterns lit*.

## Decisions

1. **Lantern state model.** A lantern is now `{lit, fuel, deposited, ever_lit, relit_count}` instead of `{lit, deposited}`.
   - `fuel` is stored internally as an **integer in 1/60 units** (`fuel_u`). 1 unit/tick == 1 fuel/s, drain 5 units/tick == 5 fuel/s, one mote == 600 units.
     Reason: avoids float drift (the ticket recommends it); values are only rounded when written to a snapshot/event (1 decimal).
   - `ever_lit` selects the cost: first light 10 motes, relight 5 motes. A lantern that goes out keeps `ever_lit = true` and resets `deposited = 0`.
2. **Refuel uses the same interact key.** `interact` picks the nearest *receivable* lantern (unlit, or lit with `fuel < 100`; tie -> smaller id).
   Because decay (step 2) runs before interaction (step 5), a lit lantern is never exactly full on the next interact, so the "full lantern ignored" branch only triggers when no motes are carried. Documented, not a bug.
3. **Safe zone is derived, not stored.** `isSafeLantern(l) = l.lit && fuel >= 30` (exactly 30 still safe). Everything that used "lit lanterns" for safe zones now uses this predicate.
   Regaining >= 30 (refuel or relight) flags `just_lit`, reusing the Ticket-02 mechanism that pushes Shades out of the 6 m zone for <= 30 ticks without damage.
4. **New Shade state `drain`.** Only `wander` Shades choose weak lanterns (`lit && fuel < 30`, nearest, tie id), otherwise the nearest unlit lantern as before.
   `drain` is stationary, drains 5 fuel/s per Shade (stacking), emits `fuel_drain` every 60 ticks and leaves via: player within 6 m -> `chase`; pulse -> `stunned`; lantern out / fuel >= 30 / > 2 m -> `wander`. Stun now always ends in `wander`.
5. **Win rule replaced.** `all_lit` early win is removed. Win condition is evaluated in step 11 *after every update of the tick*:
   `flames <= 0 -> lost/no_flames`, else at `time_left == 0`: `lit >= ceil(0.6 * total)` -> `won/dawn_survived`, otherwise `lost/dawn`.
   Night lengths 240/270/300 s. `ceil` uses a 1e-9 epsilon so 0.6*5 = 3 (not 4).
6. **Capacity.** `capacity = min(20, 10 + 2 * successful_lights)`; scenario-placed lit lanterns do not count; resets each Night (engine instance per Night).
7. **Score replaced.** +5 per mote deposited/refuelled, +100 first light, +40 relight, +5 per stunned Shade (+15 if it was draining), dawn bonus `50 + floor(fuel)` per lit lantern and +50 per remaining flame. Time bonus removed (`per_second_left = 0`).

## Consequences
- Old tests "deposit 10 motes -> instant win" and the Ticket-02 score formula (948) are invalid and were removed/rewritten (see CHANGELOG, docs/proof/phase-3/verification.md).
- Presentation changes (fuel bar, low-fuel 1 Hz blink, deflated + torn unlit lanterns, colour-blind palette) are UI-only and do not affect headless output.
