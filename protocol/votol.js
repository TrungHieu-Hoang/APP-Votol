/**
 * Votol EM Controller Protocol Handler
 * 
 * Giao thức giao tiếp với bộ điều khiển Votol EM qua UART/Serial
 * Sử dụng HC-05 Bluetooth module làm cầu nối serial không dây
 * 
 * Frame format: [Header: 0x3A][Address][Command][Length][Data...][Checksum]
 * - Header: 0x3A (cố định)
 * - Address: 0x01 (mặc định)
 * - Command: 0x52 = Read, 0x57 = Write
 * - Length: số byte dữ liệu
 * - Data: dữ liệu tham số
 * - Checksum: XOR tất cả byte từ Address đến Data cuối
 */

const HEADER = 0x3A;
const DEVICE_ADDR = 0x01;
const CMD_READ = 0x52;   // 'R'
const CMD_WRITE = 0x57;  // 'W'

// Bản đồ tham số - ánh xạ tên tham số → vị trí byte trong data block
// Offset và size tính theo byte trong khối dữ liệu trả về
const PARAM_MAP = {
    // === CÀI ĐẶT TRANG 1 - Cài đặt cơ bản ===
    softwareVersion:     { offset: 0,  size: 2, type: 'uint16', label: 'Phiên bản phần mềm', readOnly: true },
    hardwareVersion:     { offset: 2,  size: 2, type: 'uint16', label: 'Phiên bản phần cứng', readOnly: true },
    brand:               { offset: 4,  size: 1, type: 'uint8',  label: 'Nhà sản xuất', readOnly: true },
    model:               { offset: 5,  size: 1, type: 'uint8',  label: 'Model', readOnly: true },
    batteryVoltage:      { offset: 6,  size: 2, type: 'uint16', label: 'Điện áp pin (V)', readOnly: true },
    
    overVoltage:         { offset: 8,  size: 2, type: 'uint16', label: 'Quá áp (V)', min: 0, max: 120 },
    underVoltage:        { offset: 10, size: 2, type: 'uint16', label: 'Thiếu áp (V)', min: 0, max: 120 },
    softUnderVoltage:    { offset: 12, size: 2, type: 'uint16', label: 'Thiếu áp mềm (V)', min: 0, max: 120 },
    underVoltageHyst:    { offset: 14, size: 2, type: 'uint16', label: 'Độ trễ thiếu áp (V)', min: 0, max: 10 },
    busCurrent:          { offset: 16, size: 2, type: 'uint16', label: 'Dòng bus/hãm ngược (A)', min: 0, max: 500 },
    phaseCurrentLimit:   { offset: 18, size: 2, type: 'uint16', label: 'Giới hạn dòng pha', min: 0, max: 65000 },
    
    // Cài đặt điện áp ga
    throttleLowProtect:  { offset: 20, size: 2, type: 'float10', label: 'Giá trị bảo vệ thấp (V)', min: 0, max: 5, step: 0.1 },
    throttleStartV:      { offset: 22, size: 2, type: 'float10', label: 'Điện áp khởi động (V)', min: 0, max: 5, step: 0.1 },
    throttleEndV:        { offset: 24, size: 2, type: 'float10', label: 'Điện áp kết thúc (V)', min: 0, max: 5, step: 0.1 },
    throttleHighProtect: { offset: 26, size: 2, type: 'float10', label: 'Giá trị bảo vệ cao (V)', min: 0, max: 5, step: 0.1 },
    
    // Cài đặt khởi động
    startTorque:         { offset: 28, size: 2, type: 'uint16', label: 'Mô-men khởi động', min: 0, max: 500 },
    couplingTorque:      { offset: 30, size: 2, type: 'uint16', label: 'Mô-men kết hợp', min: 0, max: 500 },
    riseSlope:           { offset: 32, size: 2, type: 'uint16', label: 'Độ dốc tăng', min: 0, max: 255 },
    fallSlope:           { offset: 34, size: 2, type: 'uint16', label: 'Độ dốc giảm', min: 0, max: 255 },
    
    // === CÀI ĐẶT TRANG 2 - Chế độ vận hành ===
    maxCurrentLimit:     { offset: 36, size: 2, type: 'uint16', label: 'Giới hạn dòng tối đa (A)', min: 0, max: 500 },
    fieldWeakValue:      { offset: 38, size: 2, type: 'uint16', label: 'Giá trị suy từ', min: 0, max: 65000 },
    currentPI_KI:        { offset: 40, size: 2, type: 'uint16', label: 'Tham số PI dòng (KI)', min: 0, max: 65000 },
    autoExitEnable:      { offset: 42, size: 1, type: 'bool',   label: 'Tự động thoát' },
    exitTime:            { offset: 43, size: 2, type: 'uint16', label: 'Thời gian thoát (S)', min: 0, max: 600 },
    recoveryTime:        { offset: 45, size: 2, type: 'uint16', label: 'Thời gian phục hồi (S)', min: 0, max: 600 },
    
    // Cài đặt tốc độ
    speedSettingEnable:  { offset: 47, size: 1, type: 'bool',   label: 'Bật cài đặt tốc độ' },
    maxRPM:              { offset: 48, size: 2, type: 'uint16', label: 'RPM tối đa', min: 0, max: 20000 },
    
    // Giới hạn tốc độ
    speedLimitSwitch:    { offset: 50, size: 1, type: 'bool',   label: 'Công tắc giới hạn tốc độ' },
    speedLimitRatio:     { offset: 51, size: 2, type: 'uint16', label: 'Tỷ lệ giới hạn tốc độ (%)', min: 0, max: 100 },
    fieldWeakComp:       { offset: 53, size: 2, type: 'uint16', label: 'Hệ số bù suy từ', min: 0, max: 100 },
    
    // Cài đặt 3 tốc độ
    lowSpeedRatio:       { offset: 55, size: 2, type: 'uint16', label: 'Tốc độ thấp (%)', min: 0, max: 100 },
    lowSpeedCurrentLimit:{ offset: 57, size: 2, type: 'uint16', label: 'Giới hạn dòng tốc độ thấp (%)', min: 0, max: 200 },
    midSpeedRatio:       { offset: 59, size: 2, type: 'uint16', label: 'Tốc độ trung bình (%)', min: 0, max: 100 },
    midSpeedCurrentLimit:{ offset: 61, size: 2, type: 'uint16', label: 'Giới hạn dòng tốc độ TB (%)', min: 0, max: 200 },
    highSpeedRatio:      { offset: 63, size: 2, type: 'uint16', label: 'Tốc độ cao (%)', min: 0, max: 100 },
    overModulation:      { offset: 65, size: 2, type: 'uint16', label: 'Siêu điều chỉnh (%)', min: 0, max: 100 },
    accelPhaseCurrent:   { offset: 67, size: 2, type: 'uint16', label: 'Dòng pha tăng tốc (%)', min: 0, max: 65000 },
    ratedPhaseTime:      { offset: 69, size: 2, type: 'uint16', label: 'T/g dòng pha định mức (%)', min: 0, max: 255 },
    currentPI_KP:        { offset: 71, size: 2, type: 'uint16', label: 'Tham số PI dòng (KP)', min: 0, max: 65000 },
    ratedPhaseCurrent:   { offset: 73, size: 2, type: 'uint16', label: 'Giới hạn dòng pha định mức', min: 0, max: 65000 },
    
    // Chế độ chuyển số
    gearMode:            { offset: 75, size: 1, type: 'uint8',  label: 'Chế độ chuyển số', options: [0, 1] }, // 0=Điểm, 1=Gạt
    defaultGear:         { offset: 76, size: 1, type: 'uint8',  label: 'Số mặc định', options: [0, 1, 2] }, // 0=Thấp, 1=TB, 2=Cao
    softStartSwitch:     { offset: 77, size: 1, type: 'bool',   label: 'Công tắc khởi động mềm' },
    softStartLevel:      { offset: 78, size: 2, type: 'uint16', label: 'Cấp khởi động mềm', min: 0, max: 10 },
    
    // === CÀI ĐẶT TRANG 3 - Cài đặt động cơ ===
    polePairs:           { offset: 80, size: 2, type: 'uint16', label: 'Số cặp cực', min: 1, max: 50 },
    phaseAngle:          { offset: 82, size: 2, type: 'uint16', label: 'Góc lệch pha', min: 0, max: 360 },
    hallSwapYB:          { offset: 84, size: 1, type: 'bool',   label: 'Đổi Hall vàng-xanh' },
    phaseSwapBG:         { offset: 85, size: 1, type: 'bool',   label: 'Đổi pha xanh-lục' },
    direction:           { offset: 86, size: 1, type: 'uint8',  label: 'Chiều quay', options: [0, 1] }, // 0=Thuận, 1=Ngược
    motorType:           { offset: 87, size: 1, type: 'uint8',  label: 'Loại động cơ', options: [0, 1] }, // 0=Dán bề mặt, 1=V
    outputType:          { offset: 88, size: 1, type: 'uint8',  label: 'Đầu ra', options: [0, 1] }, // 0=Một dây, 1=Hall
    
    // === CÀI ĐẶT TRANG 4 - Chức năng hỗ trợ ===
    hillParkEnable:      { offset: 89, size: 1, type: 'bool',   label: 'Đỗ xe tự động trên dốc' },
    cruiseEnable:        { offset: 90, size: 1, type: 'bool',   label: 'Chế độ Cruise' },
    walkAssistEnable:    { offset: 91, size: 1, type: 'bool',   label: 'Hỗ trợ dắt xe' },
    walkAssistSpeed:     { offset: 92, size: 2, type: 'uint16', label: 'Tốc độ dắt xe (%)', min: 0, max: 100 },
    walkAssistTorque:    { offset: 94, size: 2, type: 'uint16', label: 'Mô-men dắt xe', min: 0, max: 1000 },
    dualVoltageAutoDetect:{ offset: 96, size: 1, type: 'bool',  label: 'Tự nhận diện điện áp kép' },
    dualVoltageSelect:   { offset: 97, size: 1, type: 'uint8',  label: 'Chọn điện áp kép', options: [0, 1] }, // 0=Thấp, 1=Cao
};

// Danh sách model Votol
const MODEL_NAMES = {
    0: 'EM25',
    1: 'EM30',
    2: 'EM50',
    3: 'EM50S',
    4: 'EM60',
    5: 'EM80',
    6: 'EM100',
    7: 'EM100S',
    8: 'EM150',
    9: 'EM200',
    10: 'EM260',
};

const BRAND_NAMES = {
    0: 'Phổ thông',
    1: 'SIA',
    2: 'EMsport',
};

class VotolProtocol {
    constructor() {
        this.dataBuffer = Buffer.alloc(0);
        this.expectedLength = 0;
        this.onDataCallback = null;
        this.onErrorCallback = null;
    }

    /**
     * Tính checksum XOR
     */
    calcChecksum(data) {
        let checksum = 0;
        for (let i = 0; i < data.length; i++) {
            checksum ^= data[i];
        }
        return checksum & 0xFF;
    }

    /**
     * Tạo frame đọc dữ liệu từ controller
     */
    buildReadCommand() {
        const frame = Buffer.from([HEADER, DEVICE_ADDR, CMD_READ, 0x00]);
        const checksum = this.calcChecksum(frame.slice(1));
        return Buffer.concat([frame, Buffer.from([checksum])]);
    }

    /**
     * Tạo frame ghi dữ liệu xuống controller
     */
    buildWriteCommand(params) {
        // Tạo data block từ params
        const dataBlock = this.encodeParams(params);
        const length = dataBlock.length;
        
        const header = Buffer.from([HEADER, DEVICE_ADDR, CMD_WRITE, length]);
        const frame = Buffer.concat([header, dataBlock]);
        const checksum = this.calcChecksum(frame.slice(1));
        
        return Buffer.concat([frame, Buffer.from([checksum])]);
    }

    /**
     * Mã hóa tham số thành data block
     */
    encodeParams(params) {
        // Tìm kích thước data block cần thiết
        let maxEnd = 0;
        for (const key in PARAM_MAP) {
            const p = PARAM_MAP[key];
            if (p.offset + p.size > maxEnd) {
                maxEnd = p.offset + p.size;
            }
        }
        
        const dataBlock = Buffer.alloc(maxEnd);
        
        for (const key in params) {
            if (!PARAM_MAP[key]) continue;
            const param = PARAM_MAP[key];
            if (param.readOnly) continue;
            
            const value = params[key];
            
            switch (param.type) {
                case 'uint8':
                case 'bool':
                    dataBlock.writeUInt8(param.type === 'bool' ? (value ? 1 : 0) : value, param.offset);
                    break;
                case 'uint16':
                    dataBlock.writeUInt16BE(value, param.offset);
                    break;
                case 'float10':
                    dataBlock.writeUInt16BE(Math.round(value * 10), param.offset);
                    break;
            }
        }
        
        return dataBlock;
    }

    /**
     * Giải mã data block thành object tham số
     */
    decodeParams(dataBlock) {
        const params = {};
        
        for (const key in PARAM_MAP) {
            const param = PARAM_MAP[key];
            
            if (param.offset + param.size > dataBlock.length) {
                params[key] = 0;
                continue;
            }
            
            switch (param.type) {
                case 'uint8':
                    params[key] = dataBlock.readUInt8(param.offset);
                    break;
                case 'bool':
                    params[key] = dataBlock.readUInt8(param.offset) !== 0;
                    break;
                case 'uint16':
                    params[key] = dataBlock.readUInt16BE(param.offset);
                    break;
                case 'float10':
                    params[key] = dataBlock.readUInt16BE(param.offset) / 10;
                    break;
            }
        }
        
        // Thêm thông tin model và brand
        if (params.model !== undefined) {
            params._modelName = MODEL_NAMES[params.model] || `Unknown (${params.model})`;
        }
        if (params.brand !== undefined) {
            params._brandName = BRAND_NAMES[params.brand] || `Unknown (${params.brand})`;
        }
        
        return params;
    }

    /**
     * Xử lý dữ liệu nhận từ serial port
     * Gọi callback khi nhận đủ 1 frame hoàn chỉnh
     */
    processIncoming(chunk) {
        this.dataBuffer = Buffer.concat([this.dataBuffer, chunk]);
        
        // Tìm header 0x3A
        while (this.dataBuffer.length > 0) {
            const headerIdx = this.dataBuffer.indexOf(HEADER);
            
            if (headerIdx === -1) {
                this.dataBuffer = Buffer.alloc(0);
                return;
            }
            
            // Bỏ dữ liệu trước header
            if (headerIdx > 0) {
                this.dataBuffer = this.dataBuffer.slice(headerIdx);
            }
            
            // Cần ít nhất 4 byte: Header + Addr + Cmd + Length
            if (this.dataBuffer.length < 4) return;
            
            const addr = this.dataBuffer[1];
            const cmd = this.dataBuffer[2];
            const dataLen = this.dataBuffer[3];
            const totalLen = 4 + dataLen + 1; // Header+Addr+Cmd+Len + Data + Checksum
            
            // Chưa nhận đủ dữ liệu
            if (this.dataBuffer.length < totalLen) return;
            
            // Trích xuất frame
            const frame = this.dataBuffer.slice(0, totalLen);
            this.dataBuffer = this.dataBuffer.slice(totalLen);
            
            // Kiểm tra checksum
            const receivedChecksum = frame[totalLen - 1];
            const calcChecksum = this.calcChecksum(frame.slice(1, totalLen - 1));
            
            if (receivedChecksum !== calcChecksum) {
                console.log(`[Votol] Checksum error: received 0x${receivedChecksum.toString(16)}, calculated 0x${calcChecksum.toString(16)}`);
                if (this.onErrorCallback) {
                    this.onErrorCallback('Lỗi checksum - dữ liệu không hợp lệ');
                }
                continue;
            }
            
            // Giải mã dữ liệu
            if (cmd === CMD_READ && dataLen > 0) {
                const dataBlock = frame.slice(4, 4 + dataLen);
                const params = this.decodeParams(dataBlock);
                
                if (this.onDataCallback) {
                    this.onDataCallback(params);
                }
            } else if (cmd === CMD_WRITE) {
                // Phản hồi ghi thành công
                if (this.onDataCallback) {
                    this.onDataCallback({ _writeSuccess: true });
                }
            }
        }
    }

    /**
     * Đặt callback khi nhận dữ liệu
     */
    onData(callback) {
        this.onDataCallback = callback;
    }

    /**
     * Đặt callback khi có lỗi
     */
    onError(callback) {
        this.onErrorCallback = callback;
    }

    /**
     * Reset buffer
     */
    reset() {
        this.dataBuffer = Buffer.alloc(0);
    }

    /**
     * Lấy bản đồ tham số
     */
    static getParamMap() {
        return PARAM_MAP;
    }

    static getModelNames() {
        return MODEL_NAMES;
    }

    static getBrandNames() {
        return BRAND_NAMES;
    }
}

module.exports = { VotolProtocol, PARAM_MAP, MODEL_NAMES, BRAND_NAMES };
