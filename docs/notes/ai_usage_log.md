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
