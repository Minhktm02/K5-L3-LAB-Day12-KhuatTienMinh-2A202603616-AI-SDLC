const fs = require('fs');
const http = require('http');
const path = require('path');
const leaderboard = require('./src/leaderboard');

// Handle CLI flags before starting HTTP server
const args = process.argv.slice(2);
const exportIdx = args.indexOf('--export-leaderboard');
if (exportIdx !== -1) {
  const outFile = args[exportIdx + 1];
  if (!outFile) {
    console.error('Usage: node server.js --export-leaderboard <out.json>');
    process.exit(1);
  }
  leaderboard.exportLeaderboard(outFile);
  process.exit(0);
}

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const reqPath = req.url.split('?')[0];

  // Leaderboard API
  if (reqPath === '/api/leaderboard') {
    if (req.method === 'GET') {
      const data = leaderboard.loadLeaderboard();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }
    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const payload = JSON.parse(raw || '{}');
        const updated = leaderboard.addEntry(payload);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(updated));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  let fileRel = reqPath === '/' ? '/index.html' : reqPath;
  let filePath = path.join(__dirname, 'public', fileRel);
  if (fileRel.startsWith('/src/')) {
    filePath = path.join(__dirname, fileRel);
  } else if (fileRel === '/game.contract.json') {
    filePath = path.join(__dirname, 'game.contract.json');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Đảo Đèn Lồng Game server running at http://localhost:${PORT}`);
});
