# Ma trận kiểm chứng & Bằng chứng nghiệm thu Phase 2 (Contract v1.1)

| Mã AC | Yêu cầu | Cách kiểm chứng | Bằng chứng (`docs/proof/phase-2/`) | Kết quả |
|---|---|---|---|---|
| **AC-P1-REG** | Hồi quy Phase 1 với số chuẩn v1.1 | Chạy scenario nhặt đom đóm & nạp đủ 10 đom đóm thắng Đêm 1 | `pickup.jsonl`, `win.jsonl`, `det1.jsonl`, `det2.jsonl` | **ĐẠT** |
| **AC-P2-01** | Cơ chế Lướt (Dash 14m/s, 12 tick, CD 1.5s) | Chạy `dash_scenario.json` + `dash_inputs.json` | `dash.jsonl` (`pos[2] = 2.8m` tại tick 12, event `dash`) | **ĐẠT** |
| **AC-P2-02** | Đêm 2 Đảo Cau & Bục nhảy xuyên đảo | Chạy `--night 2` với `jumppad_night2_scenario.json` | `jumppad_n2.jsonl` (bay từ đảo A đáp xuống đảo B `grounded: true`) | **ĐẠT** |
| **AC-P2-03** | Đêm 3 Đảo Chuông (3 tầng, bục nhảy, gió mạnh) | Chạy `--night 3` với `night3_tier_scenario.json` & benchmark | `night3_tier.jsonl` (đáp lên tầng 2 `Y=6`), `bench_night3.jsonl` | **ĐẠT** |
| **AC-P2-04** | Gió Lạc (Drifter) cướp & rơi đom đóm khi trúng Pulse | Chạy `drifter_scenario.json` + `drifter_inputs.json` | `drifter.jsonl` (events `drifter_steal` & `drifter_drop`) | **ĐẠT** |
| **AC-P2-05** | Bùa Gió (Wind Charm) tăng tốc & xóa hồi chiêu Lướt | Chạy `charm_scenario.json` + `charm_inputs.json` | `charm.jsonl` (event `charm_picked`, lướt 2 lần liên tiếp) | **ĐẠT** |
| **AC-P2-06/07** | Tạm dừng (`paused`/`resumed`), Chuỗi 3 Đêm, Cài đặt | Chạy `pause_inputs.json` & kiểm tra UI Web 3D | `pause.jsonl` (`state: "paused"`, `sim_tick` dừng ở 5) | **ĐẠT** |
| **AC-P2-08** | HUD đầy đủ, Âm thanh WebAudio, Bảng màu chuẩn | Kiểm tra trực tiếp trên `public/index.html` | Đủ 10 SFX + BGM, mã màu Hex chuẩn, mũi tên chỉ hướng đèn | **ĐẠT** |
| **AC-P2-09** | Rơi khỏi đảo (`Y < -10`) & chờ 60 tick hồi sinh | Unit test `Fall off Island & Respawn` trong `run_tests.js` | Event `player_hit` (`by: "fall", lost: 4`), hồi sinh tại `(0,0,0)` | **ĐẠT** |
| **AC-P2-10** | Hiệu năng Headless (21.600 tick <= 30s) | Đo thời gian chạy `21.600 tick` Đêm 3 trong `run_tests.js` | `bench_night3.jsonl` (Hoàn thành trong `< 200 ms`, nhanh gấp 150 lần ngưỡng 30s) | **ĐẠT** |
