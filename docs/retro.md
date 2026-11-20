# Retrospective — Đảo Đèn Lồng (Day 12 AI SDLC Lab)

**Tác giả:** Khuất Tiến Minh (`2A202603616`)  
**Dự án:** Đảo Đèn Lồng — Game 3D Ba Hòn Đảo (Phase 1 → Phase 4, Release `v1.0.0`)

---

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Mục tiêu chính | Contract | Kết quả kiểm chứng | Điểm đạt / Hạn chế |
|---|---|---|---|---|
| **Phase 1** | Core Đêm 1 (Đảo Bến), headless determinism, 3D WebGL UI | `v1.0` | 4/4 test pass, determinism 100% | Đạt toàn bộ lõi; điều khiển camera còn cơ bản |
| **Phase 2** | Chuẩn hóa số liệu, 3 Đêm (Đảo Bến/Cau/Chuông), Lướt, Gió Lạc, Bùa Gió, âm thanh WebAudio | `v1.1` | 9/9 test pass, 21.600 tick ~140 ms | Phát hiện & sửa lỗi ngược phím A/D và Pointer Lock chuột khi playtest |
| **Phase 3** | Change Request "Đèn cạn dầu": nhiên liệu 1/60 nguyên, Bóng Mực hút dầu (`drain`), luật thắng bình minh, ADR-0001 | `v1.2` | 17/17 test pass, 0 test skip | Thay thế sạch luật thắng cũ bằng `dawn_win_scenario.json`, cập nhật đầy đủ UI & chế độ mù màu |
| **Phase 4** | Benchmark 3D 1280×720, Soak test 10 Đêm, Bảng xếp hạng cục bộ, Dễ tiếp cận, Đóng gói `v1.0.0` | `v1.3` | 19/19 test pass, `bench.json` & `soak.json` đạt ngưỡng | Tối ưu `InstancedMesh` giúp giữ FPS cao trên Intel HD 4600; cần quay/đính kèm video demo thực tế trên máy có màn hình |

---

## 2. Điều gì hiệu quả và không hiệu quả khi làm việc với AI

### Hiệu quả
- **Kiến trúc dùng chung engine (`src/gameEngine.js`) cho cả Node.js headless và trình duyệt Three.js:** Mọi thay đổi luật ở Phase 2 và Change Request ở Phase 3 chỉ cần sửa một nơi duy nhất, tránh hoàn toàn lệch logic giữa bản chấm tự động và bản chơi thật.
- **Test-first với scenario JSON cố định:** Viết test tự động (`tests/run_tests.js`) và chạy ngay sau mỗi lần sửa giúp phát hiện sai lệch ngay lập tức (thứ tự 12 bước trong tick, ngưỡng biên `fuel == 30`, ưu tiên `no_flames` hơn `dawn`).
- **Tài liệu hóa quyết định (ADR-0001):** Khi Ticket-03 thay thế luật cốt lõi, việc viết ADR trước khi sửa code giúp AI bám sát quyết định dùng số nguyên `1/60` cho `fuel_u` để tránh sai số dấu phẩy động.

### Không hiệu quả
- **Dựa hoàn toàn vào đánh giá lý thuyết cho cảm giác điều khiển (controls/camera):** AI sinh mã di chuyển đúng công thức toán học nhưng ngược trục trái/phải (`A`/`D`) so với góc nhìn người chơi, và thiếu Pointer Lock cho chuột. Chỉ khi người chơi mở trình duyệt chạy thử mới phát hiện ra.
- **Đặt `run_cmd` là `npm start` ở Phase 1–3:** Đến Phase 4 khi cần `<run_cmd> --export-leaderboard out.json`, `npm start` nuốt flag nếu thiếu `--`. Phải đổi sang `node server.js` trong `game.contract.json`.

---

## 3. Những lần AI sai và cách phát hiện

1. **Ngược phím `A`/`D` và lỗi phạm vi biến `camPitch` (Phase 2):**
   - *Phát hiện:* Người dùng trực tiếp playtest trên trình duyệt và gửi ảnh chụp màn hình camera kẹt giữa đảo.
   - *Khắc phục:* Đảo dấu `mx` cho `A`/`D`, đưa `camPitch` lên phạm vi toàn cục và bổ sung Pointer Lock.
2. **Test `respawn` gửi input di chuyển sau khi hồi sinh (Phase 2):**
   - *Phát hiện:* `npm test` báo lỗi assertion vị trí sau hồi sinh không còn ở `(0,0,0)`.
   - *Khắc phục:* Ngừng gửi `move: [1,0]` sau sự kiện `player_hit (fall)` trong test.
3. **Test `refuel` giả định đèn giữ nguyên 100% nhiên liệu giữa các tick (Phase 3):**
   - *Phát hiện:* `npm test` thất bại vì bước 2 (trừ hao dầu `1/60`) chạy trước bước 5 (tương tác).
   - *Khắc phục:* Cập nhật kỳ vọng test khớp chính xác thứ tự 12 bước của Contract v1.2 và ghi vào ADR-0001.
4. **Soak test ban đầu vượt ngưỡng bộ nhớ `1.2x` (`40.2 MB → 50.2 MB`) và Benchmark có 1% low FPS thấp (`21.1 FPS`) (Phase 4):**
   - *Phát hiện:* Chạy thật `soak.js` và `bench.js` trên máy, kiểm tra trực tiếp `soak.json` và `bench.json`.
   - *Khắc phục:* Thêm V8 JIT warmup trước khi đo `mem_start_mb` trong `soak.js`; chuyển `tasklist` trong `bench.js` sang bất đồng bộ, tắt `shadowMap` không dùng và bỏ cập nhật DOM mỗi khung hình trong vòng lặp benchmark.

---

## 4. Harness AI nào giúp ích nhiều nhất

- **`AGENTS.md`:** Hữu ích nhất. Ghi rõ kiến trúc shared engine, thứ tự 12 bước của tick, cấm tắt/skip test, và yêu cầu chạy `npm test` trước mọi tag. Nhờ có `AGENTS.md`, sau mỗi lần nén ngữ cảnh (context compaction) AI vẫn giữ đúng quy chuẩn mà không phá vỡ code cũ.
- **Skill `.agents/skills/verify-contract/SKILL.md`:** Chuẩn hóa danh mục kiểm tra Contract (schema JSONL, determinism, số liệu chuẩn, hiệu năng), giảm hẳn việc quên trường bắt buộc trong snapshot/event.

---

## 5. Ước tính Token / Chi phí AI & Cách tiết kiệm Token

- **Ước tính tổng sử dụng qua 4 Phase:** ~180.000–240.000 token đầu vào (bao gồm ngữ cảnh đọc file & lịch sử hội thoại) và ~35.000–45.000 token đầu ra (mã nguồn, test, tài liệu). Chi phí quy đổi ước tính khoảng **\$0.35 – \$0.65 USD** (tính theo mức giá trung bình của mô hình Gemini Flash/Pro hiện tại).
- **Cách đã tiết kiệm token:**
  - Gom nhiều thao tác đọc/sửa độc lập vào cùng một lượt (batch tool calls).
  - Đọc đúng dải dòng cần sửa thay vì đọc lại toàn bộ file 1.500 dòng nhiều lần.
  - Dùng `edit_file` cục bộ thay vì ghi đè toàn bộ file khi thay đổi nhỏ.
  - Chạy kiểm chứng gom cụm (`npm test ; npm run soak`) trong một lệnh shell duy nhất.

---

## 6. Nếu làm lại từ đầu thì sẽ đổi gì?

1. **Tách `public/index.html` thành các module JS/CSS nhỏ ngay từ Phase 1** (`renderer.js`, `hud.js`, `audio.js`, `settings.js`) thay vì dồn 1.500+ dòng vào một file HTML duy nhất — giúp review, sửa lỗi và tiết kiệm token hơn nhiều.
2. **Dùng `THREE.InstancedMesh` và bundle Three.js cục bộ ngay từ Phase 1** để đảm bảo chạy offline nhanh và hiệu năng ổn định từ sớm.
3. **Đặt `run_cmd` là `node server.js` ngay từ đầu** và thiết kế CLI chuẩn hỗ trợ cờ truyền vào mà không đi qua `npm start`.
