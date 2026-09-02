/* ══════════ Smart Home Master Client Application ══════════ */

const MODE = "mock";
const URL_HA = "http://homeassistant.local:8123";
const TOKEN = "ใส่_Long_Lived_Access_Token_ตอนมีอุปกรณ์จริง";
const RATE = 4.2; 
const GEOFENCE = 150; // meters

/* ══════════ Devices Definition ══════════ */
const DEVICES = [
  { id: "light.living",   room: "ห้องนั่งเล่น", name: "ไฟเพดาน",       type: "light",   icon: "💡", w: 36, dim: 1 },
  { id: "switch.tv",      room: "ห้องนั่งเล่น", name: "ทีวี",           type: "switch",  icon: "📺", w: 120 },
  { id: "climate.living", room: "ห้องนั่งเล่น", name: "แอร์",           type: "climate", icon: "❄️", w: 1150 },
  { id: "cover.curtain",  room: "ห้องนั่งเล่น", name: "ม่านอัตโนมัติ",  type: "cover",   icon: "🪟", w: 5 },
  { id: "light.bed",      room: "ห้องนอน",     name: "ไฟหัวเตียง",     type: "light",   icon: "🛏️", w: 24, dim: 1 },
  { id: "fan.bed",        room: "ห้องนอน",     name: "พัดลม",          type: "fan",     icon: "🌀", w: 45 },
  { id: "light.kitchen",  room: "ครัว",        name: "ไฟครัว",         type: "light",   icon: "🍳", w: 18 },
  { id: "switch.heater",  room: "ห้องน้ำ",     name: "เครื่องทำน้ำอุ่น", type: "switch",  icon: "🚿", w: 3500 },
  { id: "lock.front",     room: "หน้าบ้าน",    name: "กลอนประตู",      type: "lock",    icon: "🔐", w: 2 },
  { id: "light.porch",    room: "หน้าบ้าน",    name: "ไฟหน้าบ้าน",     type: "light",   icon: "🏮", w: 15 }
];

const SCENES = [
  { 
    n: "ออกจากบ้าน", i: "🚪", 
    f: s => { 
      DEVICES.forEach(d => { if (d.type !== "lock") s[d.id].on = false; }); 
      s["lock.front"].on = true; 
      s["cover.curtain"].pos = 0; 
    }
  },
  { 
    n: "เข้านอน", i: "🌙", 
    f: s => { 
      DEVICES.forEach(d => { if (d.type !== "lock") s[d.id].on = false; }); 
      s["light.bed"].on = true; 
      s["light.bed"].bri = 12; 
      s["fan.bed"].on = true; 
      s["fan.bed"].spd = 1; 
      s["lock.front"].on = true; 
    }
  },
  { 
    n: "ดูหนัง", i: "🎬", 
    f: s => { 
      s["light.living"].on = true; 
      s["light.living"].bri = 20; 
      s["switch.tv"].on = true; 
      s["cover.curtain"].pos = 0; 
      s["light.kitchen"].on = false; 
    }
  },
  { 
    n: "ตื่นนอน", i: "☀️", 
    f: s => { 
      s["cover.curtain"].pos = 100; 
      s["light.bed"].on = true; 
      s["light.bed"].bri = 70; 
      s["light.kitchen"].on = true; 
      s["fan.bed"].on = false; 
    }
  }
];

const RULES = [
  { id: "r1", n: "มีคนเดินผ่านตอนมืด → เปิดไฟหน้าบ้าน", when: { ent: "motion", to: 1 }, cond: { s: "lux", lt: 120 }, then: [{ id: "light.porch", on: true, bri: 85 }], msg: "พบความเคลื่อนไหว เปิดไฟหน้าบ้านให้แล้ว" },
  { id: "r2", n: "ร้อนเกิน 31°C → เปิดแอร์", when: { s: "temp", above: 31 }, then: [{ id: "climate.living", on: true, temp: 25 }], msg: "อุณหภูมิเกิน 31°C เปิดแอร์อัตโนมัติ" },
  { id: "r3", n: "18:30 → เปิดไฟต้อนรับ", when: { time: "18:30" }, then: [{ id: "light.living", on: true, bri: 65 }, { id: "light.porch", on: true, bri: 100 }], msg: "ถึงเวลาเย็น เปิดไฟต้อนรับ" },
  { id: "r4", n: "ตรวจพบความเคลื่อนไหวขณะไม่อยู่บ้าน", when: { ent: "door", to: 1 }, cond: { mode: "away" }, then: [], msg: "⚠️ ตรวจพบความเคลื่อนไหวขณะไม่มีคนอยู่บ้าน!", warn: 1 },
  { id: "r5", n: "ลืมปิดน้ำอุ่นเกิน 30 นาที → ปิดให้", when: { runtime: "switch.heater", min: 30 }, then: [{ id: "switch.heater", on: false }], msg: "ปิดเครื่องทำน้ำอุ่นอัตโนมัติ (เปิดนานเกินไป)" },
  { id: "r6", n: "แบตมือถือต่ำกว่า 20% → เตือนประหยัดไฟ", when: { batt: 20 }, then: [], msg: "🔋 แบตเตอรี่ต่ำ · จำลองสถานะไฟสำรอง", warn: 1 }
];

/* ══════════ Core State & Storage ══════════ */
const K = "hasim_v4";
let V = "home";
let drag = 0;
let S = loadState();

function freshState() {
  const s = { _log: [], _kwh: [], _rules: {}, _mode: "home", _run: {} };
  DEVICES.forEach(d => s[d.id] = { on: false, bri: 80, spd: 2, temp: 25, pos: 50 });
  RULES.forEach(r => s._rules[r.id] = true);
  const D = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"], t = new Date();
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(t - i * 864e5);
    s._kwh.push({ d: D[dt.getDay()], v: i === 0 ? 0 : +(3 + Math.random() * 5).toFixed(2) });
  }
  return s;
}

function loadState() {
  try {
    const r = localStorage.getItem(K);
    return r ? JSON.parse(r) : freshState();
  } catch (e) {
    return freshState();
  }
}

function saveState() {
  try {
    localStorage.setItem(K, JSON.stringify(S));
  } catch (e) {}
}

function resetState() {
  localStorage.removeItem(K);
  S = loadState();
  render();
  toast("รีเซ็ตข้อมูลเรียบร้อย");
}

function logEvent(m, t = "ok") {
  S._log.unshift({ m, t, ts: new Date().toLocaleTimeString("th-TH") });
  S._log = S._log.slice(0, 120);
  saveState();
}

function toast(m) {
  const e = document.createElement("div");
  e.className = "tst";
  e.textContent = m;
  document.getElementById("toast").appendChild(e);
  setTimeout(() => e.remove(), 3400);
  if (navigator.vibrate) navigator.vibrate([55, 35, 55]);
  if (window.Notification && Notification.permission === "granted") {
    try { new Notification("บ้านของฉัน", { body: m, tag: "sh", icon: ICON192 }); } catch (e) {}
  }
}

/* ══════════ Sensors & Telemetry ══════════ */
const PHONE = { motion: 0, lux: null, batt: null, active: false };
let SEN = { temp: 29, hum: 62, lux: 400, pm: 28, motion: 0, door: 0 };
let lastAcc = 0, shakeAt = 0, homeGeo = null, liveVid = null;

function tickSensors() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const sun = Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
  const ac = S["climate.living"].on;
  const target = ac ? S["climate.living"].temp : 26 + sun * 7;
  SEN.temp = +(SEN.temp + (target - SEN.temp) * 0.12 + (Math.random() - 0.5) * 0.2).toFixed(1);
  SEN.hum = Math.round(62 + Math.sin(h / 3) * 5 + (Math.random() - 0.5) * 3);
  SEN.pm = Math.round(22 + Math.sin(h / 5) * 9 + Math.random() * 6);
  
  if (PHONE.active) {
    SEN.lux = PHONE.lux !== null ? PHONE.lux : Math.round(sun * 900 + 5);
    SEN.motion = PHONE.motion;
    SEN.door = (PHONE.motion && S._mode === "away") ? 1 : 0;
  } else {
    SEN.lux = Math.round(sun * 900 + (S["light.living"].on ? 40 : 0) + 5);
    SEN.motion = Math.random() < 0.14 ? 1 : 0;
    SEN.door = Math.random() < 0.05 ? 1 : 0;
  }
}

function powerNow() {
  return DEVICES.reduce((a, d) => {
    const s = S[d.id];
    if (!s.on) return a;
    if (d.type === "light") return a + d.w * (d.dim ? s.bri / 100 : 1);
    if (d.type === "fan") return a + d.w * (s.spd / 3);
    if (d.type === "climate") return a + d.w * (1 + (26 - s.temp) * 0.08);
    return a + d.w;
  }, 0);
}

/* ══════════ API Layer ══════════ */
const api = {
  async set(id, p) {
    Object.assign(S[id], p);
    saveState();
    // Also notify local server if available
    try {
      fetch(`/api/devices/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }).catch(() => {});
    } catch (e) {}
  },
  toggle(id) {
    return this.set(id, { on: !S[id].on });
  }
};

/* ══════════ Automations Engine ══════════ */
let PREV = { ...SEN };
function runRules() {
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  
  RULES.forEach(r => {
    if (!S._rules[r.id]) return;
    let fire = false;
    const w = r.when;
    if (w.ent) fire = SEN[w.ent] === w.to && PREV[w.ent] !== w.to;
    if (w.s != null) fire = SEN[w.s] > w.above && PREV[w.s] <= w.above;
    if (w.time) fire = hm === w.time && S._lastT !== hm;
    if (w.batt != null) fire = PHONE.batt && PHONE.batt.p < w.batt && !PHONE.batt.ch && !S._battWarn;
    if (w.runtime) {
      const t = S._run[w.runtime];
      fire = S[w.runtime].on && t && (Date.now() - t) / 6e4 > w.min;
    }
    if (!fire) return;
    if (r.cond) {
      if (r.cond.lt != null && !(SEN[r.cond.s] < r.cond.lt)) return;
      if (r.cond.mode && S._mode !== r.cond.mode) return;
    }
    if (w.batt != null) S._battWarn = 1;
    r.then.forEach(a => {
      const { id, ...p } = a;
      api.set(id, p);
    });
    logEvent(r.msg, r.warn ? "warn" : "auto");
    toast(r.msg);
  });

  if (now.getSeconds() < 3) S._lastT = hm;
  DEVICES.forEach(d => {
    if (S[d.id].on && !S._run[d.id]) S._run[d.id] = Date.now();
    if (!S[d.id].on) delete S._run[d.id];
  });
  PREV = { ...SEN };
}

/* ══════════ Views & UI Renderer ══════════ */
function render() {
  document.getElementById("mode").textContent = 
    PHONE.active ? "📱 เซ็นเซอร์จริง" : (MODE === "mock" ? "🧪 โหมดจำลอง" : "🟢 เชื่อมต่อจริง");
  
  document.getElementById("clock").textContent = 
    new Date().toLocaleString("th-TH", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) +
    " · " + Math.round(powerNow()) + " W";

  document.querySelectorAll("nav div").forEach(n => n.classList.toggle("act", n.dataset.v === V));
  
  const viewsMap = { home: vHome, cam: vCam, energy: vEnergy, auto: vAuto, remote: vRemote, log: vLog };
  document.getElementById("view").innerHTML = viewsMap[V] ? viewsMap[V]() : vHome();
  
  document.getElementById("ttl").textContent = {
    home: "บ้านของฉัน", cam: "กล้องวงจรปิด", energy: "การใช้พลังงาน", auto: "ระบบอัตโนมัติ", remote: "รีโมท IoT & BLE", log: "บันทึกเหตุการณ์"
  }[V] || "บ้านของฉัน";

  if (V === "cam") drawCams();
  if (V === "energy") drawChart();
  if (V === "remote") bindRemoteEvents();
  
  bindEvents();
}

function vHome() {
  const rooms = [...new Set(DEVICES.map(d => d.room))];
  let h = `<div>${["home", "away"].map(m => `<span class="chip ${S._mode === m ? "act" : ""}" data-mode="${m}">${m === "home" ? "🏠 อยู่บ้าน" : "🚗 ไม่อยู่บ้าน"}</span>`).join("")}</div>`;
  
  h += `<h2>สถานะสภาพแวดล้อม</h2>
   <div class="row"><span>🌡️ อุณหภูมิ</span><span class="val">${SEN.temp} °C</span></div>
   <div class="row"><span>💧 ความชื้น</span><span class="val">${SEN.hum} %</span></div>
   <div class="row"><span>🌤️ แสงสว่าง${PHONE.lux !== null ? " (กล้องจริง)" : ""}</span><span class="val">${SEN.lux} lx</span></div>
   <div class="row"><span>🏃 ความเคลื่อนไหว</span><span class="val">${SEN.motion ? "🔴 พบการเคลื่อนไหว" : "⚪ ปกติ"}</span></div>
   <div class="row"><span>😷 PM2.5</span><span class="val" style="color:${SEN.pm > 50 ? "#ff5c5c" : "#f5c518"}">${SEN.pm} µg/m³</span></div>`;

  if (PHONE.batt) {
    h += `<div class="row"><span>🔋 พลังงานสำรอง</span><span class="val">${PHONE.batt.p}%${PHONE.batt.ch ? " ⚡" : ""}</span></div>`;
  }

  rooms.forEach(r => {
    h += `<h2>${r}</h2><div class="grid">`;
    DEVICES.filter(d => d.room === r).forEach(d => {
      const s = S[d.id];
      const cls = s.on ? (d.type === "climate" ? "card cool" : "card on") : "card";
      let sub = s.on ? ({
        light: d.dim ? `เปิด · ${s.bri}%` : "เปิด",
        switch: "เปิด",
        fan: `ระดับ ${s.spd}`,
        climate: `${s.temp}°C`,
        lock: "ล็อกอยู่",
        cover: ""
      })[d.type] : "ปิด";
      
      if (d.type === "cover") sub = `เปิด ${s.pos}%`;
      if (d.type === "lock" && !s.on) sub = "ปลดล็อก";
      
      h += `<div class="${cls}" data-id="${d.id}"><div class="ico">${d.icon}</div>
        <div class="nm">${d.name}</div><div class="st">${sub}</div>`;
      
      if (d.type === "light" && d.dim && s.on) h += `<input type="range" min="1" max="100" value="${s.bri}" data-bri="${d.id}">`;
      if (d.type === "cover") h += `<input type="range" min="0" max="100" value="${s.pos}" data-pos="${d.id}">`;
      if (d.type === "fan" && s.on) h += `<input type="range" min="1" max="3" value="${s.spd}" data-spd="${d.id}">`;
      if (d.type === "climate" && s.on) h += `<div class="stepper"><button data-t="${d.id}:-1">−</button><b>${s.temp}°</b><button data-t="${d.id}:1">+</button></div>`;
      
      h += `</div>`;
    });
    h += `</div>`;
  });

  h += `<h2>ฉากด่วน (Scenes)</h2><div class="grid">` + SCENES.map((x, i) =>
    `<div class="card" data-sc="${i}"><div class="ico">${x.i}</div><div class="nm">${x.n}</div></div>`).join("") + `</div>`;

  h += `<h2>ระบบและตั้งค่า</h2>
    <div style="display: flex; gap: 8px; margin-top: 8px;">
      <input type="text" id="voiceInputText" placeholder="พิมพ์คำสั่งสั่งงานบ้าน..." style="flex:1; padding: 12px; background: var(--bg-card); border: 1px solid var(--bg-card-border); color: white; border-radius: 12px;">
      <button class="b" id="btnSendVoiceText" style="width: auto; margin:0; padding: 12px 18px; background: var(--accent-blue); color: white; border: none; font-weight: bold;">สั่งงาน</button>
    </div>
    <button class="b" data-act="voice">🎤 ${window._sr ? "ปิด" : "เปิด"}การสั่งงานด้วยเสียง</button>
    <button class="b" data-act="sethome">📍 ตั้งตำแหน่งนี้เป็น "บ้าน"</button>
    <button class="b" data-act="export">📤 ส่งออกข้อมูล JSON</button>
    <button class="b" data-act="reset">↺ รีเซ็ตทั้งหมด</button><div id="exp"></div>`;

  return h;
}

function vCam() {
  return `<h2>กล้อง 1 · หน้าบ้าน${liveVid ? " (สดจากกล้องจริง)" : ""}</h2>
  <canvas id="c1" width="640" height="360"></canvas>
  <h2>กล้อง 2 · ห้องนั่งเล่น (จำลอง)</h2><canvas id="c2" width="640" height="360"></canvas>
  <div class="row" style="margin-top:12px"><span>สถานะตรวจจับ</span>
  <span class="val">${SEN.motion ? "🔴 พบความเคลื่อนไหว" : "⚪ ปกติ"}</span></div>
  <div class="row"><span>ความสว่างที่วัดได้</span><span class="val">${SEN.lux} lx</span></div>`;
}

function vEnergy() {
  const t = S._kwh.reduce((a, b) => a + b.v, 0);
  return `<div class="row"><span>ใช้อยู่ตอนนี้</span><span class="val">${Math.round(powerNow())} W</span></div>
   <div class="row"><span>วันนี้</span><span class="val">${S._kwh[6].v.toFixed(2)} kWh · ${(S._kwh[6].v * RATE).toFixed(2)} ฿</span></div>
   <div class="row"><span>รวม 7 วัน</span><span class="val">${t.toFixed(1)} kWh · ${(t * RATE).toFixed(0)} ฿</span></div>
   <div class="row"><span>ประมาณการ 30 วัน</span><span class="val">${(t / 7 * 30 * RATE).toFixed(0)} ฿</span></div>
   <h2>ย้อนหลัง 7 วัน (kWh)</h2><canvas id="ch" width="700" height="330"></canvas>
   <h2>อุปกรณ์ที่กินไฟตอนนี้</h2>` +
   (DEVICES.filter(d => S[d.id].on).sort((a, b) => b.w - a.w).map(d =>
   `<div class="row"><span>${d.icon} ${d.name}</span><span class="val">${d.w} W</span></div>`).join("") ||
   `<div class="row"><span>ไม่มีอุปกรณ์เปิดอยู่</span></div>`);
}

function vAuto() {
  return RULES.map(r => {
    const on = S._rules[r.id];
    return `<div class="rule ${on ? "" : "off"}"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
     <div><div style="font-size:14px;font-weight:600">${r.n}</div>
     <div style="font-size:11.5px;color:#7a7a88;margin-top:4px">${r.msg}</div></div>
     <div class="sw ${on ? "on" : ""}" data-rule="${r.id}"><i></i></div></div></div>`;
  }).join("");
}

/* ══════════ IoT MQTT & BLE Remote Control View ══════════ */
let myMode = 'remote';
let mqttClient = null, mqttTopic = '';
let uartChar = null;
const UART_SVC = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const CMD_TEXT = {
  UP:'▲ ขึ้น', DOWN:'▼ ลง', LEFT:'◀ ซ้าย', RIGHT:'▶ ขวา', OK:'● ตกลง',
  LIGHT_ON:'💡 เปิดไฟ', LIGHT_OFF:'🌙 ปิดไฟ',
  FAN_UP:'🌀 เพิ่มลม', FAN_DOWN:'🌀 ลดลม',
  AC_ON:'❄️ เปิดแอร์', ALL_OFF:'⛔ ปิดทั้งหมด'
};

function vRemote() {
  const savedRoom = localStorage.getItem('room') || '';
  return `
    <div class="card">
      <h3 style="margin-bottom:10px;"><i class="fa-solid fa-gamepad"></i> โหมดของเครื่องนี้</h3>
      <div class="modes">
        <button class="mode ${myMode === 'remote' ? 'active' : ''}" data-mode="remote">📱 รีโมท (Remote)</button>
        <button class="mode ${myMode === 'receiver' ? 'active' : ''}" data-mode="receiver">📺 ตัวรับ (Receiver)</button>
      </div>
      <div class="row" style="margin-bottom:10px;">
        <span style="min-width:70px;">รหัสห้อง:</span>
        <input id="roomCode" placeholder="เช่น home123" maxlength="12" value="${savedRoom}">
      </div>
      <button id="btnJoin">🔗 เชื่อมต่อห้อง (MQTT)</button>
      <button id="btnBLE" style="width:100%; margin-top:8px; padding:12px; border:1px solid var(--accent-blue); background:rgba(74,168,255,0.1); color:var(--accent-blue); border-radius:12px; font-weight:600; cursor:pointer;">
        📡 เชื่อมต่อบอร์ด ESP32 ผ่าน Bluetooth (BLE)
      </button>
      <p id="netStatus" style="margin-top:10px; font-size:13px; color:var(--text-muted);">ยังไม่ได้เชื่อมต่อ</p>
    </div>

    <!-- แผงรีโมท -->
    <div class="card ${myMode !== 'remote' ? 'hide' : ''}" id="remotePanel" style="margin-top:14px;">
      <h3 style="margin-bottom:14px;"><i class="fa-solid fa-sliders"></i> รีโมทควบคุมอัจฉริยะ</h3>
      <div class="pad">
        <button class="k" data-cmd="UP">▲</button>
        <button class="k" data-cmd="LEFT">◀</button>
        <button class="k ok" data-cmd="OK">OK</button>
        <button class="k" data-cmd="RIGHT">▶</button>
        <button class="k" data-cmd="DOWN">▼</button>
      </div>
      <div class="grid">
        <button class="k wide on"  data-cmd="LIGHT_ON">💡 เปิดไฟ</button>
        <button class="k wide off" data-cmd="LIGHT_OFF">🌙 ปิดไฟ</button>
        <button class="k wide"     data-cmd="FAN_UP">🌀 พัดลม +</button>
        <button class="k wide"     data-cmd="FAN_DOWN">🌀 พัดลม −</button>
        <button class="k wide"     data-cmd="AC_ON">❄️ เปิดแอร์</button>
        <button class="k wide off" data-cmd="ALL_OFF">⛔ ปิดทั้งหมด</button>
      </div>
      <p id="lastSent" style="margin-top:12px; font-size:12.5px; color:var(--accent-gold); text-align:center;"></p>
    </div>

    <!-- จอฝั่งตัวรับ -->
    <div class="card ${myMode !== 'receiver' ? 'hide' : ''}" id="receiverPanel" style="margin-top:14px;">
      <h3 style="margin-bottom:10px;"><i class="fa-solid fa-desktop"></i> คำสั่งที่ได้รับ</h3>
      <div id="bigCmd">— รอรับคำสั่ง —</div>
      <ul id="cmdLog"></ul>
    </div>
  `;
}

function bindRemoteEvents() {
  document.querySelectorAll('.mode').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.mode').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      myMode = b.dataset.mode;
      document.getElementById('remotePanel')?.classList.toggle('hide', myMode !== 'remote');
      document.getElementById('receiverPanel')?.classList.toggle('hide', myMode !== 'receiver');
    };
  });

  const btnJoin = document.getElementById('btnJoin');
  const netStatus = document.getElementById('netStatus');
  const roomCodeInput = document.getElementById('roomCode');

  if (btnJoin) {
    btnJoin.onclick = () => {
      const code = roomCodeInput.value.trim();
      if (!code) return alert('ใส่รหัสห้องก่อนครับ');
      localStorage.setItem('room', code);
      mqttTopic = 'smarthome/' + code;
      netStatus.textContent = '⏳ กำลังเชื่อมต่อ MQTT...';

      if (mqttClient) mqttClient.end(true);

      mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

      mqttClient.on('connect', () => {
        netStatus.textContent = `✅ เชื่อมต่อห้อง "${code}" แล้ว (${myMode === 'remote' ? 'รีโมท' : 'ตัวรับ'})`;
        mqttClient.subscribe(mqttTopic);
        toast(`เชื่อมต่อห้อง "${code}" สำเร็จ`);
      });

      mqttClient.on('message', (t, msg) => {
        if (myMode !== 'receiver') return;
        try {
          showCommand(JSON.parse(msg.toString()));
        } catch (e) {}
      });

      mqttClient.on('error', () => {
        netStatus.textContent = '❌ เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง';
      });
    };
  }

  // BLE Connect Button
  const btnBLE = document.getElementById('btnBLE');
  if (btnBLE) {
    btnBLE.onclick = connectUART;
  }

  // Remote Buttons
  document.querySelectorAll('.k').forEach(btn => {
    btn.onclick = () => {
      const cmd = btn.dataset.cmd;
      if (navigator.vibrate) navigator.vibrate(35);
      const payload = { cmd, at: Date.now() };

      if (mqttClient && mqttClient.connected) {
        mqttClient.publish(mqttTopic, JSON.stringify(payload));
      }

      sendBLE(cmd);

      // Execute locally if light/ac/all_off
      if (cmd === 'LIGHT_ON') api.set('light.living', { on: true });
      if (cmd === 'LIGHT_OFF') api.set('light.living', { on: false });
      if (cmd === 'AC_ON') api.set('climate.living', { on: true });
      if (cmd === 'ALL_OFF') SCENES[0].f(S);

      const lastSentEl = document.getElementById('lastSent');
      if (lastSentEl) {
        lastSentEl.textContent = `ส่งคำสั่งแล้ว: ${CMD_TEXT[cmd] || cmd} • ${new Date().toLocaleTimeString('th-TH')}`;
      }
    };
  });
}

function showCommand({ cmd, at }) {
  if (navigator.vibrate) navigator.vibrate(50);
  const bigCmd = document.getElementById('bigCmd');
  if (bigCmd) bigCmd.textContent = CMD_TEXT[cmd] || cmd;
  
  const cmdLog = document.getElementById('cmdLog');
  if (cmdLog) {
    const li = document.createElement('li');
    li.textContent = `${new Date(at).toLocaleTimeString('th-TH')} — ${CMD_TEXT[cmd] || cmd}`;
    cmdLog.prepend(li);
  }
}

async function connectUART() {
  const netStatus = document.getElementById('netStatus');
  if (!navigator.bluetooth) {
    return alert('เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth (BLE)');
  }
  try {
    const dev = await navigator.bluetooth.requestDevice({
      filters: [{ services: [UART_SVC] }],
      optionalServices: [UART_SVC]
    });
    const server = await dev.gatt.connect();
    const svc = await server.getPrimaryService(UART_SVC);
    uartChar = await svc.getCharacteristic(UART_RX);
    if (netStatus) netStatus.textContent = `✅ เชื่อมต่อ BLE กับ "${dev.name}" แล้ว`;
    toast(`เชื่อมต่อ BLE "${dev.name}" สำเร็จ`);
  } catch (e) {
    console.warn('BLE connect error:', e);
  }
}

async function sendBLE(cmd) {
  if (!uartChar) return;
  try {
    await uartChar.writeValue(new TextEncoder().encode(cmd + '\n'));
  } catch (e) {
    console.warn('BLE send failed', e);
  }
}

function vLog() {
  return S._log.length ? S._log.map(l =>
    `<div class="log ${l.t}">${l.m}<small>${l.ts}</small></div>`).join("")
    : `<div class="log">ยังไม่มีเหตุการณ์ · ระบบกำลังบันทึกสถานะตามเวลาจริง</div>`;
}

/* ══════════ Canvas Camera Stream & Motion Visualizer ══════════ */
function drawCams() {
  const c1 = document.getElementById("c1");
  if (c1 && liveVid && liveVid.videoWidth > 0) {
    const x = c1.getContext("2d");
    x.drawImage(liveVid, 0, 0, 640, 360);
    if (SEN.motion) {
      x.strokeStyle = "#ff3b3b";
      x.lineWidth = 4;
      x.strokeRect(8, 8, 624, 344);
      x.fillStyle = "#ff3b3b";
      x.fillRect(8, 8, 200, 27);
      x.fillStyle = "#fff";
      x.font = "bold 14px sans-serif";
      x.fillText("⚠ MOTION DETECTED", 16, 27);
    }
    x.fillStyle = "rgba(0,0,0,.55)";
    x.fillRect(0, 330, 640, 30);
    x.fillStyle = "#fff";
    x.font = "13px monospace";
    x.fillText("● LIVE · " + new Date().toLocaleTimeString("th-TH") + " · " + SEN.lux + " lx", 10, 350);
  } else if (c1) {
    fakeCam(c1, SEN.motion);
  }
  
  const c2 = document.getElementById("c2");
  if (c2) fakeCam(c2, S["light.living"].on ? 0 : SEN.motion);
}

function fakeCam(cv, mv) {
  const x = cv.getContext("2d"), W = 640, Hh = 360, night = SEN.lux < 120;
  const g = x.createLinearGradient(0, 0, 0, Hh);
  g.addColorStop(0, night ? "#0a0f14" : "#2c3e50");
  g.addColorStop(1, night ? "#050708" : "#1a2530");
  x.fillStyle = g;
  x.fillRect(0, 0, W, Hh);
  
  x.fillStyle = night ? "#0d1418" : "#22303c";
  x.fillRect(0, 250, W, 110);
  x.strokeStyle = night ? "#16212a" : "#34495e";
  x.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.moveTo(i * 100, 250);
    x.lineTo(i * 130 - 140, 360);
    x.stroke();
  }
  
  if (mv) {
    const t = Date.now() / 700 % 1, px = 80 + t * 440;
    x.fillStyle = "rgba(230,230,240,.85)";
    x.beginPath();
    x.arc(px, 215, 17, 0, 7);
    x.fill();
    x.fillRect(px - 15, 232, 30, 62);
    x.fillRect(px - 13, 294, 10, 42);
    x.fillRect(px + 3, 294, 10, 42);
    x.strokeStyle = "#ff3b3b";
    x.lineWidth = 3;
    x.strokeRect(px - 40, 190, 80, 160);
    x.fillStyle = "#ff3b3b";
    x.fillRect(px - 40, 172, 104, 18);
    x.fillStyle = "#fff";
    x.font = "bold 12px sans-serif";
    x.fillText("MOTION 98%", px - 35, 185);
  }
  
  for (let i = 0; i < 800; i++) {
    x.fillStyle = `rgba(255,255,255,${Math.random() * 0.045})`;
    x.fillRect(Math.random() * W, Math.random() * Hh, 1.5, 1.5);
  }
  x.fillStyle = "rgba(0,0,0,.55)";
  x.fillRect(0, 0, W, 30);
  x.fillStyle = "#fff";
  x.font = "14px monospace";
  x.fillText(new Date().toLocaleString("th-TH"), 12, 20);
  x.fillStyle = "#ff3b3b";
  x.beginPath();
  x.arc(W - 24, 15, 6, 0, 7);
  x.fill();
  x.fillStyle = "#fff";
  x.font = "bold 12px sans-serif";
  x.fillText("REC", W - 62, 20);
  
  if (night) {
    x.fillStyle = "rgba(80,255,120,.05)";
    x.fillRect(0, 0, W, Hh);
    x.fillStyle = "#5f6";
    x.font = "12px monospace";
    x.fillText("● NIGHT VISION", 12, Hh - 14);
  }
}

/* ══════════ Energy Chart Renderer ══════════ */
function drawChart() {
  const cv = document.getElementById("ch");
  if (!cv) return;
  const x = cv.getContext("2d"), W = 700, Hh = 330, P = 40;
  const mx = Math.max(...S._kwh.map(d => d.v), 1) * 1.25;
  
  x.clearRect(0, 0, W, Hh);
  x.strokeStyle = "#26262e";
  x.lineWidth = 1;
  x.font = "12px sans-serif";
  
  for (let i = 0; i <= 4; i++) {
    const y = Hh - P - (Hh - P * 2) * i / 4;
    x.beginPath();
    x.moveTo(P, y);
    x.lineTo(W - 10, y);
    x.stroke();
    x.fillStyle = "#5a5a68";
    x.fillText((mx * i / 4).toFixed(1), 6, y + 4);
  }
  
  const bw = (W - P - 20) / 7;
  S._kwh.forEach((d, i) => {
    const h = (Hh - P * 2) * (d.v / mx), bx = P + 10 + i * bw, by = Hh - P - h;
    const g = x.createLinearGradient(0, by, 0, Hh - P);
    g.addColorStop(0, i === 6 ? "#f5c518" : "#4a4a58");
    g.addColorStop(1, i === 6 ? "#c99f0a" : "#2e2e38");
    x.fillStyle = g;
    x.beginPath();
    if (x.roundRect) x.roundRect(bx, by, bw - 14, h, 7); else x.rect(bx, by, bw - 14, h);
    x.fill();
    x.fillStyle = "#8a8a99";
    x.textAlign = "center";
    x.fillText(d.d, bx + (bw - 14) / 2, Hh - P + 18);
    x.fillStyle = "#fff";
    x.font = "bold 12px sans-serif";
    x.fillText(d.v.toFixed(1), bx + (bw - 14) / 2, by - 7);
    x.font = "12px sans-serif";
    x.textAlign = "left";
  });
}

/* ══════════ Event Bindings ══════════ */
function bindEvents() {
  document.querySelectorAll("[data-id]").forEach(el => el.onclick = e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
    const d = DEVICES.find(x => x.id === el.dataset.id);
    api.toggle(d.id);
    logEvent(`${d.name} ถูก${S[d.id].on ? "เปิด" : "ปิด"}`);
    if (navigator.vibrate) navigator.vibrate(18);
    render();
  });

  document.querySelectorAll("[data-bri]").forEach(el => {
    el.oninput = e => {
      drag = 1;
      api.set(el.dataset.bri, { bri: +e.target.value, on: true });
      el.parentNode.querySelector(".st").textContent = "เปิด · " + e.target.value + "%";
    };
    el.onchange = () => { drag = 0; render(); };
  });

  document.querySelectorAll("[data-pos]").forEach(el => {
    el.oninput = e => {
      drag = 1;
      api.set(el.dataset.pos, { pos: +e.target.value, on: +e.target.value > 0 });
    };
    el.onchange = () => { drag = 0; render(); };
  });

  document.querySelectorAll("[data-spd]").forEach(el => {
    el.oninput = e => {
      drag = 1;
      api.set(el.dataset.spd, { spd: +e.target.value });
    };
    el.onchange = () => { drag = 0; render(); };
  });

  document.querySelectorAll("[data-t]").forEach(el => el.onclick = e => {
    e.stopPropagation();
    const [id, v] = el.dataset.t.split(":");
    api.set(id, { temp: Math.min(30, Math.max(16, S[id].temp + +v)) });
    render();
  });

  document.querySelectorAll("[data-sc]").forEach(el => el.onclick = () => {
    const sc = SCENES[el.dataset.sc];
    sc.f(S);
    saveState();
    logEvent("เรียกใช้ฉาก: " + sc.n);
    toast("▶ " + sc.n);
    render();
  });

  document.querySelectorAll("[data-rule]").forEach(el => el.onclick = () => {
    S._rules[el.dataset.rule] = !S._rules[el.dataset.rule];
    saveState();
    render();
  });

  document.querySelectorAll("[data-mode]").forEach(el => el.onclick = () => {
    S._mode = el.dataset.mode;
    saveState();
    logEvent("เปลี่ยนโหมดเป็น " + (S._mode === "home" ? "อยู่บ้าน" : "ไม่อยู่บ้าน"));
    render();
  });

  const actions = {
    export: () => {
      const expDiv = document.getElementById("exp");
      if (expDiv) expDiv.innerHTML = `<textarea readonly>${JSON.stringify(S, null, 2)}</textarea>`;
    },
    reset: resetState,
    voice: () => {
      window._sr ? stopVoice() : initVoice();
      render();
    },
    sethome: () => {
      navigator.geolocation.getCurrentPosition(p => {
        homeGeo = { la: p.coords.latitude, lo: p.coords.longitude };
        localStorage.setItem("homeGeo", JSON.stringify(homeGeo));
        toast("📍 บันทึกตำแหน่งบ้านแล้ว");
        logEvent("ตั้งตำแหน่งบ้านใหม่", "ok");
      }, () => toast("ไม่สามารถอ่านตำแหน่งได้"));
    }
  };

  Object.keys(actions).forEach(k => {
    const el = document.querySelector(`[data-act="${k}"]`);
    if (el) el.onclick = actions[k];
  });

  // Voice text input send button
  const btnSendVoiceText = document.getElementById("btnSendVoiceText");
  const voiceInputText = document.getElementById("voiceInputText");
  if (btnSendVoiceText && voiceInputText) {
    btnSendVoiceText.onclick = () => {
      const text = voiceInputText.value.trim();
      if (text) {
        processVoiceText(text);
        voiceInputText.value = '';
      }
    };
  }
}

document.querySelectorAll("nav div").forEach(n => n.onclick = () => {
  V = n.dataset.v;
  render();
  if (navigator.vibrate) navigator.vibrate(12);
  window.scrollTo(0, 0);
});

/* ══════════ Mobile Sensor Hardware Integration ══════════ */
function initMotion() {
  window.addEventListener("devicemotion", e => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
    if (Math.abs(mag - lastAcc) > 1.4) {
      PHONE.motion = 1;
      shakeAt = Date.now();
    }
    lastAcc = mag;
  });
  setInterval(() => {
    if (Date.now() - shakeAt > 3000) PHONE.motion = 0;
  }, 500);
}

async function initCam() {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const v = document.createElement("video");
    v.srcObject = st;
    v.playsInline = true;
    v.muted = true;
    await v.play();
    liveVid = v;
    
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 48;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    
    setInterval(() => {
      if (v.videoWidth === 0) return;
      cx.drawImage(v, 0, 0, 64, 48);
      const d = cx.getImageData(0, 0, 64, 48).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) {
        s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      }
      PHONE.lux = Math.round(s / (d.length / 4) / 255 * 1000);
    }, 700);
  } catch (e) {
    logEvent("ไม่ได้รับสิทธิ์กล้อง · ใช้ค่าจำลองแทน");
  }
}

function initGeo() {
  const sv = localStorage.getItem("homeGeo");
  if (sv) homeGeo = JSON.parse(sv);
  if (!navigator.geolocation) return;
  
  navigator.geolocation.watchPosition(p => {
    const g = { la: p.coords.latitude, lo: p.coords.longitude };
    if (!homeGeo) {
      homeGeo = g;
      localStorage.setItem("homeGeo", JSON.stringify(g));
      logEvent("บันทึกตำแหน่งบ้านอัตโนมัติ");
      return;
    }
    const R = 6371e3;
    const t1 = homeGeo.la * Math.PI / 180, t2 = g.la * Math.PI / 180;
    const dt = (g.la - homeGeo.la) * Math.PI / 180;
    const dl = (g.lo - homeGeo.lo) * Math.PI / 180;
    const a = Math.sin(dt / 2) ** 2 + Math.cos(t1) * Math.cos(t2) * Math.sin(dl / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const should = dist > GEOFENCE ? "away" : "home";
    
    if (S._mode !== should) {
      S._mode = should;
      logEvent(`📍 Geofence: ${should === "away" ? "ออกจากบ้าน" : "กลับถึงบ้าน"} (${Math.round(dist)} ม.)`, "auto");
      toast(should === "away" ? "🚗 ตรวจพบว่าคุณออกจากบ้าน" : "🏠 ยินดีต้อนรับกลับบ้าน");
      (should === "away" ? SCENES[0] : SCENES[3]).f(S);
      saveState();
      render();
    }
  }, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
}

async function initBatt() {
  if (!navigator.getBattery) return;
  try {
    const b = await navigator.getBattery();
    const up = () => {
      PHONE.batt = { p: Math.round(b.level * 100), ch: b.charging };
      if (b.charging) S._battWarn = 0;
    };
    up();
    b.addEventListener("levelchange", up);
    b.addEventListener("chargingchange", up);
  } catch (e) {}
}

/* ══════════ Thai Speech & Text Parser ══════════ */
const VOICE_CMD = [
  { k: ["เปิดไฟห้องนั่งเล่น", "เปิดไฟเพดาน"], a: () => api.set("light.living", { on: true, bri: 80 }) },
  { k: ["ปิดไฟห้องนั่งเล่น"], a: () => api.set("light.living", { on: false }) },
  { k: ["เปิดแอร์"], a: () => api.set("climate.living", { on: true }) },
  { k: ["ปิดแอร์"], a: () => api.set("climate.living", { on: false }) },
  { k: ["เปิดไฟทั้งหมด", "เปิดไฟทุกดวง"], a: () => DEVICES.filter(d => d.type === "light").forEach(d => api.set(d.id, { on: true, bri: 90 })) },
  { k: ["ปิดไฟทั้งหมด", "ปิดทุกอย่าง"], a: () => SCENES[0].f(S) },
  { k: ["เข้านอน", "ฝันดี"], a: () => SCENES[1].f(S) },
  { k: ["ดูหนัง"], a: () => SCENES[2].f(S) },
  { k: ["ตื่นนอน", "อรุณสวัสดิ์"], a: () => SCENES[3].f(S) },
  { k: ["ล็อกประตู", "ล็อคประตู"], a: () => api.set("lock.front", { on: true }) }
];

function processVoiceText(t) {
  const hit = VOICE_CMD.find(c => c.k.some(k => t.includes(k)));
  if (hit) {
    hit.a();
    saveState();
    logEvent("🎤 สั่งด้วยเสียง: " + t, "ok");
    toast("🎤 " + t);
    render();
  } else {
    // Send to local server voice endpoint as well
    fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t })
    }).then(r => r.json()).then(data => {
      logEvent("🎤 คำสั่ง: " + data.message, data.success ? "ok" : "warn");
      toast(data.message);
      render();
    }).catch(() => {
      logEvent("🎤 ไม่เข้าใจคำสั่ง: " + t);
      toast("ไม่เข้าใจคำสั่ง: " + t);
    });
  }
}

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง สามารถพิมพ์ช่องข้อความแทนได้");
    return;
  }
  const r = new SR();
  r.lang = "th-TH";
  r.continuous = true;
  r.interimResults = false;
  r.onresult = e => {
    const t = e.results[e.results.length - 1][0].transcript.trim();
    processVoiceText(t);
  };
  r.onend = () => {
    if (window._sr) try { r.start(); } catch (e) {}
  };
  try {
    r.start();
    window._sr = r;
    toast("🎤 เปิดการสั่งงานด้วยเสียงแล้ว");
  } catch (e) {}
}

function stopVoice() {
  if (window._sr) {
    const r = window._sr;
    window._sr = null;
    try { r.stop(); } catch (e) {}
    toast("ปิดการสั่งงานด้วยเสียง");
  }
}

/* ══════════ PWA Icon Generator & Install ══════════ */
function makeIcon(sz) {
  const c = document.createElement("canvas");
  c.width = c.height = sz;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, sz, sz);
  g.addColorStop(0, "#f5c518");
  g.addColorStop(1, "#e0940a");
  x.fillStyle = "#0e0e11";
  x.fillRect(0, 0, sz, sz);
  x.fillStyle = g;
  x.beginPath();
  const p = sz * 0.14, r = sz * 0.22;
  if (x.roundRect) x.roundRect(p, p, sz - p * 2, sz - p * 2, r); else x.rect(p, p, sz - p * 2, sz - p * 2);
  x.fill();
  x.fillStyle = "#111";
  x.font = `${sz * 0.42}px sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("🏠", sz / 2, sz / 2 + sz * 0.02);
  return c.toDataURL("image/png");
}

const ICON192 = makeIcon(192);
const ICON512 = makeIcon(512);

(function () {
  const ap = document.createElement("link");
  ap.rel = "apple-touch-icon";
  ap.href = ICON192;
  document.head.appendChild(ap);
})();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  const b = document.getElementById("install");
  if (b) {
    b.style.display = "block";
    b.onclick = async () => {
      b.style.display = "none";
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    };
  }
});

window.addEventListener("appinstalled", () => {
  logEvent("ติดตั้งแอปลงเครื่องสำเร็จ", "ok");
});

/* ══════════ App Initialization ══════════ */
document.getElementById("go").onclick = async () => {
  if (typeof DeviceMotionEvent !== "undefined" && DeviceMotionEvent.requestPermission) {
    try { await DeviceMotionEvent.requestPermission(); } catch (e) {}
  }
  if (window.Notification) {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  initMotion();
  await initCam();
  initGeo();
  initBatt();
  if (navigator.wakeLock) {
    try { await navigator.wakeLock.request("screen"); } catch (e) {}
  }
  PHONE.active = true;
  document.getElementById("perm").remove();
  logEvent("เชื่อมต่อเซ็นเซอร์มือถือสำเร็จ", "ok");
  toast("📱 ใช้เซ็นเซอร์จริงจากมือถือแล้ว");
  render();
};

document.getElementById("skip").onclick = () => {
  document.getElementById("perm").remove();
  render();
};

setInterval(() => {
  tickSensors();
  runRules();
  S._kwh[6].v = +(S._kwh[6].v + powerNow() / 1000 * (2 / 3600)).toFixed(4);
  saveState();
  if (!drag && document.visibilityState === "visible") render();
}, 2000);

setInterval(() => {
  if (V === "cam" && document.visibilityState === "visible") drawCams();
}, 120);

tickSensors();
render();
logEvent("ระบบเริ่มทำงาน", "ok");
