import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { default: handler } = await import('./dist/server/server.js');

const port = Number(process.env.PORT || 8081);
const host = '0.0.0.0';

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

async function tryServeStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const isPublicImage = [
    '/elimusphere-logo.png',
    '/founder-joseph-wandera.jpg',
    '/founder-stephen-owiti-omondi.png',
  ].includes(pathname);
  if (!pathname.startsWith('/assets/') && !isPublicImage && pathname !== '/favicon.ico') {
    return false;
  }

  const candidates = [];
  if (pathname.startsWith('/assets/')) {
    candidates.push(path.join(__dirname, 'dist', 'client', pathname.replace(/^\//, '')));
  } else {
    candidates.push(path.join(__dirname, 'dist', 'client', pathname.replace(/^\//, '')));
    candidates.push(path.join(__dirname, 'public', pathname.replace(/^\//, '')));
  }

  for (const candidate of candidates) {
    try {
      const filePath = path.resolve(candidate);
      const allowedRoot = path.resolve(__dirname, 'dist', 'client');
      const publicRoot = path.resolve(__dirname, 'public');
      if (!filePath.startsWith(allowedRoot) && !filePath.startsWith(publicRoot)) {
        continue;
      }
      const file = await fs.readFile(filePath);
      res.statusCode = 200;
      res.setHeader('content-type', getContentType(filePath));
      res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      res.end(file);
      return true;
    } catch {
      // continue to next candidate
    }
  }

  return false;
}

const server = createServer(async (req, res) => {
  if (await tryServeStatic(req, res)) {
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? req : undefined,
    // Node's fetch implementation requires this when the body is a stream.
    ...(hasBody ? { duplex: 'half' } : {}),
  });

  const env = {};
  const ctx = {
    waitUntil: (promise) => {
      void promise.catch(() => undefined);
    },
  };

  try {
    const response = await handler.fetch(request, env, ctx);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/assets/')) {
      res.setHeader('cache-control', 'no-store, max-age=0, must-revalidate');
    }
    if (response.body) {
      const reader = response.body.getReader();
      const pump = () => reader.read().then(({ value, done }) => {
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        pump();
      });
      pump();
    } else {
      res.end();
    }
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Production server listening on http://${host}:${port}`);
});
