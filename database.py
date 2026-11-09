import sqlite3
import os
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), "chamcong.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        break_start TEXT,
        break_end TEXT,
        grace_period_minutes INTEGER DEFAULT 15,
        standard_hours REAL DEFAULT 8.0
    );

    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        department_id INTEGER,
        position TEXT,
        shift_id INTEGER DEFAULT 1,
        hire_date TEXT,
        status TEXT DEFAULT 'active',
        leave_balance REAL DEFAULT 12.0,
        avatar_url TEXT,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        check_in_time TEXT,
        check_out_time TEXT,
        status TEXT NOT NULL,
        late_minutes INTEGER DEFAULT 0,
        early_leave_minutes INTEGER DEFAULT 0,
        work_hours REAL DEFAULT 0.0,
        note TEXT,
        check_in_image TEXT,
        ip_address TEXT,
        is_manual_adjusted INTEGER DEFAULT 0,
        adjusted_by TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        request_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        days_count REAL DEFAULT 1.0,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        rejection_reason TEXT,
        created_at TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)

    conn.commit()
    conn.close()

def seed_data_if_empty():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM employees")
    count = cursor.fetchone()[0]

    if count > 0:
        conn.close()
        return

    # Seed Departments
    departments = [
        ("Ban Giám Đốc", "BGD", "Quản trị và điều hành doanh nghiệp"),
        ("Phòng Kỹ Thuật (IT)", "IT", "Phát triển phần mềm và hạ tầng công nghệ"),
        ("Phòng Kinh Doanh", "KD", "Phát triển thị trường và bán hàng"),
        ("Phòng Marketing", "MKT", "Truyền thông và quảng bá thương hiệu"),
        ("Phòng Nhân Sự (HR)", "HR", "Quản trị nhân lực, tuyển dụng, đào tạo"),
        ("Phòng Kế Toán", "KT", "Quản lý tài chính và kế toán doanh nghiệp"),
    ]
    cursor.executemany("INSERT INTO departments (name, code, description) VALUES (?, ?, ?)", departments)

    # Seed Shifts
    shifts = [
        ("Ca Hành Chính", "08:00", "17:30", "12:00", "13:30", 15, 8.0),
        ("Ca Sáng", "08:00", "12:00", None, None, 15, 4.0),
        ("Ca Chiều", "13:30", "17:30", None, None, 15, 4.0),
        ("Ca Linh Hoạt", "08:30", "18:00", "12:00", "13:30", 30, 8.0),
    ]
    cursor.executemany("""
        INSERT INTO shifts (name, start_time, end_time, break_start, break_end, grace_period_minutes, standard_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, shifts)

    # Seed Employees
    employees = [
        ("NV001", "Nguyễn Văn An", "an.nguyen@techcorp.vn", "0901234567", 1, "Tổng Giám Đốc (CEO)", 1, "2021-01-15", "active", 14.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=AnNguyen"),
        ("NV002", "Trần Thị Mai", "mai.tran@techcorp.vn", "0912345678", 5, "Trưởng Phòng Nhân Sự", 1, "2021-03-01", "active", 12.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=MaiTran"),
        ("NV003", "Lê Hoàng Long", "long.le@techcorp.vn", "0923456789", 2, "Trưởng Phòng Kỹ Thuật", 1, "2021-06-10", "active", 10.5, "https://api.dicebear.com/7.x/avataaars/svg?seed=LongLe"),
        ("NV004", "Phạm Quốc Bảo", "bao.pham@techcorp.vn", "0934567890", 2, "Kỹ Sư Phần Mềm Senior", 1, "2022-02-15", "active", 11.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=BaoPham"),
        ("NV005", "Đỗ Thị Thu Hương", "huong.do@techcorp.vn", "0945678901", 2, "Frontend Developer", 4, "2022-08-01", "active", 12.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=HuongDo"),
        ("NV006", "Vũ Minh Đức", "duc.vu@techcorp.vn", "0956789012", 3, "Trưởng Phòng Kinh Doanh", 1, "2021-09-01", "active", 9.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=DucVu"),
        ("NV007", "Hoàng Kim Oanh", "oanh.hoang@techcorp.vn", "0967890123", 3, "Chuyên Viên Tư Vấn Bán Hàng", 1, "2023-01-10", "active", 12.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=OanhHoang"),
        ("NV008", "Đặng Tuấn Kiệt", "kiet.dang@techcorp.vn", "0978901234", 4, "Trưởng Phòng Marketing", 1, "2022-04-12", "active", 10.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=KietDang"),
        ("NV009", "Bùi Bích Phương", "phuong.bui@techcorp.vn", "0989012345", 4, "Content & Social Specialist", 1, "2023-05-20", "active", 12.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=PhuongBui"),
        ("NV010", "Ngô Thanh Vân", "van.ngo@techcorp.vn", "0990123456", 6, "Kế Toán Trưởng", 1, "2021-02-01", "active", 13.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=VanNgo"),
        ("NV011", "Trịnh Đình Quang", "quang.trinh@techcorp.vn", "0909876543", 2, "DevOps Engineer", 1, "2023-09-01", "active", 11.5, "https://api.dicebear.com/7.x/avataaars/svg?seed=QuangTrinh"),
        ("NV012", "Lý Hải Yến", "yen.ly@techcorp.vn", "0918765432", 5, "Chuyên Viên Tuyển Dụng", 1, "2023-11-15", "active", 12.0, "https://api.dicebear.com/7.x/avataaars/svg?seed=YenLy"),
    ]
    cursor.executemany("""
        INSERT INTO employees (employee_code, full_name, email, phone, department_id, position, shift_id, hire_date, status, leave_balance, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, employees)

    # Seed Default Settings
    settings = [
        ("company_name", "Công Ty Cổ Phần Công Nghệ NextGen Tech"),
        ("company_address", "Tầng 8, Tòa nhà Landmark Tower, Hà Nội"),
        ("company_wifi", "NextGen_Guest_5G"),
        ("grace_period_minutes", "15"),
        ("auto_checkout_enabled", "true"),
        ("allow_camera_checkin", "true"),
        ("allow_leave_balance_check", "true")
    ]
    cursor.executemany("INSERT INTO settings (key, value) VALUES (?, ?)", settings)

    # Generate 14 days of realistic attendance up to today
    today = datetime.now().date()
    emp_ids = list(range(1, 13))

    for day_offset in range(14, -1, -1):
        curr_date = today - timedelta(days=day_offset)
        # Skip Sunday (weekday() == 6)
        if curr_date.weekday() == 6:
            continue

        date_str = curr_date.strftime("%Y-%m-%d")
        is_today = (day_offset == 0)

        for emp_id in emp_ids:
            # For today: simulate only some have checked in already
            if is_today:
                # 60% checked in already, some pending for user to test!
                if emp_id in [1, 2, 3, 5, 6, 8, 9]:
                    check_in = f"07:{random.randint(45, 59):02d}:00"
                    status = "on_time"
                    late_m = 0
                    cursor.execute("""
                        INSERT OR REPLACE INTO attendance 
                        (employee_id, date, check_in_time, check_out_time, status, late_minutes, early_leave_minutes, work_hours, note)
                        VALUES (?, ?, ?, NULL, ?, ?, 0, 0.0, 'Đã check-in buổi sáng')
                    """, (emp_id, date_str, check_in, status, late_m))
                elif emp_id == 4:
                    # Late check-in
                    check_in = "08:35:12"
                    cursor.execute("""
                        INSERT OR REPLACE INTO attendance 
                        (employee_id, date, check_in_time, check_out_time, status, late_minutes, early_leave_minutes, work_hours, note)
                        VALUES (?, ?, ?, NULL, 'late', 35, 0, 0.0, 'Kẹt xe đường Cầu Giấy')
                    """, (emp_id, date_str, check_in))
                elif emp_id == 7:
                    # Leave
                    cursor.execute("""
                        INSERT OR REPLACE INTO attendance 
                        (employee_id, date, status, note)
                        VALUES (?, ?, 'leave', 'Nghỉ phép năm đã duyệt')
                    """, (emp_id, date_str))
                # emp_id 10, 11, 12 haven't checked in yet! Perfect for testing check-in!
                continue

            # For past days
            # Saturday: half day or normal
            rand_val = random.random()
            if rand_val < 0.80:
                # On time
                in_min = random.randint(45, 58)
                check_in = f"07:{in_min:02d}:15"
                check_out = f"17:{random.randint(30, 45):02d}:00"
                cursor.execute("""
                    INSERT INTO attendance 
                    (employee_id, date, check_in_time, check_out_time, status, late_minutes, early_leave_minutes, work_hours, note)
                    VALUES (?, ?, ?, ?, 'on_time', 0, 0, 8.0, 'Làm việc đầy đủ')
                """, (emp_id, date_str, check_in, check_out))
            elif rand_val < 0.90:
                # Late
                late_m = random.randint(16, 45)
                check_in = f"08:{late_m:02d}:30"
                check_out = f"17:{random.randint(30, 50):02d}:00"
                hours = round(8.0 - (late_m / 60.0), 1)
                cursor.execute("""
                    INSERT INTO attendance 
                    (employee_id, date, check_in_time, check_out_time, status, late_minutes, early_leave_minutes, work_hours, note)
                    VALUES (?, ?, ?, ?, 'late', ?, 0, ?, 'Đi muộn')
                """, (emp_id, date_str, check_in, check_out, late_m, hours))
            elif rand_val < 0.95:
                # Early leave
                early_m = random.randint(30, 60)
                check_in = "07:55:00"
                check_out = "16:45:00"
                cursor.execute("""
                    INSERT INTO attendance 
                    (employee_id, date, check_in_time, check_out_time, status, late_minutes, early_leave_minutes, work_hours, note)
                    VALUES (?, ?, ?, ?, 'early_leave', 0, ?, 7.2, 'Xin về sớm có việc gia đình')
                """, (emp_id, date_str, check_in, check_out, early_m))
            else:
                # Leave
                cursor.execute("""
                    INSERT INTO attendance 
                    (employee_id, date, status, note)
                    VALUES (?, ?, 'leave', 'Nghỉ phép chế độ')
                """, (emp_id, date_str))

    # Seed Leave Requests
    leave_requests = [
        (7, "annual_leave", today.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d"), 1.0, "Nghỉ phép giải quyết việc cá nhân gia đình", "approved", "Trần Thị Mai", today.strftime("%Y-%m-%d 08:00:00"), None, (today - timedelta(days=1)).strftime("%Y-%m-%d 14:20:00")),
        (4, "late_early", (today + timedelta(days=1)).strftime("%Y-%m-%d"), (today + timedelta(days=1)).strftime("%Y-%m-%d"), 0.5, "Xin phép đến muộn 1 tiếng đi khám sức khỏe định kỳ", "pending", None, None, None, today.strftime("%Y-%m-%d 09:15:00")),
        (5, "annual_leave", (today + timedelta(days=3)).strftime("%Y-%m-%d"), (today + timedelta(days=4)).strftime("%Y-%m-%d"), 2.0, "Du lịch cùng gia đình", "pending", None, None, None, today.strftime("%Y-%m-%d 10:30:00")),
        (9, "sick_leave", (today - timedelta(days=5)).strftime("%Y-%m-%d"), (today - timedelta(days=5)).strftime("%Y-%m-%d"), 1.0, "Bị sốt xuất huyết, nghỉ theo chỉ định bác sĩ", "approved", "Trần Thị Mai", (today - timedelta(days=5)).strftime("%Y-%m-%d 08:30:00"), None, (today - timedelta(days=5)).strftime("%Y-%m-%d 07:10:00")),
        (11, "overtime", (today - timedelta(days=2)).strftime("%Y-%m-%d"), (today - timedelta(days=2)).strftime("%Y-%m-%d"), 0.5, "Tăng ca triển khai bản cập nhật hệ thống máy chủ", "approved", "Lê Hoàng Long", (today - timedelta(days=2)).strftime("%Y-%m-%d 18:00:00"), None, (today - timedelta(days=2)).strftime("%Y-%m-%d 16:00:00")),
        (6, "business_trip", (today + timedelta(days=5)).strftime("%Y-%m-%d"), (today + timedelta(days=7)).strftime("%Y-%m-%d"), 3.0, "Gặp gỡ khách hàng ký kết hợp đồng tại TP.HCM", "pending", None, None, None, today.strftime("%Y-%m-%d 11:00:00")),
    ]
    cursor.executemany("""
        INSERT INTO leave_requests 
        (employee_id, request_type, start_date, end_date, days_count, reason, status, approved_by, approved_at, rejection_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, leave_requests)

    conn.commit()
    conn.close()
