document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  const devicesContainer = document.getElementById('devices-container');
  const powerDisplay = document.getElementById('power-display');
  const totalPowerVal = document.getElementById('total-power-val');
  const costEstimate = document.getElementById('energy-cost-estimate');
  const connectionStatus = document.getElementById('connection-status');
  const voiceBtn = document.getElementById('voice-btn');
  const voiceToast = document.getElementById('voice-toast');
  const voiceText = document.getElementById('voice-text');
  const btnToggleCam = document.getElementById('btn-toggle-cam');
  const videoEl = document.getElementById('webcam');
  const motionAlert = document.getElementById('motion-alert');
  const luxVal = document.getElementById('lux-val');
  const nvBadge = document.getElementById('nv-badge');

  let cameraActive = false;
  let videoStream = null;

  // 1. โหลดข้อมูลอุปกรณ์และการใช้ไฟ
  async function loadData() {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      renderDevices(data.devices);
      renderEnergy(data.energy);
      connectionStatus.innerText = '100% Offline • SSE ซิงก์สมบูรณ์';
    } catch (err) {
      connectionStatus.innerText = 'ขาดการเชื่อมต่อกับเซิร์ฟเวอร์';
    }
  }

  function renderDevices(devices = []) {
    document.getElementById('device-count-label').innerText = `${devices.length} เครื่อง`;
    devicesContainer.innerHTML = devices.map(d => {
      const icon = d.type === 'light' ? 'lightbulb' : d.type === 'ac' ? 'wind' : d.type === 'fan' ? 'fan' : 'tv';
      return `
        <div class="device-card ${d.state ? 'is-on' : ''}" onclick="toggleDevice('${d.id}')">
          <div class="icon-box"><i data-lucide="${icon}"></i></div>
          <div>
            <div class="device-name">${d.name}</div>
            <div class="device-meta">${d.room} • ${d.state ? 'เปิดอยู่ (' + d.powerWatts + 'W)' : 'ปิด'}</div>
          </div>
        </div>
      `;
    }).join('');
    if (window.lucide) lucide.createIcons();
  }

  function renderEnergy(energy) {
    if (!energy) return;
    powerDisplay.innerHTML = `${energy.currentWatts} <small>Watts</small>`;
    totalPowerVal.innerText = `${energy.currentWatts} W`;
    costEstimate.innerText = `~${energy.estimatedDailyCost} บาท / วัน (${energy.dailyKwh} kWh)`;
    if (energy.history7Days) drawSparkline('energySparkline', energy.history7Days);
  }

  // 2. การสลับสถานะอุปกรณ์ (Optimistic UI)
  window.toggleDevice = async function(id) {
    try {
      await fetch(`/api/devices/${id}/toggle`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  // 3. ปรับโหมด Preset (Scenes)
  document.querySelectorAll('.scene-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.scene-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const scene = btn.dataset.scene;
      await fetch(`/api/automations/${scene}/execute`, { method: 'POST' });
      loadData();
    });
  });

  // 4. สั่งงานด้วยเสียงภาษาไทยแบบ Local Web Speech API
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognizer = new SpeechRecognition();
    recognizer.lang = 'th-TH';
    recognizer.continuous = false;

    voiceBtn.addEventListener('click', () => {
      voiceBtn.classList.add('recording');
      voiceToast.classList.remove('hidden');
      voiceText.innerText = 'กำลังฟังคำสั่งของคุณ...';
      recognizer.start();
    });

    recognizer.onresult = async (e) => {
      const command = e.results[0][0].transcript;
      voiceText.innerText = `"${command}"`;
      try {
        const res = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: command })
        });
        const result = await res.json();
        voiceText.innerText = result.reply;
        setTimeout(() => voiceToast.classList.add('hidden'), 3500);
      } catch (err) {
        voiceText.innerText = 'ประมวลผลคำสั่งไม่สำเร็จ';
      }
    };

    recognizer.onend = () => voiceBtn.classList.remove('recording');
  } else {
    voiceBtn.style.display = 'none';
  }

  // 5. กล้องและคำนวณแสงสว่างสด (Local Hardware Sensor Integration)
  btnToggleCam.addEventListener('click', async () => {
    if (!cameraActive) {
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        videoEl.srcObject = videoStream;
        cameraActive = true;
        btnToggleCam.innerHTML = '<i data-lucide="video-off"></i> ปิดกล้อง';
        startSensorAnalysis();
      } catch (err) {
        alert('ไม่สามารถเข้าถึงกล้องได้: ' + err.message);
      }
    } else {
      if (videoStream) videoStream.getTracks().forEach(t => t.stop());
      videoEl.srcObject = null;
      cameraActive = false;
      btnToggleCam.innerHTML = '<i data-lucide="camera"></i> เปิดกล้องสด';
    }
    if (window.lucide) lucide.createIcons();
  });

  function startSensorAnalysis() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    setInterval(() => {
      if (!cameraActive || videoEl.readyState !== 4) return;
      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(videoEl, 0, 0, 160, 120);
      const imgData = ctx.getImageData(0, 0, 160, 120).data;
      let totalLuma = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        totalLuma += 0.299 * imgData[i] + 0.587 * imgData[i+1] + 0.114 * imgData[i+2];
      }
      const avgLux = Math.round((totalLuma / (imgData.length / 4)) * 2);
      luxVal.innerText = `ความสว่าง: ${avgLux} lx`;

      if (avgLux < 80) {
        nvBadge.innerText = 'Night Vision Auto';
        nvBadge.classList.add('nv-active');
      } else {
        nvBadge.innerText = 'Light Mode';
        nvBadge.classList.remove('nv-active');
      }
    }, 1500);
  }

  // 6. วาดกราฟ Sparkline 7 วัน
  function drawSparkline(canvasId, points) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...points), max = Math.max(...points);
    const step = w / (points.length - 1);

    ctx.beginPath();
    points.forEach((val, i) => {
      const x = i * step;
      const y = h - ((val - min) / (max - min || 1)) * (h - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.lineTo(w, h); ctx.lineTo(0, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // 7. เชื่อมต่อ Server-Sent Events (SSE) Real-time Sync
  const sse = new EventSource('/api/events');
  sse.onmessage = (msg) => {
    try {
      const payload = JSON.parse(msg.data);
      if (payload.type === 'DEVICE_UPDATED' || payload.type === 'CONNECTED') {
        loadData();
      }
    } catch (e) {}
  };

  loadData();
});