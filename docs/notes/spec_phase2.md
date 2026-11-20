# Phase 2 Specification & Acceptance Criteria (TICKET-02 — "Ba hòn đảo")

## 1. Đồng bộ số liệu chuẩn & Thứ tự xử lý 12 bước
- Mọi hằng số trong `game.contract.json` (Contract v1.1) khớp 100% với Bảng số liệu chuẩn Phần 1.
- Vòng lặp 60 tick/giây tuân thủ nghiêm ngặt 12 bước từ Đọc input (Pause) đến Ghi Snapshot.

## 2. Tiêu chí nghiệm thu (Acceptance Criteria) cho từng mục ở Phần 2 & Phần 3

| Mã AC | Tính năng | Tiêu chí nghiệm thu kiểm chứng được |
|---|---|---|
| **AC-P2-01** | **Lướt (Dash)** | Nhấn `dash` khi không đang lướt và hết hồi chiêu: Mây lướt với tốc độ `14 m/s` trong `0.2 s` (`12 tick`, đi được `2.8 m`), giữ nguyên độ cao trên không, hồi chiêu `1.5 s` tính từ lúc bắt đầu lướt, phát sự kiện `dash {}`. |
| **AC-P2-02** | **Đêm 2 — Đảo Cau & Bục nhảy** | Hai đảo bán kính `28 m` tại `(0,0,0)` và `(70,0,0)` nối bằng cầu tre `x ∈ [26,44], z ∈ [-2,2]`. Chạm bục nhảy tại `(20,0,18)` hoặc `(50,0,-18)` bắn Mây lên với `vel_y = 14 m/s`, vận tốc ngang `24 m/s` hướng về tâm đảo kia, giữ tới khi chạm đất và đáp an toàn trong đảo đích. |
| **AC-P2-03** | **Đêm 3 — Đảo Chuông (3 tầng, dốc, gió mạnh)** | Đảo bán kính `45 m` có 3 tầng (`Y=0`, `Y=3`, `Y=6`), 2 dốc rộng `3 m` ở góc `30°` và `150°`, tháp chuông bán kính `2 m` ở tâm tầng 2, bục nhảy `(0,3,13)` đáp lên tầng 2 (`Y=6`). Mỗi `30 s` có gió mạnh `5 s` đẩy người chơi `2 m/s`. |
| **AC-P2-04** | **Gió Lạc (Drifters)** | Sinh tại tick `1200, 2400, ...` (Đêm 2 & 3, tối đa 2 con). Khi Mây mang `>= 5` đom đóm và cách `<= 15 m`, chuyển từ `idle` (`2 m/s`) sang `chase` (`7 m/s`). Chạm (`XZ <= 1.2 m`) cướp `min(3, đang mang)`, phát `drifter_steal`, chuyển sang `flee` trong `240 tick`. Trúng Tỏa Sáng khi đang `flee` mang đồ sẽ thả lại toàn bộ thành đom đóm rơi (`drifter_drop`) và biến mất sau `120 tick`. |
| **AC-P2-05** | **Bùa Gió (Wind Charm)** | Nhặt tại `(35,0,0)` ở Đêm 2 hoặc `(±30,0,25)` ở Đêm 3 (`XZ <= 1.0 m, dY <= 1.5 m`): phát `charm_picked`, hiệu lực `600 tick` tăng tốc chạy lên `7.2 m/s` và xóa hồi chiêu Lướt (`0 s`). Hồi lại sau `2700 tick`. |
| **AC-P2-06** | **Chuỗi 3 Đêm & Màn hình Bình Minh** | Luồng giao diện: Menu chính -> Giới thiệu Đêm (tên đảo, lời Ông Đăng) -> Chơi -> Kết quả -> Đêm kế tiếp. Thắng Đêm 3 hiện màn hình Bình Minh với tổng điểm 3 Đêm; thua được chơi lại Đêm đó. |
| **AC-P2-07** | **Tạm dừng (Pause) & Cài đặt** | Nhấn `Esc` hoặc `P` dừng hoàn toàn logic (`sim_tick`, thời gian, hồi chiêu đứng yên, snapshot ghi `state: "paused"`, phát sự kiện `paused {}` / `resumed {}`). Menu tạm dừng có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Cài đặt âm lượng và độ nhạy chuột lưu vào `localStorage`. |
| **AC-P2-08** | **Âm thanh, HUD đầy đủ & Bảng màu chuẩn** | Có nhạc nền đêm và đủ 10 hiệu ứng âm thanh (Web Audio API). HUD có Ngọn Lửa (trên trái), đồng hồ `mm:ss` nhấp nháy đỏ khi `<= 30 s` (trên giữa), đèn `k/n` và điểm (trên phải), thanh 10 ô đom đóm (dưới giữa), hồi chiêu Lướt & Tỏa Sáng (dưới phải), nhắc `"E — Nạp ánh sáng (x/10)"` và mũi tên chỉ đèn chưa sáng gần nhất ở ngoài màn hình. Ánh sáng môi trường `= 0.15 + 0.55 * (đèn sáng / tổng đèn)`. |
| **AC-P2-09** | **Rơi khỏi đảo (`Y < -10`) & Hồi sinh** | Rơi xuống `Y < -10` trừ 1 Ngọn Lửa, mất toàn bộ đom đóm (`player_hit` có `by: "fall", lost: n`), chờ `60 tick` rồi hồi sinh tại `(0,0,0)` với bất tử `90 tick`. |
| **AC-P2-10** | **Hiệu năng Headless & 3D** | Chạy headless 1 Đêm đầy đủ (`21.600 tick`) hoàn thành trong `<= 30 giây` (thực tế `~80 ms`). Bản 3D đạt `60 FPS` (`>= 30 FPS`) ở `1280×720`. |
