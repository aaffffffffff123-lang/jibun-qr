/* 평택 상온 지번 QR — 오프라인 저장 (깃허브 버전 전용)
   한 번 열어 둔 폰은 깃허브가 막힌 회사 와이파이에서도 저장본으로 열린다.
   - 화면(index.html): 인터넷 되면 새 버전, 안 되면(막히면) 저장본
   - 엔진 파일(바코드·숫자 읽기): 저장본 우선 */
var CACHE = 'jibunqr-v1';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* 화면이 처음 열릴 때 엔진 파일을 미리 받아 둔다 (와이파이에서 바로 쓰려고) */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type !== 'warm' || !Array.isArray(d.files)) return;
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return d.files.reduce(function (p, f) {
      return p.then(function () {
        return c.match(f).then(function (hit) {
          if (hit) return;
          return fetch(f).then(function (r) { if (r.ok) return c.put(f, r); });
        }).catch(function () {});
      });
    }, Promise.resolve());
  }));
});
function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); }); }
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (isPage) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      /* 회사망이 막으면서 '접속 차단' 안내 페이지를 대신 보내 주는 경우가 있어서,
         받은 화면이 이 앱이 맞는지 확인하고 아니면 저장본을 쓴다 */
      var net = fetch(req).then(function (r) {
        if (!r || !r.ok) throw new Error('bad');
        return r.clone().text().then(function (t) {
          if (t.indexOf('ptqr_hist_v1') < 0) throw new Error('not-app');
          c.put('./index.html', r.clone());
          return r;
        });
      });
      net.catch(function () {});
      return Promise.race([net, timeout(3500)]).catch(function () {
        return c.match('./index.html').then(function (hit) { return hit || net; });
      });
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) { if (r && r.ok && r.type === 'basic') c.put(req, r.clone()); return r; });
    });
  }));
});
