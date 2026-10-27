const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 4560; // 456 Hijriyyah - Wafat Imam Ibn Hazm
const HOST = '0.0.0.0'; // Binds to all interfaces (localhost, 127.0.0.1, LAN)
const BASE_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // 1. CORS Pre-flight Options
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end();
    return;
  }

  // 2. Turath API Reverse Proxy (Bypasses Browser CORS)
  if (req.url.startsWith('/api/turath/')) {
    const targetPath = req.url.replace('/api/turath', '');
    const targetUrl = 'https://api.turath.io' + targetPath;

    https.get(targetUrl, {
      headers: {
        'Origin': 'https://app.turath.io',
        'Referer': 'https://app.turath.io/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('[Turath Proxy Error]:', err.message);
      res.writeHead(502, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Gagal terhubung ke Turath API', details: err.message }));
    });
    return;
  }

  // 3. Serve Static Files
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(BASE_DIR, reqPath);

  // Security check: ensure path is inside BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  const browserUrl = `http://127.0.0.1:${PORT}`;
  console.log(`================================================================`);
  console.log(`  Mausu'ah Ikhtiyarat Ibn Hazm al-Fiqhiyyah - Al-Muhalla`);
  console.log(`  Server aktif berjalan di:`);
  console.log(`  -> ${browserUrl}`);
  console.log(`  -> http://localhost:${PORT}`);
  console.log(`  Proxy Turath API aktif di: /api/turath/`);
  console.log(`  Membuka browser otomatis ke: ${browserUrl} ...`);
  console.log(`  (Jangan tutup jendela ini selama menggunakan aplikasi)`);
  console.log(`================================================================`);

  // Buka browser hanya setelah server dipastikan siap menerima koneksi
  const startCmd = process.platform === 'win32' ? `start "" "${browserUrl}"` : `open "${browserUrl}"`;
  exec(startCmd, (err) => {
    if (err) console.log('Silakan buka manual di browser:', browserUrl);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Periksa apakah server yang sedang berjalan adalah aplikasi kita sendiri
    http.get(`http://127.0.0.1:${PORT}/index.html`, (res) => {
      if (res.statusCode === 200) {
        const browserUrl = `http://127.0.0.1:${PORT}`;
        console.log(`================================================================`);
        console.log(`  [INFO] Server sudah aktif berjalan di: ${browserUrl}`);
        console.log(`  Membuka browser otomatis ke: ${browserUrl} ...`);
        console.log(`================================================================`);
        const startCmd = process.platform === 'win32' ? `start "" "${browserUrl}"` : `open "${browserUrl}"`;
        exec(startCmd);
        return;
      }
      const nextPort = PORT + 1;
      console.error(`[PERINGATAN] Port ${PORT} sedang dipakai. Mencoba port ${nextPort}...`);
      server.listen(nextPort, HOST);
    }).on('error', () => {
      const nextPort = PORT + 1;
      console.error(`[PERINGATAN] Port ${PORT} sedang dipakai. Mencoba port ${nextPort}...`);
      server.listen(nextPort, HOST);
    });
  } else {
    console.error('[ERROR] Server gagal dijalankan:', err);
  }
});
