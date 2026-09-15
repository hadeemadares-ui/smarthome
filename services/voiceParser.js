import { deviceManager } from './deviceManager.js';
import { automationEngine } from './automationEngine.js';

export function processVoiceCommand(text = '') {
  const query = text.toLowerCase().trim();

  // 1. คำสั่งควบคุมภาพรวมทุกอุปกรณ์
  if (query.includes('ปิดไฟทั้งหมด') || query.includes('ปิดไฟทุกดวง') || query.includes('ดับไฟ')) {
    deviceManager.getAll().forEach(d => {
      if (d.type === 'light' && d.state) deviceManager.toggle(d.id);
    });
    return { success: true, reply: 'ปิดไฟทุกดวงเรียบร้อยแล้วค่ะ' };
  }

  if (query.includes('เปิดไฟทั้งหมด') || query.includes('เปิดไฟทุกดวง')) {
    deviceManager.getAll().forEach(d => {
      if (d.type === 'light' && !d.state) deviceManager.toggle(d.id);
    });
    return { success: true, reply: 'เปิดไฟทุกดวงเรียบร้อยแล้วค่ะ' };
  }

  if (query.includes('ปิดทั้งหมด') || query.includes('ปิดบ้าน') || query.includes('ออกจากบ้าน')) {
    deviceManager.getAll().forEach(d => {
      if (d.state && d.type !== 'lock') deviceManager.toggle(d.id);
    });
    return { success: true, reply: 'เปิดโหมดออกจากบ้าน ปิดอุปกรณ์ในบ้านเรียบร้อยแล้วค่ะ' };
  }

  // 2. คำสั่ง Scene Presets
  if (query.includes('เข้านอน') || query.includes('ราตรีสวัสดิ์')) {
    deviceManager.getAll().forEach(d => {
      if (d.type === 'light' || d.type === 'tv' || d.type === 'fan') {
        if (d.state) deviceManager.toggle(d.id);
      }
    });
    const ac = deviceManager.getById('ac-master');
    if (ac && !ac.state) deviceManager.toggle('ac-master');
    return { success: true, reply: 'เปิดโหมดเข้านอน ปิดไฟและเปิดแอร์ห้องนอนให้เรียบร้อยแล้วค่ะ' };
  }

  if (query.includes('ดูหนัง')) {
    const tv = deviceManager.getById('tv-living');
    if (tv && !tv.state) deviceManager.toggle('tv-living');
    const light = deviceManager.getById('light-living');
    if (light && !light.state) deviceManager.toggle('light-living');
    return { success: true, reply: 'เปิดโหมดดูหนัง เปิดทีวีและปรับแสงบรรยากาศแล้วค่ะ' };
  }

  if (query.includes('ตื่นนอน') || query.includes('อรุณสวัสดิ์')) {
    const light = deviceManager.getById('light-bedroom');
    if (light && !light.state) deviceManager.toggle('light-bedroom');
    return { success: true, reply: 'อรุณสวัสดิ์ค่ะ เปิดไฟห้องนอนให้แล้วค่ะ' };
  }

  // 3. ตรวจจับตามประเภทและสถานที่ของอุปกรณ์
  const devices = deviceManager.getAll();
  const isTurnOn = query.includes('เปิด') || query.includes('ติด') || query.includes('ทำงาน');
  const isTurnOff = query.includes('ปิด') || query.includes('ดับ') || query.includes('หยุด');

  for (const dev of devices) {
    const nameMatch = query.includes(dev.name.toLowerCase());
    const roomMatch = query.includes((dev.room || '').toLowerCase());
    const typeMatch = (dev.type === 'ac' && (query.includes('แอร์') || query.includes('ปรับอากาศ'))) ||
                      (dev.type === 'light' && (query.includes('ไฟ') || query.includes('โคมไฟ'))) ||
                      (dev.type === 'fan' && (query.includes('พัดลม') || query.includes('ลม'))) ||
                      (dev.type === 'tv' && (query.includes('ทีวี') || query.includes('โทรทัศน์')));

    if (nameMatch || (roomMatch && typeMatch) || (typeMatch && devices.filter(d => d.type === dev.type).length === 1)) {
      if (isTurnOn && !dev.state) {
        deviceManager.toggle(dev.id);
        return { success: true, reply: `เปิด${dev.name}เรียบร้อยแล้วค่ะ` };
      } else if (isTurnOff && dev.state) {
        deviceManager.toggle(dev.id);
        return { success: true, reply: `ปิด${dev.name}เรียบร้อยแล้วค่ะ` };
      } else if (isTurnOn || isTurnOff) {
        return { success: true, reply: `${dev.name}${dev.state ? 'เปิดอยู่แล้วค่ะ' : 'ปิดอยู่แล้วค่ะ'}` };
      }
    }
  }

  // 4. Fallback คำสั่งสั้นๆ เช่น "ไฟห้องนั่งเล่น", "แอร์"
  if (query.includes('ไฟ')) {
    const dev = deviceManager.getById('light-living');
    if (dev) {
      deviceManager.toggle('light-living');
      return { success: true, reply: `${dev.state ? 'เปิด' : 'ปิด'}ไฟห้องนั่งเล่นแล้วค่ะ` };
    }
  }

  if (query.includes('แอร์')) {
    const dev = deviceManager.getById('ac-master');
    if (dev) {
      deviceManager.toggle('ac-master');
      return { success: true, reply: `${dev.state ? 'เปิด' : 'ปิด'}แอร์ห้องนอนแล้วค่ะ` };
    }
  }

  return { success: false, reply: `ขออภัยค่ะ ไม่เข้าใจคำสั่ง "${text}" ลองพูดว่า "เปิดไฟห้องนั่งเล่น", "เปิดแอร์" หรือ "เข้านอน"` };
}