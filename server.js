/**
 * Votol Controller Web Server
 * 
 * Server Node.js kết nối HC-05 Bluetooth qua cổng COM
 * Cung cấp giao diện web cho điện thoại truy cập qua WiFi cùng mạng
 * 
 * Cách dùng:
 *   1. Pair HC-05 với máy tính (mã PIN mặc định: 1234)
 *   2. Tìm cổng COM của HC-05 trong Device Manager
 *   3. Chạy: node server.js
 *   4. Mở trình duyệt điện thoại, truy cập: http://<IP-máy-tính>:3000
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

// Thử import serialport, nếu chưa cài thì dùng mock
let SerialPort, ReadlineParser;
try {
    const sp = require('serialport');
    SerialPort = sp.SerialPort;
    ReadlineParser = sp.ReadlineParser;
} catch (e) {
    console.log('[Server] Module serialport chưa được cài. Chạy ở chế độ mô phỏng (demo).');
    SerialPort = null;
}

const { VotolProtocol, PARAM_MAP } = require('./protocol/votol');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Biến toàn cục
let serialPort = null;
let protocol = new VotolProtocol();
let isConnected = false;
let currentParams = {};

// Dữ liệu mô phỏng mặc định (dùng khi không có HC-05)
const DEFAULT_DEMO_PARAMS = {
    softwareVersion: 0,
    hardwareVersion: 0,
    brand: 0,
    model: 2,
    batteryVoltage: 72,
    _brandName: 'Phổ thông',
    _modelName: 'EM50',
    
    overVoltage: 60,
    underVoltage: 40,
    softUnderVoltage: 43,
    underVoltageHyst: 1,
    busCurrent: 40,
    phaseCurrentLimit: 9960,
    
    throttleLowProtect: 0.3,
    throttleStartV: 1.2,
    throttleEndV: 4.3,
    throttleHighProtect: 4.9,
    
    startTorque: 0,
    couplingTorque: 0,
    riseSlope: 80,
    fallSlope: 60,
    
    maxCurrentLimit: 40,
    fieldWeakValue: 3000,
    currentPI_KI: 200,
    autoExitEnable: false,
    exitTime: 30,
    recoveryTime: 30,
    
    speedSettingEnable: true,
    maxRPM: 600,
    
    speedLimitSwitch: false,
    speedLimitRatio: 30,
    fieldWeakComp: 10,
    
    lowSpeedRatio: 60,
    lowSpeedCurrentLimit: 100,
    midSpeedRatio: 80,
    midSpeedCurrentLimit: 100,
    highSpeedRatio: 100,
    overModulation: 14,
    accelPhaseCurrent: 3000,
    ratedPhaseTime: 40,
    currentPI_KP: 9000,
    ratedPhaseCurrent: 5000,
    
    gearMode: 0,
    defaultGear: 0,
    softStartSwitch: false,
    softStartLevel: 1,
    
    polePairs: 4,
    phaseAngle: 60,
    hallSwapYB: false,
    phaseSwapBG: false,
    direction: 0,
    motorType: 0,
    outputType: 0,
    
    hillParkEnable: false,
    cruiseEnable: false,
    walkAssistEnable: false,
    walkAssistSpeed: 7,
    walkAssistTorque: 400,
    dualVoltageAutoDetect: false,
    dualVoltageSelect: 0,
};

// API endpoint: Lấy danh sách cổng COM
app.get('/api/ports', async (req, res) => {
    if (!SerialPort) {
        return res.json([
            { path: 'DEMO', manufacturer: 'Demo Mode - Không có SerialPort' }
        ]);
    }
    
    try {
        const ports = await SerialPort.list();
        console.log('[Server] Danh sách cổng COM:');
        if (ports.length === 0) {
            console.log('  (Không tìm thấy cổng COM nào)');
        }
        ports.forEach(p => {
            console.log(`  ${p.path} - ${p.manufacturer || 'N/A'} ${p.friendlyName || ''}`);
        });
        res.json(ports.map(p => ({
            path: p.path,
            manufacturer: p.manufacturer || '',
            friendlyName: p.friendlyName || '',
            vendorId: p.vendorId,
            productId: p.productId,
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Auto-detect HC-05 port
app.get('/api/autodetect', async (req, res) => {
    if (!SerialPort) {
        return res.json({ port: 'DEMO', reason: 'SerialPort not installed' });
    }
    try {
        const ports = await SerialPort.list();
        // Tìm cổng HC-05 bằng tên
        const hc05 = ports.find(p => 
            (p.friendlyName && p.friendlyName.toLowerCase().includes('hc-05')) ||
            (p.friendlyName && p.friendlyName.toLowerCase().includes('hc05')) ||
            (p.manufacturer && p.manufacturer.toLowerCase().includes('hc-05')) ||
            (p.friendlyName && p.friendlyName.toLowerCase().includes('bluetooth')) ||
            (p.friendlyName && p.friendlyName.toLowerCase().includes('standard serial over bluetooth'))
        );
        if (hc05) {
            console.log(`[AutoDetect] Tìm thấy HC-05: ${hc05.path} (${hc05.friendlyName || hc05.manufacturer})`);
            return res.json({ port: hc05.path, name: hc05.friendlyName || hc05.manufacturer });
        }
        // Nếu không tìm thấy HC-05, trả về tất cả cổng COM
        if (ports.length > 0) {
            console.log(`[AutoDetect] Không tìm thấy HC-05. Trả về ${ports.length} cổng COM.`);
            return res.json({ port: null, ports: ports.map(p => ({ path: p.path, name: p.friendlyName || p.manufacturer || p.path })) });
        }
        console.log('[AutoDetect] Không có cổng COM nào.');
        return res.json({ port: null, ports: [], reason: 'No COM ports found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API endpoint: Lấy bản đồ tham số
app.get('/api/params', (req, res) => {
    res.json(PARAM_MAP);
});

// Lấy IP của máy tính trong mạng LAN
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Socket.IO connection
io.on('connection', (socket) => {
    console.log(`[Socket] Client kết nối: ${socket.id}`);
    
    // Gửi trạng thái hiện tại
    socket.emit('connectionStatus', {
        connected: isConnected,
        params: currentParams
    });

    // Kết nối Bluetooth (Serial Port)
    socket.on('connect_bluetooth', async (data) => {
        const { portPath, baudRate = 9600 } = data;
        
        // Chế độ demo
        if (portPath === 'DEMO' || !SerialPort) {
            isConnected = true;
            currentParams = { ...DEFAULT_DEMO_PARAMS };
            io.emit('connectionStatus', { connected: true, demo: true });
            io.emit('params_data', currentParams);
            console.log('[Server] Đang chạy ở chế độ demo');
            return;
        }
        
        // Auto-detect nếu portPath là 'AUTO'
        let targetPort = portPath;
        if (portPath === 'AUTO') {
            try {
                const ports = await SerialPort.list();
                const hc05 = ports.find(p => 
                    (p.friendlyName && p.friendlyName.toLowerCase().includes('bluetooth')) ||
                    (p.friendlyName && p.friendlyName.toLowerCase().includes('hc-05')) ||
                    (p.friendlyName && p.friendlyName.toLowerCase().includes('serial'))
                );
                if (hc05) {
                    targetPort = hc05.path;
                    console.log(`[Auto] Tìm thấy: ${hc05.path} (${hc05.friendlyName})`);
                } else if (ports.length > 0) {
                    targetPort = ports[0].path;
                    console.log(`[Auto] Dùng cổng đầu tiên: ${targetPort}`);
                } else {
                    socket.emit('bt_no_ports', { ports: [] });
                    console.log('[Auto] Không tìm thấy cổng COM');
                    return;
                }
            } catch (err) {
                socket.emit('error', { message: `Lỗi quét cổng: ${err.message}` });
                return;
            }
        }
        
        try {
            // Đóng port cũ nếu đang mở
            if (serialPort && serialPort.isOpen) {
                serialPort.close();
                await new Promise(r => setTimeout(r, 500));
            }
            
            console.log(`[Serial] Đang kết nối ${targetPort} @ ${baudRate} baud...`);
            
            serialPort = new SerialPort({
                path: targetPort,
                baudRate: parseInt(baudRate),
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
            });
            
            protocol.reset();
            
            serialPort.on('open', () => {
                isConnected = true;
                console.log(`[Serial] ✅ Đã kết nối cổng ${targetPort} @ ${baudRate} baud`);
                io.emit('connectionStatus', { connected: true, port: targetPort });
                
                // Tự động gửi lệnh đọc dữ liệu sau khi kết nối
                setTimeout(() => {
                    const cmd = protocol.buildReadCommand();
                    serialPort.write(cmd, (err) => {
                        if (err) console.error('[Serial] Lỗi gửi lệnh đọc:', err.message);
                        else console.log('[Serial] Đã gửi lệnh đọc dữ liệu tự động');
                    });
                }, 500);
            });
            
            serialPort.on('data', (data) => {
                protocol.processIncoming(data);
            });
            
            serialPort.on('error', (err) => {
                console.error('[Serial] Lỗi:', err.message);
                io.emit('error', { message: `Lỗi Serial: ${err.message}` });
                isConnected = false;
                io.emit('connectionStatus', { connected: false });
            });
            
            serialPort.on('close', () => {
                isConnected = false;
                console.log('[Serial] Đã ngắt kết nối');
                io.emit('connectionStatus', { connected: false });
            });
            
            // Callback khi nhận dữ liệu từ controller
            protocol.onData((params) => {
                if (params._writeSuccess) {
                    io.emit('write_success', { message: 'Lưu dữ liệu thành công!' });
                } else {
                    currentParams = params;
                    io.emit('params_data', params);
                }
            });
            
            protocol.onError((message) => {
                io.emit('error', { message });
            });
            
        } catch (err) {
            console.error('[Serial] Không thể kết nối:', err.message);
            socket.emit('error', { message: `Không thể kết nối ${targetPort}: ${err.message}` });
        }
    });

    // Ngắt kết nối Bluetooth
    socket.on('disconnect_bluetooth', () => {
        if (serialPort && serialPort.isOpen) {
            serialPort.close();
        }
        isConnected = false;
        io.emit('connectionStatus', { connected: false });
        console.log('[Serial] Đã ngắt kết nối theo yêu cầu');
    });

    // Đọc dữ liệu từ controller
    socket.on('read_data', () => {
        if (!isConnected) {
            socket.emit('error', { message: 'Chưa kết nối Bluetooth!' });
            return;
        }
        
        // Chế độ demo
        if (!serialPort || !serialPort.isOpen) {
            currentParams = { ...DEFAULT_DEMO_PARAMS };
            io.emit('params_data', currentParams);
            return;
        }
        
        const cmd = protocol.buildReadCommand();
        serialPort.write(cmd, (err) => {
            if (err) {
                socket.emit('error', { message: `Lỗi gửi lệnh đọc: ${err.message}` });
            } else {
                console.log('[Serial] Đã gửi lệnh đọc dữ liệu');
            }
        });
    });

    // Ghi dữ liệu xuống controller
    socket.on('write_data', (params) => {
        if (!isConnected) {
            socket.emit('error', { message: 'Chưa kết nối Bluetooth!' });
            return;
        }
        
        // Chế độ demo
        if (!serialPort || !serialPort.isOpen) {
            currentParams = { ...currentParams, ...params };
            io.emit('write_success', { message: 'Lưu dữ liệu thành công! (Demo)' });
            io.emit('params_data', currentParams);
            return;
        }
        
        const cmd = protocol.buildWriteCommand(params);
        serialPort.write(cmd, (err) => {
            if (err) {
                socket.emit('error', { message: `Lỗi gửi lệnh ghi: ${err.message}` });
            } else {
                console.log('[Serial] Đã gửi lệnh ghi dữ liệu');
                // Cập nhật params local
                currentParams = { ...currentParams, ...params };
            }
        });
    });

    // Cập nhật 1 tham số
    socket.on('update_param', (data) => {
        const { key, value } = data;
        if (currentParams.hasOwnProperty(key) || PARAM_MAP[key]) {
            currentParams[key] = value;
            // Broadcast đến tất cả client
            io.emit('param_updated', { key, value });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client ngắt kết nối: ${socket.id}`);
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       VOTOL CONTROLLER - ỨNG DỤNG CÀI ĐẶT         ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Máy tính:  http://localhost:${PORT}                   ║`);
    console.log(`║  Điện thoại: http://${localIP}:${PORT}            ║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  Bước 1: Pair HC-05 với máy tính (PIN: 1234)        ║');
    console.log('║  Bước 2: Chọn cổng COM trong ứng dụng              ║');
    console.log('║  Bước 3: Kết nối và cài đặt controller              ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
});
