// App State
let devices = [];
let automations = [];
let currentRoom = 'all';
let isDarkTheme = true;

// DOM Elements
const devicesContainer = document.getElementById('devicesContainer');
const automationsContainer = document.getElementById('automationsContainer');
const totalWattsEl = document.getElementById('totalWatts');
const activeDevicesCountEl = document.getElementById('activeDevicesCount');
const dailyBahtEl = document.getElementById('dailyBaht');
const securityStateEl = document.getElementById('securityState');
const voiceTextInput = document.getElementById('voiceTextInput');
const sendVoiceBtn = document.getElementById('sendVoiceBtn');
const micBtn = document.getElementById('micBtn');
const voiceFeedback = document.getElementById('voiceFeedback');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const systemIpList = document.getElementById('systemIpList');

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW reg error:', err));
  });
}

// Theme Toggle
themeToggleBtn.addEventListener('click', () => {
  isDarkTheme = !isDarkTheme;
  document.body.classList.toggle('light-theme', !isDarkTheme);
  themeToggleBtn.innerHTML = isDarkTheme
    ? '<i class="fa-solid fa-moon"></i> โหมดมืด'
    : '<i class="fa-solid fa-sun"></i> โหมดสว่าง';
});

// Room Filter Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRoom = btn.dataset.room;
    renderDevices();
  });
});

// Initialize Data
async function initApp() {
  await fetchDevices();
  await fetchAutomations();
  await fetchSystemInfo();
  setupSSE();
}

async function fetchDevices() {
  try {
    const res = await fetch('/api/devices');
    const data = await res.json();
    devices = data.devices;
    updateEnergySummary(data.energy);
    renderDevices();
  } catch (err) {
    console.error('Error fetching devices:', err);
  }
}

async function fetchAutomations() {
  try {
    const res = await fetch('/api/automations');
    const data = await res.json();
    automations = data.rules;
    renderAutomations();
  } catch (err) {
    console.error('Error fetching automations:', err);
  }
}

async function fetchSystemInfo() {
  try {
    const res = await fetch('/api/system');
    const data = await res.json();
    if (data.ips) {
      systemIpList.innerHTML = data.ips.map(ip => `<code>http://${ip}:3000</code>`).join(' &nbsp;•&nbsp; ');
    }
  } catch (err) {
    console.error('Error fetching system info:', err);
  }
}

// Setup Real-time Server Sent Events (SSE)
function setupSSE() {
  const eventSource = new EventSource('/api/events');
  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'DEVICE_UPDATE') {
        const idx = devices.findIndex(d => d.id === payload.device.id);
        if (idx !== -1) {
          devices[idx] = payload.device;
        }
        if (payload.energy) updateEnergySummary(payload.energy);
        renderDevices();
      }
    } catch (e) {
      console.error('Error parsing SSE:', e);
    }
  };
}

// Update Summary Widgets
function updateEnergySummary(energy) {
  if (!energy) return;
  totalWattsEl.textContent = `${energy.totalWatts} W`;
  activeDevicesCountEl.textContent = `${energy.activeDevicesCount} / ${devices.length}`;
  dailyBahtEl.textContent = `฿${energy.estimatedDailyBaht}`;

  const alarmDev = devices.find(d => d.id === 'security_alarm');
  const lockDev = devices.find(d => d.id === 'lock_front_door');
  
  if (alarmDev && alarmDev.state === 'on') {
    securityStateEl.textContent = lockDev && lockDev.locked ? 'ปลอดภัย (ล็อคแน่นหนา)' : 'แจ้งเตือน (ประตูเปิดอยู่)';
    securityStateEl.style.color = lockDev && lockDev.locked ? 'var(--accent-green)' : 'var(--accent-amber)';
  } else {
    securityStateEl.textContent = 'ปิดระบบแจ้งเตือน';
    securityStateEl.style.color = 'var(--text-muted)';
  }
}

// Render Device Cards
function renderDevices() {
  const filtered = currentRoom === 'all' 
    ? devices 
    : devices.filter(d => d.room === currentRoom);

  devicesContainer.innerHTML = '';

  filtered.forEach(dev => {
    const isON = dev.state === 'on' || dev.locked === true;
    const card = document.createElement('div');
    card.className = `device-card ${isON ? 'active' : ''}`;

    let controlHtml = '';

    if (dev.type === 'light') {
      controlHtml = `
        <div style="margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
            <span>ความสว่าง</span>
            <span>${dev.brightness}%</span>
          </div>
          <input type="range" class="range-slider" min="10" max="100" value="${dev.brightness}" 
                 onchange="updateDeviceProperty('${dev.id}', { brightness: parseInt(this.value) })">
        </div>
      `;
    } else if (dev.type === 'climate') {
      controlHtml = `
        <div style="margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">อุณหภูมิปัจจุบัน: ${dev.currentTemp}°C</span>
            <span style="font-weight: 700; color: var(--accent-blue);">${dev.targetTemp}°C</span>
          </div>
          <input type="range" class="range-slider" min="18" max="30" value="${dev.targetTemp}" 
                 onchange="updateDeviceProperty('${dev.id}', { targetTemp: parseInt(this.value) })">
        </div>
      `;
    } else if (dev.type === 'lock') {
      controlHtml = `
        <div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted);">
          สถานะ: <strong style="color: ${dev.locked ? 'var(--accent-green)' : 'var(--accent-red)'}">${dev.locked ? 'ล็อคแล้ว' : 'ปลดล็อค'}</strong> (แบตเตอรี่ ${dev.battery}%)
        </div>
      `;
    } else if (dev.type === 'sensor') {
      controlHtml = `
        <div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted);">
          สถานะตรวจจับ: <strong style="color: ${dev.presence ? 'var(--accent-green)' : 'var(--text-muted)'}">${dev.presence ? 'พบการเคลื่อนไหว' : 'ปกติ'}</strong>
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="device-card-header">
          <div class="device-icon-box">
            <i class="fa-solid ${dev.icon}"></i>
          </div>
          <label class="switch">
            <input type="checkbox" ${isON ? 'checked' : ''} onchange="toggleDeviceState('${dev.id}')">
            <span class="slider"></span>
          </label>
        </div>
        <div class="device-title">${dev.name}</div>
        <div class="device-sub">${getRoomLabel(dev.room)}</div>
      </div>
      <div class="device-controls-area">
        ${controlHtml}
      </div>
    `;

    devicesContainer.appendChild(card);
  });
}

function getRoomLabel(roomKey) {
  const map = {
    living_room: 'ห้องรับแขก',
    bedroom: 'ห้องนอน',
    entrance: 'ประตูหน้าบ้าน',
    security: 'ระบบรักษาความปลอดภัย'
  };
  return map[roomKey] || roomKey;
}

// Toggle Device API
async function toggleDeviceState(id) {
  try {
    await fetch(`/api/devices/${id}/toggle`, { method: 'POST' });
  } catch (err) {
    console.error('Failed to toggle device:', err);
  }
}

// Update Device Property API
async function updateDeviceProperty(id, updates) {
  try {
    await fetch(`/api/devices/${id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  } catch (err) {
    console.error('Failed to update device:', err);
  }
}

// Render Automations
function renderAutomations() {
  automationsContainer.innerHTML = '';
  automations.forEach(rule => {
    const card = document.createElement('div');
    card.className = 'automation-card';
    card.innerHTML = `
      <div>
        <h4 style="font-size: 1rem; margin-bottom: 4px;">${rule.name}</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted);">${rule.description}</p>
      </div>
      <button class="automation-btn" onclick="runAutomation('${rule.id}')">
        <i class="fa-solid fa-play"></i> เรียกใช้
      </button>
    `;
    automationsContainer.appendChild(card);
  });
}

async function runAutomation(id) {
  try {
    const res = await fetch(`/api/automations/${id}/execute`, { method: 'POST' });
    const data = await res.json();
    showVoiceFeedback(`เปิดใช้งาน ${data.ruleName} สำเร็จ`);
  } catch (err) {
    console.error('Failed to execute rule:', err);
  }
}

// Voice Command Handlers
sendVoiceBtn.addEventListener('click', () => {
  const text = voiceTextInput.value.trim();
  if (text) {
    sendVoiceCommand(text);
    voiceTextInput.value = '';
  }
});

voiceTextInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendVoiceBtn.click();
  }
});

async function sendVoiceCommand(text) {
  showVoiceFeedback(`กำลังประมวลผล: "${text}"...`);
  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    showVoiceFeedback(data.message, data.success);
  } catch (err) {
    showVoiceFeedback('เกิดข้อผิดพลาดในการส่งคำสั่งเสียง', false);
  }
}

function showVoiceFeedback(msg, isSuccess = true) {
  voiceFeedback.style.display = 'block';
  voiceFeedback.style.backgroundColor = isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  voiceFeedback.style.color = isSuccess ? 'var(--accent-green)' : 'var(--accent-red)';
  voiceFeedback.innerHTML = `<i class="fa-solid ${isSuccess ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> ${msg}`;
}

// Local Speech Recognition (Web Speech API)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'th-TH';
  recognition.continuous = false;

  micBtn.addEventListener('click', () => {
    micBtn.classList.add('listening');
    showVoiceFeedback('กำลังฟังคำสั่งเสียง... (เช่น "เปิดไฟห้องรับแขก")', true);
    recognition.start();
  });

  recognition.onresult = (event) => {
    micBtn.classList.remove('listening');
    const transcript = event.results[0][0].transcript;
    voiceTextInput.value = transcript;
    sendVoiceCommand(transcript);
  };

  recognition.onerror = () => {
    micBtn.classList.remove('listening');
    showVoiceFeedback('ไม่สามารถรับเสียงได้ กรุณาพิมพ์คำสั่งแทน', false);
  };

  recognition.onend = () => {
    micBtn.classList.remove('listening');
  };
} else {
  micBtn.addEventListener('click', () => {
    alert('เบราว์เซอร์นี้ไม่รองรับ Speech Recognition API สามารถพิมพ์คำสั่งภาษาไทยในช่องข้อความได้ครับ');
  });
}

// App Launch
window.addEventListener('DOMContentLoaded', initApp);
