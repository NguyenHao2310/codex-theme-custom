# codex-theme-custom

**Pixel Studio V2 cho Codex trên Windows** — nền pixel chuyển động, video cục bộ và bảng tùy chỉnh ngay trên thanh công cụ của cửa sổ chat.

Đây là dự án cộng đồng, không liên kết với OpenAI. Phần vẽ 9 cảnh được chuyển từ [Pixel Chat Themes](https://github.com/aqua2409z/pixel-chat-themes) của **aqua2409z** theo giấy phép MIT.

## Tính năng

Bản **2.0.2** bỏ cả nền chân ô nhập lẫn hai gradient tối ở mép trên/dưới vùng chat khi bật theme. Nền ô soạn thảo và mặt nạ cuộn chữ được giữ nguyên; tắt theme khôi phục giao diện gốc.

- Nút bốn ô vuông cạnh các nút điều khiển chat ở góc trên phải.
- Bảng chọn 9 cảnh có ảnh xem trước: terminal, mây, rùa biển, Koi, sứa, thuyền giấy, đom đóm, trăng sao và Việt Nam.
- Video nền từ tệp trên máy, tối đa 200 MB; phát lặp và tắt tiếng.
- Chỉnh màu phủ, độ sáng, độ rực, độ mờ, độ đục khung chat, tốc độ và kích thước pixel.
- Tắt nền vẫn giữ nút để bật lại. Cài đặt lưu bằng localStorage; video lưu bằng IndexedDB.
- Không tải mã từ mạng khi chạy; không gửi video hoặc nội dung chat đến máy chủ bên ngoài.

## Dùng bản V2

Yêu cầu: **Windows 11**, ứng dụng Microsoft Store có gói `OpenAI.Codex` và **Node.js 24** trong PATH. Bộ khởi chạy sử dụng Windows PowerShell 5.1 và `Get-NetTCPConnection`.

1. Tải [ZIP V2](dist/codex-theme-custom-v2.zip) rồi giải nén vào thư mục của bạn, hoặc clone repo.
2. Lưu công việc và thoát hoàn toàn Codex/ChatGPT bằng **Ctrl+Q**.
3. Chạy **`Start-Pixel.cmd`**. Không cần chạy bằng Administrator.
4. Bấm nút **bốn ô vuông** trên thanh công cụ để mở Pixel Studio.
5. Chọn **Cảnh Pixel**, **Video** hoặc **Tinh chỉnh**.

Ở mục Video, bấm ô thêm video hoặc thả tệp vào đó. MP4 H.264 và WebM là những lựa chọn nên thử; phần mở rộng không bảo đảm codec được hỗ trợ. Xóa một mục khỏi thư viện không xóa tệp gốc. Hiện chưa hỗ trợ link YouTube hoặc video trực tuyến.

Nút tùy chỉnh chỉ được thêm trong những phiên mở bằng `Start-Pixel.cmd`. Mở ứng dụng bình thường từ Start không tự thêm nút. `Apply-Pixel.cmd` áp dụng lại giao diện trong một phiên đã mở CDP. Các lựa chọn và video đã lưu sẽ được khôi phục khi mở lại bằng bộ khởi chạy.

## Hoàn tác và quyền CDP

Nút **Tắt nền** trả lại nền ứng dụng và vẫn giữ bảng điều khiển. Để đóng cả cổng CDP, thoát hoàn toàn ứng dụng bằng **Ctrl+Q**, rồi mở Codex bình thường. Không có tác vụ tự khởi động cùng Windows và không sửa `app.asar` hoặc gói cài đặt.

Bộ khởi chạy mở CDP tại **`127.0.0.1:19327`**, kiểm tra địa chỉ cục bộ rồi mới chèn mã vào renderer chính `app://-/index.html`. CDP cho phép tiến trình trên cùng máy điều khiển renderer và tiếp cận dữ liệu hiển thị trong đó. Loopback không phải cơ chế xác thực; không chia sẻ hoặc chuyển tiếp cổng này.

## Phát triển

Không cần cài dependency npm.

```powershell
npm run build
npm run check
```

- `src/engine.js`: phần vẽ cảnh từ dự án gốc.
- `src/adapter.js`: giao diện Pixel Studio, điều khiển nền và thư viện video.
- `pixel-runtime.js`: bản gộp để chèn, tạo lại bằng lệnh build.
- `inject.mjs`: kết nối CDP, chọn đúng renderer và đăng ký áp dụng lại khi renderer reload trong cùng phiên.
- `Start-Pixel.ps1`: mở ứng dụng với CDP cục bộ và gọi bộ chèn.
- `dist/codex-theme-custom-v2.zip`: gói V2 đã thử, không chứa dữ liệu phiên hoặc video cá nhân.

## Trạng thái kiểm thử

Đã thử trực tiếp ngày **7/11/2026** trên gói `OpenAI.Codex 26.1103.4239.0`:

- Mở bảng bằng nút trên thanh công cụ, đổi cảnh, tạm dừng, bật/tắt nền.
- Điều chỉnh độ sáng và đặt lại tinh chỉnh.
- Mở hộp chọn tệp, thêm WebM mẫu, lưu thư viện và phát có hình/chuyển động, lặp, tắt tiếng.
- Thoát và mở lại bằng bộ khởi chạy: nút, lựa chọn và video được khôi phục.

`npm run check` chỉ kiểm tra cú pháp và smoke test engine bằng canvas giả lập; không thay thế các kiểm tra giao diện/video trên máy thật. Phiên bản Codex khác hoặc thay đổi bố cục có thể cần cập nhật adapter.

## Giấy phép và ghi nguồn

MIT. Giữ nguyên [LICENSE](LICENSE) của engine gốc. Xem [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) để biết nguồn và phần đã chuyển đổi.
