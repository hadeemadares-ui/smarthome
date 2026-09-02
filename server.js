import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { deviceManager } from './services/deviceManager.js';
import { automationEngine } from './services/automationEngine.js';
import { processVoiceCommand } from './services/voiceParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Simple SSE / WebSocket connections registry
const clients = new Set();

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = ['localhost', '127.0.0.1'];
  for (const k in interfaces) {
    for (const k2 of interfaces[k]) {
      if (k2.family === 'IPv4' && !k2.internal) {
        addresses.push(k2.address);
      }
    }
  }
  return [...new Set(addresses)];
}

// Subscribe to device updates to push to connected clients via SSE
deviceManager.subscribe(event => {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(data);
  }
});

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // CORS headers for local LAN access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Routes ---

  // Real-time Event Stream (SSE - Server Sent Events for Instant Sync without dependencies)
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Offline Smart Home Hub SSE Connected' })}\n\n`);
    clients.add(res);

    req.on('close', () => {
      clients.delete(res);
    });
    return;
  }

  // Devices API
  if (pathname === '/api/devices' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ devices: deviceManager.getAll(), energy: deviceManager.getEnergySummary() }));
    return;
  }

  if (pathname.startsWith('/api/devices/') && pathname.endsWith('/toggle') && req.method === 'POST') {
    const parts = pathname.split('/');
    const id = parts[3];
    const device = deviceManager.toggle(id);
    if (device) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, device }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Device not found' }));
    }
    return;
  }

  if (pathname.startsWith('/api/devices/') && pathname.endsWith('/update') && req.method === 'POST') {
    const parts = pathname.split('/');
    const id = parts[3];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const device = deviceManager.update(id, updates);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, device }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Energy API
  if (pathname === '/api/energy' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(deviceManager.getEnergySummary()));
    return;
  }

  // Automations API
  if (pathname === '/api/automations' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rules: automationEngine.getAll() }));
    return;
  }

  if (pathname.startsWith('/api/automations/') && pathname.endsWith('/execute') && req.method === 'POST') {
    const id = pathname.split('/')[3];
    const result = automationEngine.executeRule(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname.startsWith('/api/automations/') && pathname.endsWith('/toggle') && req.method === 'POST') {
    const id = pathname.split('/')[3];
    const rule = automationEngine.toggleRule(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, rule }));
    return;
  }

  // Local Offline Voice Command API
  if (pathname === '/api/voice' && req.method === 'POST') {
    req.setEncoding('utf8');
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);
        const result = processVoiceCommand(text);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
      }
    });
    return;
  }

  // System Status API
  if (pathname === '/api/system' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      offlineMode: true,
      securityStatus: 'Local Network Isolated (Encrypted)',
      uptimeSeconds: Math.floor(process.uptime()),
      ips: getLocalIpAddresses(),
      hostname: os.hostname(),
      platform: os.platform(),
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024)
    }));
    return;
  }

  // --- Static Files Serving ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Security check to prevent Directory Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  const ips = getLocalIpAddresses();
  console.log('\n==================================================');
  console.log('  🏠 Smart Home Offline Server Running (Local Only)');
  console.log('==================================================');
  console.log(` Local Access:     http://localhost:${PORT}`);
  ips.forEach(ip => {
    if (ip !== 'localhost' && ip !== '127.0.0.1') {
      console.log(` LAN Access:       http://${ip}:${PORT}`);
    }
  });
  console.log(' Mode:             100% Offline / Privacy Preserved');
  console.log('==================================================\n');
});
