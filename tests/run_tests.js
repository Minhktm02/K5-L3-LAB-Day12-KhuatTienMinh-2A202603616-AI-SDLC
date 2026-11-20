const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const GameEngine = require('../src/gameEngine');

console.log('=== RUNNING TEST SUITE: DAO DEN LONG (CONTRACT v1.3 - PHASE 4) ===');

const rootDir = path.resolve(__dirname, '..');
const proofDir = path.resolve(rootDir, 'docs/proof/phase-4');
fs.mkdirSync(proofDir, { recursive: true });

const contract = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'game.contract.json'), 'utf8'));
assert.strictEqual(contract.contract_version, '1.3', 'Contract version must be 1.3');
assert.strictEqual(contract.bench_cmd, 'node src/bench.js', 'Contract must define bench_cmd');
assert.strictEqual(contract.soak_cmd, 'node src/soak.js', 'Contract must define soak_cmd');
assert.strictEqual(contract.tuning.night1_duration_s, 240);
assert.strictEqual(contract.tuning.night2_duration_s, 270);
assert.strictEqual(contract.tuning.night3_duration_s, 300);

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}
function run(cmdArgs) {
  execSync(`node src/headless.js ${cmdArgs}`, { cwd: rootDir });
}
function makeEngine(night, scenario, seed = 42) {
  const e = new GameEngine(contract, seed, night);
  e.applyScenario(scenario);
  return e;
}
const baseScn = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [] };

// 1. Determinism
console.log('1. Checking Determinism...');
run('--seed 123 --night 1 --ticks 350 --out docs/proof/phase-4/det1.jsonl');
run('--seed 123 --night 1 --ticks 350 --out docs/proof/phase-4/det2.jsonl');
assert.strictEqual(
  fs.readFileSync(path.resolve(proofDir, 'det1.jsonl'), 'utf8'),
  fs.readFileSync(path.resolve(proofDir, 'det2.jsonl'), 'utf8'),
  'Headless mode must be strictly deterministic'
);
console.log('✓ Determinism verified.');

// 2. Regression Phase 1: mote pickup
console.log('2. Regression Phase 1: mote pickup...');
run('--seed 42 --night 1 --scenario tests/scenarios/mote_pickup_scenario.json --inputs tests/scenarios/mote_pickup_inputs.json --ticks 60 --out docs/proof/phase-4/pickup.jsonl');
assert(readJsonl(path.resolve(proofDir, 'pickup.jsonl')).some(r => r.type === 'event' && r.name === 'mote_picked' && r.data.carried === 1));
console.log('✓ Mote pickup verified.');

// 3. Dawn win (replaces the old "all lanterns lit => instant win" test, see ADR-0001)
console.log('3. Dawn win scenario (3/5 lanterns lit at dawn)...');
run('--seed 42 --night 1 --scenario tests/scenarios/dawn_win_scenario.json --ticks 100 --out docs/proof/phase-4/dawn_win.jsonl');
const dawnRecs = readJsonl(path.resolve(proofDir, 'dawn_win.jsonl'));
const dawnEnd = dawnRecs[dawnRecs.length - 1];
assert.strictEqual(dawnEnd.type, 'end');
assert.strictEqual(dawnEnd.state, 'won');
assert.strictEqual(dawnEnd.ticks, 60, 'Game ends at the dawn tick (60 ticks for 1s)');
// 3 lanterns x (50 + floor(99.0)) + 3 flames x 50 = 447 + 150 = 597
assert.strictEqual(dawnEnd.score, 597, 'Dawn score = sum(50+floor(fuel)) + 50*flames');
assert(dawnRecs.some(r => r.type === 'event' && r.name === 'game_over' && r.data.result === 'won' && r.data.reason === 'dawn_survived'));
console.log('✓ Dawn win verified (dawn_survived, score 597).');

// 4. Dash
console.log('4. Dash...');
run('--seed 42 --night 1 --scenario tests/scenarios/dash_scenario.json --inputs tests/scenarios/dash_inputs.json --ticks 20 --snapshot-every 12 --out docs/proof/phase-4/dash.jsonl');
const dashRecs = readJsonl(path.resolve(proofDir, 'dash.jsonl'));
assert(dashRecs.some(r => r.type === 'event' && r.name === 'dash'));
const s12 = dashRecs.find(r => r.type === 'snapshot' && r.tick === 12);
assert(Math.abs(s12.player.pos[2] - 2.8) < 0.01);
console.log('✓ Dash verified.');

// 5. Drifter
console.log('5. Drifter steal & drop...');
run('--seed 42 --night 2 --scenario tests/scenarios/drifter_scenario.json --inputs tests/scenarios/drifter_inputs.json --ticks 30 --out docs/proof/phase-4/drifter.jsonl');
const drRecs = readJsonl(path.resolve(proofDir, 'drifter.jsonl'));
const steal = drRecs.find(r => r.type === 'event' && r.name === 'drifter_steal');
assert(steal && steal.data.amount === 3 && steal.data.carried === 3);
const drop = drRecs.find(r => r.type === 'event' && r.name === 'drifter_drop');
assert(drop && drop.data.amount === 3);
console.log('✓ Drifter verified.');

// 6. Charm
console.log('6. Wind charm...');
run('--seed 42 --night 2 --scenario tests/scenarios/charm_scenario.json --inputs tests/scenarios/charm_inputs.json --ticks 30 --out docs/proof/phase-4/charm.jsonl');
const chRecs = readJsonl(path.resolve(proofDir, 'charm.jsonl'));
const chEv = chRecs.find(r => r.type === 'event' && r.name === 'charm_picked');
assert(chEv && chEv.data.charm_id === 'C1' && chEv.data.charm_ticks === 600);
assert.strictEqual(chRecs.filter(r => r.type === 'event' && r.name === 'dash').length, 2);
console.log('✓ Wind charm verified.');

// 7. Jump pads
console.log('7. Night 2 / Night 3 jump pads...');
run('--seed 42 --night 2 --scenario tests/scenarios/jumppad_night2_scenario.json --inputs tests/scenarios/jumppad_night2_inputs.json --ticks 100 --out docs/proof/phase-4/jumppad_n2.jsonl');
const jp2 = readJsonl(path.resolve(proofDir, 'jumppad_n2.jsonl')).filter(r => r.type === 'snapshot').pop();
assert(Math.hypot(jp2.player.pos[0] - 70, jp2.player.pos[2]) <= 28 && jp2.player.grounded);
run('--seed 42 --night 3 --scenario tests/scenarios/night3_tier_scenario.json --inputs tests/scenarios/night3_tier_inputs.json --ticks 80 --out docs/proof/phase-4/night3_tier.jsonl');
const n3 = readJsonl(path.resolve(proofDir, 'night3_tier.jsonl')).filter(r => r.type === 'snapshot').pop();
assert.strictEqual(n3.player.pos[1], 6);
assert.strictEqual(n3.player.grounded, true);
console.log('✓ Jump pads verified.');

// 8. Pause
console.log('8. Pause & resume...');
run('--seed 42 --night 1 --scenario tests/scenarios/dash_scenario.json --inputs tests/scenarios/pause_inputs.json --ticks 20 --snapshot-every 5 --out docs/proof/phase-4/pause.jsonl');
const paRecs = readJsonl(path.resolve(proofDir, 'pause.jsonl'));
assert(paRecs.some(r => r.name === 'paused') && paRecs.some(r => r.name === 'resumed'));
const p10 = paRecs.find(r => r.type === 'snapshot' && r.tick === 10);
assert.strictEqual(p10.state, 'paused');
assert.strictEqual(p10.sim_tick, 5);
console.log('✓ Pause verified.');

// 9. Fall
console.log('9. Fall off island & respawn...');
const fallEngine = makeEngine(1, { player: { pos: [39.8, 0, 0], carried: 4, flames: 3 }, ...baseScn });
let fallHit = null;
for (let i = 0; i < 150; i++) {
  const evs = fallEngine.step({ move: fallHit ? [0, 0] : [1, 0], cam_yaw_deg: 0 });
  const hit = evs.find(e => e.name === 'player_hit' && e.data.by === 'fall');
  if (hit) fallHit = hit;
}
assert(fallHit && fallHit.data.lost === 4 && fallHit.data.flames === 2);
assert.strictEqual(fallEngine.player.pos[0], 0);
assert(fallEngine.player.invuln_ticks > 0);
console.log('✓ Fall verified.');

// 10. Lantern fuel decay, lantern_out, relight (cost 5, +40)
console.log('10. Fuel decay -> lantern_out -> relight...');
const e10 = makeEngine(1, {
  player: { pos: [0, 0, 24], carried: 5, flames: 3 }, ...baseScn,
  lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 1.0 }],
  time_left_s: 200
});
assert.strictEqual(e10.getSnapshot().lanterns[0].fuel, 1.0);
let outEv = null;
for (let i = 0; i < 70 && !outEv; i++) {
  outEv = e10.step({}).find(e => e.name === 'lantern_out');
}
assert(outEv && outEv.tick === 60 && outEv.data.lantern_id === 'L1', 'Lantern goes out exactly after 60 ticks (1 fuel / s)');
const l10 = e10.getSnapshot().lanterns[0];
assert.strictEqual(l10.lit, false);
assert.strictEqual(l10.fuel, 0);
assert.strictEqual(l10.deposited, 0);
assert.strictEqual(l10.ever_lit, true);
const relitEvs = e10.step({ interact: true });
const litEv = relitEvs.find(e => e.name === 'lantern_lit');
assert(litEv && litEv.data.relight === true, 'Relight must be flagged');
const l10b = e10.getSnapshot().lanterns[0];
assert.strictEqual(l10b.lit, true);
assert.strictEqual(l10b.fuel, 100);
assert.strictEqual(l10b.relit_count, 1);
assert.strictEqual(e10.player.carried, 0, 'Relight costs only 5 motes');
assert.strictEqual(e10.score, 5 * 5 + 40, '5 motes x 5 + relight 40');
assert.strictEqual(e10.getSnapshot().player.capacity, 12, 'Capacity grows by 2 per successful light');
console.log('✓ Fuel decay / lantern_out / relight / capacity verified.');

// 11. Refuel (headless scenario) and full-fuel lantern ignored
console.log('11. Refuel scenario...');
run('--seed 42 --night 1 --scenario tests/scenarios/refuel_scenario.json --inputs tests/scenarios/refuel_inputs.json --ticks 10 --snapshot-every 1 --out docs/proof/phase-4/refuel.jsonl');
const rfRecs = readJsonl(path.resolve(proofDir, 'refuel.jsonl'));
const refuels = rfRecs.filter(r => r.type === 'event' && r.name === 'refuel');
// Fuel decays (step 2) before interaction (step 5), so a lit lantern is never exactly full at the next
// interact: the 2nd interact (tick 5, ~0.1 fuel missing) still consumes exactly 1 mote (ceil(deficit/10) = 1).
assert.strictEqual(refuels.length, 2, 'Two interacts -> two refuel events');
// fuel 55 -> after 1 tick decay ~54.98; step 1 interact: used = min(10, ceil(45.02/10)=5) = 5 -> fuel 100
assert.strictEqual(refuels[0].data.amount, 5);
assert.strictEqual(refuels[0].data.fuel, 100);
assert.strictEqual(refuels[1].data.amount, 1, 'Small deficit costs exactly 1 mote');
assert.strictEqual(refuels[1].data.fuel, 100);
const rfEnd = rfRecs[rfRecs.length - 1];
assert.strictEqual(rfEnd.score, 30, '6 motes x 5 points');
// Interact while carrying 0 motes must not emit anything
const e11 = makeEngine(1, { ...baseScn, player: { pos: [0, 0, 24], carried: 0 }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 50 }] });
assert.strictEqual(e11.step({ interact: true }).filter(e => e.name === 'refuel').length, 0);
console.log('✓ Refuel verified.');

// 12. Boundary: exactly 30 fuel keeps safe zone, below 30 loses it
console.log('12. Safe zone boundary (fuel == 30)...');
const e12 = makeEngine(1, { ...baseScn, lanterns: [{ id: 'L1', pos: [20, 0, 0], lit: true, fuel: 30 }] });
assert.strictEqual(e12.isSafeLantern(e12.lanterns[0]), true, 'fuel == 30 keeps the safe zone');
e12.step({});
assert.strictEqual(e12.isSafeLantern(e12.lanterns[0]), false, 'fuel < 30 loses the safe zone');
console.log('✓ Safe-zone boundary verified.');

// 13. Drain: wander shade hunts weak lantern, drains 5/s, lantern_out, shade back to wander
console.log('13. Shade drain scenario...');
run('--seed 42 --night 1 --scenario tests/scenarios/drain_scenario.json --ticks 300 --snapshot-every 30 --out docs/proof/phase-4/drain.jsonl');
const dnRecs = readJsonl(path.resolve(proofDir, 'drain.jsonl'));
const drainSnap = dnRecs.find(r => r.type === 'snapshot' && r.shades.some(s => s.state === 'drain'));
assert(drainSnap, 'Shade must enter drain state next to a weak lantern');
const fd = dnRecs.find(r => r.type === 'event' && r.name === 'fuel_drain');
assert(fd && fd.data.lantern_id === 'L1' && fd.data.shade_id === 'S1', 'fuel_drain event every 60 ticks');
assert(fd.data.fuel > 13 && fd.data.fuel < 15, `fuel after 60 drain ticks ~14.0, got ${fd.data.fuel}`);
const outDn = dnRecs.find(r => r.type === 'event' && r.name === 'lantern_out');
assert(outDn, 'Drained lantern must go out');
const lastDn = dnRecs.filter(r => r.type === 'snapshot').pop();
assert.strictEqual(lastDn.shades[0].state, 'wander', 'Shade returns to wander after the lantern is out');
console.log('✓ Drain verified.');

// 14. Pulse on a draining shade gives +15 total
console.log('14. Pulse on draining shade (+15) vs normal shade (+5)...');
const e14 = makeEngine(1, {
  player: { pos: [20, 0, 4], carried: 3, flames: 3 }, ...baseScn,
  shades: [{ id: 'S1', pos: [20, 0, 1.5], state: 'drain', target_lantern_id: 'L1' }],
  lanterns: [{ id: 'L1', pos: [20, 0, 0], lit: true, fuel: 20 }],
  time_left_s: 200
});
const pev = e14.step({ pulse: true });
assert(pev.find(e => e.name === 'pulse').data.stunned_ids.includes('S1'));
assert.strictEqual(e14.score, 15, 'Pulse on draining shade = +15');
assert.strictEqual(e14.shades[0].state, 'stunned');
const e14b = makeEngine(1, {
  player: { pos: [0, 0, 0], carried: 3, flames: 3 }, ...baseScn,
  shades: [{ id: 'S1', pos: [3, 0, 0], state: 'chase' }]
});
e14b.step({ pulse: true });
assert.strictEqual(e14b.score, 5, 'Pulse on normal shade = +5');
console.log('✓ Pulse scoring verified.');

// 15. Win rule thresholds, no early win, no_flames beats dawn
console.log('15. Win / lose rules...');
const lanternsLit = n => Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
const dawn = (night, lit, extra = {}) => {
  const e = makeEngine(night, { ...baseScn, lanterns: lanternsLit(lit), time_left_s: 1 / 60, ...extra });
  e.step({});
  return e;
};
assert.strictEqual(dawn(1, 3).state, 'won', 'Night 1: 3/5 wins');
assert.strictEqual(dawn(1, 2).state, 'lost', 'Night 1: 2/5 loses');
assert.strictEqual(dawn(1, 2).reason, 'dawn');
assert.strictEqual(dawn(2, 4).state, 'won', 'Night 2: 4/6 wins');
assert.strictEqual(dawn(2, 3).state, 'lost', 'Night 2: 3/6 loses');
assert.strictEqual(dawn(3, 5).state, 'won', 'Night 3: 5/7 wins');
assert.strictEqual(dawn(3, 4).state, 'lost', 'Night 3: 4/7 loses');
assert.strictEqual(dawn(1, 3).reason, 'dawn_survived');
const eEarly = makeEngine(1, { ...baseScn, lanterns: lanternsLit(5), time_left_s: 100 });
for (let i = 0; i < 100; i++) eEarly.step({});
assert.strictEqual(eEarly.state, 'playing', 'Lighting every lantern no longer ends the night');
const eFlames = makeEngine(1, { ...baseScn, player: { pos: [0, 0, 0], flames: 0 }, lanterns: lanternsLit(5), time_left_s: 1 / 60 });
eFlames.step({});
assert.strictEqual(eFlames.state, 'lost');
assert.strictEqual(eFlames.reason, 'no_flames', 'no_flames wins over dawn on the last tick');
console.log('✓ Win / lose rules verified.');

// 16. Capacity growth
console.log('16. Capacity growth...');
const capOf = n => makeEngine(1, { ...baseScn, player: { pos: [0, 0, 0], successful_lights: n } }).getSnapshot().player.capacity;
assert.strictEqual(capOf(0), 10);
assert.strictEqual(capOf(3), 16);
assert.strictEqual(capOf(5), 20);
assert.strictEqual(capOf(9), 20, 'Capacity capped at 20');
console.log('✓ Capacity verified.');

// 17. Benchmark headless speed
console.log('17. Performance benchmark (21,600 ticks, Night 3)...');
const tStart = Date.now();
run('--seed 777 --night 3 --ticks 21600 --snapshot-every 60 --out docs/proof/phase-4/bench_night3.jsonl');
const elapsedMs = Date.now() - tStart;
console.log(`✓ Completed in ${elapsedMs} ms (limit 30,000 ms).`);
assert(elapsedMs <= 30000);

// 18. Contract v1.3: Bench scene initialization (200 shades, 100 motes, L1-L3 lit @ fuel 100, no decay)
console.log('18. Benchmark scene setup & stability...');
const eBench = new GameEngine(contract, 42, 1);
eBench.initBenchWorld();
assert.strictEqual(eBench.shades.length, 200, 'Bench scene must have 200 Shades');
assert(eBench.shades.every(s => s.state === 'wander'), 'All bench Shades must be wandering');
assert.strictEqual(eBench.motes.length, 100, 'Bench scene must have 100 Motes');
assert.strictEqual(eBench.lanterns.filter(l => l.lit).length, 3, 'L1-L3 must be lit');
assert(eBench.lanterns.slice(0, 3).every(l => l.fuel_u === eBench.FUEL_MAX_U), 'L1-L3 must have fuel 100');
for (let i = 0; i < 60; i++) eBench.stepBench(1 / 60);
assert.strictEqual(eBench.shades.length, 200, 'Bench scene must not spawn/despawn Shades');
assert.strictEqual(eBench.motes.length, 100, 'Bench scene must not pick up Motes');
assert(eBench.lanterns.slice(0, 3).every(l => l.fuel_u === eBench.FUEL_MAX_U), 'Bench scene must not decay fuel');
assert.strictEqual(eBench.state, 'playing', 'Bench scene must not end');
console.log('✓ Benchmark scene verified.');

// 19. Contract v1.3: Leaderboard validation, tie-break, top-10 cap, and CLI export
console.log('19. Local leaderboard & --export-leaderboard CLI...');
const lb = require('../src/leaderboard');
const tmpLbPath = path.resolve(proofDir, 'tmp_lb.json');
if (fs.existsSync(tmpLbPath)) fs.unlinkSync(tmpLbPath);
assert.strictEqual(lb.validateName('May_01'), true);
assert.strictEqual(lb.validateName('MinhÁnh'), true, 'Vietnamese name supported');
assert.strictEqual(lb.validateName('ab'), false, 'Too short (<3)');
assert.strictEqual(lb.validateName('abcdefghijklmn'), false, 'Too long (>12)');
assert.strictEqual(lb.validateName('bad name!'), false, 'Invalid chars');
lb.addEntry({ name: 'LateTie', score: 1000, nights_won: 3, seed: 1, achieved_at: '2026-11-20T12:00:00+07:00' }, tmpLbPath);
lb.addEntry({ name: 'EarlyTie', score: 1000, nights_won: 3, seed: 2, achieved_at: '2026-11-20T11:00:00+07:00' }, tmpLbPath);
for (let i = 0; i < 12; i++) {
  lb.addEntry({ name: `Player_${i}`, score: 100 + i * 10, nights_won: 1, seed: i }, tmpLbPath);
}
const loadedLb = lb.loadLeaderboard(tmpLbPath);
assert.strictEqual(loadedLb.entries.length, 10, 'Leaderboard keeps top 10');
assert.strictEqual(loadedLb.entries[0].name, 'EarlyTie', 'Earlier achieved_at wins ties');
assert.strictEqual(loadedLb.entries[1].name, 'LateTie');
const exportedPath = path.resolve(proofDir, 'exported_lb.json');
execSync(`node server.js --export-leaderboard "${exportedPath}"`, { cwd: rootDir });
const exportedJson = JSON.parse(fs.readFileSync(exportedPath, 'utf8'));
assert(Array.isArray(exportedJson.entries), '--export-leaderboard must output {"entries": [...]}');
fs.unlinkSync(tmpLbPath);
console.log('✓ Leaderboard & CLI export verified.');

console.log('==========================================================');
console.log('ALL PHASE 4 TESTS PASSED SUCCESSFULLY! (19/19)');
console.log('==========================================================');
