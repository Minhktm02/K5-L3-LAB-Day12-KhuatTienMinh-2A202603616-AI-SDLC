# Nhật ký sử dụng AI & Ước tính chi phí (AI Usage Log)

## 1. Công cụ & Model
- **Phase 1:** Antigravity AI Agent (Gemini 3.8 Flash)
- **Phase 2:** Antigravity AI Agent (Gemini 4 Argon)
- **Orchestration:** AI SDLC Workflow (Requirements -> Plan -> Build -> Verify -> Evaluate -> Tag)

## 2. Thống kê Token & Tối ưu chi phí theo Phase

| Phase | Ước tính Token | Chi phí ước tính | Chiến lược tiết kiệm Token |
|---|---:|---:|---|
| **Phase 1 (PRD-0)** | ~35,000 tokens | ~$0.015 | Tách biệt `GameEngine` và `headless.js`; gom lệnh đọc/ghi file theo batch. |
| **Phase 2 (Ticket-02)** | ~55,000 tokens | ~$0.030 | Dùng chung 1 file `src/gameEngine.js` cho cả Node.js headless và trình duyệt 3D (`window.GameEngine`), loại bỏ hoàn toàn việc viết lặp logic 2 nơi và tránh sai lệch giữa UI và Test Contract v1.1. |

## 3. Nhật ký phát hiện lỗi AI & Cải tiến Harness
- **Phase 1 — Lỗi đường dẫn CWD:** Lần đầu gọi `node src/headless.js` từ thư mục cha thay vì thư mục gốc của repo.
  - *Khắc phục:* Cập nhật `AGENTS.md` ghi rõ các lệnh chạy từ gốc repo.
- **Phase 2 — Lỗi tự kiểm thử (Off-by-one / Input tiếp diễn sau hồi sinh):**
  - *Phát hiện:* Khi viết test số 9 (`Fall off Island & Respawn`), script test giữ nguyên `move: [1, 0]` suốt 150 tick khiến nhân vật sau khi chờ 60 tick và hồi sinh tại `(0,0,0)` tiếp tục đi thêm 27 tick (`2.7 m`), làm trượt assert `pos[0] === 0`.
  - *Khắc phục:* Sửa input trong test dừng di chuyển sau khi sự kiện `player_hit (by: fall)` nổ ra để kiểm chứng chính xác vị trí hồi sinh `(0,0,0)` và trạng thái bất tử `90 tick`.
  - *Cải tiến Harness:* Bổ sung skill `.agents/skills/verify-contract/SKILL.md` và cập nhật `AGENTS.md` với quy trình 12 bước tick bắt buộc của Contract v1.1.

## Phase 3 (Ticket-03, Contract v1.2)
- Model: Claude Sonnet 5.5 (via Antigravity). Est. ~70k tokens (~$0.05). Saved tokens by editing only the touched engine sections and reusing the single shared engine for headless + browser.
- AI mistakes found by self-review: (1) an edit dropped the closing braces of the scenario shades loop (syntax break) - caught by re-reading the file and fixed before running; (2) an edit removed `invuln:` from the snapshot and a colour line in the UI - caught by diff review and restored; (3) my first refuel test assumed a lit lantern stays full between ticks - wrong because decay runs before interaction; test corrected and the behaviour documented in ADR-0001.
- Harness change: AGENTS.md now lists the v1.2 deltas and the rule 'never skip a test, remove with reason'; verify-contract skill updated to 17 checks.

## Phase 4 (Ticket-04, Contract v1.3 — v1.0.0)
- Model: Gemini (via Antigravity). Est. ~55k tokens (~$0.04).
- Saved tokens by batching independent file writes (`leaderboard.js`, `server.js`, `soak.js`, `bench.js`) and running `npm test`, `npm run soak`, and `npm run bench` in parallel.
- AI mistakes / issues caught by real execution:
  1. Initial soak test had `mem_start_mb: 40.2` → `mem_end_mb: 50.2` (1.25x > 1.2x) due to cold V8 JIT compilation during Night 1; fixed by adding a brief 3-night V8 JIT warmup before Night 1 (`46.1 MB → 53.4 MB`, 1.158x <= 1.2x).
  2. Initial 3D benchmark had `p1_low_fps: 21.1` on Intel HD 4600 due to synchronous `execSync('tasklist')` every 1s, unused `shadowMap.enabled = true`, and per-frame DOM mutations; fixed with async RSS polling, disabling unused shadow map, and static warmup/measuring labels (`avg_fps: 110.2`, `p1_low_fps: 35.6`, `load_ms: 2241 ms`).
  3. Changed `run_cmd` from `npm start` to `node server.js` so `<run_cmd> --export-leaderboard out.json` works directly without npm swallowing CLI flags.
- Harness update: updated `AGENTS.md` for Contract v1.3 and expanded `tests/run_tests.js` to 19/19 passing tests.
