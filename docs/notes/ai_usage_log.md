# Nhật ký sử dụng AI & Ước tính chi phí (AI Usage Log)

## 1. Công cụ & Model
- **Coding Assistant:** Antigravity AI Agent (Gemini 3.8 Flash)
- **Orchestration:** AI SDLC Workflow (Plan -> Build -> Test -> Verify)

## 2. Thống kê Token & Tối ưu chi phí
- **Phase 1 Tokens ước tính:** ~35,000 tokens (Context, Spec, Engine, 3D Canvas, Test verification).
- **Chi phí ước tính:** ~$0.015 USD.
- **Chiến lược tiết kiệm token:**
  - Gom các tác vụ đọc/viết file và chạy lệnh thành batch (parallel tool calling).
  - Tách kiến trúc: tách biệt hoàn toàn Logic Engine (`gameEngine.js`) khỏi tầng đồ họa hiển thị (`public/index.html`), giúp test và headless chạy độc lập mà không cần render nặng nề.

## 3. Nhật ký sửa lỗi AI & Học hỏi
- **Lỗi đường dẫn:** Lần đầu gọi `node src/headless.js` từ thư mục gốc cha thay vì thư mục repository. Khắc phục bằng cách luôn chỉ định rõ context hoặc thư mục làm việc của repository.
- **Ràng buộc Test Contract:** Đảm bảo trường ticks trong `inputs.frames` luôn tăng nghiêm ngặt (nếu không thoát với mã 2 theo đúng quy định).
