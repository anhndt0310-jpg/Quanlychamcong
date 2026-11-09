import os
import io
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from database import get_db, init_db, seed_data_if_empty
from models import (
    CheckInRequest, CheckOutRequest, AttendanceAdjustRequest,
    EmployeeCreate, EmployeeUpdate, LeaveRequestCreate,
    LeaveRequestReview, ShiftUpdate, SettingsUpdate
)

app = FastAPI(title="TimeTrack Pro - Quản Lý Chấm Công", version="2.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Database & Seed
@app.on_event("startup")
def on_startup():
    init_db()
    seed_data_if_empty()

# Helper: parse time HH:MM
def time_to_minutes(time_str: str) -> int:
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])

# Static files
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
def read_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>TimeTrack Pro API is running</h1>"

# ----------------- ATTENDANCE APIS -----------------

@app.post("/api/attendance/check-in")
def check_in(payload: CheckInRequest, request: Request):
    conn = get_db()
    cursor = conn.cursor()

    # Find employee
    emp = None
    if payload.employee_id:
        cursor.execute("SELECT * FROM employees WHERE id = ?", (payload.employee_id,))
        emp = cursor.fetchone()
    elif payload.employee_code:
        cursor.execute("SELECT * FROM employees WHERE employee_code = ?", (payload.employee_code.strip().upper(),))
        emp = cursor.fetchone()

    if not emp:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên với thông tin đã cung cấp.")

    employee_id = emp["id"]
    emp_name = emp["full_name"]
    emp_code = emp["employee_code"]
    shift_id = emp["shift_id"] or 1

    # Get shift
    cursor.execute("SELECT * FROM shifts WHERE id = ?", (shift_id,))
    shift = cursor.fetchone()
    if not shift:
        cursor.execute("SELECT * FROM shifts LIMIT 1")
        shift = cursor.fetchone()

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%H:%M:%S")

    # Check if already checked in today
    cursor.execute("SELECT * FROM attendance WHERE employee_id = ? AND date = ?", (employee_id, today_str))
    existing = cursor.fetchone()

    if existing and existing["check_in_time"]:
        conn.close()
        return {
            "success": False,
            "message": f"Nhân viên {emp_name} ({emp_code}) đã điểm danh vào lúc {existing['check_in_time']}!",
            "already_checked_in": True,
            "attendance": dict(existing)
        }

    # Calculate status & late minutes
    start_minutes = time_to_minutes(shift["start_time"])
    grace_minutes = shift["grace_period_minutes"]
    current_minutes = now.hour * 60 + now.minute

    late_minutes = 0
    if current_minutes > (start_minutes + grace_minutes):
        status = "late"
        late_minutes = current_minutes - start_minutes
    else:
        status = "on_time"

    client_ip = request.client.host if request.client else "127.0.0.1"

    if existing:
        cursor.execute("""
            UPDATE attendance 
            SET check_in_time = ?, status = ?, late_minutes = ?, note = ?, check_in_image = ?, ip_address = ?
            WHERE id = ?
        """, (current_time_str, status, late_minutes, payload.note or "Điểm danh qua Web", payload.image_base64, client_ip, existing["id"]))
        attendance_id = existing["id"]
    else:
        cursor.execute("""
            INSERT INTO attendance 
            (employee_id, date, check_in_time, status, late_minutes, early_leave_minutes, work_hours, note, check_in_image, ip_address)
            VALUES (?, ?, ?, ?, ?, 0, 0.0, ?, ?, ?)
        """, (employee_id, today_str, current_time_str, status, late_minutes, payload.note or "Điểm danh qua Web", payload.image_base64, client_ip))
        attendance_id = cursor.lastrowid

    conn.commit()
    conn.close()

    status_vi = "Đúng giờ" if status == "on_time" else f"Đi muộn {late_minutes} phút"
    return {
        "success": True,
        "message": f"Điểm danh VÀO thành công cho {emp_name} ({status_vi})!",
        "attendance_id": attendance_id,
        "employee_name": emp_name,
        "employee_code": emp_code,
        "check_in_time": current_time_str,
        "status": status,
        "status_vi": status_vi,
        "late_minutes": late_minutes
    }

@app.post("/api/attendance/check-out")
def check_out(payload: CheckOutRequest):
    conn = get_db()
    cursor = conn.cursor()

    # Find employee
    emp = None
    if payload.employee_id:
        cursor.execute("SELECT * FROM employees WHERE id = ?", (payload.employee_id,))
        emp = cursor.fetchone()
    elif payload.employee_code:
        cursor.execute("SELECT * FROM employees WHERE employee_code = ?", (payload.employee_code.strip().upper(),))
        emp = cursor.fetchone()

    if not emp:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")

    employee_id = emp["id"]
    emp_name = emp["full_name"]
    emp_code = emp["employee_code"]
    shift_id = emp["shift_id"] or 1

    cursor.execute("SELECT * FROM shifts WHERE id = ?", (shift_id,))
    shift = cursor.fetchone()
    if not shift:
        cursor.execute("SELECT * FROM shifts LIMIT 1")
        shift = cursor.fetchone()

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%H:%M:%S")

    cursor.execute("SELECT * FROM attendance WHERE employee_id = ? AND date = ?", (employee_id, today_str))
    record = cursor.fetchone()

    if not record or not record["check_in_time"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Nhân viên {emp_name} chưa điểm danh vào hôm nay nên không thể check-out.")

    # Calculate hours worked and early leave
    check_in_dt = datetime.strptime(f"{today_str} {record['check_in_time']}", "%Y-%m-%d %H:%M:%S")
    check_out_dt = now

    total_seconds = (check_out_dt - check_in_dt).total_seconds()
    raw_hours = total_seconds / 3600.0

    # Deduct break time if worked past break
    work_hours = round(max(0.5, raw_hours), 1)
    if work_hours > 5.0:
        work_hours = round(max(4.0, work_hours - 1.5), 1)

    # Check early leave
    end_minutes = time_to_minutes(shift["end_time"])
    current_minutes = now.hour * 60 + now.minute
    early_leave_minutes = 0
    status = record["status"]

    if current_minutes < end_minutes:
        early_leave_minutes = end_minutes - current_minutes
        if status == "on_time":
            status = "early_leave"

    note = record["note"] or ""
    if payload.note:
        note = f"{note} | Check-out note: {payload.note}"

    cursor.execute("""
        UPDATE attendance 
        SET check_out_time = ?, work_hours = ?, early_leave_minutes = ?, status = ?, note = ?
        WHERE id = ?
    """, (current_time_str, work_hours, early_leave_minutes, status, note, record["id"]))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Điểm danh RA thành công cho {emp_name}! Tổng số giờ làm: {work_hours}h.",
        "employee_name": emp_name,
        "employee_code": emp_code,
        "check_out_time": current_time_str,
        "work_hours": work_hours,
        "early_leave_minutes": early_leave_minutes
    }

@app.get("/api/attendance/today")
def get_today_attendance():
    conn = get_db()
    cursor = conn.cursor()
    today_str = datetime.now().strftime("%Y-%m-%d")

    cursor.execute("""
        SELECT 
            e.id as employee_id,
            e.employee_code,
            e.full_name,
            e.position,
            e.avatar_url,
            d.name as department_name,
            s.name as shift_name,
            s.start_time as shift_start,
            s.end_time as shift_end,
            a.id as attendance_id,
            a.check_in_time,
            a.check_out_time,
            a.status,
            a.late_minutes,
            a.early_leave_minutes,
            a.work_hours,
            a.note,
            a.is_manual_adjusted
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN shifts s ON e.shift_id = s.id
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
        WHERE e.status = 'active'
        ORDER BY 
            CASE 
                WHEN a.check_in_time IS NOT NULL THEN 0
                WHEN a.status = 'leave' THEN 1
                ELSE 2
            END,
            a.check_in_time ASC,
            e.employee_code ASC
    """, (today_str,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

@app.get("/api/attendance/logs")
def get_attendance_logs(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    department_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT 
            a.id,
            a.date,
            a.check_in_time,
            a.check_out_time,
            a.status,
            a.late_minutes,
            a.early_leave_minutes,
            a.work_hours,
            a.note,
            a.is_manual_adjusted,
            a.adjusted_by,
            e.id as employee_id,
            e.employee_code,
            e.full_name,
            e.position,
            e.avatar_url,
            d.name as department_name,
            s.name as shift_name
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN shifts s ON e.shift_id = s.id
        WHERE 1=1
    """
    params = []

    if date_from:
        query += " AND a.date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND a.date <= ?"
        params.append(date_to)
    if department_id:
        query += " AND e.department_id = ?"
        params.append(department_id)
    if employee_id:
        query += " AND a.employee_id = ?"
        params.append(employee_id)
    if status and status != "all":
        query += " AND a.status = ?"
        params.append(status)
    if search:
        query += " AND (e.full_name LIKE ? OR e.employee_code LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term])

    query += " ORDER BY a.date DESC, a.check_in_time DESC LIMIT 500"

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/attendance/adjust")
def adjust_attendance(payload: AttendanceAdjustRequest):
    conn = get_db()
    cursor = conn.cursor()

    # Calculate hours if check_in and check_out are provided
    work_hours = 0.0
    if payload.check_in_time and payload.check_out_time:
        try:
            t1 = datetime.strptime(payload.check_in_time, "%H:%M:%S")
            t2 = datetime.strptime(payload.check_out_time, "%H:%M:%S")
            diff = (t2 - t1).total_seconds() / 3600.0
            work_hours = round(max(0.0, diff), 1)
            if work_hours > 5.0:
                work_hours = round(max(4.0, work_hours - 1.5), 1)
        except Exception:
            work_hours = 8.0

    cursor.execute("""
        INSERT INTO attendance 
        (employee_id, date, check_in_time, check_out_time, status, work_hours, note, is_manual_adjusted, adjusted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(employee_id, date) DO UPDATE SET
            check_in_time = excluded.check_in_time,
            check_out_time = excluded.check_out_time,
            status = excluded.status,
            work_hours = excluded.work_hours,
            note = excluded.note,
            is_manual_adjusted = 1,
            adjusted_by = excluded.adjusted_by
    """, (
        payload.employee_id, payload.date, payload.check_in_time, payload.check_out_time,
        payload.status, work_hours, payload.note or "Quản trị viên điều chỉnh công thủ công",
        payload.adjusted_by or "Admin"
    ))

    conn.commit()
    conn.close()
    return {"success": True, "message": "Điều chỉnh công thành công!"}

@app.get("/api/attendance/export")
def export_attendance_excel(month: Optional[str] = None):
    # If no month provided, use current month
    if not month:
        month = datetime.now().strftime("%Y-%m")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            a.date,
            e.employee_code,
            e.full_name,
            d.name as department_name,
            e.position,
            a.check_in_time,
            a.check_out_time,
            a.status,
            a.late_minutes,
            a.early_leave_minutes,
            a.work_hours,
            a.note,
            a.is_manual_adjusted
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE a.date LIKE ?
        ORDER BY a.date DESC, e.employee_code ASC
    """, (f"{month}%",))

    rows = cursor.fetchall()
    conn.close()

    # Create Excel Workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Chấm Công {month}"

    # Header styling
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    cell_font = Font(name="Segoe UI", size=10)
    thin_border = Border(
        left=Side(style='thin', color='E5E7EB'),
        right=Side(style='thin', color='E5E7EB'),
        top=Side(style='thin', color='E5E7EB'),
        bottom=Side(style='thin', color='E5E7EB')
    )

    # Title Banner
    ws.merge_cells("A1:K1")
    ws["A1"] = f"BẢNG CHI TIẾT CHẤM CÔNG THÁNG {month} - TIMETRACK PRO"
    ws["A1"].font = Font(name="Segoe UI", size=14, bold=True, color="1E3A8A")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    headers = [
        "Ngày", "Mã NV", "Họ và Tên", "Phòng Ban", "Chức Vụ", 
        "Giờ Vào", "Giờ Ra", "Trạng Thái", "Đi Muộn (phút)", 
        "Số Giờ Công", "Ghi Chú"
    ]

    ws.append([]) # Blank row 2
    ws.append(headers) # Row 3

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=3, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[3].height = 25

    status_labels = {
        "on_time": "Đúng giờ",
        "late": "Đi muộn",
        "early_leave": "Về sớm",
        "absent": "Vắng mặt",
        "leave": "Nghỉ phép",
        "business_trip": "Công tác"
    }

    for row in rows:
        st_text = status_labels.get(row["status"], row["status"])
        if row["is_manual_adjusted"]:
            st_text += " (Đã điều chỉnh)"

        ws.append([
            row["date"],
            row["employee_code"],
            row["full_name"],
            row["department_name"] or "",
            row["position"] or "",
            row["check_in_time"] or "--",
            row["check_out_time"] or "--",
            st_text,
            row["late_minutes"] or 0,
            row["work_hours"] or 0.0,
            row["note"] or ""
        ])

    # Format data rows & column widths
    for row_idx in range(4, ws.max_row + 1):
        ws.row_dimensions[row_idx].height = 20
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = cell_font
            cell.border = thin_border
            if col_idx in [1, 2, 6, 7, 8, 9, 10]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    col_widths = [14, 12, 24, 20, 22, 12, 12, 18, 16, 14, 28]
    for i, w in enumerate(col_widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(i)
        ws.column_dimensions[col_letter].width = w

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"Bang_Cham_Cong_{month}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ----------------- DASHBOARD STATS -----------------

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()
    today_str = datetime.now().strftime("%Y-%m-%d")

    # Total employees
    cursor.execute("SELECT COUNT(*) FROM employees WHERE status = 'active'")
    total_active_employees = cursor.fetchone()[0]

    # Attendance stats for today
    cursor.execute("""
        SELECT 
            COUNT(CASE WHEN check_in_time IS NOT NULL THEN 1 END) as total_present,
            COUNT(CASE WHEN status = 'on_time' THEN 1 END) as on_time_count,
            COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count,
            COUNT(CASE WHEN status = 'leave' THEN 1 END) as on_leave_count
        FROM attendance
        WHERE date = ?
    """, (today_str,))
    today_stats = cursor.fetchone()

    total_present = today_stats["total_present"]
    on_time_count = today_stats["on_time_count"]
    late_count = today_stats["late_count"]
    on_leave_count = today_stats["on_leave_count"]
    not_checked_in = max(0, total_active_employees - total_present - on_leave_count)

    # Pending leave requests
    cursor.execute("SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'")
    pending_leaves = cursor.fetchone()[0]

    # Weekly chart data (Past 7 days)
    chart_dates = []
    chart_on_time = []
    chart_late = []
    chart_leave = []

    today = datetime.now().date()
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        day_label = d.strftime("%d/%m")
        chart_dates.append(day_label)

        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN status = 'on_time' THEN 1 END) as on_time,
                COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
                COUNT(CASE WHEN status = 'leave' THEN 1 END) as on_leave
            FROM attendance
            WHERE date = ?
        """, (d_str,))
        row = cursor.fetchone()
        chart_on_time.append(row["on_time"] or 0)
        chart_late.append(row["late"] or 0)
        chart_leave.append(row["on_leave"] or 0)

    # Department distribution
    cursor.execute("""
        SELECT d.name, COUNT(e.id) as emp_count
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
        GROUP BY d.id
    """)
    dept_distribution = [dict(row) for row in cursor.fetchall()]

    # Recent activity logs (5 latest)
    cursor.execute("""
        SELECT 
            a.check_in_time,
            a.check_out_time,
            a.status,
            a.late_minutes,
            a.date,
            e.full_name,
            e.employee_code,
            e.avatar_url,
            d.name as department_name
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE a.date = ?
        ORDER BY COALESCE(a.check_out_time, a.check_in_time) DESC
        LIMIT 6
    """, (today_str,))
    recent_activities = [dict(row) for row in cursor.fetchall()]

    conn.close()

    attendance_rate = 0.0
    if total_active_employees > 0:
        attendance_rate = round((total_present / total_active_employees) * 100.0, 1)

    return {
        "total_active_employees": total_active_employees,
        "total_present": total_present,
        "on_time_count": on_time_count,
        "late_count": late_count,
        "on_leave_count": on_leave_count,
        "not_checked_in": not_checked_in,
        "pending_leaves": pending_leaves,
        "attendance_rate": attendance_rate,
        "weekly_chart": {
            "labels": chart_dates,
            "on_time": chart_on_time,
            "late": chart_late,
            "leave": chart_leave,
        },
        "dept_distribution": dept_distribution,
        "recent_activities": recent_activities
    }

# ----------------- EMPLOYEE APIS -----------------

@app.get("/api/employees")
def get_employees(department_id: Optional[int] = None, status: Optional[str] = None, search: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT 
            e.*,
            d.name as department_name,
            s.name as shift_name,
            s.start_time as shift_start,
            s.end_time as shift_end
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN shifts s ON e.shift_id = s.id
        WHERE 1=1
    """
    params = []
    if department_id:
        query += " AND e.department_id = ?"
        params.append(department_id)
    if status:
        query += " AND e.status = ?"
        params.append(status)
    if search:
        query += " AND (e.full_name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY e.id ASC"
    cursor.execute(query, params)
    employees = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return employees

@app.get("/api/employees/{emp_id}")
def get_employee_detail(emp_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT e.*, d.name as department_name, s.name as shift_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN shifts s ON e.shift_id = s.id
        WHERE e.id = ?
    """, (emp_id,))
    emp = cursor.fetchone()
    conn.close()
    if not emp:
        raise HTTPException(status_code=404, detail="Nhân viên không tồn tại.")
    return dict(emp)

@app.post("/api/employees")
def create_employee(payload: EmployeeCreate):
    conn = get_db()
    cursor = conn.cursor()

    # Check code unique
    cursor.execute("SELECT id FROM employees WHERE employee_code = ?", (payload.employee_code.strip().upper(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Mã nhân viên đã tồn tại trong hệ thống!")

    avatar = payload.avatar_url
    if not avatar:
        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={payload.full_name.replace(' ', '')}"

    hire_date = payload.hire_date or datetime.now().strftime("%Y-%m-%d")

    cursor.execute("""
        INSERT INTO employees 
        (employee_code, full_name, email, phone, department_id, position, shift_id, hire_date, status, leave_balance, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    """, (
        payload.employee_code.strip().upper(), payload.full_name, payload.email,
        payload.phone, payload.department_id, payload.position, payload.shift_id or 1,
        hire_date, payload.leave_balance or 12.0, avatar
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "id": new_id, "message": "Thêm nhân viên thành công!"}

@app.put("/api/employees/{emp_id}")
def update_employee(emp_id: int, payload: EmployeeUpdate):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM employees WHERE id = ?", (emp_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")

    fields = []
    params = []
    for key, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            fields.append(f"{key} = ?")
            params.append(val)

    if fields:
        params.append(emp_id)
        cursor.execute(f"UPDATE employees SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit()

    conn.close()
    return {"success": True, "message": "Cập nhật thông tin nhân viên thành công!"}

@app.delete("/api/employees/{emp_id}")
def delete_employee(emp_id: int):
    conn = get_db()
    cursor = conn.cursor()
    # Check if has attendance
    cursor.execute("DELETE FROM attendance WHERE employee_id = ?", (emp_id,))
    cursor.execute("DELETE FROM leave_requests WHERE employee_id = ?", (emp_id,))
    cursor.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Xóa nhân viên và dữ liệu liên quan thành công!"}

# ----------------- LEAVE REQUEST APIS -----------------

@app.get("/api/leave-requests")
def get_leave_requests(status: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT 
            lr.*,
            e.employee_code,
            e.full_name,
            e.position,
            e.avatar_url,
            d.name as department_name
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE 1=1
    """
    params = []
    if status and status != "all":
        query += " AND lr.status = ?"
        params.append(status)

    query += " ORDER BY lr.id DESC"
    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/leave-requests")
def create_leave_request(payload: LeaveRequestCreate):
    conn = get_db()
    cursor = conn.cursor()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO leave_requests 
        (employee_id, request_type, start_date, end_date, days_count, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (payload.employee_id, payload.request_type, payload.start_date, payload.end_date, payload.days_count, payload.reason, now_str))

    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "id": new_id, "message": "Gửi đơn xin nghỉ phép thành công! Đang chờ phê duyệt."}

@app.put("/api/leave-requests/{req_id}/review")
def review_leave_request(req_id: int, payload: LeaveRequestReview):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM leave_requests WHERE id = ?", (req_id,))
    req = cursor.fetchone()
    if not req:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn từ.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        UPDATE leave_requests 
        SET status = ?, approved_by = ?, approved_at = ?, rejection_reason = ?
        WHERE id = ?
    """, (payload.status, payload.approved_by, now_str, payload.rejection_reason, req_id))

    # If approved and it's leave, subtract leave balance and mark attendance for those dates
    if payload.status == "approved":
        emp_id = req["employee_id"]
        days = req["days_count"]
        # Update balance
        cursor.execute("UPDATE employees SET leave_balance = MAX(0.0, leave_balance - ?) WHERE id = ?", (days, emp_id))

        # Mark attendance for date range
        start_d = datetime.strptime(req["start_date"], "%Y-%m-%d").date()
        end_d = datetime.strptime(req["end_date"], "%Y-%m-%d").date()
        curr = start_d
        while curr <= end_d:
            if curr.weekday() != 6: # skip Sunday
                d_str = curr.strftime("%Y-%m-%d")
                status_type = "leave" if req["request_type"] in ["annual_leave", "sick_leave"] else "business_trip"
                cursor.execute("""
                    INSERT INTO attendance (employee_id, date, status, note)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(employee_id, date) DO UPDATE SET
                        status = excluded.status,
                        note = excluded.note
                """, (emp_id, d_str, status_type, f"Đơn đã duyệt: {req['reason']}"))
            curr += timedelta(days=1)

    conn.commit()
    conn.close()

    msg = "Đã duyệt đơn thành công!" if payload.status == "approved" else "Đã từ chối đơn."
    return {"success": True, "message": msg}

# ----------------- MONTHLY SUMMARY / PAYROLL REPORT -----------------

@app.get("/api/reports/monthly")
def get_monthly_report(month: Optional[str] = None):
    if not month:
        month = datetime.now().strftime("%Y-%m")

    conn = get_db()
    cursor = conn.cursor()

    # Get standard working days for this month (excluding Sundays)
    year, m = map(int, month.split("-"))
    num_days = 31
    if m in [4, 6, 9, 11]:
        num_days = 30
    elif m == 2:
        num_days = 29 if year % 4 == 0 else 28

    standard_work_days = 0
    for day in range(1, num_days + 1):
        try:
            d = datetime(year, m, day)
            if d.weekday() != 6:  # Skip Sunday
                standard_work_days += 1
        except ValueError:
            pass

    cursor.execute("""
        SELECT 
            e.id as employee_id,
            e.employee_code,
            e.full_name,
            e.position,
            e.leave_balance,
            d.name as department_name,
            COUNT(CASE WHEN a.check_in_time IS NOT NULL THEN 1 END) as days_worked,
            COUNT(CASE WHEN a.status = 'on_time' THEN 1 END) as on_time_days,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
            COALESCE(SUM(a.late_minutes), 0) as total_late_minutes,
            COUNT(CASE WHEN a.status = 'early_leave' THEN 1 END) as early_leave_days,
            COUNT(CASE WHEN a.status = 'leave' THEN 1 END) as leave_days,
            COALESCE(SUM(a.work_hours), 0.0) as total_work_hours
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date LIKE ?
        WHERE e.status = 'active'
        GROUP BY e.id
        ORDER BY e.employee_code ASC
    """, (f"{month}%",))

    report = []
    for row in cursor.fetchall():
        r = dict(row)
        r["standard_days"] = standard_work_days
        r["total_work_hours"] = round(r["total_work_hours"], 1)
        # Attendance rate
        rate = round((r["days_worked"] / max(1, standard_work_days)) * 100.0, 1)
        r["completion_rate"] = min(100.0, rate)

        # Rating evaluation
        if r["completion_rate"] >= 95 and r["late_days"] <= 1:
            rating = "Xuất sắc"
            badge = "emerald"
        elif r["completion_rate"] >= 80:
            rating = "Tốt"
            badge = "blue"
        elif r["completion_rate"] >= 65:
            rating = "Trung bình"
            badge = "amber"
        else:
            rating = "Cần cải thiện"
            badge = "rose"

        r["rating"] = rating
        r["rating_badge"] = badge
        report.append(r)

    conn.close()
    return {"month": month, "standard_work_days": standard_work_days, "report": report}

# ----------------- MASTER DATA & SETTINGS -----------------

@app.get("/api/departments")
def get_departments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.*, COUNT(e.id) as employee_count 
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
        GROUP BY d.id
    """)
    departments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return departments

@app.get("/api/shifts")
def get_shifts():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM shifts")
    shifts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return shifts

@app.put("/api/shifts/{shift_id}")
def update_shift(shift_id: int, payload: ShiftUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE shifts 
        SET name = ?, start_time = ?, end_time = ?, break_start = ?, break_end = ?, 
            grace_period_minutes = ?, standard_hours = ?
        WHERE id = ?
    """, (payload.name, payload.start_time, payload.end_time, payload.break_start, payload.break_end,
          payload.grace_period_minutes, payload.standard_hours, shift_id))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Cập nhật ca làm việc thành công!"}

@app.get("/api/settings")
def get_settings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    settings_dict = {row["key"]: row["value"] for row in cursor.fetchall()}
    conn.close()
    return settings_dict

@app.post("/api/settings")
def update_settings(payload: SettingsUpdate):
    conn = get_db()
    cursor = conn.cursor()
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if v is not None:
            cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (k, str(v)))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Cập nhật cấu hình hệ thống thành công!"}

@app.post("/api/reset-data")
def reset_database_data():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attendance")
    cursor.execute("DELETE FROM leave_requests")
    cursor.execute("DELETE FROM employees")
    cursor.execute("DELETE FROM departments")
    cursor.execute("DELETE FROM shifts")
    cursor.execute("DELETE FROM settings")
    conn.commit()
    conn.close()
    seed_data_if_empty()
    return {"success": True, "message": "Đã khôi phục dữ liệu mẫu thành công!"}

if __name__ == "__main__":
    import uvicorn
    import socket
    import webbrowser
    import time
    import threading

    def find_free_port(preferred_port=8000):
        candidate_ports = [preferred_port, 8080, 8088, 8888, 5000]
        for port in candidate_ports:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("127.0.0.1", port))
                    return port
                except OSError:
                    continue
        return preferred_port

    target_port = find_free_port(8000)
    url = f"http://127.0.0.1:{target_port}"
    print("\n=======================================================")
    print("  TimeTrack Pro - He Thong Quan Ly Cham Cong")
    print(f"  Dang khoi chay tren: {url}")
    print(f"  Tai lieu Swagger API: {url}/docs")
    print("=======================================================\n")

    def auto_open_browser():
        time.sleep(1.2)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=auto_open_browser, daemon=True).start()
    uvicorn.run("main:app", host="127.0.0.1", port=target_port, reload=True)
