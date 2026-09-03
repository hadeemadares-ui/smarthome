import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deviceManager } from './deviceManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTO_FILE = path.join(__dirname, '..', 'data', 'automations.json');

const DEFAULT_RULES = [
  {
    id: 'away-mode',
    name: 'โหมดออกจากบ้าน (Away Mode)',
    enabled: true,
    action: 'turn_off_all'
  },
  {
    id: 'night-mode',
    name: 'โหมดเข้านอน (Night Mode)',
    enabled: true,
    action: 'night_routine'
  }
];

class AutomationEngine {
  constructor() {
    this.rules = DEFAULT_RULES;
    this.init();
  }

  init() {
    if (fs.existsSync(AUTO_FILE)) {
      try {
        this.rules = JSON.parse(fs.readFileSync(AUTO_FILE, 'utf-8'));
      } catch (err) {
        this.rules = DEFAULT_RULES;
      }
    }
  }

  getAll() {
    return this.rules;
  }

  executeRule(id) {
    if (id === 'away' || id === 'away-mode') {
      deviceManager.getAll().forEach(d => {
        if (d.state) deviceManager.toggle(d.id);
      });
      return { success: true, message: 'ปิดอุปกรณ์ทั้งหมดเรียบร้อย (Away Mode)' };
    }
    if (id === 'night' || id === 'night-mode') {
      deviceManager.getAll().forEach(d => {
        if (d.type === 'light' && d.state) deviceManager.toggle(d.id);
        if (d.type === 'ac' && !d.state) deviceManager.toggle(d.id);
      });
      return { success: true, message: 'เปิดแอร์และปิดไฟทุกดวงเรียบร้อย (Night Mode)' };
    }
    if (id === 'home') {
      const livingLight = deviceManager.getById('light-living');
      if (livingLight && !livingLight.state) deviceManager.toggle(livingLight.id);
      return { success: true, message: 'ยินดีต้อนรับกลับบ้าน เปิดไฟห้องนั่งเล่นแล้ว' };
    }
    return { success: false, message: 'ไม่พบโหมดคำสั่ง' };
  }

  toggleRule(id) {
    const r = this.rules.find(item => item.id === id);
    if (r) {
      r.enabled = !r.enabled;
      return r;
    }
    return null;
  }
}

export const automationEngine = new AutomationEngine();