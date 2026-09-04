/* ══════════ Smart Home Master Application Script ══════════ */

const MODE = "mock";
const RATE = 4.2;
const GEOFENCE = 150; // meters

/* ══════════ Devices Definition ══════════ */
const DEVICES = [
  { id: "light.living",   room: "ห้องนั่งเล่น", name: "ไฟเพดานหลัก",    type: "light",   icon: "fa-lightbulb", w: 36, dim: 1 },
  { id: "switch.tv",      room: "ห้องนั่งเล่น", name: "ทีวี 4K OLED",    type: "switch",  icon: "fa-tv", w: 120 },
  { id: "climate.living", room: "ห้องนั่งเล่น", name: "เครื่องปรับอากาศ", type: "climate", icon: "fa-snowflake", w: 1150 },
  { id: "cover.curtain",  room: "ห้องนั่งเล่น", name: "ม่านไฟฟ้า",        type: "cover",   icon: "fa-blinds", w: 5 },
  { id: "light.bed",      room: "ห้องนอน",     name: "ไฟหัวเตียง LED",  type: "light",   icon: "fa-sun", w: 24, dim: 1 },
  { id: "fan.bed",        room: "ห้องนอน",     name: "พัดลมปรับอากาศ", type: "fan",     icon: "fa-fan", w: 45 },
  { id: "light.kitchen",  room: "ครัว",        name: "ไฟเคาน์เตอร์ครัว",  type: "light",   icon: "fa-utensils", w: 18 },
  { id: "switch.heater",  room: "ห้องน้ำ",     name: "เครื่องทำน้ำอุ่น", type: "switch",  icon: "fa-shower", w: 3500 },
  { id: "lock.front",     room: "หน้าบ้าน",    name: "Smart Lock ประตู", type: "lock",    icon: "fa-lock", w: 2 },
  { id: "light.porch",    room: "หน้าบ้าน",    name: "ไฟส่องสว่างหน้าบ้าน", type: "light", icon: "fa-house-lighting", w: 15 }
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

/* ══════════ State & Storage ══════════ */
const K = "hasim_v4";
let V = "home";
let currentRoom = "all";
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
  toast("รีเซ็ตข้อมูลเรียบร้อยแล้ว");
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
    try { new Notification("บ้านของฉัน", { body: m, tag: "sh" }); } catch (e) {}
  }
}

/* ══════════ Telemetry & Sensors ══════════ */
const PHONE = { motion: 0, lux: null, batt: null, active: false };
let SEN = { temp: 29, hum: 62, lux: 400, pm: 28, motion: 0, door: 0 };
let lastAcc = 0, shakeAt = 0, homeGeo = null, liveVid = null;
let customCamImg = null;
let camStreamUrl = localStorage.getItem('cam_stream_url') || '';

function loadCustomCamStream(url) {
  if (!url) { customCamImg = null; return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  customCamImg = img;
}
if (camStreamUrl) loadCustomCamStream(camStreamUrl);

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
    
    // Broadcast MQTT Payload to Real Smart Home Hardware / ESP32 Relays
    if (mqttClient && mqttClient.connected && mqttTopic) {
      try {
        const payload = { id, ...p, at: Date.now() };
        mqttClient.publish(`${mqttTopic}/set/${id}`, JSON.stringify(payload));
        mqttClient.publish(mqttTopic, JSON.stringify(payload));
      } catch (e) {}
    }

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

let lastRenderedView = '';

/* ══════════ Views & UI Renderer ══════════ */
function render(force = false) {
  const clockHeader = document.getElementById("clockHeader");
  if (clockHeader) {
    clockHeader.textContent = PHONE.active ? "📱 เซ็นเซอร์มือถือจริง" : "🟢 100% Local Isolated";
  }

  document.querySelectorAll(".bottom-nav .nav-item").forEach(n => {
    n.classList.toggle("act", n.dataset.v === V);
    n.classList.toggle("active", n.dataset.v === V);
  });
  
  const viewEl = document.getElementById("view");
  if (!viewEl) return;

  if (force || V !== lastRenderedView || !viewEl.children.length) {
    const viewsMap = { home: vHome, cam: vCam, energy: vEnergy, auto: vAuto, remote: vRemote, log: vLog };
    viewEl.innerHTML = viewsMap[V] ? viewsMap[V]() : vHome();
    lastRenderedView = V;

    if (V === "cam") drawCams();
    if (V === "energy") drawChart();
    if (V === "remote") bindRemoteEvents();
    bindEvents();
  } else {
    // In-place selective DOM update to eliminate lag & DOM rebuilding
    if (V === "home") updateHomeDOM();
    if (V === "cam") drawCams();
  }
}

function updateHomeDOM() {
  const activeCount = DEVICES.filter(d => S[d.id].on).length;
  const watts = Math.round(powerNow());
  const dailyCost = (S._kwh[6].v * RATE).toFixed(2);

  const heroWatts = document.getElementById("heroWatts");
  if (heroWatts) heroWatts.textContent = `${watts} W`;

  const heroActiveDevs = document.getElementById("heroActiveDevs");
  if (heroActiveDevs) heroActiveDevs.textContent = `${activeCount} / ${DEVICES.length}`;

  const heroDailyCost = document.getElementById("heroDailyCost");
  if (heroDailyCost) heroDailyCost.textContent = `฿${dailyCost}`;

  const heroTemp = document.getElementById("heroTemp");
  if (heroTemp) heroTemp.textContent = `${SEN.temp}°C`;

  DEVICES.forEach(d => {
    const cardEl = document.querySelector(`.card[data-id="${d.id}"]`);
    if (cardEl) {
      const isOn = S[d.id].on;
      cardEl.classList.toggle("on", isOn);
      const swEl = cardEl.querySelector(".sw");
      if (swEl) swEl.classList.toggle("on", isOn);
      const subEl = cardEl.querySelector(".device-sub");
      if (subEl) {
        if (d.bri != null) {
          subEl.textContent = `${d.room} • ${isOn ? "เปิดอยู่ · " + S[d.id].bri + "%" : "ปิดอยู่"}`;
        } else if (d.pos != null) {
          subEl.textContent = `${d.room} • ${S[d.id].pos > 0 ? "เปิด " + S[d.id].pos + "%" : "ปิดอยู่"}`;
        } else {
          subEl.textContent = `${d.room} • ${isOn ? "เปิดอยู่" : "ปิดอยู่"}`;
        }
      }
    }
  });
}

function vHome() {
  const activeCount = DEVICES.filter(d => S[d.id].on).length;
  const watts = Math.round(powerNow());
  const dailyCost = (S._kwh[6].v * RATE).toFixed(2);

  let h = `
    <!-- Hero Stat Grid -->
    <div class="hero-stats">
      <div class="stat-card">
        <div class="stat-icon-box amber"><i class="fa-solid fa-bolt"></i></div>
        <div>
          <div id="heroWatts" class="stat-value">${watts} W</div>
          <div class="stat-label">การใช้ไฟตอนนี้</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box indigo"><i class="fa-solid fa-power-off"></i></div>
        <div>
          <div id="heroActiveDevs" class="stat-value">${activeCount} / ${DEVICES.length}</div>
          <div class="stat-label">อุปกรณ์เปิดอยู่</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box green"><i class="fa-solid fa-coins"></i></div>
        <div>
          <div id="heroDailyCost" class="stat-value">฿${dailyCost}</div>
          <div class="stat-label">ประมาณการค่าไฟวันนี้</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box blue"><i class="fa-solid fa-temperature-three-quarters"></i></div>
        <div>
          <div id="heroTemp" class="stat-value">${SEN.temp}°C</div>
          <div class="stat-label">อุณหภูมิในบ้าน (AQI ${SEN.pm})</div>
        </div>
      </div>
    </div>

    <!-- Mode Selector Chips -->
    <div style="margin-bottom: 16px;">
      ${["home", "away"].map(m => `
        <span class="chip ${S._mode === m ? "act" : ""}" data-mode="${m}">
          ${m === "home" ? "🏠 โหมดอยู่บ้าน (Home)" : "🚗 โหมดไม่อยู่บ้าน (Away)"}
        </span>
      `).join("")}
    </div>

    <!-- Quick IoT Remote Shortcut Banner -->
    <div class="remote-shortcut-card" onclick="V='remote'; render(); window.scrollTo(0,0);" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(56, 189, 248, 0.3)); border: 1px solid rgba(99, 102, 241, 0.5); border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 22px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3);">
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, var(--accent-indigo), #38bdf8); display: flex; align-items: center; justify-content: center; font-size: 22px; color: white;">
          <i class="fa-solid fa-gamepad"></i>
        </div>
        <div>
          <div style="font-weight: 700; font-size: 1rem; color: #fff;">🎛️ เปิดหน้าแผงควบคุม รีโมท IoT</div>
          <div style="font-size: 0.8rem; color: #cbd5e1;">โหมดรีโมทควบคุมไร้สาย MQTT / Bluetooth (BLE)</div>
        </div>
      </div>
      <i class="fa-solid fa-chevron-right" style="color: var(--accent-blue); font-size: 18px;"></i>
    </div>

    <!-- Quick Scenes Carousel -->
    <div class="section-title">
      <span><i class="fa-solid fa-sparkles" style="color: var(--accent-amber);"></i> ฉากสั่งงานด่วน (Quick Scenes)</span>
    </div>
    <div class="scenes-grid">
      ${SCENES.map((x, i) => `
        <div class="scene-card" data-sc="${i}">
          <div class="scene-icon">${x.i}</div>
          <div class="scene-name">${x.n}</div>
        </div>
      `).join("")}
    </div>

    <!-- Room Filter Tabs -->
    <div class="section-title">
      <span><i class="fa-solid fa-layer-group" style="color: var(--accent-blue);"></i> อุปกรณ์ภายในบ้าน</span>
    </div>
    <div class="room-tabs">
      <button class="tab-btn ${currentRoom === 'all' ? 'active' : ''}" data-room="all"><i class="fa-solid fa-border-all"></i> ทั้งหมด</button>
      <button class="tab-btn ${currentRoom === 'ห้องนั่งเล่น' ? 'active' : ''}" data-room="ห้องนั่งเล่น"><i class="fa-solid fa-couch"></i> ห้องนั่งเล่น</button>
      <button class="tab-btn ${currentRoom === 'ห้องนอน' ? 'active' : ''}" data-room="ห้องนอน"><i class="fa-solid fa-bed"></i> ห้องนอน</button>
      <button class="tab-btn ${currentRoom === 'ครัว' ? 'active' : ''}" data-room="ครัว"><i class="fa-solid fa-utensils"></i> ครัว</button>
      <button class="tab-btn ${currentRoom === 'หน้าบ้าน' ? 'active' : ''}" data-room="หน้าบ้าน"><i class="fa-solid fa-house-chimney"></i> หน้าบ้าน</button>
    </div>

    <!-- Devices Grid -->
    <div class="devices-grid">
  `;

  const filteredDevs = currentRoom === 'all' ? DEVICES : DEVICES.filter(d => d.room === currentRoom);

  filteredDevs.forEach(d => {
    const s = S[d.id];
    const isON = s.on || s.locked;
    
    let activeClass = "";
    if (isON) {
      if (d.type === "light") activeClass = "active-light";
      else if (d.type === "climate") activeClass = "active-climate";
      else if (d.type === "lock") activeClass = "active-lock";
      else activeClass = "active-light";
    }

    let subText = s.on ? ({
      light: d.dim ? `เปิดอยู่ · ${s.bri}%` : "เปิดอยู่",
      switch: "เปิดใช้งาน",
      fan: `แรงลมระดับ ${s.spd}`,
      climate: `โหมดเย็น ${s.temp}°C`,
      lock: "ล็อกแน่นหนา",
      cover: `เปิด ${s.pos}%`
    })[d.type] : "ปิดอยู่";

    if (d.type === "cover") subText = `ตำแหน่งผ้าม่าน ${s.pos}%`;
    if (d.type === "lock" && !s.on) subText = "ปลดล็อกแล้ว";

    h += `
      <div class="device-card ${activeClass}" data-id="${d.id}">
        <div>
          <div class="device-card-header">
            <div class="device-icon">
              <i class="fa-solid ${d.icon}"></i>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${isON ? 'checked' : ''} onchange="api.toggle('${d.id}'); render();">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="device-title">${d.name}</div>
          <div class="device-sub">${d.room} • ${subText}</div>
        </div>

        <div style="margin-top: 14px;">
    `;

    if (d.type === "light" && d.dim && s.on) {
      h += `<input type="range" class="custom-range" min="1" max="100" value="${s.bri}" data-bri="${d.id}">`;
    } else if (d.type === "cover") {
      h += `<input type="range" class="custom-range" min="0" max="100" value="${s.pos}" data-pos="${d.id}">`;
    } else if (d.type === "fan" && s.on) {
      h += `<input type="range" class="custom-range" min="1" max="3" value="${s.spd}" data-spd="${d.id}">`;
    } else if (d.type === "climate" && s.on) {
      h += `
        <div class="temp-stepper">
          <button class="temp-btn" data-t="${d.id}:-1">−</button>
          <span style="font-weight: 700; color: var(--accent-blue); font-size: 1rem;">${s.temp}°C</span>
          <button class="temp-btn" data-t="${d.id}:1">+</button>
        </div>
      `;
    }

    h += `</div></div>`;
  });

  h += `</div>`; // End devices-grid

  // Voice Input Panel
  h += `
    <div style="background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-glass); border-radius: var(--radius-xl); padding: 22px; margin-bottom: 24px;">
      <div style="font-size: 1rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-microphone" style="color: var(--accent-indigo);"></i> สั่งงานด้วยเสียงออฟไลน์ (Local Thai Voice)
      </div>
      <div style="display: flex; gap: 10px;">
        <input type="text" id="voiceInputText" placeholder="พิมพ์คำสั่ง เช่น 'เปิดไฟห้องนั่งเล่น', 'เข้านอน'..." style="flex:1; padding: 12px 16px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); color: white; border-radius: var(--radius-md); font-size: 0.92rem; outline: none;">
        <button id="btnSendVoiceText" style="padding: 12px 20px; background: linear-gradient(135deg, var(--accent-indigo), #38bdf8); color: white; border: none; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
          ส่งคำสั่ง
        </button>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
        <button class="b" data-act="voice" style="flex: 1; margin: 0;"><i class="fa-solid fa-microphone-lines"></i> ${window._sr ? "ปิด" : "เปิด"}ไมค์รับเสียง</button>
        <button class="b" data-act="sethome" style="flex: 1; margin: 0;"><i class="fa-solid fa-location-crosshairs"></i> ตั้งปักหมุดบ้าน</button>
        <button class="b" data-act="export" style="flex: 1; margin: 0;"><i class="fa-solid fa-file-code"></i> JSON Export</button>
        <button class="b" data-act="reset" style="flex: 1; margin: 0;"><i class="fa-solid fa-rotate-left"></i> รีเซ็ตระบบ</button>
      </div>
      <div id="exp"></div>
    </div>
  `;

  return h;
}

function vCam() {
  const savedStreamUrl = localStorage.getItem('cam_stream_url') || '';
  const cam1Title = camStreamUrl ? "(สตรีม IP Camera / ESP32-CAM)" : (liveVid ? "(สตรีมสดจากกล้องจริง)" : "(จำลอง)");
  return `
    <div class="section-title">
      <span><i class="fa-solid fa-video" style="color: var(--accent-blue);"></i> ระบบกล้องวงจรปิด & ตรวจจับวัตถุ</span>
    </div>
    
    <div class="chart-box">
      <h3 style="font-size: 1rem; margin-bottom: 10px;"><i class="fa-solid fa-camera"></i> กล้อง 1 · หน้าบ้าน ${cam1Title}</h3>
      <canvas id="c1" width="640" height="360"></canvas>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
        <button id="btnStartRealCamBack" style="padding: 10px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(56, 189, 248, 0.3)); border: 1px solid rgba(99, 102, 241, 0.6); color: white; border-radius: 10px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
          📷 เปิดดูกล้องหลังสดๆ
        </button>
        <button id="btnStartRealCamFront" style="padding: 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-glass); color: white; border-radius: 10px; font-weight: 600; font-size: 0.8rem; cursor: pointer;">
          🤳 เปิดดูกล้องหน้า
        </button>
      </div>
    </div>

    <div class="chart-box">
      <h3 style="font-size: 1rem; margin-bottom: 10px;"><i class="fa-solid fa-camera"></i> กล้อง 2 · ห้องนั่งเล่น (จำลอง)</h3>
      <canvas id="c2" width="640" height="360"></canvas>
    </div>

    <!-- Connection Box for IP / ESP32-CAM Cameras -->
    <details style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 12px; margin-bottom: 14px; border: 1px solid var(--border-glass);">
      <summary style="font-size: 0.85rem; font-weight: 700; color: var(--accent-blue); cursor: pointer;">
        ⚙️ เชื่อมต่อกล้องจริง (ESP32-CAM / IP Camera / USB Webcam)
      </summary>
      <div style="margin-top: 10px; font-size: 0.8rem; color: #cbd5e1;">
        <label style="display:block; margin-bottom:6px; font-weight:600;">ใส่อURL สตรีมกล้องวิดีโอ (MJPEG / Stream URL):</label>
        <input type="text" id="camStreamInput" value="${savedStreamUrl}" placeholder="เช่น http://192.168.1.100:81/stream หรือ https://..." style="width:100%; padding:8px 12px; background:rgba(0,0,0,0.4); border:1px solid var(--border-glass); color:#fff; border-radius:8px; margin-bottom:10px; font-size:0.8rem;" />
        <button id="btnSaveCamStream" style="width:100%; padding:9px; background:linear-gradient(135deg, #38bdf8, #0284c7); color:#fff; border:0; border-radius:8px; font-weight:700; cursor:pointer;">💾 บันทึกและเชื่อมต่อสตรีมกล้อง</button>
      </div>
    </details>

    <div class="row"><span>สถานะตรวจจับความเคลื่อนไหว</span><span class="val">${SEN.motion ? "🔴 พบความเคลื่อนไหว" : "⚪ ปกติ"}</span></div>
    <div class="row"><span>ความสว่างแสง (Lux)</span><span class="val">${SEN.lux} lx</span></div>
  `;
}

function vEnergy() {
  const totalKwh = S._kwh.reduce((a, b) => a + b.v, 0);
  return `
    <div class="section-title">
      <span><i class="fa-solid fa-bolt" style="color: var(--accent-amber);"></i> รายงานและสถิติการใช้พลังงาน</span>
    </div>

    <div class="hero-stats" style="margin-top: 0;">
      <div class="stat-card">
        <div class="stat-icon-box amber"><i class="fa-solid fa-plug"></i></div>
        <div>
          <div class="stat-value">${Math.round(powerNow())} W</div>
          <div class="stat-label">วัตต์ขณะนี้</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box green"><i class="fa-solid fa-chart-simple"></i></div>
        <div>
          <div class="stat-value">${S._kwh[6].v.toFixed(2)} kWh</div>
          <div class="stat-label">หน่วยไฟวันนี้</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box blue"><i class="fa-solid fa-money-bill-wave"></i></div>
        <div>
          <div class="stat-value">฿${(totalKwh / 7 * 30 * RATE).toFixed(0)}</div>
          <div class="stat-label">ประมาณการ 30 วัน</div>
        </div>
      </div>
    </div>

    <div class="chart-box">
      <h3 style="font-size: 1rem; margin-bottom: 14px;"><i class="fa-solid fa-chart-column"></i> สถิติการใช้ไฟย้อนหลัง 7 วัน (kWh)</h3>
      <canvas id="ch" width="700" height="330"></canvas>
    </div>

    <div class="section-title"><span>อุปกรณ์ที่ใช้ไฟขณะนี้</span></div>
    ${
      DEVICES.filter(d => S[d.id].on).sort((a, b) => b.w - a.w).map(d =>
        `<div class="row"><span><i class="fa-solid ${d.icon}"></i> ${d.name} (${d.room})</span><span class="val">${d.w} W</span></div>`
      ).join("") || `<div class="row"><span>ไม่มีอุปกรณ์เปิดใช้งานอยู่</span></div>`
    }
  `;
}

function vAuto() {
  return `
    <div class="section-title">
      <span><i class="fa-solid fa-robot" style="color: var(--accent-indigo);"></i> กฎอัตโนมัติประจำบ้าน (Automations)</span>
    </div>
    ${RULES.map(r => {
      const on = S._rules[r.id];
      return `
        <div class="rule ${on ? "" : "off"}">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
            <div>
              <div style="font-size: 1rem; font-weight:600;">${r.n}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${r.msg}</div>
            </div>
            <div class="sw ${on ? "on" : ""}" data-rule="${r.id}"><i></i></div>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

/* ══════════ IoT MQTT, BLE & Built-in Infrared (IR Blaster) ══════════ */
let myMode = localStorage.getItem('remote_myMode') || 'remote'; // remote | receiver | ir_blaster
let irDeviceType = localStorage.getItem('remote_irDeviceType') || 'tv'; // tv | ac | fan | custom
let selectedBrands = {
  tv: localStorage.getItem('ir_brand_tv') || 'samsung',
  ac: localStorage.getItem('ir_brand_ac') || 'daikin',
  fan: localStorage.getItem('ir_brand_fan') || 'hatari'
};
let irTargetTemp = 24;
let irModeState = 'COOL';
let irFanState = 'AUTO';

let mqttClient = null, mqttTopic = '';
let uartChar = null;
const UART_SVC = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const CMD_TEXT = {
  UP:'▲ ขึ้น', DOWN:'▼ ลง', LEFT:'◀ ซ้าย', RIGHT:'▶ ขวา', OK:'● ตกลง',
  LIGHT_ON:'💡 เปิดไฟ', LIGHT_OFF:'🌙 ปิดไฟ',
  FAN_UP:'🌀 เพิ่มลม', FAN_DOWN:'🌀 ลดลม',
  AC_ON:'❄️ เปิดแอร์', ALL_OFF:'⛔ ปิดทั้งหมด',
  IR_POWER:'🔴 IR Power', IR_MUTE:'🔇 IR Mute',
  IR_VOL_UP:'🔊 เสียง +', IR_VOL_DN:'🔉 เสียง −',
  IR_CH_UP:'📺 ช่อง +', IR_CH_DN:'📺 ช่อง −',
  IR_TEMP_UP:'❄️ แอร์ +1°C', IR_TEMP_DN:'❄️ แอร์ -1°C'
};

// Convert Hex Code to Microseconds NEC Pattern for Android ConsumerIrManager.transmit()
function hexToNECPattern(hexStr) {
  let val = parseInt(hexStr.replace('0x', ''), 16);
  if (isNaN(val)) val = 0x20DF10EF;
  
  const pattern = [9000, 4500]; // Standard NEC Header Mark & Space
  for (let i = 31; i >= 0; i--) {
    const bit = (val >> i) & 1;
    pattern.push(560);
    pattern.push(bit ? 1690 : 560);
  }
  pattern.push(560); // NEC Stop bit
  return pattern;
}

// Universal Hardware IR Transmit for Honor 200, Xiaomi, Poco, Huawei, Samsung Built-in Phone IR Blasters
function transmitBuiltInPhoneIR(hexCode = '0x20DF10EF', freq = 38000) {
  const pattern = hexToNECPattern(hexCode);
  const bridges = [
    window.AndroidIR,
    window.ConsumerIR,
    window.HonorIR,
    window.XiaomiIR,
    window.HuaweiIR,
    navigator.ir
  ];

  for (const bridge of bridges) {
    if (bridge && typeof bridge.transmit === 'function') {
      try {
        bridge.transmit(freq, pattern);
        return true;
      } catch (e) {
        try { bridge.transmit(freq, hexCode); return true; } catch (err) {}
      }
    }
  }
  return false;
}

// Web Audio 38kHz Carrier Signal Modulator for 3.5mm IR Audio Blaster & Built-in IR Emulation
function transmitWebAudioIR(hexCode = '0x20DF10EF') {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioCtx.sampleRate;
    const carrierFreq = 38000; // 38kHz standard IR carrier
    const duration = 0.15; // 150ms IR burst
    const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * carrierFreq * t) * 0.9;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  } catch (e) {
    console.log('Audio IR fallback:', e);
  }
}

// Universal IR Hex Protocol Map for Major Appliance Brands
const IR_CODES = {
  tv: {
    samsung:   { power: '0xE0E040BF', mute: '0xE0E0F00F', volUp: '0xE0E0E01F', volDn: '0xE0E0D02F', chUp: '0xE0E048B7', chDn: '0xE0E008F7' },
    lg:        { power: '0x20DF10EF', mute: '0x20DF906F', volUp: '0x20DF40BF', volDn: '0x20DFC03F', chUp: '0x20DF00FF', chDn: '0x20DF807F' },
    sony:      { power: '0xA90',      mute: '0x290',      volUp: '0x490',      volDn: '0xC90',      chUp: '0x90',       chDn: '0x890' },
    panasonic: { power: '0x400401008081', mute: '0x400401004041', volUp: '0x400401000405', volDn: '0x400401008485' },
    tcl:       { power: '0x4FB40BF',  mute: '0x4FB08F7',  volUp: '0x4FB10EF',  volDn: '0x4FB30CF' },
    sharp:     { power: '0xAA5A',     mute: '0xAA2A',     volUp: '0xAA1A',     volDn: '0xAA6A' }
  },
  ac: {
    daikin:     { power: '0x11DA2700', cool: '0x11DA2701', tempUp: '0x11DA2702', tempDn: '0x11DA2703' },
    mitsubishi: { power: '0x23CB2601', cool: '0x23CB2602', tempUp: '0x23CB2603', tempDn: '0x23CB2604' },
    carrier:    { power: '0x28D70100', cool: '0x28D70101', tempUp: '0x28D70102', tempDn: '0x28D70103' },
    haier:      { power: '0xA55A0100', cool: '0xA55A0101', tempUp: '0xA55A0102', tempDn: '0xA55A0103' }
  },
  fan: {
    hatari:     { power: '0x00FF02FD', speed: '0x00FF9867', swing: '0x00A850AF', timer: '0x00FF38C7' },
    mitsubishi: { power: '0x807F02FD', speed: '0x807F9867', swing: '0x807FA05F' },
    xiaomi:     { power: '0x5C800100', speed: '0x5C800101', swing: '0x5C800102' }
  }
};

function vRemote() {
  const savedRoom = localStorage.getItem('room') || '';
  return `
    <!-- Segmented Capsule Mode Picker -->
    <div class="remote-segment-bar">
      <button class="remote-segment-btn ${myMode === 'remote' ? 'active' : ''}" data-mode="remote">
        <i class="fa-solid fa-gamepad"></i> 📱 รีโมทแอป
      </button>
      <button class="remote-segment-btn ${myMode === 'ir_blaster' ? 'active' : ''}" data-mode="ir_blaster">
        <i class="fa-solid fa-tower-broadcast"></i> 📡 รีโมท IR
      </button>
      <button class="remote-segment-btn ${myMode === 'receiver' ? 'active' : ''}" data-mode="receiver">
        <i class="fa-solid fa-desktop"></i> 📺 ตัวรับ
      </button>
    </div>

    <!-- Mode 1: Sleek Wireless Smart Home Remote -->
    <div class="remote-card ${myMode !== 'remote' ? 'hide' : ''}" id="remotePanel" style="padding: 20px;">
      <div style="text-align: center; margin-bottom: 4px;">
        <div style="font-size: 1rem; font-weight: 700; color: #fff;">🎛️ แผงรีโมทควบคุมไร้สาย</div>
      </div>

      <!-- Circular Apple Glass D-PAD Trackpad -->
      <div class="remote-dpad-circle">
        <button class="dpad-dir-btn up" data-cmd="UP"><i class="fa-solid fa-chevron-up"></i></button>
        <button class="dpad-dir-btn down" data-cmd="DOWN"><i class="fa-solid fa-chevron-down"></i></button>
        <button class="dpad-dir-btn left" data-cmd="LEFT"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="dpad-dir-btn right" data-cmd="RIGHT"><i class="fa-solid fa-chevron-right"></i></button>
        <button class="dpad-center-btn" data-cmd="OK">OK</button>
      </div>

      <!-- Balanced 2-Column Action Buttons -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button class="k wide on"  data-cmd="LIGHT_ON" style="padding:13px; border-radius:14px; font-weight:600;">💡 เปิดไฟ</button>
        <button class="k wide off" data-cmd="LIGHT_OFF" style="padding:13px; border-radius:14px; font-weight:600;">🌙 ปิดไฟ</button>
        <button class="k wide"     data-cmd="FAN_UP" style="padding:13px; border-radius:14px; font-weight:600;">🌀 พัดลม +</button>
        <button class="k wide"     data-cmd="FAN_DOWN" style="padding:13px; border-radius:14px; font-weight:600;">🌀 พัดลม −</button>
        <button class="k wide"     data-cmd="AC_ON" style="padding:13px; border-radius:14px; font-weight:600;">❄️ เปิดแอร์</button>
        <button class="k wide off" data-cmd="ALL_OFF" style="padding:13px; border-radius:14px; font-weight:600;">⛔ ปิดทั้งหมด</button>
      </div>
      <p id="lastSent" style="margin-top:14px; font-size:0.8rem; color:var(--accent-amber); text-align:center;"></p>
    </div>

    <!-- Mode 2: Minimalist IR Blaster Controller -->
    <div class="remote-card ${myMode !== 'ir_blaster' ? 'hide' : ''}" id="irPanel" style="padding: 20px;">
      <div id="irPulseEmitter" class="ir-pulse-emitter" style="width:44px; height:44px; font-size:18px; margin-bottom:10px;">
        <i class="fa-solid fa-tower-broadcast"></i>
      </div>
      <div style="text-align: center; margin-bottom: 14px;">
        <div style="font-size: 1rem; font-weight: 700; color: #fff;">📡 รีโมทอินฟราเรด (Infrared IR)</div>
        <div style="font-size: 0.78rem; color: #38bdf8; margin-top: 4px; font-weight: 600;">
          📲 รองรับตัวยิง IR บนหัวเครื่อง (Honor 200 / Xiaomi / Poco / Huawei) + ESP32 MQTT
        </div>
      </div>

      <!-- Compact IR Type Pill Tabs -->
      <div class="ir-type-tabs" style="justify-content: center; margin-bottom: 14px;">
        <button class="ir-type-btn ${irDeviceType === 'tv' ? 'active' : ''}" data-irtype="tv">📺 ทีวี</button>
        <button class="ir-type-btn ${irDeviceType === 'ac' ? 'active' : ''}" data-irtype="ac">❄️ แอร์</button>
        <button class="ir-type-btn ${irDeviceType === 'fan' ? 'active' : ''}" data-irtype="fan">🌀 พัดลม</button>
        <button class="ir-type-btn ${irDeviceType === 'custom' ? 'active' : ''}" data-irtype="custom">⚙️ คัสตอม</button>
      </div>

      <!-- Elegant Glass Dropdown Selector for All World Brands -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); padding: 8px 12px; border-radius: 12px; margin-bottom: 14px; border: 1px solid var(--border-glass);">
        <label for="irBrandSelect" style="font-size: 0.8rem; font-weight: 600; color: #cbd5e1;">🌐 ยี่ห้อ (Brand):</label>
        <select id="irBrandSelect" style="background: rgba(18, 22, 32, 0.95); color: #fff; border: 1px solid var(--accent-indigo); padding: 5px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; outline: none; width: 62%; cursor: pointer;">
          ${getIRBrandDropdownOptions(irDeviceType)}
        </select>
      </div>

      <!-- TV Minimal Controls -->
      <div id="irTvView" class="${irDeviceType !== 'tv' ? 'hide' : ''}">
        <!-- Live TV Power State Badge & Toggle Feedback -->
        <div id="tvPowerBadge" style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:12px; margin-bottom:12px; border:1px solid var(--border-glass);">
          <span style="font-size:0.8rem; color:#cbd5e1; font-weight:600;">สถานะทีวี (TV Power State):</span>
          <span id="tvStateText" style="font-size:0.8rem; font-weight:700; color:${S['tv']?.on ? '#34d399' : '#f87171'};">
            ${S['tv']?.on ? '🟢 เปิดอยู่ (ON)' : '🔴 ปิดอยู่ (OFF)'}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <button class="ir-cmd-btn" data-ircmd="power" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: 0; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer;">🔴 Power Toggle</button>
          <button class="ir-cmd-btn" data-ircmd="mute" style="background: rgba(255,255,255,0.06); color: #fff; border: 1px solid var(--border-glass); padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer;">🔇 Mute</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <button class="ir-cmd-btn" data-ircmd="volUp" style="padding:10px; background:rgba(56,189,248,0.12); border:1px solid var(--accent-blue); color:var(--accent-blue); border-radius:10px; font-weight:700;">VOL +</button>
          <button class="ir-cmd-btn" data-ircmd="volDn" style="padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-glass); color:#fff; border-radius:10px; font-weight:700;">VOL −</button>
          <button class="ir-cmd-btn" data-ircmd="chUp" style="padding:10px; background:rgba(168,85,247,0.12); border:1px solid var(--accent-purple); color:var(--accent-purple); border-radius:10px; font-weight:700;">CH ▲</button>
          <button class="ir-cmd-btn" data-ircmd="chDn" style="padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-glass); color:#fff; border-radius:10px; font-weight:700;">CH ▼</button>
        </div>
        
        <div class="remote-dpad-circle" style="width: 180px; height: 180px; margin: 10px auto;">
          <button class="ir-cmd-btn dpad-dir-btn up" data-ircmd="up"><i class="fa-solid fa-chevron-up"></i></button>
          <button class="ir-cmd-btn dpad-dir-btn down" data-ircmd="down"><i class="fa-solid fa-chevron-down"></i></button>
          <button class="ir-cmd-btn dpad-dir-btn left" data-ircmd="left"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="ir-cmd-btn dpad-dir-btn right" data-ircmd="right"><i class="fa-solid fa-chevron-right"></i></button>
          <button class="ir-cmd-btn dpad-center-btn" data-ircmd="ok" style="width: 60px; height: 60px; font-size: 0.9rem;">OK</button>
        </div>
      </div>

      <!-- AC Minimal Controls -->
      <div id="irAcView" class="${irDeviceType !== 'ac' ? 'hide' : ''}">
        <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 16px; padding: 14px; text-align: center; margin-bottom: 12px;">
          <div style="font-size: 0.75rem; color: #94a3b8;">อุณหภูมิที่ตั้งไว้ (TEMP)</div>
          <div id="irAcTempDisp" style="font-size: 2.4rem; font-weight: 800; color: #38bdf8; margin: 2px 0;">${irTargetTemp}°C</div>
          <div style="display: flex; justify-content: center; gap: 10px; margin-top: 6px;">
            <button id="btnAcTempDn" style="width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,0.08); border:1px solid var(--border-glass); color:#fff; font-size:18px; cursor:pointer;">−</button>
            <button id="btnAcTempUp" style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, var(--accent-blue), var(--accent-indigo)); border:0; color:#fff; font-size:18px; cursor:pointer;">+</button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button class="ir-cmd-btn" data-ircmd="power" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: 0; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer;">🔴 Power</button>
          <button class="ir-cmd-btn" data-ircmd="cool" style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid var(--accent-blue); padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer;">❄️ Cool</button>
        </div>
      </div>

      <!-- Fan Minimal Controls -->
      <div id="irFanView" class="${irDeviceType !== 'fan' ? 'hide' : ''}">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <button class="ir-cmd-btn" data-ircmd="power" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: 0; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer;">🔴 Power</button>
          <button class="ir-cmd-btn" data-ircmd="speed" style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid var(--accent-amber); padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer;">🌀 Speed</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button class="ir-cmd-btn" data-ircmd="swing" style="background: rgba(255,255,255,0.06); color: #fff; border: 1px solid var(--border-glass); padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer;">🔄 Swing</button>
          <button class="ir-cmd-btn" data-ircmd="timer" style="background: rgba(255,255,255,0.06); color: #fff; border: 1px solid var(--border-glass); padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer;">⏱️ Timer</button>
        </div>
      </div>

      <!-- Custom IR Code Minimal Input -->
      <div id="irCustomView" class="${irDeviceType !== 'custom' ? 'hide' : ''}">
        <div style="display:flex; gap:8px;">
          <input id="inputCustomIrHex" placeholder="เช่น 0x20DF10EF" style="flex:1; background:rgba(18,22,32,0.9); color:#fff; border:1px solid var(--border-glass); padding:8px 12px; border-radius:10px; font-family:monospace; font-size:0.85rem;">
          <button id="btnSendCustomIr" style="background:linear-gradient(135deg, #ef4444, #f97316); color:#fff; border:0; padding:8px 14px; border-radius:10px; font-weight:700; cursor:pointer;">ยิง IR</button>
        </div>
      </div>

      <p id="irStatusText" style="margin-top: 12px; font-size: 0.78rem; color: var(--accent-amber); text-align: center;">
        พร้อมยิงสัญญาณอินฟราเรด 38.0 kHz
      </p>
    </div>

    <!-- Mode 3: Receiver Monitor -->
    <div class="remote-card ${myMode !== 'receiver' ? 'hide' : ''}" id="receiverPanel" style="padding: 20px;">
      <h3 style="font-size: 1rem; margin-bottom: 10px;"><i class="fa-solid fa-desktop"></i> จอรับสัญญาณคำสั่ง</h3>
      <div id="bigCmd">— รอรับคำสั่ง —</div>
      <ul id="cmdLog"></ul>
    </div>

    <!-- Production Hardware Connection Drawer -->
    <details style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 16px; padding: 14px 16px; margin-top: 16px;">
      <summary style="font-size: 0.85rem; color: var(--accent-blue); font-weight: 700; cursor: pointer; user-select: none;">
        ⚙️ ตั้งค่าการเชื่อมต่อฮาร์ดแวร์จริง (MQTT / ESP32 Gateway / BLE)
      </summary>
      <div style="margin-top: 14px; font-size: 0.8rem; color: #cbd5e1;">
        <div style="margin-bottom: 10px;">
          <label style="display:block; font-weight:600; margin-bottom:4px;">MQTT Server Broker URL:</label>
          <input id="mqttBrokerUrl" value="${localStorage.getItem('mqtt_broker_url') || 'wss://broker.emqx.io:8084/mqtt'}" placeholder="wss://broker.hivemq.com:8000/mqtt" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--border-glass); color:#fff; border-radius:8px; font-size:0.8rem;" />
        </div>
        
        <div style="margin-bottom: 10px;">
          <label style="display:block; font-weight:600; margin-bottom:4px;">รหัสบ้าน / Topic Prefix:</label>
          <input id="roomCode" placeholder="เช่น home123" maxlength="20" value="${savedRoom}" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--border-glass); color:#fff; border-radius:8px; font-size:0.8rem;" />
        </div>

        <button id="btnJoin" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #38bdf8, #0284c7); color:#fff; border:0; border-radius:8px; font-weight:700; cursor:pointer;">
          🔗 เชื่อมต่อ MQTT Broker ควบคุมบ้านจริง
        </button>

        <button id="btnBLE" style="width:100%; margin-top:8px; padding:10px; border:1px solid var(--accent-blue); background:rgba(56,189,248,0.12); color:var(--accent-blue); border-radius:8px; font-size:0.82rem; font-weight:600; cursor:pointer;">
          📡 เชื่อมต่อบอร์ด ESP32 โดยตรงผ่าน Bluetooth (BLE)
        </button>

        <p id="netStatus" style="margin-top:10px; font-size:0.8rem; color:var(--accent-amber); text-align:center; font-weight:600;">
          ${mqttClient && mqttClient.connected ? "🟢 เชื่อมต่อ MQTT เรียบร้อยแล้ว (" + mqttTopic + ")" : "⚪ โหมดจำลองในเครื่อง (Standalone Demo)"}
        </p>

        <!-- ESP32 Firmware Source Code Helper -->
        <details style="margin-top:12px; background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
          <summary style="font-weight:700; color:#38bdf8; cursor:pointer; font-size:0.78rem;">
            📄 คลิกดูโค้ดตัวอย่าง Arduino C++ สำหรับแฟลชลง ESP32
          </summary>
          <pre style="margin-top:8px; font-family:monospace; font-size:0.7rem; color:#a7f3d0; background:#0f172a; padding:10px; border-radius:8px; overflow-x:auto; max-height:180px;">
// Arduino C++ Sketch for ESP32 + Relays + DHT22
#include &lt;WiFi.h&gt;
#include &lt;PubSubClient.h&gt;

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASS";
const char* mqtt_server = "broker.hivemq.com";
const char* topic_sub = "smarthome/YOUR_ROOM/#";
const char* topic_pub = "smarthome/YOUR_ROOM/telemetry";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  pinMode(18, OUTPUT); // Relay 1 (Living Light)
  WiFi.begin(ssid, password);
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i &lt; length; i++) msg += (char)payload[i];
  if (msg.indexOf("light.living") &gt; 0 &amp;&amp; msg.indexOf("\"on\":true") &gt; 0) digitalWrite(18, HIGH);
  if (msg.indexOf("light.living") &gt; 0 &amp;&amp; msg.indexOf("\"on\":false") &gt; 0) digitalWrite(18, LOW);
}

void loop() {
  if (!client.connected()) client.connect("ESP32_Gateway");
  client.loop();
}
          </pre>
        </details>
      </div>
    </details>
  `;
}

function getIRBrandDropdownOptions(type) {
  const brandsMap = {
    tv: [
      { id: 'samsung', name: 'Samsung TV (ซัมซุง)' },
      { id: 'lg', name: 'LG Smart TV (แอลจี)' },
      { id: 'sony', name: 'Sony Bravia (โซนี่)' },
      { id: 'panasonic', name: 'Panasonic Viera (พานาโซนิค)' },
      { id: 'tcl', name: 'TCL Smart TV (ทีซีแอล)' },
      { id: 'sharp', name: 'Sharp Aquos (ชาร์ป)' },
      { id: 'toshiba', name: 'Toshiba Regza (โตชิบา)' },
      { id: 'philips', name: 'Philips Smart TV (ฟิลิปส์)' },
      { id: 'hisense', name: 'Hisense Smart TV (ไฮเซ่นส์)' },
      { id: 'xiaomi', name: 'Xiaomi Mi TV (เสี่ยวหมี่)' },
      { id: 'haier', name: 'Haier Smart TV (ไฮเออร์)' },
      { id: 'skyworth', name: 'Skyworth TV (สกายเวิร์ท)' },
      { id: 'aconatic', name: 'Aconatic TV (อะโคนาติก)' },
      { id: 'coocaa', name: 'Coocaa Smart TV (คูค่า)' },
      { id: 'vizio', name: 'Vizio TV (วิซิโอ)' },
      { id: 'hitachi', name: 'Hitachi TV (ฮิตาชิ)' },
      { id: 'jvc', name: 'JVC Smart TV (เจวีซี)' },
      { id: 'sanyo', name: 'Sanyo TV (ซันโย)' },
      { id: 'singer', name: 'Singer TV (ซิงเกอร์)' },
      { id: 'altron', name: 'Altron Thai TV (อัลตรอน)' },
      { id: 'worldtech', name: 'Worldtech TV (เวิลด์เทค)' },
      { id: 'custom', name: '⚙️ ยี่ห้ออื่น / Custom Hex' }
    ],
    ac: [
      { id: 'daikin', name: 'Daikin (ไดกิ้น)' },
      { id: 'mitsubishi', name: 'Mitsubishi Electric (มิตซูบิชิ อิเล็คทริค)' },
      { id: 'mitsu_heavy', name: 'Mitsubishi Heavy Industries (เฮฟวี่ ดิวตี้)' },
      { id: 'carrier', name: 'Carrier (แคเรียร์)' },
      { id: 'haier', name: 'Haier (ไฮเออร์)' },
      { id: 'panasonic', name: 'Panasonic (พานาโซนิค)' },
      { id: 'samsung', name: 'Samsung (ซัมซุง)' },
      { id: 'lg', name: 'LG (แอลจี)' },
      { id: 'gree', name: 'Gree (กรี)' },
      { id: 'tcl', name: 'TCL (ทีซีแอล)' },
      { id: 'sharp', name: 'Sharp (ชาร์ป)' },
      { id: 'toshiba', name: 'Toshiba (โตชิบา)' },
      { id: 'fujitsu', name: 'Fujitsu (ฟูจิตสึ)' },
      { id: 'york', name: 'York (ยอร์ค)' },
      { id: 'central_air', name: 'Central Air (เซ็นทรัลแอร์)' },
      { id: 'saijo', name: 'Saijo Denki (ไซโจ เดนกิ)' },
      { id: 'amena', name: 'Amena (อามีน่า)' },
      { id: 'tasaki', name: 'Tasaki (ทาซากิ)' },
      { id: 'eminent', name: 'Eminent Air (เอมมิเน้นท์แอร์)' },
      { id: 'midea', name: 'Midea (ไมเดีย)' },
      { id: 'aux', name: 'Aux Air (อ็อกซ์)' },
      { id: 'electrolux', name: 'Electrolux (อีเลคโทรลักซ์)' },
      { id: 'chigo', name: 'Chigo (ชิโก้)' },
      { id: 'star_air', name: 'Star Air (สตาร์แอร์)' },
      { id: 'custom', name: '⚙️ ยี่ห้ออื่น / Custom Hex' }
    ],
    fan: [
      { id: 'hatari', name: 'Hatari (ฮาตาริ)' },
      { id: 'mitsubishi', name: 'Mitsubishi (มิตซูบิชิ)' },
      { id: 'xiaomi', name: 'Xiaomi Smart Fan (เสี่ยวหมี่)' },
      { id: 'panasonic', name: 'Panasonic (พานาโซนิค)' },
      { id: 'kdk', name: 'KDK Fan (เคดีเค)' },
      { id: 'dyson', name: 'Dyson Air Multiplier (ไดสัน)' },
      { id: 'toshiba', name: 'Toshiba (โตชิบา)' },
      { id: 'sharp', name: 'Sharp Plasmacluster (ชาร์ป)' },
      { id: 'imarflex', name: 'Imarflex (อิมาร์เฟล็กซ์)' },
      { id: 'hanabishi', name: 'Hanabishi (ฮานาบิชิ)' },
      { id: 'victor', name: 'Victor (วิคเตอร์)' },
      { id: 'clarte', name: 'Clarte (คลาร์เต้)' },
      { id: 'masterkool', name: 'Masterkool (มาสเตอร์คูล)' },
      { id: 'midea', name: 'Midea (ไมเดีย)' },
      { id: 'honeywell', name: 'Honeywell (ฮันนี่เวลล์)' },
      { id: 'custom', name: '⚙️ ยี่ห้ออื่น / Custom Hex' }
    ]
  };

  const list = brandsMap[type] || [];
  const activeBrand = selectedBrands[type] || list[0]?.id || 'samsung';

  return list.map(b => `
    <option value="${b.id}" ${activeBrand === b.id ? 'selected' : ''}>
      ${b.name}
    </option>
  `).join('');
}

function triggerIRSignal(cmdType, hexCodeVal = null) {
  const activeBrand = selectedBrands[irDeviceType] || 'samsung';
  const hexCode = hexCodeVal || IR_CODES[irDeviceType]?.[activeBrand]?.[cmdType] || IR_CODES[irDeviceType]?.samsung?.[cmdType] || '0x20DF10EF';

  // 1. Tactile Vibration Feedback
  if (navigator.vibrate) navigator.vibrate([25, 10, 25]);

  // 2. Visual IR Pulse Emitter Glow Animation
  const emitter = document.getElementById('irPulseEmitter');
  if (emitter) {
    emitter.classList.add('transmitting');
    setTimeout(() => emitter.classList.remove('transmitting'), 400);
  }

  // 3. Built-in Phone Hardware IR Blaster (Honor 200 / Xiaomi / Poco / Huawei / Samsung)
  const isPhoneIrFired = transmitBuiltInPhoneIR(hexCode, 38000);

  // 4. Web Audio 38kHz Carrier Signal Modulator
  transmitWebAudioIR(hexCode);

  // 5. MQTT IR Transmit Payload for ESP32 / Arduino IR Blasters in the house
  if (mqttClient && mqttClient.connected) {
    const irPayload = {
      type: 'IR_TRANSMIT',
      protocol: activeBrand.toUpperCase(),
      code: hexCode,
      device: irDeviceType,
      command: cmdType,
      at: Date.now()
    };
    mqttClient.publish(mqttTopic, JSON.stringify(irPayload));
  }

  // 6. Update Power State Tracking & Badge Text
  if (cmdType === 'power' && S['tv']) {
    S['tv'].on = !S['tv'].on;
    saveState();
    const tvStateText = document.getElementById('tvStateText');
    if (tvStateText) {
      tvStateText.textContent = S['tv'].on ? '🟢 เปิดอยู่ (ON)' : '🔴 ปิดอยู่ (OFF)';
      tvStateText.style.color = S['tv'].on ? '#34d399' : '#f87171';
    }
  }

  // 7. Update Status Feedback Text
  const statusEl = document.getElementById('irStatusText');
  if (statusEl) {
    statusEl.textContent = `📡 ยิงสัญญาณ IR [${activeBrand.toUpperCase()} ${cmdType.toUpperCase()}]: ${hexCode}`;
  }
  toast(`📡 ยิงคลื่น IR ${hexCode}`);
}

function bindRemoteEvents() {
  document.querySelectorAll('.remote-segment-btn').forEach(b => {
    b.onclick = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      myMode = b.dataset.mode;
      localStorage.setItem('remote_myMode', myMode);
      render(true);
    };
  });

  const brandSelect = document.getElementById('irBrandSelect');
  if (brandSelect) {
    brandSelect.onchange = (e) => {
      e.stopPropagation();
      const val = brandSelect.value;
      selectedBrands[irDeviceType] = val;
      localStorage.setItem('ir_brand_' + irDeviceType, val);
      const statusEl = document.getElementById('irStatusText');
      if (statusEl) statusEl.textContent = `เลือกยี่ห้อ [${val.toUpperCase()}] เรียบร้อยแล้ว (38.0 kHz)`;
    };
  }

  // IR Type Tabs Handler (TV, AC, Fan, Custom)
  document.querySelectorAll('.ir-type-btn').forEach(btn => {
    btn.onclick = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      irDeviceType = btn.dataset.irtype;
      localStorage.setItem('remote_irDeviceType', irDeviceType);
      render(true);
    };
  });

  // IR Command Buttons Click Event Handler
  document.querySelectorAll('.ir-cmd-btn').forEach(btn => {
    btn.onclick = () => {
      const cmdType = btn.dataset.ircmd;
      if (cmdType) triggerIRSignal(cmdType);
    };
  });

  // AC Temp Adjustment Buttons
  const btnAcTempUp = document.getElementById('btnAcTempUp');
  const btnAcTempDn = document.getElementById('btnAcTempDn');
  const irAcTempDisp = document.getElementById('irAcTempDisp');

  if (btnAcTempUp) {
    btnAcTempUp.onclick = () => {
      if (irTargetTemp < 30) irTargetTemp++;
      if (irAcTempDisp) irAcTempDisp.textContent = `${irTargetTemp}°C`;
      triggerIRSignal('tempUp');
    };
  }
  if (btnAcTempDn) {
    btnAcTempDn.onclick = () => {
      if (irTargetTemp > 16) irTargetTemp--;
      if (irAcTempDisp) irAcTempDisp.textContent = `${irTargetTemp}°C`;
      triggerIRSignal('tempDn');
    };
  }

  // Custom IR Hex Transmitter Button
  const btnSendCustomIr = document.getElementById('btnSendCustomIr');
  const inputCustomIrHex = document.getElementById('inputCustomIrHex');
  if (btnSendCustomIr && inputCustomIrHex) {
    btnSendCustomIr.onclick = () => {
      const hexVal = inputCustomIrHex.value.trim();
      if (!hexVal) return alert('กรุณาป้อนรหัส IR Hex Code ก่อนครับ');
      triggerIRSignal('custom', hexVal);
    };
  }

  const btnJoin = document.getElementById('btnJoin');
  const netStatus = document.getElementById('netStatus');
  const roomCodeInput = document.getElementById('roomCode');

  if (btnJoin) {
    btnJoin.onclick = () => {
      const code = roomCodeInput ? roomCodeInput.value.trim() : '';
      if (!code) return alert('กรุณาใส่รหัสบ้านก่อนครับ');
      
      const brokerInput = document.getElementById('mqttBrokerUrl');
      const brokerUrl = brokerInput ? brokerInput.value.trim() : 'wss://broker.emqx.io:8084/mqtt';

      localStorage.setItem('room', code);
      localStorage.setItem('mqtt_broker_url', brokerUrl);
      
      mqttTopic = 'smarthome/' + code;
      if (netStatus) netStatus.textContent = '⏳ กำลังเชื่อมต่อ MQTT Broker...';

      if (mqttClient) mqttClient.end(true);
      try {
        mqttClient = mqtt.connect(brokerUrl);

        mqttClient.on('connect', () => {
          if (netStatus) netStatus.textContent = `🟢 เชื่อมต่อ MQTT "${code}" แล้ว [${brokerUrl}]`;
          mqttClient.subscribe(mqttTopic);
          mqttClient.subscribe(`${mqttTopic}/#`);
          toast(`🟢 เชื่อมต่อ MQTT "${code}" สำเร็จแล้ว`);
          render(true);
        });

        mqttClient.on('message', (t, msg) => {
          try {
            const data = JSON.parse(msg.toString());
            if (myMode === 'receiver') showCommand(data);

            // Live bi-directional hardware sensor telemetry sync
            if (data.temp != null) SEN.temp = data.temp;
            if (data.hum != null) SEN.hum = data.hum;
            if (data.pm != null) SEN.pm = data.pm;
            if (data.lux != null) SEN.lux = data.lux;
            if (data.motion != null) SEN.motion = data.motion;

            // Live bi-directional physical relay/switch sync
            if (data.id && S[data.id]) {
              const { id, ...props } = data;
              Object.assign(S[id], props);
              saveState();
              render(false);
            }
          } catch (e) {}
        });

        mqttClient.on('error', () => {
          if (netStatus) netStatus.textContent = '❌ เชื่อมต่อล้มเหลว ตรวจสอบ URL หรืออินเทอร์เน็ต';
        });
      } catch (err) {
        if (netStatus) netStatus.textContent = '❌ รูปแบบ URL MQTT ไม่ถูกต้อง';
      }
    };
  }

  const btnBLE = document.getElementById('btnBLE');
  if (btnBLE) btnBLE.onclick = connectUART;

  document.querySelectorAll('.dpad-btn, .k').forEach(btn => {
    btn.onclick = () => {
      const cmd = btn.dataset.cmd;
      if (!cmd) return;
      if (navigator.vibrate) navigator.vibrate(35);
      const payload = { cmd, at: Date.now() };

      if (mqttClient && mqttClient.connected) {
        mqttClient.publish(mqttTopic, JSON.stringify(payload));
      }

      sendBLE(cmd);

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
  if (!navigator.bluetooth) return alert('เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth');
  try {
    const dev = await navigator.bluetooth.requestDevice({
      filters: [{ services: [UART_SVC] }],
      optionalServices: [UART_SVC]
    });
    const server = await dev.gatt.connect();
    const svc = await server.getPrimaryService(UART_SVC);
    uartChar = await svc.getCharacteristic(UART_RX);
    if (netStatus) netStatus.textContent = `✅ เชื่อมต่อ BLE กับ "${dev.name}" สำเร็จ`;
    toast(`เชื่อมต่อ BLE "${dev.name}" เรียบร้อยแล้ว`);
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
  return `
    <div class="section-title">
      <span><i class="fa-solid fa-list-check" style="color: var(--accent-blue);"></i> บันทึกเหตุการณ์ในระบบ</span>
    </div>
    ${
      S._log.length ? S._log.map(l =>
        `<div class="log ${l.t}">${l.m}<small>${l.ts}</small></div>`).join("")
        : `<div class="log">ยังไม่มีเหตุการณ์ · ระบบกำลังบันทึกตามเวลาจริง</div>`
    }
  `;
}

/* ══════════ Canvas Camera Visualizer ══════════ */
function drawCams() {
  const c1 = document.getElementById("c1");
  if (c1 && customCamImg && customCamImg.complete && customCamImg.naturalWidth > 0) {
    const x = c1.getContext("2d");
    x.drawImage(customCamImg, 0, 0, 640, 360);
    if (SEN.motion) {
      x.strokeStyle = "#f43f5e";
      x.lineWidth = 4;
      x.strokeRect(8, 8, 624, 344);
      x.fillStyle = "#f43f5e";
      x.fillRect(8, 8, 200, 27);
      x.fillStyle = "#fff";
      x.font = "bold 14px sans-serif";
      x.fillText("⚠ MOTION DETECTED", 16, 27);
    }
    x.fillStyle = "rgba(0,0,0,.6)";
    x.fillRect(0, 330, 640, 30);
    x.fillStyle = "#fff";
    x.font = "13px monospace";
    x.fillText("● IP CAM STREAM · " + new Date().toLocaleTimeString("th-TH") + " · " + SEN.lux + " lx", 10, 350);
  } else if (c1 && liveVid && liveVid.videoWidth > 0) {
    const x = c1.getContext("2d");
    x.drawImage(liveVid, 0, 0, 640, 360);
    if (SEN.motion) {
      x.strokeStyle = "#f43f5e";
      x.lineWidth = 4;
      x.strokeRect(8, 8, 624, 344);
      x.fillStyle = "#f43f5e";
      x.fillRect(8, 8, 200, 27);
      x.fillStyle = "#fff";
      x.font = "bold 14px sans-serif";
      x.fillText("⚠ MOTION DETECTED", 16, 27);
    }
    x.fillStyle = "rgba(0,0,0,.6)";
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
  g.addColorStop(0, night ? "#090d12" : "#1e293b");
  g.addColorStop(1, night ? "#040608" : "#0f172a");
  x.fillStyle = g;
  x.fillRect(0, 0, W, Hh);
  
  x.fillStyle = night ? "#0f171e" : "#1e293b";
  x.fillRect(0, 250, W, 110);
  x.strokeStyle = night ? "#1e293b" : "#334155";
  x.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.moveTo(i * 100, 250);
    x.lineTo(i * 130 - 140, 360);
    x.stroke();
  }
  
  if (mv) {
    const t = Date.now() / 700 % 1, px = 80 + t * 440;
    x.fillStyle = "rgba(241,245,249,.85)";
    x.beginPath();
    x.arc(px, 215, 17, 0, 7);
    x.fill();
    x.fillRect(px - 15, 232, 30, 62);
    x.fillRect(px - 13, 294, 10, 42);
    x.fillRect(px + 3, 294, 10, 42);
    x.strokeStyle = "#f43f5e";
    x.lineWidth = 3;
    x.strokeRect(px - 40, 190, 80, 160);
    x.fillStyle = "#f43f5e";
    x.fillRect(px - 40, 172, 104, 18);
    x.fillStyle = "#fff";
    x.font = "bold 12px sans-serif";
    x.fillText("MOTION 98%", px - 35, 185);
  }
  
  for (let i = 0; i < 800; i++) {
    x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    x.fillRect(Math.random() * W, Math.random() * Hh, 1.5, 1.5);
  }
  x.fillStyle = "rgba(0,0,0,.6)";
  x.fillRect(0, 0, W, 30);
  x.fillStyle = "#fff";
  x.font = "14px monospace";
  x.fillText(new Date().toLocaleString("th-TH"), 12, 20);
  x.fillStyle = "#f43f5e";
  x.beginPath();
  x.arc(W - 24, 15, 6, 0, 7);
  x.fill();
  x.fillStyle = "#fff";
  x.font = "bold 12px sans-serif";
  x.fillText("REC", W - 62, 20);
  
  if (night) {
    x.fillStyle = "rgba(16,185,129,.05)";
    x.fillRect(0, 0, W, Hh);
    x.fillStyle = "#10b981";
    x.font = "12px monospace";
    x.fillText("● NIGHT VISION ON", 12, Hh - 14);
  }
}

/* ══════════ Canvas Energy Chart Renderer ══════════ */
function drawChart() {
  const cv = document.getElementById("ch");
  if (!cv) return;
  const x = cv.getContext("2d"), W = 700, Hh = 330, P = 40;
  const mx = Math.max(...S._kwh.map(d => d.v), 1) * 1.25;
  
  x.clearRect(0, 0, W, Hh);
  x.strokeStyle = "rgba(255,255,255,0.08)";
  x.lineWidth = 1;
  x.font = "12px Prompt, sans-serif";
  
  for (let i = 0; i <= 4; i++) {
    const y = Hh - P - (Hh - P * 2) * i / 4;
    x.beginPath();
    x.moveTo(P, y);
    x.lineTo(W - 10, y);
    x.stroke();
    x.fillStyle = "#64748b";
    x.fillText((mx * i / 4).toFixed(1), 6, y + 4);
  }
  
  const bw = (W - P - 20) / 7;
  S._kwh.forEach((d, i) => {
    const h = (Hh - P * 2) * (d.v / mx), bx = P + 10 + i * bw, by = Hh - P - h;
    const g = x.createLinearGradient(0, by, 0, Hh - P);
    g.addColorStop(0, i === 6 ? "#f59e0b" : "#6366f1");
    g.addColorStop(1, i === 6 ? "#d97706" : "#4338ca");
    x.fillStyle = g;
    x.beginPath();
    if (x.roundRect) x.roundRect(bx, by, bw - 14, h, 8); else x.rect(bx, by, bw - 14, h);
    x.fill();
    x.fillStyle = "#94a3b8";
    x.textAlign = "center";
    x.fillText(d.d, bx + (bw - 14) / 2, Hh - P + 18);
    x.fillStyle = "#fff";
    x.font = "bold 12px Prompt, sans-serif";
    x.fillText(d.v.toFixed(1), bx + (bw - 14) / 2, by - 7);
    x.font = "12px Prompt, sans-serif";
    x.textAlign = "left";
  });
}

/* ══════════ Events Binding ══════════ */
function bindEvents() {
  const btnSaveCam = document.getElementById('btnSaveCamStream');
  if (btnSaveCam) {
    btnSaveCam.onclick = () => {
      const inputEl = document.getElementById('camStreamInput');
      if (inputEl) {
        camStreamUrl = inputEl.value.trim();
        localStorage.setItem('cam_stream_url', camStreamUrl);
        loadCustomCamStream(camStreamUrl);
        toast(camStreamUrl ? '📡 บันทึกลิงก์สตรีมกล้องแล้ว' : '⚪ ยกเลิกการเชื่อมสตรีมกล้องแล้ว');
        render(true);
      }
    };
  }

  const btnRealBack = document.getElementById('btnStartRealCamBack');
  if (btnRealBack) {
    btnRealBack.onclick = () => {
      camStreamUrl = '';
      localStorage.removeItem('cam_stream_url');
      customCamImg = null;
      initCam('environment');
    };
  }

  const btnRealFront = document.getElementById('btnStartRealCamFront');
  if (btnRealFront) {
    btnRealFront.onclick = () => {
      camStreamUrl = '';
      localStorage.removeItem('cam_stream_url');
      customCamImg = null;
      initCam('user');
    };
  }

  document.querySelectorAll(".room-tabs .tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".room-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRoom = btn.dataset.room;
      render(true);
    };
  });

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
      const sub = el.parentNode.parentNode.querySelector(".device-sub");
      if (sub) sub.textContent = `${DEVICES.find(d=>d.id===el.dataset.bri).room} • เปิดอยู่ · ${e.target.value}%`;
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
        toast("📍 บันทึกตำแหน่งบ้านเรียบร้อยแล้ว");
        logEvent("ตั้งตำแหน่งบ้านใหม่", "ok");
      }, () => toast("ไม่สามารถอ่านตำแหน่งได้"));
    }
  };

  Object.keys(actions).forEach(k => {
    const el = document.querySelector(`[data-act="${k}"]`);
    if (el) el.onclick = actions[k];
  });

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

document.querySelectorAll(".bottom-nav .nav-item").forEach(n => n.onclick = () => {
  V = n.dataset.v;
  render();
  if (navigator.vibrate) navigator.vibrate(12);
  window.scrollTo(0, 0);
});

/* ══════════ Hardware Sensors ══════════ */
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

async function initCam(facing = "environment") {
  try {
    if (liveVid && liveVid.srcObject) {
      liveVid.srcObject.getTracks().forEach(track => track.stop());
    }
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    const v = document.createElement("video");
    v.srcObject = st;
    v.playsInline = true;
    v.muted = true;
    await v.play();
    liveVid = v;
    toast(`📷 เปิดกล้องจริงสำเร็จแล้ว [${facing === "user" ? "กล้องหน้า" : "กล้องหลัง"}]`);
    logEvent(`เปิดใช้งานกล้องจริงสดๆ (${facing})`, "ok");
    render(true);
    
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 48;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    
    setInterval(() => {
      if (!v || v.videoWidth === 0) return;
      cx.drawImage(v, 0, 0, 64, 48);
      const d = cx.getImageData(0, 0, 64, 48).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) {
        s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      }
      PHONE.lux = Math.round(s / (d.length / 4) / 255 * 1000);
    }, 700);
  } catch (e) {
    toast("⚠️ ไม่สามารถเปิดกล้องได้ โปรดยินยอมสิทธิ์กล้องบนเบราว์เซอร์");
    logEvent("ไม่ได้รับสิทธิ์กล้อง · ใช้ค่าจำลองแทน", "warn");
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

/* ══════════ Voice Recognition Engine ══════════ */
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
    toast("เบราว์เซอร์นี้ไม่รองรับระบบแยกแยะเสียงพูด พิมพ์แทนได้ครับ");
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
    toast("🎤 เปิดการรับคำสั่งเสียงภาษาไทยแล้ว");
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

/* ══════════ PWA Setup ══════════ */
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

/* ══════════ Modal Permission Events ══════════ */
const goBtn = document.getElementById("go");
if (goBtn) {
  goBtn.onclick = async () => {
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
    document.getElementById("perm")?.remove();
    logEvent("เชื่อมต่อเซ็นเซอร์มือถือสำเร็จ", "ok");
    toast("📱 ใช้เซ็นเซอร์จริงจากมือถือแล้ว");
    render();
  };
}

const skipBtn = document.getElementById("skip");
if (skipBtn) {
  skipBtn.onclick = () => {
    document.getElementById("perm")?.remove();
    render();
  };
}

setInterval(() => {
  tickSensors();
  runRules();
  S._kwh[6].v = +(S._kwh[6].v + powerNow() / 1000 * (2 / 3600)).toFixed(4);
  saveState();
  if (!drag && V !== "remote" && document.visibilityState === "visible") render();
}, 2000);

setInterval(() => {
  if (V === "cam" && document.visibilityState === "visible") drawCams();
}, 120);

tickSensors();
render();
logEvent("ระบบเริ่มทำงาน", "ok");