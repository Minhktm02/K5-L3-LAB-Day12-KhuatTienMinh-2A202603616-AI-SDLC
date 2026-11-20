const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');

const PROCESS_START_MS = Date.now();

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { seed: 42, duration: 30, out: 'bench.json' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed') parsed.seed = parseInt(args[++i], 10);
    else if (args[i] === '--duration') parsed.duration = parseFloat(args[++i]);
    else if (args[i] === '--out') parsed.out = args[++i];
  }
  if (isNaN(parsed.seed) || isNaN(parsed.duration) || parsed.duration <= 0 || !parsed.out) {
    console.error('Usage: node src/bench.js --seed <int> --duration <seconds> --out <file.json>');
    process.exit(1);
  }
  return parsed;
}

function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge'
    );
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Fallback via PATH
  const cmds = process.platform === 'win32'
    ? ['chrome', 'msedge']
    : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const c of cmds) {
    try {
      const found = execSync(process.platform === 'win32' ? `where ${c}` : `which ${c}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim().split(/\r?\n/)[0];
      if (found && fs.existsSync(found)) return found;
    } catch (_) {}
  }
  return null;
}

function sampleBrowserRssMbAsync(pid, cb) {
  if (!pid) return cb(null);
  if (process.platform === 'linux') {
    fs.readFile(`/proc/${pid}/status`, 'utf8', (err, status) => {
      if (err) return cb(null);
      const m = status.match(/VmRSS:\s+(\d+)\s+kB/);
      cb(m ? Math.round((parseInt(m[1], 10) / 1024) * 10) / 10 : null);
    });
  } else if (process.platform === 'darwin') {
    exec(`ps -o rss= -p ${pid}`, (err, out) => {
      if (err) return cb(null);
      const kb = parseInt(String(out).trim(), 10);
      cb(!isNaN(kb) ? Math.round((kb / 1024) * 10) / 10 : null);
    });
  } else if (process.platform === 'win32') {
    exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (err, out) => {
      if (err) return cb(null);
      const parts = String(out).trim().split('","');
      if (parts.length >= 5) {
        const kb = parseInt(parts[4].replace(/[^\d]/g, ''), 10);
        return cb(!isNaN(kb) ? Math.round((kb / 1024) * 10) / 10 : null);
      }
      cb(null);
    });
  } else {
    cb(null);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function main() {
  const opts = parseArgs();
  const browserPath = findBrowser();
  if (!browserPath) {
    console.error('Error: No Chromium-based browser (Chrome, Edge, Chromium) found. Set CHROME_PATH env var.');
    process.exit(1);
  }

  const rootDir = path.resolve(__dirname, '..');
  const tmpProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  let browserProc = null;
  let peakMemMb = null;
  let memTimer = null;
  let finished = false;

  function cleanup() {
    if (memTimer) clearInterval(memTimer);
    if (browserProc && !browserProc.killed) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${browserProc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          browserProc.kill('SIGTERM');
        }
      } catch (_) {}
    }
    try {
      fs.rmSync(tmpProfileDir, { recursive: true, force: true });
    } catch (_) {}
  }

  const server = http.createServer((req, res) => {
    const reqPath = req.url.split('?')[0];

    if (reqPath === '/__bench_done' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        if (finished) return;
        finished = true;

        try {
          const payload = JSON.parse(body);
          const result = {
            contract_version: '1.3',
            avg_fps: Math.round(payload.avg_fps * 10) / 10,
            p1_low_fps: Math.round(payload.p1_low_fps * 10) / 10,
            frame_ms_p95: Math.round(payload.frame_ms_p95 * 10) / 10,
            frames: payload.frames,
            load_ms: Math.round(payload.load_ms),
            peak_mem_mb: peakMemMb !== null ? Math.round(peakMemMb * 10) / 10 : null,
            vsync_off: true,
            renderer: payload.renderer || 'Three.js r128 WebGLRenderer',
            os: `${os.type()} ${os.release()} (${os.arch()})`
          };
          const outPath = path.resolve(opts.out);
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
          console.log('Benchmark complete:', JSON.stringify(result, null, 2));
        } catch (err) {
          console.error('Failed to write bench output:', err);
          cleanup();
          server.close(() => process.exit(1));
          return;
        }

        cleanup();
        server.close(() => process.exit(0));
      });
      return;
    }

    let fileRel = reqPath === '/' ? '/index.html' : reqPath;
    let filePath = path.join(rootDir, 'public', fileRel);
    if (fileRel.startsWith('/src/')) {
      filePath = path.join(rootDir, fileRel);
    } else if (fileRel === '/game.contract.json') {
      filePath = path.join(rootDir, 'game.contract.json');
    }

    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(content);
      }
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/?bench=1&seed=${opts.seed}&duration=${opts.duration}&startTs=${PROCESS_START_MS}`;

    const chromeArgs = [
      `--app=${url}`,
      '--window-size=1280,720',
      '--window-position=80,60',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      `--user-data-dir=${tmpProfileDir}`
    ];

    browserProc = spawn(browserPath, chromeArgs, {
      stdio: 'ignore',
      detached: false
    });

    memTimer = setInterval(() => {
      sampleBrowserRssMbAsync(browserProc.pid, m => {
        if (m !== null && (peakMemMb === null || m > peakMemMb)) {
          peakMemMb = m;
        }
      });
    }, 3000);

    // Safety timeout: warmup (3s) + duration + 30s grace
    const timeoutMs = (opts.duration + 35) * 1000;
    setTimeout(() => {
      if (!finished) {
        console.error('Benchmark timed out waiting for browser completion.');
        cleanup();
        server.close(() => process.exit(1));
      }
    }, timeoutMs).unref();

    browserProc.on('exit', code => {
      if (!finished) {
        console.error(`Browser exited prematurely with code ${code}`);
        cleanup();
        server.close(() => process.exit(1));
      }
    });
  });
}

main();
