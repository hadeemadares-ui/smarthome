import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deviceManager } from './deviceManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_FILE = path.join(__dirname, '../data/automations.json');

const initialRules = [
  {
    id: 'rule_night_mode',
    name: 'โหมดเข้านอน (Night Mode)',
    description: 'ปิดไฟห้องรับแขก ล็อคประตูหน้าบ้าน และปรับแอร์ห้องนอนที่ 25°C',
    enabled: true,
    trigger: 'manual_or_time',
    time: '22:30',
    actions: [
      { deviceId: 'light_living_main', update: { state: 'off' } },
      { deviceId: 'light_living_ambient', update: { state: 'off' } },
      { deviceId: 'lock_front_door', update: { locked: true } },
      { deviceId: 'ac_bedroom', update: { state: 'on', targetTemp: 25 } }
    ]
  },
  {
    id: 'rule_leave_home',
    name: 'ออกจากบ้าน (Away Mode)',
    description: 'ปิดไฟทุกดวง ปิดแอร์ทุกเครื่อง และเปิดระบบรักษาความปลอดภัยออฟไลน์',
    enabled: true,
    trigger: 'manual',
    actions: [
      { deviceId: 'light_living_main', update: { state: 'off' } },
      { deviceId: 'light_living_ambient', update: { state: 'off' } },
      { deviceId: 'light_bedroom_main', update: { state: 'off' } },
      { deviceId: 'ac_living', update: { state: 'off' } },
      { deviceId: 'ac_bedroom', update: { state: 'off' } },
      { deviceId: 'lock_front_door', update: { locked: true } },
      { deviceId: 'security_alarm', update: { state: 'on', mode: 'armed_away' } }
    ]
  },
  {
    id: 'rule_auto_light_mmwave',
    name: 'เปิดไฟอัตโนมัติเมื่อพบการเคลื่อนไหว (mmWave)',
    description: 'เปิดไฟ LED เมื่อเซนเซอร์ mmWave ตรวจเจอมนุษย์ในห้องรับแขก',
    enabled: true,
    trigger: 'sensor_presence',
    actions: [
      { deviceId: 'light_living_ambient', update: { state: 'on', brightness: 60 } }
    ]
  }
];

class AutomationEngine {
  constructor() {
    this.rules = this.loadRules();
  }

  loadRules() {
    try {
      if (fs.existsSync(RULES_FILE)) {
        return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      }
    } catch (err) {
      console.error('Error loading automations:', err);
    }
    this.saveRules(initialRules);
    return initialRules;
  }

  saveRules(rulesToSave = this.rules) {
    try {
      fs.writeFileSync(RULES_FILE, JSON.stringify(rulesToSave, null, 2));
    } catch (err) {
      console.error('Error saving automations:', err);
    }
  }

  getAll() {
    return this.rules;
  }

  toggleRule(id) {
    const rule = this.rules.find(r => r.id === id);
    if (rule) {
      rule.enabled = !rule.enabled;
      this.saveRules();
    }
    return rule;
  }

  executeRule(id) {
    const rule = this.rules.find(r => r.id === id);
    if (!rule) return { success: false, message: 'Rule not found' };

    const results = [];
    rule.actions.forEach(act => {
      const updated = deviceManager.update(act.deviceId, act.update);
      if (updated) results.push(updated);
    });

    return {
      success: true,
      ruleName: rule.name,
      updatedDevices: results,
      timestamp: new Date().toISOString()
    };
  }
}

export const automationEngine = new AutomationEngine();
