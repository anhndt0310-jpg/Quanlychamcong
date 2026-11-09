from pydantic import BaseModel, EmailStr
from typing import Optional, List

class CheckInRequest(BaseModel):
    employee_id: Optional[int] = None
    employee_code: Optional[str] = None
    note: Optional[str] = None
    image_base64: Optional[str] = None

class CheckOutRequest(BaseModel):
    employee_id: Optional[int] = None
    employee_code: Optional[str] = None
    note: Optional[str] = None

class AttendanceAdjustRequest(BaseModel):
    employee_id: int
    date: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    status: str
    note: Optional[str] = None
    adjusted_by: Optional[str] = "Admin"

class EmployeeCreate(BaseModel):
    employee_code: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: int
    position: str
    shift_id: Optional[int] = 1
    hire_date: Optional[str] = None
    leave_balance: Optional[float] = 12.0
    avatar_url: Optional[str] = None

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    position: Optional[str] = None
    shift_id: Optional[int] = None
    status: Optional[str] = None
    leave_balance: Optional[float] = None
    avatar_url: Optional[str] = None

class LeaveRequestCreate(BaseModel):
    employee_id: int
    request_type: str
    start_date: str
    end_date: str
    days_count: Optional[float] = 1.0
    reason: str

class LeaveRequestReview(BaseModel):
    status: str  # approved, rejected
    approved_by: Optional[str] = "Quản lý nhân sự"
    rejection_reason: Optional[str] = None

class ShiftUpdate(BaseModel):
    name: str
    start_time: str
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    grace_period_minutes: int = 15
    standard_hours: float = 8.0

class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_wifi: Optional[str] = None
    grace_period_minutes: Optional[str] = None
