/**
 * Hệ thống đa ngôn ngữ - Votol Controller
 * Cập nhật TẤT CẢ text trên trang bằng DOM manipulation
 */

let currentLang = localStorage.getItem('votol_lang') || null;

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('votol_lang', lang);
    applyLanguage(lang);
    const modal = document.getElementById('langModal');
    if (modal) modal.classList.remove('show');
}

function showLangModal() {
    document.getElementById('langModal').classList.add('show');
}

function initLanguage() {
    if (!currentLang) {
        showLangModal();
    } else {
        applyLanguage(currentLang);
    }
}

function applyLanguage(lang) {
    if (lang === 'vi') applyVietnamese();
    else applyEnglish();
}

function applyVietnamese() {
    q('h1[data-i18n]', 'CÀI ĐẶT BỘ ĐIỀU KHIỂN VOTOL');
    q('[data-i18n="appSubtitle"]', 'Kết nối qua Bluetooth HM-10');

    const cl = document.getElementById('connLabel');
    if (cl && !cl.style.color.includes('success')) cl.textContent = 'Chưa kết nối';
    const btn = document.getElementById('btnConnect');
    if (btn && !btn.classList.contains('connected')) btn.textContent = 'Kết nối';
    if (btn && btn.classList.contains('connected')) btn.textContent = 'Ngắt';

    const tabs = document.querySelectorAll('.tab-btn');
    const tabNames = ['Hiển Thị', 'Cài Đặt 1', 'Cài Đặt 2', 'Cài Đặt 3', 'Cài Đặt 4', 'Thêm'];
    tabs.forEach((t, i) => { if (tabNames[i]) t.textContent = tabNames[i]; });

    q('.dash-back-btn', '← Quay lại');
    qAll('.dash-top .dash-label', ['Điện Áp (V)', 'Dòng Điện (A)']);
    qAll('.dash-gauges .dash-label', ['Tốc Độ (km/h)', 'Vòng Tua (rpm)']);
    qPower('Công Suất:');
    qTemps(['Nhiệt độ ĐK:', 'Nhiệt độ ngoài:', 'Hệ số nhiệt:']);

    const dashSections = document.querySelectorAll('.dash-section-title');
    if (dashSections[0]) setFaultTitle(dashSections[0], '● Hiển thị số');
    if (dashSections[1]) setFaultSectionTitle(dashSections[1], '● Hiển thị lỗi', 'Mã lỗi:', 'Trạng thái:');
    if (dashSections[2]) dashSections[2].textContent = '● Trạng thái';

    qGear(['Thấp', 'Trung bình', 'Cao', 'S']);
    qFaults(['Quá dòng','Thiếu áp','Hall','Quá áp','Quá nhiệt','Kẹt rotor','Tay ga','Bay tốc',
             'Phanh','Nạp sẵn','Lập trình','Driver','Chip nguồn','Contactor','Encoder','SPI']);
    qStatus(['Lùi','Phanh','Chống','PARK','Chống trộm','Phát điện']);

    const sectionTitles = document.querySelectorAll('.section-title');
    const stVi = ['Cài Đặt Cơ Bản','Điện Áp Ga','Cài Đặt Khởi Động',
                  'Chế Độ Vận Hành','Cài Đặt Tốc Độ','Giới Hạn Tốc Độ',
                  '3 Tốc Độ (Cột phải: chỉnh dòng)','Chế Độ Chuyển Số',
                  'Cài Đặt Động Cơ (Không chỉnh nếu bình thường)',
                  'Chức Năng Hỗ Trợ'];
    sectionTitles.forEach((el, i) => { if (stVi[i]) el.textContent = stVi[i]; });

    qParamLabels([
        'Quá áp (V)','Thiếu áp (V)','Thiếu áp mềm',
        'Độ trễ thiếu áp','Bus/Hãm ngược','GH dòng pha',
        'Bảo vệ thấp (V)','Khởi động (V)','Kết thúc (V)','Bảo vệ cao (V)',
        'Mô-men khởi động','Mô-men kết hợp','Độ dốc tăng','Độ dốc giảm'
    ]);
    qInfoBar('Phiên bản PM:', 'Phiên bản PC:', 'Nhà SX:', 'Model:', 'Điện áp:');

    qLabels('#page-page2', [
        'Giới hạn dòng tối đa (A)','Giá trị suy từ','PI dòng (KI)',
        'Tự động thoát','Thời gian thoát (S)','Thời gian phục hồi (S)',
        'Bật cài đặt tốc độ động cơ','RPM tối đa',
        'Công tắc giới hạn tốc độ','Tỷ lệ giới hạn tốc độ (%)','Hệ số bù suy từ'
    ]);

    qLabels('#page-page3', [
        'Tốc độ thấp %','GH dòng thấp %',
        'Tốc độ TB %','GH dòng TB %',
        'Tốc độ cao %','Siêu điều chỉnh %',
        'Dòng pha tăng tốc %','T/g dòng ĐM %',
        'PI dòng (KP)','Dòng pha ĐM',
        'Chọn chế độ:','Số mặc định:',
        'Công tắc khởi động mềm','Cấp khởi động mềm'
    ]);
    qRadioLabels('#page-page3', {
        gearMode: ['Điểm 3 tốc độ', 'Gạt 3 tốc độ'],
        defaultGear: ['Thấp', 'Trung bình', 'Cao']
    });

    qLabels('#page-page4', [
        'Số cặp cực','Góc lệch pha','Đổi Hall vàng-xanh','Đổi pha xanh-lục',
        'Chiều quay:','Loại:','Đầu ra:'
    ]);
    qRadioLabels('#page-page4', {
        direction: ['Thuận', 'Ngược'],
        motorType: ['Dán bề mặt', 'V'],
        outputType: ['Một dây thông', 'Hall']
    });

    qLabels('#page-more', [
        'Đỗ xe tự động trên dốc','Chế độ Cruise','Hỗ trợ dắt xe',
        'Tốc độ dắt xe (%)','Mô-men dắt xe','Tự nhận diện điện áp kép',
        'Chọn điện áp kép:'
    ]);
    qRadioLabels('#page-more', { dualVoltageSelect: ['Thấp', 'Cao'] });

    qBottomBar(['📖 Đọc Dữ Liệu', '🔴 Ngắt BT', '💾 Lưu Dữ Liệu']);
    q('.btn-cancel', 'Hủy');
    q('.btn-ok', 'Xác nhận');
    const p4Labels2 = document.querySelectorAll('#page-page4 .radio-row .label');
    if (p4Labels2[1]) p4Labels2[1].textContent = 'Loại:';
    if (p4Labels2[2]) p4Labels2[2].textContent = 'Đầu ra:';
}

function applyEnglish() {
    q('h1[data-i18n]', 'VOTOL CONTROLLER SETTINGS');
    q('[data-i18n="appSubtitle"]', 'Connect via Bluetooth HC-05');

    const cl = document.getElementById('connLabel');
    if (cl && !cl.style.color.includes('success')) cl.textContent = 'Not connected';
    const btn = document.getElementById('btnConnect');
    if (btn && !btn.classList.contains('connected')) btn.textContent = 'Connect';
    if (btn && btn.classList.contains('connected')) btn.textContent = 'Disconnect';

    const tabs = document.querySelectorAll('.tab-btn');
    const tabNames = ['Display', 'Settings 1', 'Settings 2', 'Settings 3', 'Settings 4', 'More'];
    tabs.forEach((t, i) => { if (tabNames[i]) t.textContent = tabNames[i]; });

    q('.dash-back-btn', '← Back');
    qAll('.dash-top .dash-label', ['Voltage (V)', 'Current (A)']);
    qAll('.dash-gauges .dash-label', ['Speed (km/h)', 'RPM (rpm)']);
    qPower('Power:');
    qTemps(['Ctrl Temp:', 'Ext Temp:', 'Temp Coeff:']);

    const dashSections = document.querySelectorAll('.dash-section-title');
    if (dashSections[0]) setFaultTitle(dashSections[0], '● Gear Display');
    if (dashSections[1]) setFaultSectionTitle(dashSections[1], '● Fault Display', 'Code:', 'State:');
    if (dashSections[2]) dashSections[2].textContent = '● Status';

    qGear(['Low', 'Mid', 'High', 'S']);
    qFaults(['Overcurrent','Undervolt','Hall','Overvolt','Overheat','Stall','Throttle','Runaway',
             'Brake','Precharge','Program','Driver','Chip Pwr','Contactor','Encoder','SPI']);
    qStatus(['Reverse','Brake','Kickstand','PARK','Anti-theft','Generator']);

    const sectionTitles = document.querySelectorAll('.section-title');
    const stEn = ['Basic Settings','Throttle Voltage','Startup Settings',
                  'Operating Mode','Speed Settings','Speed Limit',
                  '3-Speed (Right: current limit)','Gear Mode',
                  'Motor Settings (Don\'t change if normal)',
                  'Auxiliary Functions'];
    sectionTitles.forEach((el, i) => { if (stEn[i]) el.textContent = stEn[i]; });

    qParamLabels([
        'Over Voltage (V)','Under Voltage (V)','Soft Under V',
        'UV Hysteresis','Bus/Regen (A)','Phase I Limit',
        'Low Protect (V)','Start V (V)','End V (V)','High Protect (V)',
        'Start Torque','Coupling Torque','Rise Slope','Fall Slope'
    ]);
    qInfoBar('SW Ver:', 'HW Ver:', 'Brand:', 'Model:', 'Voltage:');

    qLabels('#page-page2', [
        'Max Current Limit (A)','Field Weakening','PI Current (KI)',
        'Auto Exit','Exit Time (S)','Recovery Time (S)',
        'Enable Motor Speed Setting','Max RPM',
        'Speed Limit Switch','Speed Limit Ratio (%)','Field Weak Comp'
    ]);

    qLabels('#page-page3', [
        'Low Speed %','Low I Limit %',
        'Mid Speed %','Mid I Limit %',
        'High Speed %','Over Modulation %',
        'Accel Phase I %','Rated Phase T %',
        'PI Current (KP)','Rated Phase I',
        'Select mode:','Default Gear:',
        'Soft Start Switch','Soft Start Level'
    ]);
    qRadioLabels('#page-page3', {
        gearMode: ['Point 3-speed', 'Toggle 3-speed'],
        defaultGear: ['Low', 'Mid', 'High']
    });

    qLabels('#page-page4', [
        'Pole Pairs','Phase Angle','Hall Swap Y-B','Phase Swap B-G',
        'Direction:','Type:','Output:'
    ]);
    qRadioLabels('#page-page4', {
        direction: ['Forward', 'Reverse'],
        motorType: ['Surface Mount', 'V-type'],
        outputType: ['Single Wire', 'Hall']
    });

    qLabels('#page-more', [
        'Hill Auto-Park','Cruise Mode','Walk Assist',
        'Walk Speed (%)','Walk Torque','Dual Voltage Auto-Detect',
        'Dual Voltage:'
    ]);
    qRadioLabels('#page-more', { dualVoltageSelect: ['Low', 'High'] });

    qBottomBar(['📖 Read Data', '🔴 Disconnect', '💾 Save Data']);
    q('.btn-cancel', 'Cancel');
    q('.btn-ok', 'Confirm');
    const p4Labels2 = document.querySelectorAll('#page-page4 .radio-row .label');
    if (p4Labels2[1]) p4Labels2[1].textContent = 'Type:';
    if (p4Labels2[2]) p4Labels2[2].textContent = 'Output:';
}

function q(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
}
function qAll(sel, texts) {
    document.querySelectorAll(sel).forEach((el, i) => { if (texts[i]) el.textContent = texts[i]; });
}
function qPower(label) {
    const pw = document.querySelector('.dash-power');
    if (pw) { const sp = pw.querySelector('span'); const val = sp ? sp.textContent : '0.0'; pw.innerHTML = `${label} <span id="dsp-power">${val}</span>W`; }
}
function qTemps(labels) {
    const temps = document.querySelectorAll('.dash-temps span');
    const ids = ['dsp-tempCtrl', 'dsp-tempExt', 'dsp-tempCoef'];
    temps.forEach((el, i) => {
        const b = el.querySelector('b');
        const val = b ? b.textContent : '0';
        el.innerHTML = `${labels[i]} <b id="${ids[i]}">${val}</b>`;
    });
}
function setFaultTitle(el, text) { el.textContent = text; }
function setFaultSectionTitle(el, title, codeLabel, stateLabel) {
    const fc = document.getElementById('dsp-faultCode');
    const sm = document.getElementById('dsp-stateMachine');
    const fcVal = fc ? fc.textContent : '00000000';
    const smVal = sm ? sm.textContent : '0';
    el.innerHTML = `${title} &nbsp; ${codeLabel} <span id="dsp-faultCode">${fcVal}</span> &nbsp; ${stateLabel} <span id="dsp-stateMachine">${smVal}</span>`;
}
function qGear(labels) {
    document.querySelectorAll('.gear-opt').forEach((el, i) => {
        const input = el.querySelector('input');
        if (input && labels[i]) { el.innerHTML = ''; el.appendChild(input); el.append(' ' + labels[i]); }
    });
}
function qFaults(labels) {
    document.querySelectorAll('.fault-item span').forEach((el, i) => { if (labels[i]) el.textContent = labels[i]; });
}
function qStatus(labels) {
    document.querySelectorAll('.status-item span').forEach((el, i) => { if (labels[i]) el.textContent = labels[i]; });
}
function qParamLabels(labels) {
    document.querySelectorAll('#page-page1 .param-label').forEach((el, i) => { if (labels[i]) el.textContent = labels[i]; });
}
function qLabels(pageId, labels) {
    const page = document.querySelector(pageId);
    if (!page) return;
    const allLabels = page.querySelectorAll('.label');
    let idx = 0;
    allLabels.forEach(el => {
        if (labels[idx] !== undefined && labels[idx] !== '') el.textContent = labels[idx];
        idx++;
    });
}
function qRadioLabels(pageId, map) {
    const page = document.querySelector(pageId);
    if (!page) return;
    Object.keys(map).forEach(name => {
        const radios = page.querySelectorAll(`input[name="${name}"]`);
        radios.forEach((r, i) => {
            const lbl = r.closest('label');
            if (lbl && map[name][i]) { lbl.innerHTML = ''; lbl.appendChild(r); lbl.append(' ' + map[name][i]); }
        });
    });
}
function qPageToggles(pageId, labels) {
    const page = document.querySelector(pageId);
    if (!page) return;
    const rows = page.querySelectorAll('.toggle-row, .param-row:last-of-type');
    rows.forEach(row => {
        const lbl = row.querySelector('.label');
        if (lbl && labels[tIdx]) { lbl.textContent = labels[tIdx]; tIdx++; }
    });
}
function qInfoBar(pmLabel, pcLabel, mfgLabel, modelLabel, voltLabel) {
    const p1info = document.getElementById('page1Info');
    if (p1info) {
        const sw = p1info.textContent.match(/:\s*(\d+)/);
        const hw = p1info.textContent.match(/:\s*(\d+)\s*$/);
        const swVal = sw ? sw[1] : '0';
        const hwVal = hw ? hw[1] : '0';
        p1info.textContent = `${pmLabel} ${swVal}   ${pcLabel} ${hwVal}`;
    }
    const mfgEl = document.querySelector('[data-i18n="manufacturer"]');
    const modEl = document.querySelector('[data-i18n="modelLabel"]');
    const volEl = document.querySelector('[data-i18n="battVoltage"]');
    if (mfgEl) mfgEl.textContent = mfgLabel;
    if (modEl) modEl.textContent = modelLabel;
    if (volEl) volEl.textContent = voltLabel;
}
function qBottomBar(labels) {
    document.querySelectorAll('.bottom-btn').forEach((el, i) => { if (labels[i]) el.textContent = labels[i]; });
}
