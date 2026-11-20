# 🏮 Đảo Đèn Lồng — Ba Hòn Đảo (v1.0.0)

> **Video Demo:** Đính kèm trong [GitHub Release v1.0.0](https://github.com/Minhktm02/K5-L3-LAB-Day12-KhuatTienMinh-2A202603616-AI-SDLC/releases/tag/v1.0.0) (hoặc `docs/demo/demo.mp4` sau khi quay màn hình).  
> **Tác giả:** Khuất Tiến Minh (`2A202603616`) · **Test Contract:** `v1.3` · **License:** [MIT](LICENSE)

**Đảo Đèn Lồng** là game phiêu lưu hành động 3D góc nhìn thứ ba xây dựng bằng **Three.js + Node.js**. Bạn vào vai **Mây**, người giữ đèn nhỏ tuổi đội nón lá, thu thập đom đóm để thắp sáng và châm dầu giữ lửa cho các Đèn Lồng Lớn qua **3 Đêm** (*Đảo Bến*, *Đảo Cau*, *Đảo Chuông*), đẩy lùi **Bóng Mực** và **Gió Lạc** cho tới khi bình minh lên.

---

## Yêu cầu hệ thống
- **Node.js** `>= 18` (không cần cài thêm gói npm ngoài; Three.js r128 được đóng gói sẵn tại `public/lib/three.min.js`).
- Trình duyệt hỗ trợ **WebGL** (Chrome, Edge, Chromium, Firefox, Safari).
- Để chạy chế độ **Benchmark** (`src/bench.js`), cần có trình duyệt nền Chromium (`Google Chrome`, `Microsoft Edge`, hoặc `Chromium`; có thể chỉ định qua biến môi trường `CHROME_PATH`).

---

## Cài đặt & Chạy nhanh (≤ 3 lệnh từ repo sạch)

```bash
git clone https://github.com/Minhktm02/K5-L3-LAB-Day12-KhuatTienMinh-2A202603616-AI-SDLC.git
cd K5-L3-LAB-Day12-KhuatTienMinh-2A202603616-AI-SDLC
node server.js
```

Mở trình duyệt tại **`http://localhost:3000`** và bấm **BẮT ĐẦU (ĐÊM 1)** để chơi!

---

## Điều khiển mặc định (có thể đổi phím trong Cài đặt)

| Hành động | Phím mặc định | Mô tả |
|---|---|---|
| Di chuyển | `W` `A` `S` `D` (hoặc phím mũi tên) | Chạy 6.0 m/s, điều khiển đầy đủ trên không |
| Xoay camera | Di chuyển chuột (nhấp vào màn hình để khóa chuột) | Camera góc nhìn thứ ba xoay tự do |
| Nhảy | `Space` | Nhảy 7.0 m/s khi chạm đất |
| Lướt (Dash) | `Shift` | Lướt 14 m/s trong 0.2s (hồi chiêu 1.5s; 0s khi có Bùa Gió) |
| Tương tác | `E` | Nạp đom đóm vào đèn tắt (10 mới / 5 thắp lại) hoặc châm dầu đèn đang sáng |
| Tỏa Sáng | `F` | Tốn 3 đom đóm, làm choáng & đẩy lùi Bóng Mực trong 5m (hồi chiêu 3s) |
| Tạm dừng | `Esc` | Mở menu tạm dừng & cài đặt |

### Tính năng Dễ tiếp cận (Accessibility)
- **Đổi phím toàn bộ 9 hành động**, tự động phát hiện trùng phím, có nút **Khôi phục mặc định**, lưu lâu dài.
- **Phụ đề & chỉ báo hình ảnh:** cảnh báo Bóng Mực xuất hiện kèm **mũi tên chỉ hướng ở mép màn hình**, cảnh báo gió mạnh, đếm ngược 10 giây cuối, và cảnh báo đèn yếu dầu (`< 30`).
- **Giảm chuyển động:** tắt rung camera, chớp màn hình và hiệu ứng nhấp nháy.
- **Cỡ chữ UI tối thiểu 18 px** ở độ phân giải 1280×720, kèm tùy chọn **Chữ lớn (×1.25)**.
- **Bảng màu dễ phân biệt (mù màu):** chuyển viền Bóng Mực sang `#00B3FF`, cảnh báo sang `#FFFFFF` + `⚠`, kết hợp hình dạng rách giấy ở đèn tắt.

---

## Chạy Test, Headless, Benchmark, Soak & Xuất Bảng Xếp Hạng

| Chức năng | Lệnh |
|---|---|
| **Bộ test tự động (19/19 tests)** | `npm test` |
| **Chế độ Headless (Contract v1.3)** | `node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl` |
| **Benchmark 3D (1280×720, 30s)** | `node src/bench.js --seed 42 --duration 30 --out bench.json` |
| **Soak Test (10 Đêm liên tiếp)** | `node src/soak.js --seed 7 --nights 10 --out soak.json` |
| **Xuất Bảng Xếp Hạng cục bộ** | `node server.js --export-leaderboard out.json` |

> **Lưu ý VSync khi chạy Benchmark:** `src/bench.js` mở cửa sổ Chromium/Edge 1280×720 không toàn màn hình với cờ `--disable-gpu-vsync --disable-frame-rate-limit` (`vsync_off: true`). Nếu trình duyệt hoặc driver GPU trên máy chấm bỏ qua cờ này và khóa theo tần số quét màn hình, hãy chạy kèm `CHROME_PATH` trỏ tới Chromium hỗ trợ tắt VSync.

### Kết quả đo tham khảo (đã commit trong `bench.json` & `soak.json`)
- **Benchmark (Intel HD Graphics 4600, Windows 10 x64):** `avg_fps: 110.2` (≥ 60) · `p1_low_fps: 35.6` (≥ 30) · `frame_ms_p95: 16 ms` · `load_ms: 2241 ms` (≤ 10000) · `peak_mem_mb: 181.2 MB`.
- **Soak Test (10 Đêm, seed 7):** `crashes: 0` · `mem_start_mb: 46.1 MB` → `mem_end_mb: 53.4 MB` (`1.16× ≤ 1.2×`) · `duration_s: 0.61 s`.

---

## Sáng tạo của tôi
- **Bối cảnh & nhân vật thuần Việt:** Mây đội nón lá, quàng khăn đỏ, cầm đèn lồng nhỏ cùng lời dẫn chuyện của Ông Đăng qua ba hòn đảo *Đảo Bến*, *Đảo Cau* và *Đảo Chuông*.
- **Âm thanh tổng hợp thời gian thực (Web Audio API):** 10 hiệu ứng âm thanh + nhạc nền ngũ cung ban đêm được sinh trực tiếp bằng oscillator, không dùng file âm thanh nặng bên ngoài.
- **Hiệu năng tối ưu bằng `THREE.InstancedMesh`:** Gom toàn bộ Bóng Mực và Đom Đóm vào 2 draw call duy nhất, giúp giữ > 100 FPS ngay cả với 200 Bóng Mực + 100 Đom Đóm trên GPU tích hợp.
- **Bảng xếp hạng hỗ trợ tên tiếng Việt có dấu** (3–12 ký tự) lưu bền vững trên đĩa cục bộ (`data/leaderboard.json`).

---

## Tài liệu dự án
- [CHANGELOG.md](CHANGELOG.md) — Lịch sử thay đổi đầy đủ qua cả 4 Phase
- [CREDITS.md](CREDITS.md) — Nguồn thư viện, đồ họa, âm thanh & công cụ AI
- [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md) — ADR thay đổi luật cốt lõi Phase 3
- [docs/retro.md](docs/retro.md) — Bản tổng kết Retrospective 4 Phase & tối ưu token
- [docs/notes/ai_usage_log.md](docs/notes/ai_usage_log.md) — Nhật ký dùng AI & chi phí ước tính
- [docs/proof/](docs/proof/) — Bằng chứng kiểm chứng của Phase 1, 2, 3 và 4
- [AGENTS.md](AGENTS.md) & [.agents/skills/verify-contract/SKILL.md](.agents/skills/verify-contract/SKILL.md) — Harness AI
