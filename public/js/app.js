/**
 * Votol Controller - Frontend Application
 * Dual mode: Web Bluetooth (direct) / Socket.IO (via server)
 */

const hasBLE = !!navigator.bluetooth;
const hasSerial = !!navigator.serial;
const hasServer = typeof io !== 'undefined' && !window._noServer;
let socket = hasServer ? io() : null;
let connectionMode = null; // 'ble', 'serial', or 'server'
let params = {};
let editingKey = null;

const PARAM_LABELS = {
    overVoltage: { label: 'Quá áp (V)', desc: 'Ngưỡng quá áp, khuyến nghị: 58-84V', step: 1 },
    underVoltage: { label: 'Thiếu áp (V)', desc: 'Ngưỡng thiếu áp, khuyến nghị: 36-60V', step: 1 },
    softUnderVoltage: { label: 'Thiếu áp mềm (V)', desc: 'Ngưỡng thiếu áp mềm', step: 1 },
    underVoltageHyst: { label: 'Độ trễ thiếu áp (V)', desc: 'Khoảng trễ phục hồi thiếu áp', step: 1 },
    busCurrent: { label: 'Dòng bus/Hãm ngược (A)', desc: 'Giới hạn dòng bus và dòng hãm tái sinh', step: 1 },
    phaseCurrentLimit: { label: 'Giới hạn dòng pha', desc: 'Giá trị giới hạn dòng điện pha', step: 1 },
    throttleLowProtect: { label: 'Bảo vệ thấp (V)', desc: 'Điện áp bảo vệ thấp tay ga', step: 0.1 },
    throttleStartV: { label: 'Điện áp khởi động (V)', desc: 'Điện áp bắt đầu tay ga', step: 0.1 },
    throttleEndV: { label: 'Điện áp kết thúc (V)', desc: 'Điện áp tay ga tối đa', step: 0.1 },
    throttleHighProtect: { label: 'Bảo vệ cao (V)', desc: 'Điện áp bảo vệ cao tay ga', step: 0.1 },
    startTorque: { label: 'Mô-men khởi động', desc: 'Giá trị mô-men khi khởi động', step: 1 },
    couplingTorque: { label: 'Mô-men kết hợp', desc: 'Giá trị mô-men kết hợp', step: 1 },
    riseSlope: { label: 'Độ dốc tăng', desc: 'Tốc độ tăng ga', step: 1 },
    fallSlope: { label: 'Độ dốc giảm', desc: 'Tốc độ giảm ga', step: 1 },
    maxCurrentLimit: { label: 'Giới hạn dòng tối đa (A)', desc: 'Dòng điện tối đa cho phép', step: 1 },
    fieldWeakValue: { label: 'Giá trị suy từ', desc: 'Giá trị điều khiển suy từ', step: 1 },
    currentPI_KI: { label: 'Tham số PI dòng (KI)', desc: 'Hệ số tích phân PI vòng dòng', step: 1 },
    exitTime: { label: 'Thời gian thoát (S)', desc: 'Thời gian trước khi tự động thoát', step: 1 },
    recoveryTime: { label: 'Thời gian phục hồi (S)', desc: 'Thời gian phục hồi sau khi thoát', step: 1 },
    maxRPM: { label: 'RPM tối đa', desc: 'Tốc độ quay tối đa cho phép', step: 1 },
    speedLimitRatio: { label: 'Tỷ lệ giới hạn tốc độ (%)', desc: 'Phần trăm giới hạn tốc độ', step: 1 },
    fieldWeakComp: { label: 'Hệ số bù suy từ', desc: 'Hệ số bù suy từ tốc độ', step: 1 },
    lowSpeedRatio: { label: 'Tốc độ thấp (%)', desc: 'Tỷ lệ tốc độ ở số thấp', step: 1 },
    lowSpeedCurrentLimit: { label: 'GH dòng tốc độ thấp (%)', desc: 'Giới hạn dòng ở tốc độ thấp', step: 1 },
    midSpeedRatio: { label: 'Tốc độ trung bình (%)', desc: 'Tỷ lệ tốc độ ở số trung bình', step: 1 },
    midSpeedCurrentLimit: { label: 'GH dòng tốc độ TB (%)', desc: 'Giới hạn dòng ở tốc độ trung bình', step: 1 },
    highSpeedRatio: { label: 'Tốc độ cao (%)', desc: 'Tỷ lệ tốc độ ở số cao', step: 1 },
    overModulation: { label: 'Siêu điều chỉnh (%)', desc: 'Tỷ lệ siêu điều chỉnh', step: 1 },
    accelPhaseCurrent: { label: 'Dòng pha tăng tốc (%)', desc: 'Giới hạn dòng pha khi tăng tốc', step: 1 },
    ratedPhaseTime: { label: 'T/g dòng pha định mức (%)', desc: 'Thời gian giới hạn dòng pha định mức', step: 1 },
    currentPI_KP: { label: 'Tham số PI dòng (KP)', desc: 'Hệ số tỷ lệ PI vòng dòng', step: 1 },
    ratedPhaseCurrent: { label: 'Giới hạn dòng pha định mức', desc: 'Giá trị dòng pha định mức tối đa', step: 1 },
    softStartLevel: { label: 'Cấp khởi động mềm', desc: 'Cấp độ khởi động mềm (1-10)', step: 1 },
    polePairs: { label: 'Số cặp cực', desc: 'Số cặp cực động cơ', step: 1 },
    phaseAngle: { label: 'Góc lệch pha', desc: 'Góc lệch pha động cơ (độ)', step: 1 },
    walkAssistSpeed: { label: 'Tốc độ dắt xe (%)', desc: 'Giới hạn tốc độ khi dắt xe', step: 1 },
    walkAssistTorque: { label: 'Mô-men dắt xe', desc: 'Giá trị mô-men khi dắt xe', step: 1 },
    _modelName: { label: 'Model', desc: 'Tên model bộ điều khiển', step: 0, isText: true },
    batteryVoltage: { label: 'Điện áp (V)', desc: 'Điện áp pin / nguồn', step: 1 },
};

function setConnected(name) {
    const dot = document.getElementById('statusDot');
    const btn = document.getElementById('btnConnect');
    const label = document.getElementById('connLabel');
    dot.classList.add('on');
    btn.textContent = currentLang === 'en' ? 'Disconnect' : 'Ngắt';
    btn.classList.add('connected');
    btn.disabled = false;
    label.textContent = `Bluetooth: ${name}`;
    label.style.color = 'var(--success)';
    showToast(currentLang === 'en' ? 'Bluetooth Connected!' : 'Đã kết nối Bluetooth!', 'success');
}

function setDisconnected() {
    const dot = document.getElementById('statusDot');
    const btn = document.getElementById('btnConnect');
    const label = document.getElementById('connLabel');
    dot.classList.remove('on');
    btn.textContent = currentLang === 'en' ? 'Connect' : 'Kết nối';
    btn.classList.remove('connected');
    btn.disabled = false;
    label.textContent = currentLang === 'en' ? 'Not connected' : 'Chưa kết nối';
    label.style.color = 'var(--text-secondary)';
    connectionMode = null;
}

window._onParamsData = (data) => {
    params = data;
    updateAllParams(data);
    showToast(currentLang === 'en' ? 'Data loaded!' : 'Đã đọc dữ liệu!', 'success');
};
window._onWriteSuccess = () => {
    showToast(currentLang === 'en' ? 'Data saved!' : 'Lưu dữ liệu thành công!', 'success');
};
window._onBLEError = (msg) => {
    showToast(msg, 'error');
};
window._onBLEDisconnected = () => {
    setDisconnected();
    showToast(currentLang === 'en' ? 'Bluetooth Disconnected' : 'Đã ngắt Bluetooth', 'error');
};

if (socket) {
    socket.on('connect', () => { console.log('Socket.IO connected'); });
    socket.on('connectionStatus', (data) => {
        if (data.connected) {
            connectionMode = 'server';
            setConnected(data.port || 'Demo');
        } else { setDisconnected(); }
        if (data.params) updateAllParams(data.params);
    });
    socket.on('params_data', (data) => { params = data; updateAllParams(data); showToast(currentLang === 'en' ? 'Data loaded!' : 'Đã đọc dữ liệu!', 'success'); });
    socket.on('param_updated', (data) => { params[data.key] = data.value; });
    socket.on('write_success', (data) => { showToast(data.message, 'success'); });
    socket.on('error', (data) => { showToast(data.message, 'error'); });
}

async function toggleConnection() {
    const btn = document.getElementById('btnConnect');
    if (btn.classList.contains('connected')) {
        if (connectionMode === 'ble') {
            await disconnectBLE();
        } else if (connectionMode === 'serial') {
            await disconnectSerial();
        } else if (socket) {
            socket.emit('disconnect_bluetooth');
        }
        setDisconnected();
        return;
    }

    // Show connection method modal
    showConnectModal();
}

function showConnectModal() {
    const modal = document.getElementById('connectModal');
    if (!modal) return;

    // Update button states based on capability
    const bleBtn = document.getElementById('btnConnBLE');
    const serialBtn = document.getElementById('btnConnSerial');

    if (bleBtn) {
        bleBtn.disabled = !hasBLE;
        if (!hasBLE) bleBtn.title = 'Web Bluetooth không khả dụng';
    }
    if (serialBtn) {
        serialBtn.disabled = !hasSerial;
        if (!hasSerial) serialBtn.title = 'Web Serial không khả dụng (cần Chrome desktop)';
    }

    modal.classList.add('show');
}

function closeConnectModal() {
    const modal = document.getElementById('connectModal');
    if (modal) modal.classList.remove('show');
}

async function connectViaBLE() {
    closeConnectModal();
    const btn = document.getElementById('btnConnect');
    btn.disabled = true;
    btn.textContent = currentLang === 'en' ? 'Scanning...' : 'Đang quét...';

    try {
        const deviceName = await connectBLE();
        connectionMode = 'ble';
        setConnected(deviceName);
        setTimeout(async () => {
            try { await bleReadData(); } catch(e) { console.error('Auto-read failed:', e); }
        }, 500);
    } catch (err) {
        console.log('BLE failed:', err.message);
        if (err.name !== 'NotFoundError' && !err.message.includes('cancelled')) {
            showToast(err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = currentLang === 'en' ? 'Connect' : 'Kết nối';
    }
}

async function connectViaSerial() {
    closeConnectModal();
    const btn = document.getElementById('btnConnect');
    btn.disabled = true;
    btn.textContent = currentLang === 'en' ? 'Connecting...' : 'Đang kết nối...';

    try {
        const baudRateVal = parseInt(document.getElementById('baudRateModal').value) || 115200;
        const portName = await connectSerial(baudRateVal);
        connectionMode = 'serial';
        setConnected(portName);
        // Auto-read after connection
        setTimeout(async () => {
            try { await serialReadData(); } catch(e) { console.error('Auto-read failed:', e); }
        }, 500);
    } catch (err) {
        console.log('Serial failed:', err.message);
        if (err.name !== 'NotFoundError' && !err.message.includes('cancelled')) {
            showToast(err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = currentLang === 'en' ? 'Connect' : 'Kết nối';
    }
}

function disconnectBT() {
    if (connectionMode === 'ble') {
        disconnectBLE();
    } else if (connectionMode === 'serial') {
        disconnectSerial();
    } else if (socket) {
        socket.emit('disconnect_bluetooth');
    }
    setDisconnected();
}

async function readData() {
    if (connectionMode === 'ble') {
        try { await bleReadData(); } catch(e) { showToast(e.message, 'error'); }
    } else if (connectionMode === 'serial') {
        try { await serialReadData(); } catch(e) { showToast(e.message, 'error'); }
    } else if (socket) {
        socket.emit('read_data');
    }
}

async function saveData() {
    if (connectionMode === 'ble') {
        try {
            await bleWriteData(params);
            showToast(currentLang === 'en' ? 'Data saved!' : 'Lưu dữ liệu thành công!', 'success');
        } catch(e) { showToast(e.message, 'error'); }
    } else if (connectionMode === 'serial') {
        try {
            await serialWriteData(params);
            showToast(currentLang === 'en' ? 'Data saved!' : 'Lưu dữ liệu thành công!', 'success');
        } catch(e) { showToast(e.message, 'error'); }
    } else if (socket) {
        socket.emit('write_data', params);
    }
}

function showPage(pageId) {
    if (pageId === 'display') {
        document.getElementById('dashboardPanel').classList.add('show');
        initGauges();
        return;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    event.target.classList.add('active');
}

function exitDashboard() {
    document.getElementById('dashboardPanel').classList.remove('show');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-page1').classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
}

function drawGauge(canvasId, value, maxVal, ticks) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.58, r = Math.min(W, H) * 0.42;
    const startAngle = (135 * Math.PI) / 180;
    const endAngle = (405 * Math.PI) / 180;
    const totalAngle = endAngle - startAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const arcSegs = 100, arcWidth = 6;
    for (let i = 0; i < arcSegs; i++) {
        const t = i / arcSegs;
        const a1 = startAngle + totalAngle * t;
        const a2 = startAngle + totalAngle * ((i + 1.5) / arcSegs);
        let r1, g1, b1;
        if (t < 0.5) {
            const p = t / 0.5;
            r1 = Math.round(76 + (255 - 76) * p);
            g1 = Math.round(175 + (235 - 175) * p);
            b1 = Math.round(80 + (59 - 80) * p);
        } else if (t < 0.75) {
            const p = (t - 0.5) / 0.25;
            r1 = Math.round(255);
            g1 = Math.round(235 - (235 - 152) * p);
            b1 = Math.round(59 + (0 - 59) * p);
        } else {
            const p = (t - 0.75) / 0.25;
            r1 = Math.round(255 - (255 - 229) * p);
            g1 = Math.round(152 - (152 - 57) * p);
            b1 = Math.round(0 + 53 * p);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r, a1, a2);
        ctx.strokeStyle = `rgb(${r1},${g1},${b1})`;
        ctx.lineWidth = arcWidth;
        ctx.stroke();
    }

    const majorStep = ticks.length > 1 ? ticks[1] - ticks[0] : maxVal;
    const minorPerMajor = 5, minorStep = majorStep / minorPerMajor;
    const totalMinor = Math.round(maxVal / minorStep);

    for (let i = 0; i <= totalMinor; i++) {
        const val = i * minorStep;
        const ratio = val / maxVal;
        const angle = startAngle + totalAngle * ratio;
        const isMajor = (val % majorStep) < 0.001 || Math.abs(val % majorStep - majorStep) < 0.001;
        const outerR = r - arcWidth / 2 - 2;
        const innerR = isMajor ? outerR - 10 : outerR - 5;

        ctx.beginPath();
        ctx.moveTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
        ctx.lineTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
        ctx.strokeStyle = isMajor ? '#ddd' : '#555';
        ctx.lineWidth = isMajor ? 2 : 1;
        ctx.stroke();

        if (isMajor) {
            const labelR = innerR - 12;
            ctx.fillStyle = '#ccc';
            ctx.font = `bold ${W > 250 ? 11 : 9}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(val), cx + labelR * Math.cos(angle), cy + labelR * Math.sin(angle));
        }
    }

    const valRatio = Math.min(Math.max(value / maxVal, 0), 1);
    const needleAngle = startAngle + totalAngle * valRatio;
    const needleLen = r - arcWidth / 2 - 4, needleTailLen = 14;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 87, 34, 0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx + needleLen * Math.cos(needleAngle), cy + needleLen * Math.sin(needleAngle));
    const perpAngle = needleAngle + Math.PI / 2, baseW = 2;
    ctx.lineTo(cx + baseW * Math.cos(perpAngle) - needleTailLen * Math.cos(needleAngle), cy + baseW * Math.sin(perpAngle) - needleTailLen * Math.sin(needleAngle));
    ctx.lineTo(cx - baseW * Math.cos(perpAngle) - needleTailLen * Math.cos(needleAngle), cy - baseW * Math.sin(perpAngle) - needleTailLen * Math.sin(needleAngle));
    ctx.closePath();
    ctx.fillStyle = '#ff5722';
    ctx.fill();
    ctx.restore();

    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 10);
    grad.addColorStop(0, '#ff7043');
    grad.addColorStop(0.5, '#e64a19');
    grad.addColorStop(1, '#bf360c');
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
}

const speedTicks = [0, 20, 40, 60, 80, 100, 120];
const rpmTicks = [0, 500, 1000, 1500, 2000, 2500, 3000];

function initGauges() {
    drawGauge('gaugeSpeed', 0, 120, speedTicks);
    drawGauge('gaugeRPM', 0, 3000, rpmTicks);
}

function updateAllParams(data) {
    params = { ...params, ...data };
    document.getElementById('dsp-voltage').textContent = data.batteryVoltage || '0.0';
    document.getElementById('dsp-current').textContent = data.maxCurrentLimit || '0.0';
    document.getElementById('dsp-speed').textContent = '0.00';
    document.getElementById('dsp-rpm').textContent = data.maxRPM || '0';
    document.getElementById('dsp-power').textContent = '0.0';

    drawGauge('gaugeSpeed', 0, 120, speedTicks);
    drawGauge('gaugeRPM', 0, 3000, rpmTicks);

    const p1info = document.getElementById('page1Info');
    if (p1info) {
        const pmLabel = currentLang === 'en' ? 'SW Ver' : 'Phiên bản PM';
        const pcLabel = currentLang === 'en' ? 'HW Ver' : 'Phiên bản PC';
        p1info.textContent = `${pmLabel}: ${data.softwareVersion || 0}    ${pcLabel}: ${data.hardwareVersion || 0}`;
    }
    const devBrand = document.getElementById('dev-brand');
    const devModel = document.getElementById('dev-model');
    const devVoltage = document.getElementById('dev-voltage');
    if (devBrand) devBrand.textContent = data._brandName || '--';
    if (devModel) devModel.textContent = data._modelName || '--';
    if (devVoltage) devVoltage.textContent = data.batteryVoltage || '--';

    const numericKeys = [
        'overVoltage','underVoltage','softUnderVoltage','underVoltageHyst','busCurrent','phaseCurrentLimit',
        'throttleLowProtect','throttleStartV','throttleEndV','throttleHighProtect',
        'startTorque','couplingTorque','riseSlope','fallSlope',
        'maxCurrentLimit','fieldWeakValue','currentPI_KI','exitTime','recoveryTime',
        'maxRPM','speedLimitRatio','fieldWeakComp',
        'lowSpeedRatio','lowSpeedCurrentLimit','midSpeedRatio','midSpeedCurrentLimit',
        'highSpeedRatio','overModulation','accelPhaseCurrent','ratedPhaseTime',
        'currentPI_KP','ratedPhaseCurrent','softStartLevel',
        'polePairs','phaseAngle','walkAssistSpeed','walkAssistTorque'
    ];
    numericKeys.forEach(key => {
        const el = document.getElementById('v-' + key);
        if (el && data[key] !== undefined) el.textContent = data[key];
    });

    const toggleKeys = ['autoExitEnable','speedSettingEnable','speedLimitSwitch','softStartSwitch',
        'hallSwapYB','phaseSwapBG','hillParkEnable','cruiseEnable','walkAssistEnable','dualVoltageAutoDetect'];
    toggleKeys.forEach(key => {
        const el = document.getElementById('v-' + key);
        if (el && data[key] !== undefined) el.checked = !!data[key];
    });

    const radioKeys = ['gearMode','defaultGear','direction','motorType','outputType','dualVoltageSelect'];
    radioKeys.forEach(key => {
        if (data[key] !== undefined) {
            const radio = document.querySelector(`input[name="${key}"][value="${data[key]}"]`);
            if (radio) radio.checked = true;
        }
    });
}

const PICKER_OPTIONS = {
    _modelName: ['EM30', 'EM50', 'EM100', 'EM150', 'EM200'],
    batteryVoltage: [48, 60, 72, 84, 96],
};
let pickerKey = null;
let pickerSelectedValue = null;

function openPicker(key) {
    pickerKey = key;
    const options = PICKER_OPTIONS[key];
    const info = PARAM_LABELS[key] || { label: key };
    const currentVal = params[key];

    document.getElementById('pickerTitle').textContent = info.label;
    const list = document.getElementById('pickerList');
    list.innerHTML = '';
    options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'picker-item';
        div.textContent = opt;
        div.dataset.value = opt;
        div.onclick = () => scrollPickerTo(i);
        list.appendChild(div);
    });

    const cancelBtn = document.querySelector('[data-i18n-picker="cancel"]');
    const okBtn = document.querySelector('[data-i18n-picker="ok"]');
    if (cancelBtn) cancelBtn.textContent = currentLang === 'en' ? 'Cancel' : 'Hủy';
    if (okBtn) okBtn.textContent = currentLang === 'en' ? 'Confirm' : 'Xác nhận';

    document.getElementById('pickerModal').classList.add('show');
    setTimeout(() => {
        let idx = options.indexOf(currentVal);
        if (idx === -1) idx = options.findIndex(o => String(o) === String(currentVal));
        if (idx === -1) idx = 0;
        scrollPickerTo(idx);
        list.addEventListener('scroll', onPickerScroll);
    }, 50);
}

function scrollPickerTo(idx) {
    const list = document.getElementById('pickerList');
    const items = list.querySelectorAll('.picker-item');
    if (!items[idx]) return;
    list.scrollTop = idx * 44;
    updatePickerHighlight();
}

function onPickerScroll() { updatePickerHighlight(); }

function updatePickerHighlight() {
    const list = document.getElementById('pickerList');
    const items = list.querySelectorAll('.picker-item');
    const centerIdx = Math.round(list.scrollTop / 44);
    items.forEach((item, i) => {
        item.classList.remove('selected', 'near');
        if (i === centerIdx) {
            item.classList.add('selected');
            pickerSelectedValue = item.dataset.value;
        } else if (Math.abs(i - centerIdx) === 1) {
            item.classList.add('near');
        }
    });
}

function closePicker() {
    document.getElementById('pickerModal').classList.remove('show');
    pickerKey = null;
}

function confirmPicker() {
    if (!pickerKey || pickerSelectedValue === null) return;
    let value = pickerSelectedValue;
    if (!isNaN(value)) value = parseInt(value);
    params[pickerKey] = value;
    updateParamDisplay(pickerKey, value);
    if (connectionMode === 'ble') {
        // BLE update logic directly
    } else if (socket) {
        socket.emit('update_param', { key: pickerKey, value });
    }
    closePicker();
}

document.getElementById('pickerModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePicker();
});

function editParam(key) {
    if (PICKER_OPTIONS[key]) { openPicker(key); return; }
    editingKey = key;
    const info = PARAM_LABELS[key] || { label: key, desc: '', step: 1 };
    document.getElementById('modalTitle').textContent = info.label;
    document.getElementById('modalDesc').textContent = info.desc;
    const input = document.getElementById('modalInput');
    input.value = params[key] !== undefined ? params[key] : '';
    if (info.isText) {
        input.type = 'text';
        input.inputMode = 'text';
        input.step = '';
    } else {
        input.type = 'number';
        input.inputMode = 'decimal';
        input.step = info.step || 1;
    }
    document.getElementById('editModal').classList.add('show');
    setTimeout(() => { input.focus(); input.select(); }, 100);
}

function closeModal() {
    document.getElementById('editModal').classList.remove('show');
    editingKey = null;
}

function confirmEdit() {
    if (!editingKey) return;
    const input = document.getElementById('modalInput');
    const info = PARAM_LABELS[editingKey] || {};
    let value;
    if (info.isText) {
        value = input.value.trim();
        if (!value) { showToast(currentLang === 'en' ? 'Invalid value!' : 'Giá trị không hợp lệ!', 'error'); return; }
    } else {
        value = parseFloat(input.value);
        if (isNaN(value)) { showToast(currentLang === 'en' ? 'Invalid value!' : 'Giá trị không hợp lệ!', 'error'); return; }
    }
    params[editingKey] = value;
    updateParamDisplay(editingKey, value);
    if (connectionMode === 'ble') {
        // Directly modified local params object
    } else if (socket) {
        socket.emit('update_param', { key: editingKey, value });
    }
    closeModal();
}

document.getElementById('modalInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmEdit();
    if (e.key === 'Escape') closeModal();
});

function toggleParam(key, value) {
    params[key] = value;
    if (socket) socket.emit('update_param', { key, value });
}

function radioParam(key, value) {
    params[key] = value;
    if (socket) socket.emit('update_param', { key, value: parseInt(value) });
}

function updateParamDisplay(key, value) {
    const el = document.getElementById('v-' + key);
    if (el) {
        if (el.type === 'checkbox') { el.checked = !!value; }
        else if (el.type === 'radio') {
            const radio = document.querySelector(`input[name="${key}"][value="${value}"]`);
            if (radio) radio.checked = true;
        } else { el.textContent = value; }
    }
    if (key === '_modelName') {
        const devModel = document.getElementById('dev-model');
        if (devModel) devModel.textContent = value;
    }
    if (key === 'batteryVoltage') {
        const devVoltage = document.getElementById('dev-voltage');
        if (devVoltage) devVoltage.textContent = value;
        const dspVoltage = document.getElementById('dsp-voltage');
        if (dspVoltage) dspVoltage.textContent = value;
    }
}

function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

document.getElementById('connectModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeConnectModal();
});

console.log('Votol Controller App - Khởi động');
console.log('Web Bluetooth:', hasBLE ? '✅' : '❌', '| Web Serial:', hasSerial ? '✅' : '❌');
setTimeout(initGauges, 100);
initLanguage();
