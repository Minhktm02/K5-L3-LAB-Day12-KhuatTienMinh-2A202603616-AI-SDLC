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

  if (!parsed.out || isNaN(parsed.ticks) || ![1, 2, 3].includes(parsed.night)) {
    console.error('Usage: node src/headless.js --seed <int> --night <1|2|3> [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]');
    process.exit(1);
  }

  return parsed;
}

function main() {
  const options = parseArgs();

  const contractPath = path.resolve(__dirname, '../game.contract.json');
  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  } catch (err) {
    console.error('Error reading game.contract.json:', err.message);
    process.exit(1);
  }

  let scenario = null;
  if (options.scenario) {
    try {
      scenario = JSON.parse(fs.readFileSync(path.resolve(options.scenario), 'utf8'));
      if (typeof scenario !== 'object' || scenario === null || Array.isArray(scenario)) {
        throw new Error('Scenario must be a JSON object');
      }
    } catch (err) {
      console.error('Invalid scenario file format:', err.message);
      process.exit(2);
    }
  }

  let inputsData = null;
  if (options.inputs) {
    try {
      inputsData = JSON.parse(fs.readFileSync(path.resolve(options.inputs), 'utf8'));
      if (typeof inputsData !== 'object' || inputsData === null || !Array.isArray(inputsData.frames)) {
        throw new Error('Inputs must contain a frames array');
      }
    } catch (err) {
      console.error('Invalid inputs file format:', err.message);
      process.exit(2);
    }
  }

  const frameMap = new Map();
  if (inputsData && inputsData.frames) {
    let lastTick = -1;
    for (const frame of inputsData.frames) {
      if (typeof frame.tick !== 'number' || frame.tick <= lastTick || frame.tick < 0) {
        console.error('Inputs frame ticks must be strictly increasing non-negative integers. Found:', frame.tick, 'after', lastTick);
        process.exit(2);
      }
      if (frame.move !== undefined) {
        if (!Array.isArray(frame.move) || frame.move.length !== 2 || typeof frame.move[0] !== 'number' || typeof frame.move[1] !== 'number') {
          console.error('Invalid move vector in inputs frame');
          process.exit(2);
        }
      }
      lastTick = frame.tick;
      frameMap.set(frame.tick, frame);
    }
  }

  const engine = new GameEngine(contract, options.seed, options.night);
  engine.applyScenario(scenario);

  const outLines = [];

  // Snapshot tick 0: state after scenario setup, before inputs applied
  outLines.push(JSON.stringify(engine.getSnapshot()));

  let currentInputState = {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false
  };

  let prevButtons = {
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false
  };

  const totalTicks = options.ticks;
  for (let k = 0; k < totalTicks; k++) {
    if (frameMap.has(k)) {
      const f = frameMap.get(k);
      if (f.move !== undefined) currentInputState.move = [...f.move];
      if (f.cam_yaw_deg !== undefined) currentInputState.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) currentInputState.jump = !!f.jump;
      if (f.interact !== undefined) currentInputState.interact = !!f.interact;
      if (f.pulse !== undefined) currentInputState.pulse = !!f.pulse;
      if (f.dash !== undefined) currentInputState.dash = !!f.dash;
      if (f.pause !== undefined) currentInputState.pause = !!f.pause;
    }

    const stepInput = {
      move: currentInputState.move,
      cam_yaw_deg: currentInputState.cam_yaw_deg,
      jump: currentInputState.jump && !prevButtons.jump,
      interact: currentInputState.interact && !prevButtons.interact,
      pulse: currentInputState.pulse && !prevButtons.pulse,
      dash: currentInputState.dash && !prevButtons.dash,
      pause: currentInputState.pause && !prevButtons.pause
    };

    prevButtons.jump = currentInputState.jump;
    prevButtons.interact = currentInputState.interact;
    prevButtons.pulse = currentInputState.pulse;
    prevButtons.dash = currentInputState.dash;
    prevButtons.pause = currentInputState.pause;

    const events = engine.step(stepInput);

    for (const ev of events) {
      outLines.push(JSON.stringify(ev));
    }

    // Step 12: Record snapshot if on interval
    if (engine.tick % options.snapshot_every === 0) {
      outLines.push(JSON.stringify(engine.getSnapshot()));
    }

    if (engine.state === 'won' || engine.state === 'lost') {
      break;
    }
  }

  const endRecord = {
    type: 'end',
    ticks: engine.tick,
    state: engine.state,
    score: engine.score
  };
  outLines.push(JSON.stringify(endRecord));

  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outLines.join('\n') + '\n', 'utf8');

  process.exit(0);
}

main();
