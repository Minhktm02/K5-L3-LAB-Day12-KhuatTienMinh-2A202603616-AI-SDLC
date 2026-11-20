# Phase 1 Specification & Assumptions: Đảo Đèn Lồng (PRD-0)

## 1. Mục tiêu
Xây dựng Đêm 1 – Đảo Bến: Màn chơi 3D hòn đảo tròn bán kính 40m với 5 Đèn Lồng Lớn, nhân vật Mây thu thập đom đóm thắp sáng đèn và né tránh/xua đuổi Bóng Mực.

## 2. Tiêu chí nghiệm thu (Acceptance Criteria)
- **AC-P1-01:** Chạy chế độ headless đúng định dạng Test Contract v1.0, không lỗi khi chạy với các seed khác nhau.
- **AC-P1-02 (Tính tất định):** Hai lần chạy cùng `--seed`, `--scenario`, `--inputs` tạo ra file `.jsonl` giống hệt nhau (hash trùng khớp).
- **AC-P1-03 (Nhặt đom đóm):** Khi Mây di chuyển vào bán kính `pickup_radius` (2.0m), số đom đóm mang theo tăng lên đến tối đa `carry_capacity` (5).
- **AC-P1-04 (Thắp đèn):** Phím `interact` ('E') nạp đom đóm vào đèn lồng trong bán kính `interact_radius` (3.0m). Đủ 3 đom đóm đèn sáng (`lantern_lit`).
- **AC-P1-05 (Xua đuổi Bóng Mực):** Phím `pulse` tiêu tốn 1 đom đóm làm choáng (`stunned`) và đẩy lùi Bóng Mực trong bán kính 6.0m.
- **AC-P1-06 (Thắng/Thua):** Thắp đủ 5 đèn -> Thắng (`all_lit`). Hết máu (3 ngọn lửa) hoặc hết thời gian (300s) -> Thua (`no_flames` / `dawn`).

## 3. Các giả định kỹ thuật
- Vận tốc di chuyển của Mây: 6.0 m/s.
- Vận tốc di chuyển của Bóng Mực: 3.5 m/s.
- Đảo Bến có bán kính 40m. Khi rơi khỏi đảo, Mây bị trừ 1 ngọn lửa, rơi 50% số đom đóm mang theo và hồi sinh tại gốc đảo [0,0,0].
- Vùng an toàn quanh đèn đã thắp: Bán kính 5m Bóng Mực không thể tiếp cận.
