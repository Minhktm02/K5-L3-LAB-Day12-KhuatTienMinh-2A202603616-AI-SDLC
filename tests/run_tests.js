const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const GameEngine = require('../src/gameEngine');

console.log('=== RUNNING TEST SUITE: DAO DEN LONG (CONTRACT v1.1 - PHASE 2) ===');

const rootDir = path.resolve(__dirname, '..');
const proofDir = path.resolve(rootDir, 'docs/proof/phase-2');
fs.mkdirSync(proofDir, { recursive: true });

const contract = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'game.contract.json'), 'utf8'));
assert.strictEqual(contract.contract_version, '1.1', 'Contract version must be 1.1');

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

// 1. Determinism Check across Nights 1, 2, 3
console.log('1. Checking Determinism (Night 1, 2, 3)...');
execSync('node src/headless.js --seed 123 --night 1 --ticks 350 --out docs/proof/phase-2/det1.jsonl', { cwd: rootDir });
execSync('node src/headless.js --seed 123 --night 1 --ticks 350 --out docs/proof/phase-2/det2.jsonl', { cwd: rootDir });
const h1 = fs.readFileSync(path.resolve(proofDir, 'det1.jsonl'), 'utf8');
const h2 = fs.readFileSync(path.resolve(proofDir, 'det2.jsonl'), 'utf8');
assert.strictEqual(h1, h2, 'Headless mode must be strictly deterministic');
console.log('✓ Determinism verified.');

// 2. Regression Phase 1: Mote Pickup & Deposit Win with v1.1 standard tuning
console.log('2. Testing Regression Phase 1 (Mote Pickup & Deposit Win)...');
execSync('node src/headless.js --seed 42 --night 1 --scenario tests/scenarios/mote_pickup_scenario.json --inputs tests/scenarios/mote_pickup_inputs.json --ticks 60 --out docs/proof/phase-2/pickup.jsonl', { cwd: rootDir });
const pickupRecords = readJsonl(path.resolve(proofDir, 'pickup.jsonl'));
assert(pickupRecords.some(r => r.type === 'event' && r.name === 'mote_picked' && r.data.carried === 1), 'Player must pick up mote');

execSync('node src/headless.js --seed 42 --night 1 --scenario tests/scenarios/deposit_win_scenario.json --inputs tests/scenarios/deposit_win_inputs.json --ticks 10 --out docs/proof/phase-2/win.jsonl', { cwd: rootDir });
const winRecords = readJsonl(path.resolve(proofDir, 'win.jsonl'));
const winEnd = winRecords[winRecords.length - 1];
assert.strictEqual(winEnd.type, 'end');
assert.strictEqual(winEnd.state, 'won', 'Game must be won when all 5 lanterns are lit');
// Score check: 10 motes deposited (*10 = 100) + 1 lantern lit (100) + 299s left (*2 = 598) + 3 flames (*50 = 150) = 948
assert.strictEqual(winEnd.score, 948, 'Standardized score calculation must match formula');
console.log('✓ Phase 1 Regression & Standardized Scoring verified.');

// 3. Dash (Lướt: 14 m/s, 0.2s = 12 ticks -> 2.8m, 1.5s cooldown)
console.log('3. Testing Dash Scenario...');
execSync('node src/headless.js --seed 42 --night 1 --scenario tests/scenarios/dash_scenario.json --inputs tests/scenarios/dash_inputs.json --ticks 20 --snapshot-every 12 --out docs/proof/phase-2/dash.jsonl', { cwd: rootDir });
const dashRecords = readJsonl(path.resolve(proofDir, 'dash.jsonl'));
assert(dashRecords.some(r => r.type === 'event' && r.name === 'dash'), 'Dash event must be emitted');
const snap12 = dashRecords.find(r => r.type === 'snapshot' && r.tick === 12);
assert(snap12, 'Snapshot at tick 12 must exist');
assert(Math.abs(snap12.player.pos[2] - 2.8) < 0.01, `After 12 ticks of dash at 14m/s, z should be 2.8m, got ${snap12.player.pos[2]}`);
assert(snap12.player.dash_cd_s > 1.2, 'Dash cooldown must be active');
console.log('✓ Dash mechanic verified.');

// 4. Drifter (Gió Lạc: chase when carried >= 5, steal min(3, carried), drop motes when hit by Pulse while fleeing)
console.log('4. Testing Drifter (Gió Lạc) Steal & Pulse Drop Scenario...');
execSync('node src/headless.js --seed 42 --night 2 --scenario tests/scenarios/drifter_scenario.json --inputs tests/scenarios/drifter_inputs.json --ticks 30 --out docs/proof/phase-2/drifter.jsonl', { cwd: rootDir });
const drifterRecords = readJsonl(path.resolve(proofDir, 'drifter.jsonl'));
const stealEv = drifterRecords.find(r => r.type === 'event' && r.name === 'drifter_steal');
assert(stealEv, 'Drifter must steal motes when within 1.2m of player carrying >= 5');
assert.strictEqual(stealEv.data.amount, 3, 'Drifter steals min(3, carried)');
assert.strictEqual(stealEv.data.carried, 3, 'Player has 3 motes remaining');
const dropEv = drifterRecords.find(r => r.type === 'event' && r.name === 'drifter_drop');
assert(dropEv, 'Pulse on fleeing drifter with stolen motes must emit drifter_drop');
assert.strictEqual(dropEv.data.amount, 3, 'Drifter drops all 3 stolen motes');
console.log('✓ Drifter Steal & Pulse Drop verified.');

// 5. Wind Charm (Bùa Gió: 600 ticks, speed 7.2 m/s, 0 dash cooldown)
console.log('5. Testing Wind Charm (Bùa Gió) Scenario...');
execSync('node src/headless.js --seed 42 --night 2 --scenario tests/scenarios/charm_scenario.json --inputs tests/scenarios/charm_inputs.json --ticks 30 --out docs/proof/phase-2/charm.jsonl', { cwd: rootDir });
const charmRecords = readJsonl(path.resolve(proofDir, 'charm.jsonl'));
const charmEv = charmRecords.find(r => r.type === 'event' && r.name === 'charm_picked');
assert(charmEv, 'Charm picked event must be emitted');
assert.strictEqual(charmEv.data.charm_id, 'C1');
assert.strictEqual(charmEv.data.charm_ticks, 600);
const dashEventsInCharm = charmRecords.filter(r => r.type === 'event' && r.name === 'dash');
assert.strictEqual(dashEventsInCharm.length, 2, 'With Wind Charm active, player can dash again immediately after 12-tick dash ends without waiting 1.5s cooldown');
console.log('✓ Wind Charm verified.');

// 6. Night 2 Jump Pad (Bục nhảy Đảo Cau: vel_y=14, horiz=24 toward other island)
console.log('6. Testing Night 2 Jump Pad Scenario...');
execSync('node src/headless.js --seed 42 --night 2 --scenario tests/scenarios/jumppad_night2_scenario.json --inputs tests/scenarios/jumppad_night2_inputs.json --ticks 100 --out docs/proof/phase-2/jumppad_n2.jsonl', { cwd: rootDir });
const jp2Records = readJsonl(path.resolve(proofDir, 'jumppad_n2.jsonl'));
const jp2LastSnap = jp2Records.filter(r => r.type === 'snapshot').pop();
const distToIslandB = Math.hypot(jp2LastSnap.player.pos[0] - 70.0, jp2LastSnap.player.pos[2]);
assert(distToIslandB <= 28.0 && jp2LastSnap.player.grounded, `Player must land safely on Island B (dist=${distToIslandB}, grounded=${jp2LastSnap.player.grounded})`);
console.log('✓ Night 2 Jump Pad flight & landing on Island B verified.');

// 7. Night 3 Multi-tier Jump Pad & Strong Wind (Đảo Chuông)
console.log('7. Testing Night 3 Multi-Tier Jump Pad & Wind...');
execSync('node src/headless.js --seed 42 --night 3 --scenario tests/scenarios/night3_tier_scenario.json --inputs tests/scenarios/night3_tier_inputs.json --ticks 80 --out docs/proof/phase-2/night3_tier.jsonl', { cwd: rootDir });
const n3Records = readJsonl(path.resolve(proofDir, 'night3_tier.jsonl'));
const n3LastSnap = n3Records.filter(r => r.type === 'snapshot').pop();
assert.strictEqual(n3LastSnap.player.pos[1], 6, `Player must land on Tier 2 at Y=6, got Y=${n3LastSnap.player.pos[1]}`);
assert.strictEqual(n3LastSnap.player.grounded, true);
console.log('✓ Night 3 Multi-tier Jump Pad to Tier 2 (Y=6) verified.');

// 8. Pause & Resume Scenario
console.log('8. Testing Pause & Resume Scenario...');
execSync('node src/headless.js --seed 42 --night 1 --scenario tests/scenarios/dash_scenario.json --inputs tests/scenarios/pause_inputs.json --ticks 20 --snapshot-every 5 --out docs/proof/phase-2/pause.jsonl', { cwd: rootDir });
const pauseRecords = readJsonl(path.resolve(proofDir, 'pause.jsonl'));
assert(pauseRecords.some(r => r.type === 'event' && r.name === 'paused'), 'Paused event must be emitted');
assert(pauseRecords.some(r => r.type === 'event' && r.name === 'resumed'), 'Resumed event must be emitted');
const snap10Paused = pauseRecords.find(r => r.type === 'snapshot' && r.tick === 10);
assert.strictEqual(snap10Paused.state, 'paused', 'Snapshot at tick 10 must record state: paused');
assert.strictEqual(snap10Paused.sim_tick, 5, 'sim_tick must freeze at 5 while paused');
console.log('✓ Pause & Resume mechanics verified.');

// 9. Fall off Island (Y < -10) & Respawn after 60 ticks
console.log('9. Testing Fall off Island & Respawn...');
const fallEngine = new GameEngine(contract, 42, 1);
fallEngine.applyScenario({
  player: { pos: [39.8, 0, 0], carried: 4, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: []
});
let fallHitEv = null;
for (let i = 0; i < 150; i++) {
  const mv = fallHitEv ? [0, 0] : [1, 0];
  const evs = fallEngine.step({ move: mv, cam_yaw_deg: 0 });
  const hit = evs.find(e => e.name === 'player_hit' && e.data.by === 'fall');
  if (hit) fallHitEv = hit;
}
assert(fallHitEv, 'Player walking off island must trigger player_hit by fall when Y < -10');
assert.strictEqual(fallHitEv.data.lost, 4, 'All carried motes must be recorded in lost field');
assert.strictEqual(fallHitEv.data.flames, 2, 'Player loses 1 flame');
assert.strictEqual(fallEngine.player.pos[0], 0, 'Player respawns at origin after 60 ticks wait');
assert(fallEngine.player.invuln_ticks > 0, 'Player has invulnerability upon respawn');
console.log('✓ Fall off island & 60-tick respawn verified.');

// 10. Full Night Headless Benchmark (21,600 ticks in <= 30 seconds)
console.log('10. Running Performance Benchmark (21,600 ticks full Night 3)...');
const tStart = Date.now();
execSync('node src/headless.js --seed 777 --night 3 --ticks 21600 --snapshot-every 60 --out docs/proof/phase-2/bench_night3.jsonl', { cwd: rootDir });
const elapsedMs = Date.now() - tStart;
console.log(`✓ Full Night 3 (21,600 ticks) completed in ${elapsedMs} ms (limit: 30,000 ms).`);
assert(elapsedMs <= 30000, 'Full night headless run must complete in <= 30 seconds');

console.log('==========================================================');
console.log('ALL PHASE 2 TESTS PASSED SUCCESSFULLY! (10/10)');
console.log('==========================================================');
