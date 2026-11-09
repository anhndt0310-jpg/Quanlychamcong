// TimeTrack Pro - Core JavaScript Application

const API_BASE = "";

// State
const state = {
    currentTab: 'dashboard',
    employees: [],
    departments: [],
    shifts: [],
    settings: {},
    todayAttendance: [],
    charts: {
        weekly: null,
        dept: null
    },
    cameraStream: null,
    capturedImage: null
};

// --- AUDIO NOTIFICATIONS ---
function playSound(type = 'success') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (type === 'success') {
            // Happy 3-note arpeggio (C5 -> E5 -> G5)
            const notes = [523.25, 659.25, 783.99];
            notes.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.1 + 0.25);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + idx * 0.1);
                osc.stop(audioCtx.currentTime + idx * 0.1 + 0.25);
            });
        } else if (type === 'warning') {
            // Warning dual beep
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.setValueAtTime(349, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) {
        console.warn("Audio context not allowed or supported:", e);
    }
}

// --- TOAST NOTIFICATIONS ---
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const borderColors = {
        success: 'border-emerald-500 bg-emerald-50 text-emerald-900',
        error: 'border-rose-500 bg-rose-50 text-rose-900',
        warning: 'border-amber-500 bg-amber-50 text-amber-900',
        info: 'border-blue-500 bg-blue-50 text-blue-900'
    };
    const iconColors = {
        success: 'text-emerald-600',
        error: 'text-rose-600',
        warning: 'text-amber-600',
        info: 'text-blue-600'
    };
    const iconNames = {
        success: 'check-circle-2',
        error: 'alert-triangle',
        warning: 'alert-circle',
        info: 'info'
    };

    toast.className = `toast shadow-lg rounded-xl p-4 border-l-4 ${borderColors[type] || borderColors.info} flex items-start gap-3 w-84 max-w-sm`;
    toast.innerHTML = `
        <div class="mt-0.5 ${iconColors[type]}"><i data-lucide="${iconNames[type]}" class="w-5 h-5"></i></div>
        <div class="flex-1">
            <h4 class="font-bold text-sm leading-tight">${title}</h4>
            <p class="text-xs mt-1 text-slate-600">${message}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-sm font-semibold">&times;</button>
    `;

    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// --- CLOCK & DATE ---
function initRealtimeClock() {
    function update() {
        const now = new Date();
        const timeEl = document.getElementById('header-realtime-clock');
        const kioskTimeEl = document.getElementById('kiosk-digital-clock');
        const kioskDateEl = document.getElementById('kiosk-digital-date');

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeString = `${hours}:${minutes}:${seconds}`;

        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const day = dayNames[now.getDay()];
        const dateString = `${day}, ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        if (timeEl) timeEl.textContent = `${timeString} • ${dateString}`;
        if (kioskTimeEl) kioskTimeEl.textContent = timeString;
        if (kioskDateEl) kioskDateEl.textContent = dateString;
    }
    update();
    setInterval(update, 1000);
}

// --- TAB SWITCHING ---
function switchTab(tabId) {
    state.currentTab = tabId;

    // Update nav links
    document.querySelectorAll('.nav-tab').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle content views
    document.querySelectorAll('.tab-view').forEach(view => {
        if (view.id === `view-${tabId}`) {
            view.classList.remove('hidden');
        } else {
            view.classList.add('hidden');
        }
    });

    // Refresh data according to tab
    if (tabId === 'dashboard') {
        loadDashboard();
    } else if (tabId === 'kiosk') {
        initKiosk();
    } else if (tabId === 'attendance') {
        loadAttendanceLogs();
    } else if (tabId === 'employees') {
        loadEmployeesView();
    } else if (tabId === 'leaves') {
        loadLeaveRequests();
    } else if (tabId === 'reports') {
        loadMonthlyReport();
    } else if (tabId === 'settings') {
        loadSettingsView();
    }

    lucide.createIcons();
}

// --- STATUS HELPERS ---
function getStatusBadge(status, lateMinutes = 0, earlyMinutes = 0) {
    switch (status) {
        case 'on_time':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Đúng giờ
            </span>`;
        case 'late':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Đi muộn (${lateMinutes}p)
            </span>`;
        case 'early_leave':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>Về sớm (${earlyMinutes}p)
            </span>`;
        case 'leave':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>Nghỉ phép
            </span>`;
        case 'business_trip':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Công tác
            </span>`;
        case 'absent':
        default:
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Chưa điểm danh
            </span>`;
    }
}

function getLeaveTypeLabel(type) {
    const map = {
        'annual_leave': 'Nghỉ phép năm',
        'sick_leave': 'Nghỉ ốm / Chế độ',
        'late_early': 'Xin đi muộn / Về sớm',
        'overtime': 'Làm thêm ngoài giờ (OT)',
        'business_trip': 'Công tác ngoài'
    };
    return map[type] || type;
}

// --- DASHBOARD ---
async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard/stats`);
        const data = await res.json();

        // Update Counter Cards
        document.getElementById('stat-total-emp').textContent = data.total_active_employees;
        document.getElementById('stat-present').textContent = data.total_present;
        document.getElementById('stat-late').textContent = data.late_count;
        document.getElementById('stat-not-checked').textContent = data.not_checked_in;
        document.getElementById('stat-leaves').textContent = data.pending_leaves;
        document.getElementById('stat-rate').textContent = `${data.attendance_rate}%`;

        // Render Weekly Chart
        renderWeeklyChart(data.weekly_chart);

        // Render Department Doughnut Chart
        renderDeptChart(data.dept_distribution);

        // Render Recent Activity Feed
        renderRecentActivities(data.recent_activities);

        // Load today attendance table
        loadTodayAttendanceTable();
    } catch (e) {
        console.error("Lỗi khi tải bảng điều khiển:", e);
    }
}

function renderWeeklyChart(weeklyData) {
    const ctx = document.getElementById('weeklyChart');
    if (!ctx) return;

    if (state.charts.weekly) {
        state.charts.weekly.destroy();
    }

    state.charts.weekly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeklyData.labels,
            datasets: [
                {
                    label: 'Đúng giờ',
                    data: weeklyData.on_time,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Đi muộn',
                    data: weeklyData.late,
                    backgroundColor: '#f59e0b',
                    borderRadius: 6
                },
                {
                    label: 'Nghỉ phép',
                    data: weeklyData.leave,
                    backgroundColor: '#6366f1',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Plus Jakarta Sans', size: 12 }, usePointStyle: true }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { stepSize: 2 } }
            }
        }
    });
}

function renderDeptChart(deptData) {
    const ctx = document.getElementById('deptChart');
    if (!ctx) return;

    if (state.charts.dept) {
        state.charts.dept.destroy();
    }

    const labels = deptData.map(d => d.name);
    const counts = deptData.map(d => d.emp_count);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

    state.charts.dept = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12 }
                }
            },
            cutout: '65%'
        }
    });
}

function renderRecentActivities(activities) {
    const container = document.getElementById('recent-activities-list');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-sm text-slate-400">Chưa có lượt điểm danh nào hôm nay</div>`;
        return;
    }

    container.innerHTML = activities.map(act => {
        const isCheckOut = !!act.check_out_time;
        const actionText = isCheckOut ? 'Đã Check-out' : 'Đã Check-in';
        const time = isCheckOut ? act.check_out_time : act.check_in_time;
        const badge = getStatusBadge(act.status, act.late_minutes);

        return `
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-all border border-slate-100">
                <div class="flex items-center gap-3">
                    <img src="${act.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + act.employee_code}" class="w-10 h-10 rounded-full border border-slate-200 bg-white" alt="Avatar">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-sm text-slate-800">${act.full_name}</span>
                            <span class="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono">${act.employee_code}</span>
                        </div>
                        <p class="text-xs text-slate-500">${act.department_name || 'Nhân sự'} • <span class="text-blue-600 font-medium">${actionText} ${time}</span></p>
                    </div>
                </div>
                <div>${badge}</div>
            </div>
        `;
    }).join('');
}

async function loadTodayAttendanceTable() {
    try {
        const res = await fetch(`${API_BASE}/api/attendance/today`);
        state.todayAttendance = await res.json();

        renderTodayAttendanceTable(state.todayAttendance);
    } catch (e) {
        console.error("Lỗi khi tải bảng điểm danh hôm nay:", e);
    }
}

function renderTodayAttendanceTable(list) {
    const tbody = document.getElementById('today-attendance-tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Không tìm thấy bản ghi điểm danh hôm nay</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const badge = getStatusBadge(item.status, item.late_minutes, item.early_leave_minutes);
        const inTime = item.check_in_time ? `<span class="font-mono font-medium text-slate-800">${item.check_in_time}</span>` : `<span class="text-slate-400 text-xs">--:--:--</span>`;
        const outTime = item.check_out_time ? `<span class="font-mono font-medium text-slate-800">${item.check_out_time}</span>` : `<span class="text-slate-400 text-xs">--:--:--</span>`;
        const workHours = item.work_hours ? `<span class="font-semibold text-blue-600">${item.work_hours}h</span>` : `<span class="text-slate-400 text-xs">--</span>`;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                <td class="px-4 py-3.5 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        <img src="${item.avatar_url}" class="w-9 h-9 rounded-full bg-slate-100 border border-slate-200" alt="Avatar">
                        <div>
                            <div class="font-semibold text-sm text-slate-800">${item.full_name}</div>
                            <div class="text-xs text-slate-500 font-mono">${item.employee_code}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600">${item.department_name || '--'}</td>
                <td class="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600">
                    <span class="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">${item.shift_name || 'Hành chính'}</span>
                </td>
                <td class="px-4 py-3.5 whitespace-nowrap">${inTime}</td>
                <td class="px-4 py-3.5 whitespace-nowrap">${outTime}</td>
                <td class="px-4 py-3.5 whitespace-nowrap">${badge}</td>
                <td class="px-4 py-3.5 whitespace-nowrap text-sm">${workHours}</td>
            </tr>
        `;
    }).join('');
}

// --- KIOSK CHẤM CÔNG ---
async function initKiosk() {
    // Populate employee selection dropdown in kiosk
    const select = document.getElementById('kiosk-emp-select');
    if (!select) return;

    if (state.employees.length === 0) {
        await loadMasterData();
    }

    select.innerHTML = `<option value="">-- Chọn hoặc tìm nhân viên --</option>` +
        state.employees.map(emp => `
            <option value="${emp.id}" data-code="${emp.employee_code}" data-shift="${emp.shift_name}" data-dept="${emp.department_name}">
                ${emp.employee_code} - ${emp.full_name} (${emp.department_name})
            </option>
        `).join('');

    // Start Camera Preview
    startCamera();
}

async function startCamera() {
    const video = document.getElementById('kiosk-video');
    const placeholder = document.getElementById('camera-placeholder');
    if (!video) return;

    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
            state.cameraStream = stream;
            video.srcObject = stream;
            video.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
        } else {
            console.log("Camera API not available; simulation mode enabled.");
        }
    } catch (err) {
        console.warn("Không thể truy cập camera thực tế, dùng giao diện mô phỏng:", err);
        if (placeholder) {
            placeholder.classList.remove('hidden');
            placeholder.innerHTML = `
                <div class="text-center p-4">
                    <div class="w-16 h-16 mx-auto mb-2 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <i data-lucide="camera" class="w-8 h-8"></i>
                    </div>
                    <p class="text-sm font-semibold text-slate-700">Chế độ Nhận diện Khuôn mặt (Mô phỏng)</p>
                    <p class="text-xs text-slate-500 mt-1">Hệ thống AI TimeTrack Pro sẵn sàng chụp ảnh xác thực</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
}

function captureSnapshot() {
    const video = document.getElementById('kiosk-video');
    if (video && !video.classList.contains('hidden') && video.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    }
    return null;
}

async function handleKioskCheckIn() {
    const select = document.getElementById('kiosk-emp-select');
    const codeInput = document.getElementById('kiosk-code-input');
    const noteInput = document.getElementById('kiosk-note-input');

    const empId = select.value ? parseInt(select.value) : null;
    const empCode = codeInput.value.trim();
    const note = noteInput ? noteInput.value.trim() : '';

    if (!empId && !empCode) {
        showToast('Chưa chọn nhân viên', 'Vui lòng chọn nhân viên từ danh sách hoặc nhập Mã nhân viên (NV...)', 'warning');
        playSound('warning');
        return;
    }

    const imageBase64 = captureSnapshot();

    try {
        const res = await fetch(`${API_BASE}/api/attendance/check-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: empId,
                employee_code: empCode,
                note: note,
                image_base64: imageBase64
            })
        });

        const result = await res.json();
        if (!res.ok) {
            showToast('Lỗi điểm danh', result.detail || 'Không thể điểm danh', 'error');
            playSound('warning');
            return;
        }

        if (result.already_checked_in) {
            showToast('Đã điểm danh trước đó', result.message, 'warning');
            playSound('warning');
        } else {
            showToast('Điểm danh thành công!', result.message, 'success');
            playSound('success');
            showCheckInSuccessModal(result, 'in');
        }

        // Reset inputs
        codeInput.value = '';
        if (noteInput) noteInput.value = '';
        loadTodayAttendanceTable();
    } catch (e) {
        console.error(e);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ', 'error');
    }
}

async function handleKioskCheckOut() {
    const select = document.getElementById('kiosk-emp-select');
    const codeInput = document.getElementById('kiosk-code-input');
    const noteInput = document.getElementById('kiosk-note-input');

    const empId = select.value ? parseInt(select.value) : null;
    const empCode = codeInput.value.trim();
    const note = noteInput ? noteInput.value.trim() : '';

    if (!empId && !empCode) {
        showToast('Chưa chọn nhân viên', 'Vui lòng chọn nhân viên hoặc nhập Mã NV', 'warning');
        playSound('warning');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/attendance/check-out`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: empId,
                employee_code: empCode,
                note: note
            })
        });

        const result = await res.json();
        if (!res.ok) {
            showToast('Lỗi Check-out', result.detail || 'Không thể check-out', 'error');
            playSound('warning');
            return;
        }

        showToast('Check-out thành công!', result.message, 'success');
        playSound('success');
        showCheckInSuccessModal(result, 'out');

        codeInput.value = '';
        if (noteInput) noteInput.value = '';
        loadTodayAttendanceTable();
    } catch (e) {
        console.error(e);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ', 'error');
    }
}

function showCheckInSuccessModal(data, type) {
    const modal = document.getElementById('kiosk-result-modal');
    if (!modal) return;

    const titleEl = document.getElementById('kiosk-modal-title');
    const timeEl = document.getElementById('kiosk-modal-time');
    const nameEl = document.getElementById('kiosk-modal-name');
    const statusEl = document.getElementById('kiosk-modal-status');
    const extraEl = document.getElementById('kiosk-modal-extra');

    nameEl.textContent = `${data.employee_name} (${data.employee_code})`;

    if (type === 'in') {
        titleEl.textContent = 'ĐIỂM DANH VÀO CA THÀNH CÔNG';
        titleEl.className = 'font-bold text-lg text-emerald-600';
        timeEl.textContent = data.check_in_time;
        statusEl.innerHTML = getStatusBadge(data.status, data.late_minutes);
        extraEl.textContent = data.late_minutes > 0 ? `Lưu ý: Bạn đã đi muộn ${data.late_minutes} phút so với giờ quy định.` : 'Cảm ơn bạn đã đến làm việc đúng giờ!';
    } else {
        titleEl.textContent = 'CHECK-OUT RA CA THÀNH CÔNG';
        titleEl.className = 'font-bold text-lg text-blue-600';
        timeEl.textContent = data.check_out_time;
        statusEl.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Tổng giờ làm: ${data.work_hours} giờ</span>`;
        extraEl.textContent = data.early_leave_minutes > 0 ? `Lưu ý: Bạn về sớm ${data.early_leave_minutes} phút.` : 'Chúc bạn có một buổi tối thư giãn vui vẻ!';
    }

    modal.classList.remove('hidden');
    lucide.createIcons();

    // Auto close after 4 seconds
    setTimeout(() => {
        closeModal('kiosk-result-modal');
    }, 4500);
}

// --- ATTENDANCE TIMESHEET LOGS ---
async function loadAttendanceLogs() {
    const dateFrom = document.getElementById('log-date-from')?.value || '';
    const dateTo = document.getElementById('log-date-to')?.value || '';
    const deptId = document.getElementById('log-dept-select')?.value || '';
    const status = document.getElementById('log-status-select')?.value || 'all';
    const search = document.getElementById('log-search-input')?.value || '';

    // Populate department filter if empty
    const deptSelect = document.getElementById('log-dept-select');
    if (deptSelect && deptSelect.children.length <= 1) {
        deptSelect.innerHTML = `<option value="">Tất cả phòng ban</option>` +
            state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    }

    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (deptId) params.append('department_id', deptId);
    if (status) params.append('status', status);
    if (search) params.append('search', search);

    try {
        const res = await fetch(`${API_BASE}/api/attendance/logs?${params.toString()}`);
        const rows = await res.json();
        renderAttendanceLogsTable(rows);
    } catch (e) {
        console.error("Lỗi khi tải bảng nhật ký chấm công:", e);
    }
}

function renderAttendanceLogsTable(rows) {
    const tbody = document.getElementById('attendance-logs-tbody');
    if (!tbody) return;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-slate-400">Không tìm thấy dữ liệu chấm công khớp bộ lọc</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const badge = getStatusBadge(r.status, r.late_minutes, r.early_leave_minutes);
        const adjustedBadge = r.is_manual_adjusted ? `<span class="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-medium" title="Người sửa: ${r.adjusted_by || 'Admin'}">Đã sửa</span>` : '';

        return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-sm">
                <td class="px-4 py-3 whitespace-nowrap font-mono font-medium text-slate-700">${r.date}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-2.5">
                        <img src="${r.avatar_url}" class="w-8 h-8 rounded-full border border-slate-200" alt="Avatar">
                        <div>
                            <div class="font-semibold text-slate-800 leading-tight">${r.full_name}</div>
                            <div class="text-xs text-slate-400 font-mono">${r.employee_code}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">${r.department_name || '--'}</td>
                <td class="px-4 py-3 whitespace-nowrap font-mono text-slate-800">${r.check_in_time || '--:--'}</td>
                <td class="px-4 py-3 whitespace-nowrap font-mono text-slate-800">${r.check_out_time || '--:--'}</td>
                <td class="px-4 py-3 whitespace-nowrap">${badge} ${adjustedBadge}</td>
                <td class="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">${r.work_hours || 0.0}h</td>
                <td class="px-4 py-3 text-slate-500 text-xs max-w-xs truncate" title="${r.note || ''}">${r.note || '--'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                    <button onclick="openAdjustModal(${JSON.stringify(r).replace(/"/g, '&quot;')})" 
                            class="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                        Sửa công
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function exportExcel() {
    const month = document.getElementById('log-date-from')?.value?.substring(0, 7) || new Date().toISOString().substring(0, 7);
    window.location.href = `${API_BASE}/api/attendance/export?month=${month}`;
    showToast('Tải xuống Excel', `Đang kết xuất dữ liệu chấm công tháng ${month}...`, 'info');
}

// Manual Adjustment Modal
function openAdjustModal(record) {
    const modal = document.getElementById('adjust-modal');
    if (!modal) return;

    document.getElementById('adjust-emp-id').value = record.employee_id;
    document.getElementById('adjust-emp-name').textContent = `${record.full_name} (${record.employee_code})`;
    document.getElementById('adjust-date').value = record.date;
    document.getElementById('adjust-in').value = record.check_in_time || '08:00:00';
    document.getElementById('adjust-out').value = record.check_out_time || '17:30:00';
    document.getElementById('adjust-status').value = record.status || 'on_time';
    document.getElementById('adjust-note').value = record.note || '';

    modal.classList.remove('hidden');
}

async function saveAdjustAttendance() {
    const empId = parseInt(document.getElementById('adjust-emp-id').value);
    const date = document.getElementById('adjust-date').value;
    const inTime = document.getElementById('adjust-in').value;
    const outTime = document.getElementById('adjust-out').value;
    const status = document.getElementById('adjust-status').value;
    const note = document.getElementById('adjust-note').value;

    try {
        const res = await fetch(`${API_BASE}/api/attendance/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: empId,
                date: date,
                check_in_time: inTime,
                check_out_time: outTime,
                status: status,
                note: note,
                adjusted_by: 'Admin HR'
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Thành công', data.message, 'success');
            closeModal('adjust-modal');
            loadAttendanceLogs();
            loadTodayAttendanceTable();
        } else {
            showToast('Lỗi', data.detail || 'Không thể điều chỉnh công', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Lỗi khi gửi yêu cầu điều chỉnh', 'error');
    }
}

// --- EMPLOYEE MANAGEMENT ---
async function loadEmployeesView() {
    const deptFilter = document.getElementById('emp-dept-filter')?.value || '';
    const search = document.getElementById('emp-search-input')?.value || '';

    // Populate department select if empty
    const deptSelect = document.getElementById('emp-dept-filter');
    if (deptSelect && deptSelect.children.length <= 1) {
        deptSelect.innerHTML = `<option value="">Tất cả phòng ban</option>` +
            state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    }

    const params = new URLSearchParams();
    if (deptFilter) params.append('department_id', deptFilter);
    if (search) params.append('search', search);

    try {
        const res = await fetch(`${API_BASE}/api/employees?${params.toString()}`);
        state.employees = await res.json();
        renderEmployeesGrid(state.employees);
    } catch (e) {
        console.error("Lỗi khi tải danh sách nhân viên:", e);
    }
}

function renderEmployeesGrid(employees) {
    const grid = document.getElementById('employees-grid');
    if (!grid) return;

    if (employees.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400">Không tìm thấy nhân viên phù hợp</div>`;
        return;
    }

    grid.innerHTML = employees.map(emp => {
        const statusBadge = emp.status === 'active'
            ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Đang làm việc</span>`
            : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Đã nghỉ việc</span>`;

        return `
            <div class="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <img src="${emp.avatar_url}" class="w-12 h-12 rounded-full border border-slate-200 bg-slate-50" alt="Avatar">
                            <div>
                                <h3 class="font-bold text-slate-800 text-base leading-tight">${emp.full_name}</h3>
                                <p class="text-xs text-blue-600 font-mono mt-0.5">${emp.employee_code}</p>
                            </div>
                        </div>
                        ${statusBadge}
                    </div>

                    <div class="mt-4 space-y-2 text-xs text-slate-600">
                        <div class="flex items-center gap-2">
                            <i data-lucide="briefcase" class="w-3.5 h-3.5 text-slate-400"></i>
                            <span class="font-medium text-slate-700">${emp.position}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="building-2" class="w-3.5 h-3.5 text-slate-400"></i>
                            <span>${emp.department_name || 'Chưa phân bổ'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="mail" class="w-3.5 h-3.5 text-slate-400"></i>
                            <span class="truncate">${emp.email || 'Chưa có email'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                            <span>Ca: <strong class="text-slate-700">${emp.shift_name || 'Hành chính'}</strong></span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                            <span>Phép năm còn: <strong class="text-emerald-600">${emp.leave_balance} ngày</strong></span>
                        </div>
                    </div>
                </div>

                <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[11px] text-slate-400">Vào làm: ${emp.hire_date || '--'}</span>
                    <div class="flex items-center gap-1.5">
                        <button onclick="openEditEmployeeModal(${JSON.stringify(emp).replace(/"/g, '&quot;')})" 
                                class="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Sửa thông tin">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="confirmDeleteEmployee(${emp.id}, '${emp.full_name}')" 
                                class="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Xóa nhân viên">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function openAddEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    if (!modal) return;

    document.getElementById('emp-modal-title').textContent = 'Thêm Nhân Viên Mới';
    document.getElementById('emp-form-id').value = '';
    document.getElementById('emp-form-code').value = `NV${String(state.employees.length + 1).padStart(3, '0')}`;
    document.getElementById('emp-form-name').value = '';
    document.getElementById('emp-form-email').value = '';
    document.getElementById('emp-form-phone').value = '';
    document.getElementById('emp-form-position').value = '';
    document.getElementById('emp-form-date').value = new Date().toISOString().substring(0, 10);
    document.getElementById('emp-form-leave').value = '12';

    // Populate department & shift selects
    const deptSelect = document.getElementById('emp-form-dept');
    deptSelect.innerHTML = state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

    const shiftSelect = document.getElementById('emp-form-shift');
    shiftSelect.innerHTML = state.shifts.map(s => `<option value="${s.id}">${s.name} (${s.start_time} - ${s.end_time})</option>`).join('');

    modal.classList.remove('hidden');
}

function openEditEmployeeModal(emp) {
    const modal = document.getElementById('employee-modal');
    if (!modal) return;

    document.getElementById('emp-modal-title').textContent = 'Cập Nhật Thông Tin Nhân Viên';
    document.getElementById('emp-form-id').value = emp.id;
    document.getElementById('emp-form-code').value = emp.employee_code;
    document.getElementById('emp-form-name').value = emp.full_name;
    document.getElementById('emp-form-email').value = emp.email || '';
    document.getElementById('emp-form-phone').value = emp.phone || '';
    document.getElementById('emp-form-position').value = emp.position || '';
    document.getElementById('emp-form-date').value = emp.hire_date || '';
    document.getElementById('emp-form-leave').value = emp.leave_balance || 12;

    const deptSelect = document.getElementById('emp-form-dept');
    deptSelect.innerHTML = state.departments.map(d => `<option value="${d.id}" ${d.id === emp.department_id ? 'selected' : ''}>${d.name}</option>`).join('');

    const shiftSelect = document.getElementById('emp-form-shift');
    shiftSelect.innerHTML = state.shifts.map(s => `<option value="${s.id}" ${s.id === emp.shift_id ? 'selected' : ''}>${s.name}</option>`).join('');

    modal.classList.remove('hidden');
}

async function saveEmployee() {
    const id = document.getElementById('emp-form-id').value;
    const code = document.getElementById('emp-form-code').value.trim();
    const name = document.getElementById('emp-form-name').value.trim();
    const email = document.getElementById('emp-form-email').value.trim();
    const phone = document.getElementById('emp-form-phone').value.trim();
    const deptId = parseInt(document.getElementById('emp-form-dept').value);
    const position = document.getElementById('emp-form-position').value.trim();
    const shiftId = parseInt(document.getElementById('emp-form-shift').value);
    const hireDate = document.getElementById('emp-form-date').value;
    const leaveBalance = parseFloat(document.getElementById('emp-form-leave').value) || 12.0;

    if (!code || !name || !position) {
        showToast('Thiếu thông tin', 'Vui lòng nhập Mã NV, Họ Tên và Chức Vụ!', 'warning');
        return;
    }

    try {
        let res, data;
        if (id) {
            // Update
            res = await fetch(`${API_BASE}/api/employees/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: name,
                    email: email,
                    phone: phone,
                    department_id: deptId,
                    position: position,
                    shift_id: shiftId,
                    leave_balance: leaveBalance
                })
            });
        } else {
            // Create
            res = await fetch(`${API_BASE}/api/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_code: code,
                    full_name: name,
                    email: email,
                    phone: phone,
                    department_id: deptId,
                    position: position,
                    shift_id: shiftId,
                    hire_date: hireDate,
                    leave_balance: leaveBalance
                })
            });
        }

        data = await res.json();
        if (res.ok) {
            showToast('Thành công', data.message, 'success');
            closeModal('employee-modal');
            await loadMasterData();
            loadEmployeesView();
        } else {
            showToast('Lỗi', data.detail || 'Không thể lưu nhân viên', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
}

async function confirmDeleteEmployee(id, name) {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên "${name}" cùng toàn bộ dữ liệu chấm công liên quan không?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/employees/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            showToast('Đã xóa', data.message, 'success');
            await loadMasterData();
            loadEmployeesView();
        } else {
            showToast('Lỗi', data.detail || 'Không thể xóa', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Không thể xóa nhân viên', 'error');
    }
}

// --- LEAVE & REQUEST MANAGEMENT ---
async function loadLeaveRequests() {
    const statusFilter = document.getElementById('leave-status-filter')?.value || 'all';

    try {
        const res = await fetch(`${API_BASE}/api/leave-requests?status=${statusFilter}`);
        const requests = await res.json();
        renderLeaveRequestsTable(requests);
    } catch (e) {
        console.error("Lỗi khi tải danh sách đơn từ:", e);
    }
}

function renderLeaveRequestsTable(requests) {
    const tbody = document.getElementById('leave-requests-tbody');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-slate-400">Không có đơn từ nào phù hợp</td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(req => {
        let statusBadge = '';
        if (req.status === 'approved') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Đã duyệt (${req.approved_by || 'HR'})
            </span>`;
        } else if (req.status === 'rejected') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Từ chối
            </span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Chờ duyệt
            </span>`;
        }

        const actionButtons = req.status === 'pending' ? `
            <div class="flex items-center gap-1.5 justify-end">
                <button onclick="reviewLeave(${req.id}, 'approved')" class="px-2.5 py-1 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition font-medium">Duyệt</button>
                <button onclick="reviewLeave(${req.id}, 'rejected')" class="px-2.5 py-1 text-xs rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition font-medium">Từ chối</button>
            </div>
        ` : `<span class="text-xs text-slate-400 italic">Đã xử lý</span>`;

        return `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-2.5">
                        <img src="${req.avatar_url}" class="w-8 h-8 rounded-full border border-slate-200" alt="Avatar">
                        <div>
                            <div class="font-semibold text-slate-800">${req.full_name}</div>
                            <div class="text-xs text-slate-400 font-mono">${req.employee_code} • ${req.department_name}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap font-medium text-slate-700">${getLeaveTypeLabel(req.request_type)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                    <div>${req.start_date} <i data-lucide="arrow-right" class="inline w-3 h-3"></i> ${req.end_date}</div>
                    <div class="text-[11px] text-blue-600 font-medium">(${req.days_count} ngày)</div>
                </td>
                <td class="px-4 py-3 text-xs text-slate-600 max-w-xs">${req.reason}</td>
                <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-400">${req.created_at || '--'}</td>
                <td class="px-4 py-3 whitespace-nowrap">${statusBadge}</td>
                <td class="px-4 py-3 whitespace-nowrap text-right">${actionButtons}</td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

function openCreateLeaveModal() {
    const modal = document.getElementById('create-leave-modal');
    if (!modal) return;

    const empSelect = document.getElementById('leave-emp-select');
    empSelect.innerHTML = state.employees.map(e => `
        <option value="${e.id}">${e.employee_code} - ${e.full_name} (${e.department_name}) - Phép còn: ${e.leave_balance}d</option>
    `).join('');

    const todayStr = new Date().toISOString().substring(0, 10);
    document.getElementById('leave-start-date').value = todayStr;
    document.getElementById('leave-end-date').value = todayStr;
    document.getElementById('leave-days-count').value = '1.0';
    document.getElementById('leave-reason').value = '';

    modal.classList.remove('hidden');
}

async function submitCreateLeave() {
    const empId = parseInt(document.getElementById('leave-emp-select').value);
    const type = document.getElementById('leave-type-select').value;
    const start = document.getElementById('leave-start-date').value;
    const end = document.getElementById('leave-end-date').value;
    const days = parseFloat(document.getElementById('leave-days-count').value) || 1.0;
    const reason = document.getElementById('leave-reason').value.trim();

    if (!empId || !start || !end || !reason) {
        showToast('Thiếu thông tin', 'Vui lòng nhập đầy đủ ngày tháng và lý do nghỉ!', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/leave-requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: empId,
                request_type: type,
                start_date: start,
                end_date: end,
                days_count: days,
                reason: reason
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Thành công', data.message, 'success');
            closeModal('create-leave-modal');
            loadLeaveRequests();
        } else {
            showToast('Lỗi', data.detail || 'Không thể gửi đơn', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
}

async function reviewLeave(reqId, status) {
    const reason = status === 'rejected' ? prompt('Nhập lý do từ chối (tùy chọn):') : null;

    try {
        const res = await fetch(`${API_BASE}/api/leave-requests/${reqId}/review`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: status,
                approved_by: 'Trần Thị Mai (HR Manager)',
                rejection_reason: reason
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Đã xử lý đơn', data.message, status === 'approved' ? 'success' : 'info');
            loadLeaveRequests();
            loadDashboard();
        } else {
            showToast('Lỗi', data.detail || 'Không thể cập nhật đơn', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
}

// --- MONTHLY PAYROLL / ATTENDANCE REPORT ---
async function loadMonthlyReport() {
    const monthInput = document.getElementById('report-month-picker');
    const month = monthInput?.value || new Date().toISOString().substring(0, 7);

    try {
        const res = await fetch(`${API_BASE}/api/reports/monthly?month=${month}`);
        const data = await res.json();

        document.getElementById('report-standard-days').textContent = data.standard_work_days;
        renderMonthlyReportTable(data.report);
    } catch (e) {
        console.error("Lỗi khi tải báo cáo công:", e);
    }
}

function renderMonthlyReportTable(report) {
    const tbody = document.getElementById('report-tbody');
    if (!tbody) return;

    if (!report || report.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-10 text-center text-slate-400">Chưa có dữ liệu tính công tháng này</td></tr>`;
        return;
    }

    tbody.innerHTML = report.map(r => {
        let ratingBadgeClass = 'bg-blue-100 text-blue-800';
        if (r.rating_badge === 'emerald') ratingBadgeClass = 'bg-emerald-100 text-emerald-800';
        if (r.rating_badge === 'amber') ratingBadgeClass = 'bg-amber-100 text-amber-800';
        if (r.rating_badge === 'rose') ratingBadgeClass = 'bg-rose-100 text-rose-800';

        return `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                <td class="px-4 py-3 whitespace-nowrap font-mono font-medium text-blue-600">${r.employee_code}</td>
                <td class="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">${r.full_name}</td>
                <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-500">${r.department_name || '--'}</td>
                <td class="px-4 py-3 whitespace-nowrap font-bold text-slate-700">${r.days_worked} / ${r.standard_days} ngày</td>
                <td class="px-4 py-3 whitespace-nowrap text-emerald-600 font-medium">${r.on_time_days}</td>
                <td class="px-4 py-3 whitespace-nowrap text-amber-600 font-medium">
                    ${r.late_days} lần <span class="text-xs text-slate-400">(${r.total_late_minutes}p)</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-indigo-600 font-medium">${r.leave_days} ngày</td>
                <td class="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-800">${r.total_work_hours}h</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <div class="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${r.completion_rate}%"></div>
                        </div>
                        <span class="text-xs font-mono font-semibold">${r.completion_rate}%</span>
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${ratingBadgeClass}">${r.rating}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// --- SETTINGS VIEW ---
async function loadSettingsView() {
    try {
        const [settingsRes, shiftsRes] = await Promise.all([
            fetch(`${API_BASE}/api/settings`),
            fetch(`${API_BASE}/api/shifts`)
        ]);

        state.settings = await settingsRes.json();
        state.shifts = await shiftsRes.json();

        // Populate Form
        document.getElementById('setting-company-name').value = state.settings.company_name || '';
        document.getElementById('setting-company-address').value = state.settings.company_address || '';
        document.getElementById('setting-company-wifi').value = state.settings.company_wifi || '';
        document.getElementById('setting-grace-minutes').value = state.settings.grace_period_minutes || '15';

        // Render Shifts
        renderShiftsSettings(state.shifts);
    } catch (e) {
        console.error("Lỗi tải cài đặt:", e);
    }
}

function renderShiftsSettings(shifts) {
    const container = document.getElementById('shifts-settings-container');
    if (!container) return;

    container.innerHTML = shifts.map(s => `
        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
                <h4 class="font-bold text-slate-800 text-sm">${s.name}</h4>
                <p class="text-xs text-slate-500 mt-0.5">
                    Giờ làm: <strong class="text-blue-600 font-mono">${s.start_time} - ${s.end_time}</strong> | 
                    Nghỉ trưa: <strong class="text-slate-700 font-mono">${s.break_start || 'Không'} - ${s.break_end || 'Không'}</strong> | 
                    Chuẩn: <strong>${s.standard_hours}h</strong>
                </p>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500">Ân hạn: <strong>${s.grace_period_minutes} phút</strong></span>
            </div>
        </div>
    `).join('');
}

async function saveGeneralSettings() {
    const companyName = document.getElementById('setting-company-name').value;
    const address = document.getElementById('setting-company-address').value;
    const wifi = document.getElementById('setting-company-wifi').value;
    const grace = document.getElementById('setting-grace-minutes').value;

    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company_name: companyName,
                company_address: address,
                company_wifi: wifi,
                grace_period_minutes: grace
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Đã lưu cấu hình', data.message, 'success');
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Không thể lưu cài đặt', 'error');
    }
}

async function resetDemoData() {
    if (!confirm('Bạn có chắc muốn đặt lại dữ liệu mẫu về trạng thái ban đầu? Tất cả chỉnh sửa mới sẽ bị ghi đè.')) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/reset-data`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast('Khôi phục thành công', data.message, 'success');
            await loadMasterData();
            loadDashboard();
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Không thể đặt lại dữ liệu', 'error');
    }
}

// --- MASTER DATA ---
async function loadMasterData() {
    try {
        const [empRes, deptRes, shiftsRes] = await Promise.all([
            fetch(`${API_BASE}/api/employees`),
            fetch(`${API_BASE}/api/departments`),
            fetch(`${API_BASE}/api/shifts`)
        ]);

        state.employees = await empRes.json();
        state.departments = await deptRes.json();
        state.shifts = await shiftsRes.json();
    } catch (e) {
        console.error("Lỗi khi tải Master Data:", e);
    }
}

// Modal Helpers
function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('hidden');
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    initRealtimeClock();
    await loadMasterData();
    switchTab('dashboard');

    // Default dates for filters
    const todayStr = new Date().toISOString().substring(0, 10);
    const firstDayStr = todayStr.substring(0, 8) + '01';

    const logFrom = document.getElementById('log-date-from');
    const logTo = document.getElementById('log-date-to');
    if (logFrom) logFrom.value = firstDayStr;
    if (logTo) logTo.value = todayStr;

    const reportMonth = document.getElementById('report-month-picker');
    if (reportMonth) reportMonth.value = todayStr.substring(0, 7);

    // Enter key shortcuts in Kiosk
    const kioskCodeInput = document.getElementById('kiosk-code-input');
    if (kioskCodeInput) {
        kioskCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleKioskCheckIn();
            }
        });
    }
});
