/* Giải mã các tệp của trang sau khi người xem nhập đúng mật khẩu (khoa_pi_cong_khai.mjs). */
const MO = new Set(['', 'index.html', 'sw.js', 'khoa.json', 'robots.txt', '.nojekyll', 'README.md']);
const KIEU = { js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', css: 'text/css', html: 'text/html; charset=utf-8',
  webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', geojson: 'application/json',
  txt: 'text/plain; charset=utf-8', pmtiles: 'application/octet-stream' };
let khoaRam = null;
const moDb = () => new Promise((ok, loi) => { const r = indexedDB.open('pi-khoa', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => loi(r.error); });
async function layKhoa() {
  if (khoaRam) return khoaRam;
  try { const db = await moDb(); khoaRam = await new Promise((ok) => { const t = db.transaction('k').objectStore('k').get('khoa');
    t.onsuccess = () => ok(t.result || null); t.onerror = () => ok(null); }); } catch (e) { khoaRam = null; }
  return khoaRam;
}
async function ghiKhoa(k) {
  const db = await moDb();
  await new Promise((ok, loi) => { const t = db.transaction('k', 'readwrite'); if (k) t.objectStore('k').put(k, 'khoa'); else t.objectStore('k').delete('khoa');
    t.oncomplete = ok; t.onerror = () => loi(t.error); });
  khoaRam = k;
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => {
  const tra = e.ports && e.ports[0];
  if (e.data && e.data.type === 'khoa') {
    crypto.subtle.importKey('raw', e.data.raw, 'AES-GCM', false, ['decrypt']).then(ghiKhoa)
      .then(() => tra && tra.postMessage('ok'), (err) => tra && tra.postMessage('loi: ' + err));
  } else if (e.data && e.data.type === 'khoa-lai') {
    ghiKhoa(null).then(() => tra && tra.postMessage('ok'));
  }
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const goc = new URL('./', self.registration.scope);
  if (url.origin !== goc.origin || !url.pathname.startsWith(goc.pathname)) return;
  const rel = decodeURIComponent(url.pathname.slice(goc.pathname.length));
  if (rel.startsWith('vendor/') || (MO.has(rel) && rel !== '' && rel !== 'index.html')) return;
  e.respondWith(xuLy(rel, e.request, goc));
});
async function xuLy(rel, req, goc) {
  const k = await layKhoa();
  if (rel === '' || rel === 'index.html') { if (!k) return fetch(req); rel = 'app.html'; }
  if (!k) return new Response('Trang cần mật khẩu.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const r = await fetch(new URL(rel, goc).href, { cache: 'no-cache' });
  if (!r.ok) return r;
  const b = new Uint8Array(await r.arrayBuffer());
  try {
    const ro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, k, b.slice(12));
    const duoi = (rel.split('.').pop() || '').toLowerCase();
    return new Response(ro, { status: 200, headers: { 'Content-Type': KIEU[duoi] || 'application/octet-stream' } });
  } catch (err) {
    await ghiKhoa(null);       // khoá cũ không mở được bản mới (đổi mật khẩu): quay về trang hỏi mật khẩu
    return new Response('Khoá đã đổi, tải lại trang để nhập mật khẩu mới.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
