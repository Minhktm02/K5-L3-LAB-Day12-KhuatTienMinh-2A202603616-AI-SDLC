# AI Agents & Harness Guidelines: Đảo Đèn Lồng

## Build, Run & Test Commands
- **Install / Build:** `npm install`
- **Run Game (3D Web UI):** `npm start` (Mở trình duyệt: `http://localhost:3000`)
- **Run Headless Test Contract:** 
  `node src/headless.js --seed <int> --night 1 [--scenario <file>] [--inputs <file>] --ticks <n> --out <file.jsonl>`
- **Run Test Suite:** `npm test`

## Test Contract Rules (Non-negotiable)
1. **Headless Execution:** Game logic must run at a fixed 60 ticks/second without window or GPU dependencies.
2. **Determinism:** Identical `--seed`, scenario, and inputs MUST produce bit-for-bit identical JSONL output.
3. **Exit Codes:** Clean termination -> 0, General errors -> non-zero, Invalid scenario/inputs format -> 2.
4. **Events & Snapshot:** Adhere strictly to the `game.contract.json` spec and schema.
5. **No Hallucination:** Never invent new attributes that alter headless JSONL contract output.
