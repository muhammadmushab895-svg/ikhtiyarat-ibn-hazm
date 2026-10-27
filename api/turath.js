const https = require('https');

module.exports = async (req, res) => {
  // 1. Set CORS headers for browser compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 2. Resolve target path and query parameters
  const query = req.query || {};
  let targetUrl = '';

  if (query.pg || (req.url && req.url.includes('page'))) {
    const bookId = query.book_id || '767';
    const pg = query.pg || '2';
    const ver = query.ver || '3';
    targetUrl = `https://api.turath.io/page?book_id=${encodeURIComponent(bookId)}&pg=${encodeURIComponent(pg)}&ver=${encodeURIComponent(ver)}`;
  } else if (query.id || (req.url && req.url.includes('book'))) {
    const id = query.id || '767';
    const ver = query.ver || '3';
    targetUrl = `https://api.turath.io/book?id=${encodeURIComponent(id)}&include=indexes&ver=${encodeURIComponent(ver)}`;
  } else {
    // Generic fallback for any other relative path
    let cleanedPath = (req.url || '').replace(/^\/api\/turath/, '');
    if (!cleanedPath.startsWith('/')) cleanedPath = '/' + cleanedPath;
    targetUrl = `https://api.turath.io${cleanedPath}`;
  }

  // 3. Forward request with proper Turath browser headers
  try {
    const responseData = await new Promise((resolve, reject) => {
      https.get(targetUrl, {
        headers: {
          'Origin': 'https://app.turath.io',
          'Referer': 'https://app.turath.io/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      }, (proxyRes) => {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          resolve({
            statusCode: proxyRes.statusCode,
            contentType: proxyRes.headers['content-type'],
            body
          });
        });
      }).on('error', reject);
    });

    res.setHeader('Content-Type', responseData.contentType || 'application/json; charset=utf-8');
    // Edge caching for fast response across CDN nodes
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(responseData.statusCode).send(responseData.body);
  } catch (err) {
    console.error('[Vercel Turath Proxy Error]:', err.message);
    return res.status(502).json({
      error: 'تعذر الاتصال بخادم تراث الرقمي',
      details: err.message
    });
  }
};
