# 🏠 Smart Home Hub - ระบบสมาร์ทโฮมส่วนตัว (Offline 100% & Privacy-First)

![Smart Home Dashboard](https://img.shields.io/badge/Privacy-100%25%20Offline-green?style=for-the-badge&logo=shield)
![NodeJS](https://img.shields.io/badge/Node.js-v24.18-blue?style=for-the-badge&logo=nodedotjs)
![PWA Ready](https://img.shields.io/badge/PWA-Supported-purple?style=for-the-badge&logo=pwa)
![MQTT & BLE](https://img.shields.io/badge/IoT-MQTT%20%26%20Web%20BLE-orange?style=for-the-badge&logo=bluetooth)

แอปพลิเคชันสมาร์ทโฮมส่วนตัว ทำงานแบบ **Offline 100%** ไม่พึ่งพา Cloud ภายนอก ช่วยปกป้องความเป็นส่วนตัวและความปลอดภัยของบ้านคุณอย่างสูงสุด รันบนเครื่องคอมพิวเตอร์/แล็ปท็อปส่วนตัว และควบคุมผ่านเบราว์เซอร์หรือติดตั้งเป็นแอปบนมือถือ (PWA) ได้ทันที

---

## ✨ คุณสมบัติเด่น (Features)

1. **🔒 100% Local & Privacy-First**
   - ประมวลผลและจัดเก็บข้อมูลทั้งหมดบนเครื่องของคุณเอง ไร้ความเสี่ยงจากการโดนแฮกคลาวด์หรือเน็ตล่ม

2. **🎛️ Dual-Mode IoT Remote & Web BLE**
   - สลับใช้งานระหว่างโหมด **"รีโมท (Remote)"** และ **"ตัวรับ (Receiver)"**
   - สั่งงานข้ามเครื่องผ่านโปรโตคอล **MQTT** (`wss://broker.emqx.io:8084/mqtt`)
   - เชื่อมต่อและส่งคำสั่งตรงเข้าบอร์ดไมโครคอนโทรลเลอร์ (ESP32 / Arduino) ผ่าน **Web Bluetooth BLE (Nordic UART)**

3. **📱 Real Mobile Hardware Sensors Integration**
   - ตรวจจับความเคลื่อนไหวผ่านเซนเซอร์วัดความเร่งของมือถือ (`devicemotion`)
   - คำนวณความสว่างแสง (Lux) จากภาพกล้องสด
   - **Geofencing:** สลับโหมด *"อยู่บ้าน (Home)"* และ *"ไม่อยู่บ้าน (Away)"* อัตโนมัติด้วยตำแหน่ง GPS เมื่อออกห่างเกิน 150 เมตร
   - ตรวจสอบสถานะแบตเตอรี่สำรองของอุปกรณ์

4. **📹 Security Camera Stream & Motion Detection**
   - แสดงภาพกล้องสตรีมสดพร้อมระบบวาดกรอบตรวจจับวัตถุเคลื่อนไหว (`⚠ MOTION DETECTED`)
   - ระบบมองเห็นในความมืด **Night Vision Mode** อัตโนมัติเมื่อแสงสว่างต่ำกว่า 120 lx

5. **⚡ Energy Consumption Chart & Cost Calculation**
   - แผนภูมิแท่ง Canvas แสดงปริมาณการใช้ไฟฟ้า (kWh) ย้อนหลัง 7 วัน
   - คำนวณกำลังไฟวัตต์ (Watts) แบบ Real-time พร้อมประมาณการค่าไฟต่อวัน/เดือน (บาท)

6. **🗣️ Local Offline Voice Assistant**
   - สั่งงานด้วยเสียงภาษาไทยแบบ Local (เช่น *"เปิดไฟห้องรับแขก", "ปิดไฟทุกดวง", "เปิดแอร์ 24 องศา", "โหมดเข้านอน"*)

---

## 🚀 วิธีการติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. Requirements
- Node.js (v18 ขึ้นไป)
- เบราว์เซอร์สมัยใหม่ (Chrome, Safari, Edge)

### 2. Run the Application
เปิด Terminal / PowerShell ในโฟลเดอร์โครงการ แล้วสั่งงาน:

```bash
# สตาร์ทเซิร์ฟเวอร์แบบออฟไลน์
node server.js
```

### 3. Open in Browser
- **บนแล็ปท็อป:** เปิดเบราว์เซอร์เข้าที่ `http://localhost:3000`
- **บนมือถือในบ้าน:** เชื่อมต่อ Wi-Fi เดียวกัน แล้วเข้าตาม IP LAN (เช่น `http://192.168.x.x:3000`)
- **ติดตั้งเป็นแอป (PWA):** กดที่ปุ่ม **"Add to Home Screen"** บนเบราว์เซอร์มือถือ

---

## 📁 โครงสร้างไฟล์ในโครงการ (Project Structure)

```text
smarthome/
├── data/                  # ไฟล์เก็บสถานะอุปกรณ์และกฎอัตโนมัติ (JSON Store)
│   ├── devices.json
│   └── automations.json
├── public/                # ไฟล์หน้าเว็บและสคริปต์หน้าบ้าน
│   ├── index.html         # HTML Layout หลักของแอป
│   ├── styles.css         # สไตล์ดีไซน์ Dark Mode / Light Mode
│   ├── app.js             # Logic หน้าบ้าน (PWA, Sensors, Voice, Remote, BLE)
│   ├── manifest.json      # PWA App Manifest Configuration
│   └── sw.js              # Service Worker สำหรับ Offline Caching
├── services/              # บริการหลักของระบบหลังบ้าน (Node.js)
│   ├── deviceManager.js   # ตัวจัดการสถานะอุปกรณ์และการคำนวณพลังงาน
│   ├── automationEngine.js# Engine ประมวลผลกฎอัตโนมัติประจำบ้าน
│   └── voiceParser.js     # ตัววิเคราะห์คำสั่งสั่งงานด้วยเสียงภาษาไทย
├── package.json           # การตั้งค่า Node.js Package
├── server.js              # HTTP & Server-Sent Events (SSE) Backend Server
└── README.md              # เอกสารอธิบายโครงการ
```

---

## 📄 License

โครงการนี้เป็นซอฟต์แวร์โอเพ่นซอร์ส ภายใต้สัญญาอนุญาต [MIT License](LICENSE)
