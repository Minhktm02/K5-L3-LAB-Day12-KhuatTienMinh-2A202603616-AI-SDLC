const fs = require('fs');
const path = require('path');
const GameEngine = require('./gameEngine');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { seed: 7, nights: 10, out: 'soak.json' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed') parsed.seed = parseInt(args[++i], 10);
    else if (args[i] === '--nights') parsed.nights = parseInt(args[++i], 10);
    else if (args[i] === '--out') parsed.out = args[++i];
  }
  if (isNaN(parsed.seed) || isNaN(parsed.nights) || parsed.nights < 1 || !parsed.out) {
    console.error('Usage: node src/soak.js --seed <int> --nights <int> --out <file.json>');
    process.exit(1);
  }
  return parsed;
}

function createRng(seed) {
  let state = seed >>> 0;
  return function rand() {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getRssMb() {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function main() {
  const opts = parseArgs();
  const contractPath = path.resolve(__dirname, '../game.contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

  // Brief V8 JIT warmup across all 3 night maps before Night 1 so steady-state RSS is measured accurately
  for (let wn = 1; wn <= 3; wn++) {
    const warm = new GameEngine(contract, wn, wn);
    warm.initDefaultWorld();
    for (let w = 0; w < 900; w++) {
      warm.step({ move: [1, 0], cam_yaw_deg: 0, jump: w % 20 === 0, dash: w % 33 === 0, pulse: w % 50 === 0, interact: w % 10 === 0, pause: false });
    }
  }

  const startMs = Date.now();
  const results = [];
  let crashes = 0;
  let memStartMb = null;

  for (let i = 0; i < opts.nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = (opts.seed + i) >>> 0;
    const inputRng = createRng((nightSeed ^ 0x9e3779b9) >>> 0);

    try {
      let engine = new GameEngine(contract, nightSeed, night);
      engine.initDefaultWorld();

      if (i === 0) {
        memStartMb = getRssMb();
      }

      const maxTicks = engine.time_ticks_left + 10;
      let moveVec = [0, 0];

      for (let t = 0; t < maxTicks; t++) {
        if (t % 30 === 0) {
          const angle = inputRng() * Math.PI * 2;
          moveVec = [Math.cos(angle), Math.sin(angle)];
        }
        const jump = inputRng() < 0.05;
        const dash = inputRng() < 0.03;
        const pulse = inputRng() < 0.02;
        const interact = inputRng() < 0.10;

        engine.step({
          move: moveVec,
          cam_yaw_deg: 0,
          jump,
          dash,
          pulse,
          interact,
          pause: false
        });

        if (engine.state === 'won' || engine.state === 'lost') {
          break;
        }
      }

      results.push(engine.state === 'won' ? 'won' : 'lost');

      // Explicitly reset / drop references for clean GC
      engine.lanterns = [];
      engine.motes = [];
      engine.shades = [];
      engine.drifters = [];
      engine.events = [];
      engine = null;
    } catch (err) {
      crashes += 1;
      results.push('crash');
      console.error(`Soak night ${i + 1} (Night ${night}, seed ${nightSeed}) crashed:`, err);
    }
  }

  if (typeof global.gc === 'function') {
    global.gc();
  }
  const memEndMb = getRssMb();
  const durationS = Math.round(((Date.now() - startMs) / 1000) * 100) / 100;

  const output = {
    nights: opts.nights,
    crashes,
    results,
    mem_start_mb: memStartMb !== null ? memStartMb : memEndMb,
    mem_end_mb: memEndMb,
    duration_s: durationS
  };

  const outPath = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log('Soak test complete:', JSON.stringify(output));
  process.exit(crashes === 0 ? 0 : 1);
}

main();
