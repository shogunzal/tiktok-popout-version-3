
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var r=document.createElement("script");r.type="text/javascript",r.async=!0,r.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(r,a)};ttq.load("DAHJ81BC77UEK70HT9N0");ttq.page();}(window,document,"ttq");
// In-app light/dark checker — client side.
// Mirrors TikTok's own detection (its in-app bundle reads the webview User-Agent):
//   /AppTheme\/(\w+)/   → "AppTheme/dark" | "AppTheme/light"   (Android)
//   /isDarkMode\/(.{1})/ → "isDarkMode/1" | "isDarkMode/0"      (iOS)
// Priority: ?theme=dark|light (testing) → User-Agent → prefers-color-scheme (live-updating).
// The worker runs the same UA check server-side so the first paint is already correct;
// this script keeps it right if the UA has no token (e.g. desktop preview) and powers ?debug=1.
(function () {
  var html = document.documentElement;
  var ua = navigator.userAgent || '';
  function fromUA(s) {
    var dark = /isDarkMode\/(.{1})/.exec(s);
    if (dark) return dark[1] === '1' ? 'dark' : 'light';
    var theme = /AppTheme\/(\w+)/i.exec(s);
    if (theme) return theme[1].toLowerCase() === 'dark' ? 'dark' : 'light';
    return null;
  }
  function fromQuery() {
    try {
      var t = new URLSearchParams(location.search).get('theme');
      return t === 'dark' || t === 'light' ? t : null;
    } catch (e) { return null; }
  }
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function fromSystem() { return mq && mq.matches ? 'dark' : 'light'; }
  function apply(theme, source) {
    html.setAttribute('data-theme', theme);
    html.setAttribute('data-theme-source', source);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121212' : '#ffffff');
  }
  var q = fromQuery(), u = fromUA(ua);
  if (q) apply(q, 'query');
  else if (u) apply(u, 'ua');
  else {
    apply(fromSystem(), 'system');
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { apply(fromSystem(), 'system'); });
    else if (mq && mq.addListener) mq.addListener(function () { apply(fromSystem(), 'system'); });
  }
  if (/[?&]debug=1(&|$)/.test(location.search)) {
    var d = document.getElementById('debug');
    if (d) {
      d.hidden = false;
      d.textContent = 'theme=' + html.getAttribute('data-theme') + ' via ' + html.getAttribute('data-theme-source') + ' · ' + ua;
    }
  }
})();

// Lander logic. One script, no inline handlers (the worker's CSP only allows the nonced script).
// Screen changes cross-fade: the old screen slides out while the new one slides in (both stay in the
// DOM for the 250ms), so a tap never shows a hard swap. Reduced motion = instant. A tap during a
// transition settles the previous one first, so rapid taps can never leave both screens hidden.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var screens = { s1: $('s1'), s2: $('s2'), s2b: $('s2b'), s3: $('s3') };
  var active = 's1';
  var pending = null; // finish() of the in-flight transition, if any
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOTION = ['enter', 'enter-back', 'leave', 'leave-back'];

  // Per-screen beacon so we see drop-off between screens. One signal per screen entry
  // (including re-entries via back button — raw counts; dedupe by cid in admin if needed).
  var __sub = '';
  try {
    var q = new URLSearchParams(location.search);
    __sub = q.get('cid') || q.get('ttclid') || q.get('sub2') || '';
  } catch (e) {}
  function stepBeacon(id) {
    try {
      var u = '/affiliate-hybrid-event?event=lander_screen_' + encodeURIComponent(id) + '&cid=' + encodeURIComponent(__sub);
      if (navigator.sendBeacon) navigator.sendBeacon(u);
      else fetch(u, { keepalive: true, cache: 'no-store' }).catch(function () {});
    } catch (e) {}
  }
  // Initial screen beacon (s1 default-active, never routed through show()).
  stepBeacon('s1');

  function clear(el) { for (var i = 0; i < MOTION.length; i++) el.classList.remove(MOTION[i]); }

  function show(id, back) {
    var from = screens[active], to = screens[id];
    if (from === to) return;
    stepBeacon(id);
    if (pending) pending();
    clear(from); clear(to);
    var content = to.querySelector('.content');
    if (content) content.scrollTop = 0;
    to.hidden = false;
    void to.offsetWidth; // commit the un-hide before the animation classes land
    active = id;
    $('back').hidden = id === 's1';

    function finish() {
      if (pending !== finish) return; // superseded or already done
      pending = null;
      if (from !== screens[active]) from.hidden = true;
      clear(from);
      clear(to);
    }
    pending = finish;
    if (reduce) {
      finish();
    } else {
      to.classList.add(back ? 'enter-back' : 'enter');
      from.classList.add(back ? 'leave-back' : 'leave');
      from.addEventListener('animationend', function onEnd(e) {
        if (e.target !== from) return;
        from.removeEventListener('animationend', onEnd);
        finish();
      });
      setTimeout(finish, 320); // safety net if the event never fires
    }
    var heading = to.querySelector('h1');
    if (heading) { try { heading.focus({ preventScroll: true }); } catch (e) {} }
  }

  $('btn-start').addEventListener('click', function () { show('s2'); });
  $('btn-yes').addEventListener('click', function () { show('s3'); });
  $('btn-no').addEventListener('click', function () { show('s3'); });
  $('btn-back18').addEventListener('click', function () { show('s2', true); });
  $('back').addEventListener('click', function () { show(active === 's3' ? 's2' : 's1', true); });

  var dl = $('download');
  dl.addEventListener('click', function () {
    try { window.ttq.track('CompleteRegistration'); } catch (e) {}
  });
  dl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
})();

;(function(){
  var el = document.getElementById("enrol-timer");
  if (!el) return;
  var KEY = "enrol_deadline_v1";
  var now = Date.now();
  var deadline;
  try {
    var saved = sessionStorage.getItem(KEY);
    if (saved) { var d = parseInt(saved, 10); if (d > now && (d - now) <= 11000000) deadline = d; }
  } catch(e) {}
  if (!deadline) {
    deadline = now + (7200 + Math.random() * 3600) * 1000;
    try { sessionStorage.setItem(KEY, String(deadline)); } catch(e) {}
  }
  function pad(n){ return (n<10?"0":"")+n; }
  var tid;
  function tick() {
    var left = deadline - Date.now();
    if (left <= 0) { el.textContent = "Final chance"; if (tid) { clearInterval(tid); tid = null; } return; }
    var h = Math.floor(left / 3600000);
    var m = Math.floor((left % 3600000) / 60000);
    var s = Math.floor((left % 60000) / 1000);
    el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
  }
  tick();
  tid = setInterval(tick, 1000);
})();