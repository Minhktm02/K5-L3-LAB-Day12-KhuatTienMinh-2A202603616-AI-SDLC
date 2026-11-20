# AI Agents & Harness Guidelines: Đảo Đèn Lồng (Contract v1.1 - Phase 2)

## Build, Run & Test Commands
- **Install / Build:** `npm install`
- **Run Game (3D Web UI):** `npm start` (Mở trình duyệt: `http://localhost:3000`)
- **Run Headless Test Contract v1.1:**
  `node src/headless.js --seed <int> --night <1|2|3> [--scenario <file>] [--inputs <file>] --ticks <n> --out <file.jsonl> [--snapshot-every <int>]`
- **Run Automated Test Suite & Benchmark:** `npm test`

## Test Contract v1.1 Rules (Non-negotiable)
1. **Strict 12-Step Tick Order:**
   1. Input & Pause (`paused {}`, `resumed {}`, freeze `sim_tick` while paused)
   2. Decrement timers (time, cooldowns, invuln, stun/recoil, charm, dropped mote TTL, charm respawn)
   3. Move Mây (jump 7m/s, gravity -20m/s², dash 14m/s for 12 ticks, jump pads, Night 3 wind 2m/s) & check fall (`Y < -10`)
   4. Pick up Motes & Charms (`XZ <= 1.0m`, `dY <= 1.5m`)
   5. Interact with nearest unlit Lantern (`XZ <= 2.0m`, cost 10, tie-break by smaller ID)
   6. Update 6m Safe Zones (push shades inside newly lit zone out in <= 30 ticks without dealing damage)
   7. Pulse (cost 3, radius 5m from feet + 0.8m, cooldown 3s, stuns shades 120 ticks with 4m push in first 15 ticks; chases drifter -> flee; fleeing drifter with motes -> drops motes)
   8. Move Shades (`spawning`, `wander`, `chase`, `recoil`, `stunned`) and Drifters (`idle`, `chase`, `flee`)
   9. Contact: Drifters steal first (`min(3, carried)`), then Shades hit (ascending ID order)
   10. Schedule Spawns (Motes every 240 ticks up to 30; Shades at tick 300 then every 8s/7s/6s; Drifters every 1200 ticks on Night 2 & 3; interactable from next tick)
   11. Win / Lose evaluation (`no_flames` > `all_lit` > `dawn`)
   12. Record Snapshot if `tick % snapshot_every === 0`
2. **Performance:** Full Night headless run (21,600 ticks) MUST complete in `<= 30` seconds.
3. **Never finish a phase with failing tests:** Always run `npm test` via the `verify-contract` skill before tagging.
