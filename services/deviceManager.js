import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/devices.json');

// Ensure data folder exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
}

// Initial default devices if data file does not exist
const initialDevices = [
  {
    id: 'light_living_main',
    name: 'ไฟหลักห้องรับแขก',
    room: 'living_room',
    type: 'light',
    state: 'off',
    brightness: 80,
    color: '#FFD166',
    powerWatts: 15,
    icon: 'fa-lightbulb'
  },
  {
    id: 'light_living_ambient',
    name: 'ไฟบรรยากาศ LED',
    room: 'living_room',
    type: 'light',
    state: 'on',
    brightness: 50,
    color: '#06D6A0',
    powerWatts: 8,
    icon: 'fa-sun'
  },
  {
    id: 'ac_living',
    name: 'เครื่องปรับอากาศ (AC)',
    room: 'living_room',
    type: 'climate',
    state: 'on',
    targetTemp: 24,
    currentTemp: 25.5,
    mode: 'cool',
    powerWatts: 850,
    icon: 'fa-snowflake'
  },
  {
    id: 'sensor_living_presence',
    name: 'เซนเซอร์ตรวจจับ mmWave',
    room: 'living_room',
    type: 'sensor',
    presence: true,
    lastMotion: new Date().toISOString(),
    icon: 'fa-user-clock'
  },
  {
    id: 'light_bedroom_main',
    name: 'ไฟห้องนอนหลัก',
    room: 'bedroom',
    type: 'light',
    state: 'off',
    brightness: 100,
    color: '#FFFFFF',
    powerWatts: 12,
    icon: 'fa-lightbulb'
  },
  {
    id: 'ac_bedroom',
    name: 'แอร์ห้องนอน',
    room: 'bedroom',
    type: 'climate',
    state: 'off',
    targetTemp: 25,
    currentTemp: 27.0,
    mode: 'cool',
    powerWatts: 0,
    icon: 'fa-snowflake'
  },
  {
    id: 'curtain_bedroom',
    name: 'ผ้าม่านอัจฉริยะ',
    room: 'bedroom',
    type: 'cover',
    position: 100, // 100 = open, 0 = closed
    icon: 'fa-blinds'
  },
  {
    id: 'lock_front_door',
    name: 'ประตูหน้าบ้าน Smart Lock',
    room: 'entrance',
    type: 'lock',
    locked: true,
    battery: 92,
    icon: 'fa-lock'
  },
  {
    id: 'security_alarm',
    name: 'ระบบเตือนภัยออฟไลน์ (Alarm)',
    room: 'security',
    type: 'switch',
    state: 'on',
    mode: 'armed_home',
    icon: 'fa-shield-halved'
  }
];

class DeviceManager {
  constructor() {
    this.devices = this.loadDevices();
    this.logs = [];
    this.listeners = [];
  }

  loadDevices() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load device state, creating default:', err);
    }
    this.saveDevices(initialDevices);
    return initialDevices;
  }

  saveDevices(devicesToSave = this.devices) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(devicesToSave, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save device state:', err);
    }
  }

  getAll() {
    return this.devices;
  }

  getById(id) {
    return this.devices.find(d => d.id === id);
  }

  update(id, updates) {
    const device = this.getById(id);
    if (!device) return null;

    Object.assign(device, updates);
    this.saveDevices();

    const logEntry = {
      timestamp: new Date().toISOString(),
      deviceId: id,
      deviceName: device.name,
      action: 'UPDATE',
      details: updates
    };
    this.logs.unshift(logEntry);
    if (this.logs.length > 50) this.logs.pop();

    this.notify(device, logEntry);
    return device;
  }

  toggle(id) {
    const device = this.getById(id);
    if (!device) return null;

    if (device.type === 'light' || device.type === 'switch' || device.type === 'climate') {
      const newState = device.state === 'on' ? 'off' : 'on';
      if (device.type === 'climate') {
        device.powerWatts = newState === 'on' ? 850 : 0;
      }
      return this.update(id, { state: newState });
    } else if (device.type === 'lock') {
      return this.update(id, { locked: !device.locked });
    }
    return device;
  }

  getEnergySummary() {
    let totalWatts = 0;
    let activeDevicesCount = 0;

    this.devices.forEach(d => {
      if (d.state === 'on' && d.powerWatts) {
        totalWatts += d.powerWatts;
        activeDevicesCount++;
      }
    });

    return {
      totalWatts,
      activeDevicesCount,
      estimatedDailyKWh: ((totalWatts * 12) / 1000).toFixed(2),
      estimatedDailyBaht: (((totalWatts * 12) / 1000) * 4.2).toFixed(2)
    };
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify(device, log) {
    this.listeners.forEach(cb => cb({ type: 'DEVICE_UPDATE', device, log, energy: this.getEnergySummary() }));
  }
}

export const deviceManager = new DeviceManager();
