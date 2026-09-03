import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'devices.json');

// ค่าเริ่มต้นหากยังไม่มีไฟล์
const DEFAULT_DEVICES = [
  { id: 'light-living', name: 'ไฟห้องนั่งเล่น', type: 'light', room: 'ห้องนั่งเล่น', state: true, powerWatts: 24 },
  { id: 'light-bedroom', name: 'ไฟห้องนอนใหญ่', type: 'light', room: 'ห้องนอน', state: false, powerWatts: 18 },
  { id: 'ac-master', name: 'แอร์ห้องนอนใหญ่', type: 'ac', room: 'ห้องนอน', state: true, powerWatts: 820 },
  { id: 'fan-balcony', name: 'พัดลมระเบียง', type: 'fan', room: 'ระเบียง', state: false, powerWatts: 45 },
  { id: 'tv-living', name: 'Smart OLED TV', type: 'tv', room: 'ห้องนั่งเล่น', state: true, powerWatts: 110 }
];

class DeviceManager {
  constructor() {
    this.devices = [];
    this.subscribers = new Set();
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      try {
        this.devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      } catch (err) {
        this.devices = DEFAULT_DEVICES;
        this.save();
      }
    } else {
      this.devices = DEFAULT_DEVICES;
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.devices, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving devices:', e);
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(event) {
    this.subscribers.forEach(cb => cb(event));
  }

  getAll() {
    return this.devices;
  }

  getById(id) {
    return this.devices.find(d => d.id === id);
  }

  toggle(id) {
    const dev = this.getById(id);
    if (dev) {
      dev.state = !dev.state;
      this.save();
      this.notify({ type: 'DEVICE_UPDATED', device: dev, energy: this.getEnergySummary() });
      return dev;
    }
    return null;
  }

  update(id, updates) {
    const dev = this.getById(id);
    if (dev) {
      Object.assign(dev, updates);
      this.save();
      this.notify({ type: 'DEVICE_UPDATED', device: dev, energy: this.getEnergySummary() });
      return dev;
    }
    return null;
  }

  getEnergySummary() {
    const currentWatts = this.devices
      .filter(d => d.state)
      .reduce((sum, d) => sum + (d.powerWatts || 0), 0);
    const dailyKwh = ((currentWatts * 24) / 1000).toFixed(2);
    const estimatedDailyCost = (dailyKwh * 4.42).toFixed(2); // อิงอัตราค่าไฟเฉลี่ยประเทศไทย

    return {
      currentWatts,
      dailyKwh: parseFloat(dailyKwh),
      estimatedDailyCost: parseFloat(estimatedDailyCost),
      history7Days: [14.2, 16.5, 12.8, 18.2, 15.0, 13.7, parseFloat(dailyKwh)]
    };
  }
}

export const deviceManager = new DeviceManager();