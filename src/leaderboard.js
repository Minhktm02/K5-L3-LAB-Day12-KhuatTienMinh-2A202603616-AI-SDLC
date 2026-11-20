const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const LB_PATH = path.join(DATA_DIR, 'leaderboard.json');

// 3-12 characters: ASCII alphanumeric, underscore, or Vietnamese letters
const NAME_REGEX = /^[A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]{3,12}$/;

function formatLocalISO(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOff = Math.abs(offsetMin);
  const offH = pad(Math.floor(absOff / 60));
  const offM = pad(absOff % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offH}:${offM}`;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = Date.parse(a.achieved_at) || 0;
    const tb = Date.parse(b.achieved_at) || 0;
    return ta - tb; // earlier achieved_at ranks higher on tie
  });
}

function loadLeaderboard(filePath = LB_PATH) {
  try {
    if (!fs.existsSync(filePath)) return { entries: [] };
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    return { entries: sortEntries(entries).slice(0, 10) };
  } catch (err) {
    return { entries: [] };
  }
}

function saveLeaderboard(data, filePath = LB_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const sorted = { entries: sortEntries(data.entries || []).slice(0, 10) };
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  return sorted;
}

function validateName(name) {
  if (typeof name !== 'string') return false;
  return NAME_REGEX.test(name.trim());
}

function addEntry({ name, score, nights_won, seed, achieved_at }, filePath = LB_PATH) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!validateName(cleanName)) {
    throw new Error('Tên phải dài 3-12 ký tự (chữ cái, số hoặc dấu gạch dưới _).');
  }
  const numScore = Number.isFinite(Number(score)) ? Math.max(0, Math.floor(Number(score))) : 0;
  const numNights = Number.isFinite(Number(nights_won)) ? Math.max(0, Math.min(3, Math.floor(Number(nights_won)))) : 0;
  const numSeed = Number.isFinite(Number(seed)) ? (Number(seed) >>> 0) : 42;
  const timestamp = achieved_at && !isNaN(Date.parse(achieved_at)) ? achieved_at : formatLocalISO(new Date());

  const current = loadLeaderboard(filePath);
  current.entries.push({
    name: cleanName,
    score: numScore,
    nights_won: numNights,
    achieved_at: timestamp,
    seed: numSeed
  });
  return saveLeaderboard(current, filePath);
}

function exportLeaderboard(outPath, filePath = LB_PATH) {
  const data = loadLeaderboard(filePath);
  const resolved = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return data;
}

module.exports = {
  LB_PATH,
  NAME_REGEX,
  validateName,
  formatLocalISO,
  sortEntries,
  loadLeaderboard,
  saveLeaderboard,
  addEntry,
  exportLeaderboard
};
