import { deviceManager } from './deviceManager.js';
import { automationEngine } from './automationEngine.js';

export function processVoiceCommand(text = '') {
  const query = text.toLowerCase().trim();

  // 1. คำสั่งควบคุมภาพรวม
  if (query.includes('ปิดไฟทั้งหมด') || query.includes('ปิดไฟทุกดวง')) {
    deviceManager.getAll().forEach(d => {
      if (d.type === 'light' && d.state) deviceManager.toggle(d.id);
    });
    return { success: true, reply: 'ปิดไฟทุกดวงให้เรียบร้อยแล้วค่ะ' };
  }

  if (query.includes('เปิดไฟทั้งหมด') || query.includes('เปิดไฟทุกดวง')) {
    deviceManager.getAll().forEach(d => {
      if (d.type === 'light' && !d.state) deviceManager.toggle(d.id);
    });
    return { success: true, reply: 'เปิดไฟทุกดวงให้เรียบร้อยแล้วค่ะ' };
  }

  // 2. คำสั่ง Scene Presets
  if (query.includes('เข้านอน') || query.includes('ราตรีสวัสดิ์')) {
    automationEngine.executeRule('night');
    return { success: true, reply: 'ตั้งค่าโหมดเข้านอน ปิดไฟและเปิดแอร์ให้เรียบร้อยค่ะ' };
  }

  if (query.includes('ออกจากบ้าน')) {
    automationEngine.executeRule('away');
    return { success: true, reply: 'ตั้งค่าโหมดออกจากบ้าน ปิดอุปกรณ์ทั้งหมดแล้วค่ะ' };
  }

  // 3. ตรวจจับตามชื่ออุปกรณ์
  const devices = deviceManager.getAll();
  const isTurnOn = query.includes('เปิด');
  const isTurnOff = query.includes('ปิด');

  for (const dev of devices) {
    const nameMatch = query.includes(dev.name.toLowerCase());
    const roomMatch = query.includes((dev.room || '').toLowerCase());
    const typeMatch = (dev.type === 'ac' && query.includes('แอร์')) ||
                      (dev.type === 'light' && query.includes('ไฟ')) ||
                      (dev.type === 'fan' && query.includes('พัดลม')) ||
                      (dev.type === 'tv' && query.includes('ทีวี'));

    if (nameMatch || (roomMatch && typeMatch)) {
      if (isTurnOn && !dev.state) {
        deviceManager.toggle(dev.id);
        return { success: true, reply: `เปิด${dev.name}แล้วค่ะ` };
      } else if (isTurnOff && dev.state) {
        deviceManager.toggle(dev.id);
        return { success: true, reply: `ปิด${dev.name}แล้วค่ะ` };
      } else {
        return { success: true, reply: `${dev.name}อยู่ในสถานะนั้นอยู่แล้วค่ะ` };
      }
    }
  }

  return { success: false, reply: 'ขออภัยค่ะ ไม่เข้าใจคำสั่ง ลองพูดว่า "เปิดไฟห้องนั่งเล่น" หรือ "โหมดเข้านอน"' };
}