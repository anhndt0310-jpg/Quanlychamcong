# TimeTrack Pro - Hệ Thống Quản Lý Chấm Công & Nhân Sự Doanh Nghiệp

Ứng dụng web quản lý chấm công nhân viên chuyên nghiệp, hiện đại, trực quan và dễ sử dụng. Hệ thống hỗ trợ đầy đủ các nghiệp vụ từ điểm danh vào/ra ca, nhận diện khuôn mặt (kiosk), quản lý đơn từ nghỉ phép, tính công tháng và xuất file báo cáo Excel tự động.

---

## 🌟 Tính Năng Nổi Bật

### 1. 📊 Bảng Điều Khiển Tổng Quan (Dashboard)
- **Thống kê thời gian thực**: Tổng số nhân sự, Đang có mặt hôm nay, Đi muộn, Chưa điểm danh, Đơn nghỉ phép chờ duyệt, Tỷ lệ chuyên cần.
- **Biểu đồ động (Chart.js)**:
  - Biểu đồ cột chồng theo dõi chấm công 7 ngày gần nhất (Đúng giờ vs Đi muộn vs Nghỉ phép).
  - Biểu đồ donut phân bố nhân sự theo các phòng ban.
- **Bảng điểm danh trực tiếp trong ngày** và nhật ký hoạt động (Live Activity Feed) tự động cập nhật.

### 2. ⏱️ Kiosk Điểm Danh Điện Tử (Check-in / Check-out Kiosk)
- Giao diện Kiosk chuyên dụng với đồng hồ số thời gian thực lớn.
- Mô phỏng camera quét gương mặt / mã nhân viên kèm định vị GPS văn phòng.
- Phân loại tự động: Đúng giờ, Đi muộn (với số phút muộn chính xác), Về sớm, Nghỉ phép.
- Hiệu ứng âm thanh phản hồi sống động (Web Audio API Chime) & thông báo toast rực rỡ khi hoàn tất.

### 3. 📋 Bảng Chấm Công Chi Tiết (Timesheet & Nhật Ký)
- Bộ lọc đa chiều: Theo khoảng ngày, theo phòng ban, trạng thái (Đúng giờ, Đi muộn, Về sớm, Nghỉ phép), tìm kiếm theo tên hoặc mã NV.
- **Xuất Excel tự động (.xlsx)**: Tạo file Excel định dạng chuyên nghiệp với màu sắc, tiêu đề và border chuẩn.
- **Điều chỉnh công thủ công (Admin Override)**: Quản trị viên có thể cập nhật giờ vào, giờ ra, trạng thái và ghi chú lý do điều chỉnh.

### 4. 👥 Quản Lý Hồ Sơ Nhân Viên (Employee Management)
- Hiển thị dạng thẻ nhân viên trực quan kèm Avatar tự động theo tên.
- Thêm mới, chỉnh sửa thông tin, đổi trạng thái làm việc hoặc xóa nhân viên.
- Quản lý thông tin chi tiết: Mã NV, Phòng ban, Chức danh, Ca làm việc, Ngày vào làm, Quỹ phép năm còn lại.

### 5. 📝 Quản Lý Đơn Từ & Nghỉ Phép (Leave Management)
- Nhân viên gửi các loại đơn: Nghỉ phép năm, Nghỉ ốm / Khám bệnh, Xin đi muộn / Về sớm, Đăng ký làm thêm giờ (OT), Đi công tác.
- Quy trình xét duyệt trực tiếp của Quản lý: **Duyệt** hoặc **Từ chối** (kèm lý do).
- Tự động trừ quỹ ngày phép và đánh dấu trạng thái vào bảng chấm công khi đơn được duyệt.

### 6. 📈 Báo Cáo & Tính Công Hàng Tháng (Monthly Payroll & Attendance Summary)
- Tự động tính số ngày công chuẩn trong tháng (loại trừ ngày Chủ Nhật).
- Thống kê chi tiết từng nhân viên: Số ngày làm thực tế, số lần đi muộn & tổng phút muộn, số ngày nghỉ phép, tổng số giờ làm việc.
- Tính % hoàn thành công và xếp loại chuyên cần tự động (*Xuất sắc*, *Tốt*, *Trung bình*, *Cần cải thiện*).

### 7. ⚙️ Cài Đặt Hệ Thống & Khôi Phục Dữ Liệu Demo
- Cấu hình Tên doanh nghiệp, Địa chỉ trụ sở, Tên Wi-Fi văn phòng, Thời gian ân hạn trễ (Grace period).
- Quản lý danh sách các ca làm việc.
- Nút **Khôi phục dữ liệu mẫu** bất cứ lúc nào với 12 nhân viên và lịch sử điểm danh phong phú.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Python 3, FastAPI, Uvicorn (nhanh, nhẹ, chuẩn RESTful API).
- **Database**: SQLite3 (sẵn có, lưu trữ bền vững trong file `chamcong.db`, tự động khởi tạo và nạp dữ liệu mẫu ban đầu).
- **Frontend**: Single Page Application (SPA) xây dựng bằng HTML5, CSS3 hiện đại, Vanilla JavaScript (không phụ thuộc Node.js hay build step phức tạp).
- **Thư viện UI/UX**:
  - Tailwind CSS (giao diện hiện đại, responsive trên mọi kích thước màn hình).
  - Lucide Icons (bộ biểu tượng sắc nét).
  - Chart.js (biểu đồ trực quan hóa dữ liệu).
  - OpenPyXL (kết xuất file Excel chuẩn doanh nghiệp).

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh

### Bước 1: Mở thư mục dự án
Đường dẫn dự án tại:
```powershell
C:\Users\sv\.gemini\antigravity\scratch\quan-ly-cham-cong
```

### Bước 2: Khởi động máy chủ Web
Bạn có thể khởi động bằng một trong các cách sau:

- **Cách 1 (Nhanh nhất trên Windows)**: Nhấp đúp chuột vào file `run.bat`
- **Cách 2 (Sử dụng PowerShell)**:
  ```powershell
  cd "C:\Users\sv\.gemini\antigravity\scratch\quan-ly-cham-cong"
  python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
  ```

### Bước 3: Truy cập ứng dụng
Mở trình duyệt web bất kỳ (Chrome, Edge, Firefox) và truy cập:
```
http://localhost:8000
```
- Tài liệu API tương tác Swagger UI: `http://localhost:8000/docs`

---

## 📁 Cấu Trúc Dự Án

```
quan-ly-cham-cong/
│
├── main.py              # Ứng dụng FastAPI chính & toàn bộ REST API endpoints
├── database.py          # Kết nối SQLite, lược đồ database & nạp dữ liệu mẫu ban đầu
├── models.py            # Pydantic Schemas xác thực dữ liệu đầu vào
├── requirements.txt     # Danh sách các thư viện Python cần thiết
├── run.bat              # Script khởi động 1-click cho Windows
├── run.ps1              # Script khởi động PowerShell
├── README.md            # Tài liệu hướng dẫn sử dụng chi tiết
│
├── static/              # Thư mục tài nguyên tĩnh
│   ├── index.html       # Giao diện chính Single Page Application
│   ├── css/
│   │   └── style.css    # Hiệu ứng chuyển động, kính mờ (Glassmorphism), Kiosk scanline
│   └── js/
│       └── app.js       # Toàn bộ logic frontend, API calls, Chart rendering, Audio chimes
└── chamcong.db          # Cơ sở dữ liệu SQLite (tự sinh ra khi chạy)
```

---

## 👥 Dữ Liệu Nhân Viên Mẫu Sẵn Có

Hệ thống đã có sẵn 12 nhân viên mẫu thuộc các phòng ban để bạn trải nghiệm ngay lập tức:
- **NV001**: Nguyễn Văn An - Tổng Giám Đốc (CEO)
- **NV002**: Trần Thị Mai - Trưởng Phòng Nhân Sự
- **NV003**: Lê Hoàng Long - Trưởng Phòng Kỹ Thuật
- **NV004**: Phạm Quốc Bảo - Kỹ Sư Phần Mềm Senior
- **NV005**: Đỗ Thị Thu Hương - Frontend Developer
- **NV006**: Vũ Minh Đức - Trưởng Phòng Kinh Doanh
- **NV007**: Hoàng Kim Oanh - Chuyên Viên Tư Vấn Bán Hàng
- **NV008**: Đặng Tuấn Kiệt - Trưởng Phòng Marketing
- **NV009**: Bùi Bích Phương - Content & Social Specialist
- **NV010**: Ngô Thanh Vân - Kế Toán Trưởng
- **NV011**: Trịnh Đình Quang - DevOps Engineer
- **NV012**: Lý Hải Yến - Chuyên Viên Tuyển Dụng
