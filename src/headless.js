const fs = require('fs');
const path = require('path');
const GameEngine = require('./gameEngine');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    seed: 42,
    night: 1,
    scenario: null,
    inputs: null,
    ticks: 0,
    out: null,
    snapshot_every: 10
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed') {
      parsed.seed = parseInt(args[++i], 10);
    } else if (arg === '--night') {
      parsed.night = parseInt(args[++i], 10);
    } else if (arg === '--scenario') {
      parsed.scenario = args[++i];
    } else if (arg === '--inputs') {
      parsed.inputs = args[++i];
    } else if (arg === '--ticks') {
      parsed.ticks = parseInt(args[++i], 10);
    } else if (arg === '--out') {
      parsed.out = args[++i];
    } else if (arg === '--snapshot-every') {
      parsed.snapshot_every = parseInt(args[++i], 10);
    }
  }

  if (!parsed.out || isNaN(parsed.ticks)) {
    console.error('Usage: node src/headless.js --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]');
    process.exit(1);
  }

  return parsed;
}

function main() {
  const options = parseArgs();

  // Load contract
  const contractPath = path.resolve(__dirname, '../game.contract.json');
  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  } catch (err) {
    console.error('Error reading game.contract.json:', err.message);
    process.exit(1);
  }

  // Load scenario if provided
  let scenario = null;
  if (options.scenario) {
    try {
      scenario = JSON.parse(fs.readFileSync(path.resolve(options.scenario), 'utf8'));
    } catch (err) {
      console.error('Invalid scenario file format:', err.message);
      process.exit(2);
    }
  }

  // Load inputs if provided
  let inputsData = null;
  if (options.inputs) {
    try {
      inputsData = JSON.parse(fs.readFileSync(path.resolve(options.inputs), 'utf8'));
    } catch (err) {
      console.error('Invalid inputs file format:', err.message);
      process.exit(2);
    }
  }

  // Build frame lookup map
  const frameMap = new Map();
  if (inputsData && inputsData.frames) {
    let lastTick = -1;
    for (const frame of inputsData.frames) {
      if (typeof frame.tick !== 'number' || frame.tick <= lastTick) {
        console.error('Inputs frame ticks must be strictly increasing. Found:', frame.tick, 'after', lastTick);
        process.exit(2);
      }
      lastTick = frame.tick;
      frameMap.set(frame.tick, frame);
    }
  }

  const engine = new GameEngine(contract, options.seed);
  engine.applyScenario(scenario);

  const outLines = [];

  // Snapshot tick 0: state after scenario setup, before inputs applied
  outLines.push(JSON.stringify(engine.getSnapshot()));

  // Active input state across ticks
  let currentInputState = {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false
  };

  let prevButtons = {
    jump: false,
    interact: false,
    pulse: false
  };

  const totalTicks = options.ticks;
  for (let k = 0; k < totalTicks; k++) {
    // If a frame specifies changes at tick k:
    if (frameMap.has(k)) {
      const f = frameMap.get(k);
      if (f.move !== undefined) currentInputState.move = [...f.move];
      if (f.cam_yaw_deg !== undefined) currentInputState.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) currentInputState.jump = !!f.jump;
      if (f.interact !== undefined) currentInputState.interact = !!f.interact;
      if (f.pulse !== undefined) currentInputState.pulse = !!f.pulse;
    }

    // Trigger action only on rising edge (false -> true)
    const stepInput = {
      move: currentInputState.move,
      cam_yaw_deg: currentInputState.cam_yaw_deg,
      jump: currentInputState.jump && !prevButtons.jump,
      interact: currentInputState.interact && !prevButtons.interact,
      pulse: currentInputState.pulse && !prevButtons.pulse
    };

    prevButtons.jump = currentInputState.jump;
    prevButtons.interact = currentInputState.interact;
    prevButtons.pulse = currentInputState.pulse;

    const events = engine.step(stepInput);

    // Record events
    for (const ev of events) {
      outLines.push(JSON.stringify(ev));
    }

    // Record snapshot if needed
    if (engine.tick % options.snapshot_every === 0) {
      outLines.push(JSON.stringify(engine.getSnapshot()));
    }

    // Stop if game ended
    if (engine.state !== 'playing') {
      break;
    }
  }

  // End line (required)
  const endRecord = {
    type: 'end',
    ticks: engine.tick,
    state: engine.state,
    score: engine.score
  };
  outLines.push(JSON.stringify(endRecord));

  // Write out to output file
  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outLines.join('\n') + '\n', 'utf8');

  process.exit(0);
}

main();
