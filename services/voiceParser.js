import { deviceManager } from './deviceManager.js';
import { automationEngine } from './automationEngine.js';

export function processVoiceCommand(text) {
  if (!text || typeof text !== 'string') {
    return { success: false, text: '', message: 'ไม่มีข้อความคำสั่ง' };
  }

  const query = text.trim().toLowerCase();
  let actionTaken = false;
  let responseMessage = '';
  const affectedDevices = [];

  // 1. Check Automations / Scenes
  if (query.includes('เข้านอน') || query.includes('night mode')) {
    const res = automationEngine.executeRule('rule_night_mode');
    return {
      success: true,
      text,
      message: 'เปิดใช้งาน "โหมดเข้านอน" ออฟไลน์เรียบร้อยแล้ว ล็อคประตูและปิดไฟในบ้านให้แล้วครับ',
      ruleResult: res
    };
  }

  if (query.includes('ออกจากบ้าน') || query.includes('away mode') || query.includes('ไปข้างนอก')) {
    const res = automationEngine.executeRule('rule_leave_home');
    return {
      success: true,
      text,
      message: 'เปิดใช้งาน "โหมดออกจากบ้าน" เรียบร้อยแล้ว ปิดไฟ อุปกรณ์ และเปิดระบบรักษาความปลอดภัยแล้วครับ',
      ruleResult: res
    };
  }

  // 2. Turn off all lights
  if (query.includes('ปิดไฟทุกดวง') || query.includes('ปิดไฟหมด') || query.includes('turn off all lights')) {
    const devices = deviceManager.getAll();
    devices.forEach(d => {
      if (d.type === 'light') {
        const updated = deviceManager.update(d.id, { state: 'off' });
        affectedDevices.push(updated);
      }
    });
    return {
      success: true,
      text,
      message: 'ปิดไฟทุกดวงในบ้านเรียบร้อยแล้วครับ',
      affectedDevices
    };
  }

  // 3. Turn on all lights
  if (query.includes('เปิดไฟทุกดวง') || query.includes('เปิดไฟหมด') || query.includes('turn on all lights')) {
    const devices = deviceManager.getAll();
    devices.forEach(d => {
      if (d.type === 'light') {
        const updated = deviceManager.update(d.id, { state: 'on' });
        affectedDevices.push(updated);
      }
    });
    return {
      success: true,
      text,
      message: 'เปิดไฟทุกดวงในบ้านเรียบร้อยแล้วครับ',
      affectedDevices
    };
  }

  // 4. Specific Device Controls (Thai keyword parsing)
  // Living room lights
  if (query.includes('ไฟห้องรับแขก') || query.includes('ไฟนั่งเล่น') || query.includes('living room light')) {
    const state = (query.includes('ปิด') || query.includes('off')) ? 'off' : 'on';
    const updated = deviceManager.update('light_living_main', { state });
    return {
      success: true,
      text,
      message: `${state === 'on' ? 'เปิด' : 'ปิด'}ไฟหลักห้องรับแขกเรียบร้อยแล้วครับ`,
      affectedDevices: [updated]
    };
  }

  // Bedroom lights
  if (query.includes('ไฟห้องนอน') || query.includes('bedroom light')) {
    const state = (query.includes('ปิด') || query.includes('off')) ? 'off' : 'on';
    const updated = deviceManager.update('light_bedroom_main', { state });
    return {
      success: true,
      text,
      message: `${state === 'on' ? 'เปิด' : 'ปิด'}ไฟห้องนอนเรียบร้อยแล้วครับ`,
      affectedDevices: [updated]
    };
  }

  // AC / Air conditioner
  if (query.includes('แอร์') || query.includes('air') || query.includes('ac')) {
    const isBedroom = query.includes('ห้องนอน');
    const targetId = isBedroom ? 'ac_bedroom' : 'ac_living';
    const roomName = isBedroom ? 'ห้องนอน' : 'ห้องรับแขก';

    let state = (query.includes('ปิด') || query.includes('off')) ? 'off' : 'on';
    
    // Check if temperature value mentioned, e.g., 24, 25, 23
    const tempMatch = query.match(/(\d{2})/);
    let targetTemp = 24;
    if (tempMatch && parseInt(tempMatch[1]) >= 18 && parseInt(tempMatch[1]) <= 30) {
      targetTemp = parseInt(tempMatch[1]);
      state = 'on';
    }

    const updated = deviceManager.update(targetId, {
      state,
      targetTemp,
      powerWatts: state === 'on' ? 850 : 0
    });

    return {
      success: true,
      text,
      message: `${state === 'on' ? 'เปิด' : 'ปิด'}แอร์${roomName}${state === 'on' ? ` ตั้งอุณหภูมิที่ ${targetTemp}°C` : ''} เรียบร้อยแล้วครับ`,
      affectedDevices: [updated]
    };
  }

  // Lock Door
  if (query.includes('ล็อคประตู') || query.includes('ปลดล็อค') || query.includes('ประตู')) {
    const isLock = !query.includes('ปลด');
    const updated = deviceManager.update('lock_front_door', { locked: isLock });
    return {
      success: true,
      text,
      message: `${isLock ? 'ทำการล็อค' : 'ปลดล็อค'}ประตูหน้าบ้านเรียบร้อยแล้วครับ`,
      affectedDevices: [updated]
    };
  }

  // Ambient LED Light
  if (query.includes('ไฟบรรยากาศ') || query.includes('led') || query.includes('ambient')) {
    const state = (query.includes('ปิด') || query.includes('off')) ? 'off' : 'on';
    const updated = deviceManager.update('light_living_ambient', { state });
    return {
      success: true,
      text,
      message: `${state === 'on' ? 'เปิด' : 'ปิด'}ไฟบรรยากาศ LED เรียบร้อยแล้วครับ`,
      affectedDevices: [updated]
    };
  }

  return {
    success: false,
    text,
    message: `ขออภัยครับ ไม่พบคำสั่งที่ตรงกับ "${text}" (ลองพูดเช่น: "เปิดไฟห้องรับแขก", "ปิดไฟทุกดวง", "เปิดแอร์ 24 องศา", "โหมดเข้านอน")`
  };
}
