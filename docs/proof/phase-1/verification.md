# Ma trận kiểm chứng & Bằng chứng nghiệm thu Phase 1

| Yêu cầu (AC) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| **AC-P1-01** Headless Contract v1.0 | Chạy `node src/headless.js` với tham số chuẩn | File `docs/proof/phase-1/pickup.jsonl` | ĐẠT |
| **AC-P1-02** Tính tất định (Determinism) | Chạy 2 lần cùng seed 123 và so sánh file hash | `docs/proof/phase-1/det1.jsonl` vs `det2.jsonl` (True) | ĐẠT |
| **AC-P1-03** Nhặt đom đóm | Chạy scenario `mote_pickup_scenario.json` | Event `mote_picked` xuất hiện ở tick 20 | ĐẠT |
| **AC-P1-04** Thắp đèn & Thắng | Chạy scenario `deposit_win_scenario.json` | Event `deposit`, `lantern_lit` & `game_over` ("won") | ĐẠT |
| **AC-P1-05** Tỏa sáng xua Bóng Mực | Unit test kích hoạt `pulse` khi có Bóng Mực | Event `pulse` trả về ID `S1` bị stunned | ĐẠT |
| **AC-P1-06** Giao diện 3D & HUD | Mở trên trình duyệt qua `server.js` | WebGL 3D canvas, hiển thị nón lá, đom đóm, đèn, HUD | ĐẠT |
