/**
 * Votol Protocol - Browser Version
 * Xử lý giao thức Votol EM Controller trên trình duyệt
 * Hỗ trợ Web Bluetooth API (BLE) kết nối trực tiếp từ điện thoại
 * 
 * Frame: [0x3A][Address][Command][Length][Data...][Checksum]
 */

const HEADER = 0x3A;
const DEVICE_ADDR = 0x01;
const CMD_READ = 0x52;
const CMD_WRITE = 0x57;

const PARAM_MAP = {
    softwareVersion:     { offset: 0,  size: 2, type: 'uint16', readOnly: true },
    hardwareVersion:     { offset: 2,  size: 2, type: 'uint16', readOnly: true },
    brand:               { offset: 4,  size: 1, type: 'uint8',  readOnly: true },
    model:               { offset: 5,  size: 1, type: 'uint8',  readOnly: true },
    batteryVoltage:      { offset: 6,  size: 2, type: 'uint16', readOnly: true },
    overVoltage:         { offset: 8,  size: 2, type: 'uint16' },
    underVoltage:        { offset: 10, size: 2, type: 'uint16' },
    softUnderVoltage:    { offset: 12, size: 2, type: 'uint16' },
    underVoltageHyst:    { offset: 14, size: 2, type: 'uint16' },
    busCurrent:          { offset: 16, size: 2, type: 'uint16' },
    phaseCurrentLimit:   { offset: 18, size: 2, type: 'uint16' },
    throttleLowProtect:  { offset: 20, size: 2, type: 'float10' },
    throttleStartV:      { offset: 22, size: 2, type: 'float10' },
    throttleEndV:        { offset: 24, size: 2, type: 'float10' },
    throttleHighProtect: { offset: 26, size: 2, type: 'float10' },
    startTorque:         { offset: 28, size: 2, type: 'uint16' },
    couplingTorque:      { offset: 30, size: 2, type: 'uint16' },
    riseSlope:           { offset: 32, size: 2, type: 'uint16' },
    fallSlope:           { offset: 34, size: 2, type: 'uint16' },
    maxCurrentLimit:     { offset: 36, size: 2, type: 'uint16' },
    fieldWeakValue:      { offset: 38, size: 2, type: 'uint16' },
    currentPI_KI:        { offset: 40, size: 2, type: 'uint16' },
    autoExitEnable:      { offset: 42, size: 1, type: 'bool' },
    exitTime:            { offset: 43, size: 2, type: 'uint16' },
    recoveryTime:        { offset: 45, size: 2, type: 'uint16' },
    speedSettingEnable:  { offset: 47, size: 1, type: 'bool' },
    maxRPM:              { offset: 48, size: 2, type: 'uint16' },
    speedLimitSwitch:    { offset: 50, size: 1, type: 'bool' },
    speedLimitRatio:     { offset: 51, size: 2, type: 'uint16' },
    fieldWeakComp:       { offset: 53, size: 2, type: 'uint16' },
    lowSpeedRatio:       { offset: 55, size: 2, type: 'uint16' },
    lowSpeedCurrentLimit:{ offset: 57, size: 2, type: 'uint16' },
    midSpeedRatio:       { offset: 59, size: 2, type: 'uint16' },
    midSpeedCurrentLimit:{ offset: 61, size: 2, type: 'uint16' },
    highSpeedRatio:      { offset: 63, size: 2, type: 'uint16' },
    overModulation:      { offset: 65, size: 2, type: 'uint16' },
    accelPhaseCurrent:   { offset: 67, size: 2, type: 'uint16' },
    ratedPhaseTime:      { offset: 69, size: 2, type: 'uint16' },
    currentPI_KP:        { offset: 71, size: 2, type: 'uint16' },
    ratedPhaseCurrent:   { offset: 73, size: 2, type: 'uint16' },
    gearMode:            { offset: 75, size: 1, type: 'uint8' },
    defaultGear:         { offset: 76, size: 1, type: 'uint8' },
    softStartSwitch:     { offset: 77, size: 1, type: 'bool' },
    softStartLevel:      { offset: 78, size: 2, type: 'uint16' },
    polePairs:           { offset: 80, size: 2, type: 'uint16' },
    phaseAngle:          { offset: 82, size: 2, type: 'uint16' },
    hallSwapYB:          { offset: 84, size: 1, type: 'bool' },
    phaseSwapBG:         { offset: 85, size: 1, type: 'bool' },
    direction:           { offset: 86, size: 1, type: 'uint8' },
    motorType:           { offset: 87, size: 1, type: 'uint8' },
    outputType:          { offset: 88, size: 1, type: 'uint8' },
    hillParkEnable:      { offset: 89, size: 1, type: 'bool' },
    cruiseEnable:        { offset: 90, size: 1, type: 'bool' },
    walkAssistEnable:    { offset: 91, size: 1, type: 'bool' },
    walkAssistSpeed:     { offset: 92, size: 2, type: 'uint16' },
    walkAssistTorque:    { offset: 94, size: 2, type: 'uint16' },
    dualVoltageAutoDetect:{ offset: 96, size: 1, type: 'bool' },
    dualVoltageSelect:   { offset: 97, size: 1, type: 'uint8' },
};

const MODEL_NAMES = { 0:'EM25',1:'EM30',2:'EM50',3:'EM50S',4:'EM60',5:'EM80',6:'EM100',7:'EM100S',8:'EM150',9:'EM200',10:'EM260' };
const BRAND_NAMES = { 0:'Phổ thông',1:'SIA',2:'EMsport' };

function calcChecksum(data) {
    let cs = 0;
    for (let i = 0; i < data.length; i++) cs ^= data[i];
    return cs & 0xFF;
}

function buildReadCommand() {
    const frame = new Uint8Array([HEADER, DEVICE_ADDR, CMD_READ, 0x00]);
    const cs = calcChecksum(frame.subarray(1));
    const out = new Uint8Array(5);
    out.set(frame);
    out[4] = cs;
    return out;
}

function buildWriteCommand(params) {
    const dataBlock = encodeParams(params);
    const length = dataBlock.length;
    const header = new Uint8Array([HEADER, DEVICE_ADDR, CMD_WRITE, length]);
    const frame = new Uint8Array(header.length + dataBlock.length);
    frame.set(header);
    frame.set(dataBlock, header.length);
    const cs = calcChecksum(frame.subarray(1));
    const out = new Uint8Array(frame.length + 1);
    out.set(frame);
    out[frame.length] = cs;
    return out;
}

function encodeParams(params) {
    let maxEnd = 0;
    for (const key in PARAM_MAP) {
        const p = PARAM_MAP[key];
        if (p.offset + p.size > maxEnd) maxEnd = p.offset + p.size;
    }
    const data = new Uint8Array(maxEnd);
    const view = new DataView(data.buffer);
    for (const key in params) {
        if (!PARAM_MAP[key]) continue;
        const p = PARAM_MAP[key];
        if (p.readOnly) continue;
        const v = params[key];
        switch (p.type) {
            case 'uint8': data[p.offset] = v & 0xFF; break;
            case 'bool': data[p.offset] = v ? 1 : 0; break;
            case 'uint16': view.setUint16(p.offset, v, false); break;
            case 'float10': view.setUint16(p.offset, Math.round(v * 10), false); break;
        }
    }
    return data;
}

function decodeParams(dataBlock) {
    const params = {};
    const view = new DataView(dataBlock.buffer, dataBlock.byteOffset, dataBlock.byteLength);
    for (const key in PARAM_MAP) {
        const p = PARAM_MAP[key];
        if (p.offset + p.size > dataBlock.length) { params[key] = 0; continue; }
        switch (p.type) {
            case 'uint8': params[key] = dataBlock[p.offset]; break;
            case 'bool': params[key] = dataBlock[p.offset] !== 0; break;
            case 'uint16': params[key] = view.getUint16(p.offset, false); break;
            case 'float10': params[key] = view.getUint16(p.offset, false) / 10; break;
        }
    }
    if (params.model !== undefined) params._modelName = MODEL_NAMES[params.model] || 'Unknown';
    if (params.brand !== undefined) params._brandName = BRAND_NAMES[params.brand] || 'Unknown';
    return params;
}

let rxBuffer = new Uint8Array(0);

function processIncoming(chunk, onData, onError) {
    const newBuf = new Uint8Array(rxBuffer.length + chunk.length);
    newBuf.set(rxBuffer);
    newBuf.set(chunk, rxBuffer.length);
    rxBuffer = newBuf;

    while (rxBuffer.length > 0) {
        const headerIdx = rxBuffer.indexOf(HEADER);
        if (headerIdx === -1) { rxBuffer = new Uint8Array(0); return; }
        if (headerIdx > 0) rxBuffer = rxBuffer.slice(headerIdx);
        if (rxBuffer.length < 4) return;

        const dataLen = rxBuffer[3];
        const totalLen = 4 + dataLen + 1;
        if (rxBuffer.length < totalLen) return;

        const frame = rxBuffer.slice(0, totalLen);
        rxBuffer = rxBuffer.slice(totalLen);

        const receivedCs = frame[totalLen - 1];
        const calcCs = calcChecksum(frame.subarray(1, totalLen - 1));
        if (receivedCs !== calcCs) {
            if (onError) onError('Checksum error');
            continue;
        }

        const cmd = frame[2];
        if (cmd === CMD_READ && dataLen > 0) {
            const dataBlock = frame.slice(4, 4 + dataLen);
            if (onData) onData(decodeParams(dataBlock));
        } else if (cmd === CMD_WRITE) {
            if (onData) onData({ _writeSuccess: true });
        }
    }
}

function resetBuffer() { rxBuffer = new Uint8Array(0); }

const BLE_SERVICES = [
    0xFFE0,
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    0xFFF0,
];
const BLE_CHAR_MAP = {
    '0000ffe0': { tx: 0xFFE1, rx: 0xFFE1 },
    '0000fff0': { tx: 0xFFF1, rx: 0xFFF2 },
    '6e400001': { tx: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', rx: '6e400003-b5a3-f393-e0a9-e50e24dcca9e' },
};

let bleDevice = null;
let bleServer = null;
let bleTxChar = null;
let bleRxChar = null;
let bleConnected = false;

async function connectBLE() {
    if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth không được hỗ trợ. Dùng Chrome Android.');
    }

    bleDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICES,
    });

    bleDevice.addEventListener('gattserverdisconnected', onBLEDisconnected);
    bleServer = await bleDevice.gatt.connect();

    let service = null;
    let serviceKey = null;
    for (const svc of BLE_SERVICES) {
        try {
            service = await bleServer.getPrimaryService(svc);
            serviceKey = typeof svc === 'number' ? ('0000' + svc.toString(16)) : svc.substring(0, 8);
            console.log('[BLE] Found service:', svc);
            break;
        } catch (e) { continue; }
    }

    if (!service) {
        const services = await bleServer.getPrimaryServices();
        if (services.length > 0) {
            service = services[0];
            serviceKey = service.uuid.substring(0, 8);
            console.log('[BLE] Using first available service:', service.uuid);
        } else {
            throw new Error('Không tìm thấy dịch vụ UART trên thiết bị BLE');
        }
    }

    const chars = await service.getCharacteristics();
    console.log('[BLE] Characteristics:', chars.map(c => c.uuid));

    const map = BLE_CHAR_MAP[serviceKey];
    if (map) {
        try {
            bleTxChar = await service.getCharacteristic(map.tx);
            bleRxChar = (map.tx === map.rx) ? bleTxChar : await service.getCharacteristic(map.rx);
        } catch (e) {
            console.log('[BLE] Mapped chars failed, using discovery');
        }
    }

    if (!bleTxChar) {
        for (const c of chars) {
            if (c.properties.writeWithoutResponse || c.properties.write) {
                bleTxChar = c;
            }
            if (c.properties.notify) {
                bleRxChar = c;
            }
        }
    }

    if (!bleTxChar) throw new Error('Không tìm thấy characteristic ghi dữ liệu');

    if (bleRxChar && bleRxChar.properties.notify) {
        await bleRxChar.startNotifications();
        bleRxChar.addEventListener('characteristicvaluechanged', onBLEData);
    }

    bleConnected = true;
    return bleDevice.name || 'BLE Device';
}

function onBLEData(event) {
    const value = new Uint8Array(event.target.value.buffer);
    processIncoming(value, 
        (data) => {
            if (data._writeSuccess) {
                if (window._onWriteSuccess) window._onWriteSuccess();
            } else {
                if (window._onParamsData) window._onParamsData(data);
            }
        },
        (msg) => {
            if (window._onBLEError) window._onBLEError(msg);
        }
    );
}

function onBLEDisconnected() {
    bleConnected = false;
    bleTxChar = null;
    bleRxChar = null;
    if (window._onBLEDisconnected) window._onBLEDisconnected();
}

async function sendBLE(data) {
    if (!bleTxChar || !bleConnected) throw new Error('BLE chưa kết nối');
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
        if (bleTxChar.properties.writeWithoutResponse) {
            await bleTxChar.writeValueWithoutResponse(chunk);
        } else {
            await bleTxChar.writeValueWithResponse(chunk);
        }
    }
}

async function disconnectBLE() {
    if (bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
    }
    bleConnected = false;
    bleTxChar = null;
    bleRxChar = null;
}

async function bleReadData() {
    const cmd = buildReadCommand();
    await sendBLE(cmd);
}

async function bleWriteData(params) {
    const cmd = buildWriteCommand(params);
    await sendBLE(cmd);
}

// ====== Web Serial API (USB Cable) ======
let serialPort = null;
let serialWriter = null;
let serialReader = null;
let serialConnected = false;
let serialReadLoop = null;

// USB-to-Serial chip filters (CH340, CP2102, FTDI, PL2303)
const SERIAL_FILTERS = [
    { usbVendorId: 0x1A86 }, // CH340/CH341
    { usbVendorId: 0x10C4 }, // CP2102/CP2104 (Silicon Labs)
    { usbVendorId: 0x0403 }, // FTDI
    { usbVendorId: 0x067B }, // PL2303 (Prolific)
    { usbVendorId: 0x2341 }, // Arduino
];

async function connectSerial(baudRate = 115200) {
    if (!navigator.serial) {
        throw new Error('Web Serial không được hỗ trợ. Dùng Chrome trên máy tính (desktop).');
    }

    // Prompt user to select a serial port (show ALL ports, no filter)
    serialPort = await navigator.serial.requestPort();

    await serialPort.open({
        baudRate: baudRate,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: 'none',
    });

    serialWriter = serialPort.writable.getWriter();
    serialConnected = true;

    // Start reading loop
    serialReadLoop = readSerialLoop();

    // Get port info for display
    const info = serialPort.getInfo();
    let portName = 'USB Serial';
    if (info.usbVendorId === 0x1A86) portName = 'CH340 USB';
    else if (info.usbVendorId === 0x10C4) portName = 'CP2102 USB';
    else if (info.usbVendorId === 0x0403) portName = 'FTDI USB';
    else if (info.usbVendorId === 0x067B) portName = 'PL2303 USB';
    else if (info.usbVendorId) portName = `USB (${info.usbVendorId.toString(16)})`;

    console.log('[Serial] Connected:', portName, '@ baudRate:', baudRate);
    return portName;
}

async function readSerialLoop() {
    const reader = serialPort.readable.getReader();
    serialReader = reader;

    try {
        while (serialConnected) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.length > 0) {
                processIncoming(value,
                    (data) => {
                        if (data._writeSuccess) {
                            if (window._onWriteSuccess) window._onWriteSuccess();
                        } else {
                            if (window._onParamsData) window._onParamsData(data);
                        }
                    },
                    (msg) => {
                        if (window._onBLEError) window._onBLEError(msg);
                    }
                );
            }
        }
    } catch (e) {
        if (serialConnected) {
            console.error('[Serial] Read error:', e);
            if (window._onBLEError) window._onBLEError('Lỗi đọc Serial: ' + e.message);
        }
    } finally {
        try { reader.releaseLock(); } catch(e) {}
        serialReader = null;
    }
}

async function sendSerial(data) {
    if (!serialWriter || !serialConnected) throw new Error('USB Serial chưa kết nối');
    await serialWriter.write(data);
}

async function disconnectSerial() {
    serialConnected = false;
    try {
        if (serialReader) {
            await serialReader.cancel();
            serialReader = null;
        }
    } catch(e) {}
    try {
        if (serialWriter) {
            serialWriter.releaseLock();
            serialWriter = null;
        }
    } catch(e) {}
    try {
        if (serialPort) {
            await serialPort.close();
            serialPort = null;
        }
    } catch(e) {}
    resetBuffer();
    if (window._onBLEDisconnected) window._onBLEDisconnected();
}

async function serialReadData() {
    const cmd = buildReadCommand();
    await sendSerial(cmd);
}

async function serialWriteData(params) {
    const cmd = buildWriteCommand(params);
    await sendSerial(cmd);
}

// ====== Capability Detection ======
const hasWebBLE = !!navigator.bluetooth;
const hasWebSerial = !!navigator.serial;
