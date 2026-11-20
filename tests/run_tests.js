const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const GameEngine = require('../src/gameEngine');

console.log('--- RUNNING TEST SUITE: DAO DEN LONG ---');

const contract = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../game.contract.json'), 'utf8'));

// Test 1: Determinism
console.log('1. Checking Determinism...');
execSync('node src/headless.js --seed 123 --night 1 --ticks 120 --out docs/proof/phase-1/det1.jsonl', { cwd: path.resolve(__dirname, '..') });
execSync('node src/headless.js --seed 123 --night 1 --ticks 120 --out docs/proof/phase-1/det2.jsonl', { cwd: path.resolve(__dirname, '..') });
const h1 = fs.readFileSync(path.resolve(__dirname, '../docs/proof/phase-1/det1.jsonl'), 'utf8');
const h2 = fs.readFileSync(path.resolve(__dirname, '../docs/proof/phase-1/det2.jsonl'), 'utf8');
assert.strictEqual(h1, h2, 'Headless mode must be strictly deterministic given same seed');
console.log('✓ Determinism verified.');

// Test 2: Mote pickup scenario
console.log('2. Testing Mote Pickup Scenario...');
execSync('node src/headless.js --seed 42 --night 1 --scenario tests/scenarios/mote_pickup_scenario.json --inputs tests/scenarios/mote_pickup_inputs.json --ticks 60 --out docs/proof/phase-1/pickup.jsonl', { cwd: path.resolve(__dirname, '..') });
const pickupLines = fs.readFileSync(path.resolve(__dirname, '../docs/proof/phase-1/pickup.jsonl'), 'utf8').trim().split('\n');
const hasPickupEvent = pickupLines.some(l => {
  const obj = JSON.parse(l);
  return obj.type === 'event' && obj.name === 'mote_picked';
});
assert.strictEqual(hasPickupEvent, true, 'Player should pick up mote in path');
console.log('✓ Mote pickup scenario verified.');

// Test 3: Deposit & Win scenario
console.log('3. Testing Deposit & Win Scenario...');
execSync('node src/headless.js --seed 42 --night 1 --scenario tests/scenarios/deposit_win_scenario.json --inputs tests/scenarios/deposit_win_inputs.json --ticks 10 --out docs/proof/phase-1/win.jsonl', { cwd: path.resolve(__dirname, '..') });
const winLines = fs.readFileSync(path.resolve(__dirname, '../docs/proof/phase-1/win.jsonl'), 'utf8').trim().split('\n');
const endLine = JSON.parse(winLines[winLines.length - 1]);
assert.strictEqual(endLine.type, 'end', 'Last line must be end');
assert.strictEqual(endLine.state, 'won', 'Game should be won when all lanterns lit');
console.log('✓ Deposit and Win scenario verified.');

// Test 4: Pulse & Stun logic
console.log('4. Testing Pulse & Stun Logic...');
const engine = new GameEngine(contract, 999);
engine.applyScenario({
  player: { pos: [0, 0, 0], carried: 2, flames: 3 },
  shades: [{ id: 'S1', pos: [3, 0, 0] }],
  random_motes: false,
  random_shades: false
});
const events = engine.step({ pulse: true, move: [0, 0] });
const pulseEvent = events.find(e => e.name === 'pulse');
assert(pulseEvent, 'Pulse event must be generated');
assert(pulseEvent.data.stunned_ids.includes('S1'), 'Shade within radius must be stunned');
console.log('✓ Pulse & Stun verified.');

console.log('====================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! (4/4)');
console.log('====================================');
