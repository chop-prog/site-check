// Local tool: `node server.mjs`, then open http://localhost:8784. A browser page can't read other
// sites by itself, so this small server fetches them. It listens on this computer only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, normalizeUrl } from './src/report.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8784;
const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 20_000;
const PUBLIC = new Set(['/index.html', '/style.css', '/src/main.js', '/src/report.js']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

async function readLimited(res) {
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    chunks.push(chunk);
    size += chunk.length;
    if (size > MAX_BYTES) break;
  }
  return { html: Buffer.concat(chunks).toString('utf8'), bytes: size };
}

async function check(address) {
  const started = performance.now();
  const res = await fetch(address, {
    redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) site-check', Accept: 'text/html' },
  });
  const ms = Math.round(performance.now() - started);
  if (!/html/i.test(res.headers.get('content-type') ?? '')) throw Object.assign(new Error('not-html'), { code: 'not-html' });
  const { html, bytes } = await readLimited(res);
  return analyze({ url: res.url, status: res.status, html, ms, bytes });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/check') {
    const address = normalizeUrl(url.searchParams.get('url') ?? '');
    if (!address) return json(res, 400, { error: 'Введите адрес сайта, например example.ru' });
    try {
      return json(res, 200, await check(address));
    } catch (e) {
      return json(res, 502, { error: e.code === 'not-html' ? 'По этому адресу не веб-страница.' : 'Не удалось открыть сайт. Проверьте адрес или попробуйте позже.' });
    }
  }
  const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replaceAll('\\', '/');
  if (!PUBLIC.has(path)) {
    res.writeHead(404).end();
    return undefined;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path)] });
  res.end(await readFile(join(ROOT, path)));
  return undefined;
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));
