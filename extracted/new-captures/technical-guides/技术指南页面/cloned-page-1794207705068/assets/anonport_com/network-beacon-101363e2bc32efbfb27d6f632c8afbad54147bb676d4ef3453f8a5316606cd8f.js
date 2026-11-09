(function () {
  'use strict';

  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return;

  if (/\/api\//.test(location.pathname)) return;

  const ENDPOINT   = '/api/h.php';
  const HB_VISIBLE = 5000;
  const HB_HIDDEN  = 60000;

  const ls = (() => { try { const t = '__nv_t'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return localStorage; } catch (e) { return null; } })();
  const ss = (() => { try { return sessionStorage; } catch (e) { return null; } })();

  function uuid() {
    const buf = crypto.getRandomValues(new Uint8Array(16));
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const h = [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20, 32);
  }

  const visitor = (() => {
    const k = '_nv';
    let v = (ls && ls.getItem(k)) || (ss && ss.getItem(k));
    if (!v || !/^[0-9a-f-]{36}$/i.test(v)) {
      v = uuid();
      try { (ls || ss) && (ls || ss).setItem(k, v); } catch (e) {}
    }
    return v;
  })();
  const session = (() => {
    const k = '_ns';
    let v = ss && ss.getItem(k);
    if (!v || !/^[0-9a-f-]{36}$/i.test(v)) {
      v = uuid();
      try { ss && ss.setItem(k, v); } catch (e) {}
    }
    return v;
  })();

  var __warmTz = '';
  try { __warmTz = (Intl && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : ''; } catch (e) {}
  var __warmWgl = (function () {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return '';
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    } catch (e) { return ''; }
  })();

  var __permQuery = '';
  try {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'notifications' }).then(function (s) { __permQuery = String(s.state || ''); }).catch(function () {});
    }
  } catch (e) {}

  var __ev = { mm: 0, sc: 0, cl: 0, kd: 0, tc: 0 };
  var __visMs = 0;
  var __visSince = (document.visibilityState === 'visible') ? Date.now() : 0;
  function __visNow() { return __visMs + (__visSince ? (Date.now() - __visSince) : 0); }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { if (!__visSince) __visSince = Date.now(); }
    else if (__visSince) { __visMs += Date.now() - __visSince; __visSince = 0; }
  });
  addEventListener('mousemove',  function () { __ev.mm++; }, { passive: true });
  addEventListener('scroll',     function () { __ev.sc++; }, { passive: true });
  addEventListener('click',      function () { __ev.cl++; }, { passive: true });
  addEventListener('keydown',    function () { __ev.kd++; }, { passive: true });
  addEventListener('touchstart', function () { __ev.tc++; }, { passive: true });
  function evCounters() {
    return { mm: __ev.mm, sc: __ev.sc, cl: __ev.cl, kd: __ev.kd, tc: __ev.tc, vis: __visNow() };
  }

  var __probeCache = null;
  var __probeResent = false;
  function uaProbe() {
    const wgl = __warmWgl;
    const n = navigator;

    var uad = null;
    try {
      if (n.userAgentData) {
        uad = {
          p: String(n.userAgentData.platform || '').slice(0, 32),
          m: !!n.userAgentData.mobile,
          b: (n.userAgentData.brands || []).map(function (b) { return b.brand; }).join(',').slice(0, 120),
        };
      }
    } catch (e) {}
    var ag = [];
    try {
      const names = ['__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function', '__webdriver_script_func',
        '__webdriver_script_fn', '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate',
        '__selenium_unwrapped', '__fxdriver_unwrapped', '_Selenium_IDE_Recorder', '_selenium', 'calledSelenium',
        '_WEBDRIVER_ELEM_CACHE', 'ChromeDriverw', '__lastWatirAlert', '__lastWatirConfirm', '__lastWatirPrompt',
        '_phantom', '__nightmare', 'callPhantom', '__phantomas', 'domAutomation', 'domAutomationController',
        '__playwright__binding__', '__pwInitScripts', '__puppeteer_evaluation_script__'];
      for (var i = 0; i < names.length; i++) { if (names[i] in window) ag.push(names[i]); }
      const own = Object.getOwnPropertyNames(window);
      for (var j = 0; j < own.length; j++) {
        if (/^(cdc_|\$cdc_|\$chrome_asyncScriptInfo|__\$webdriverAsyncExecutor)/.test(own[j])) ag.push(own[j]);
      }
      const dn = Object.getOwnPropertyNames(document);
      for (var k = 0; k < dn.length; k++) {
        if (/^(\$cdc_|\$chrome_asyncScriptInfo|__webdriver|__selenium|__driver)/.test(dn[k])) ag.push('doc:' + dn[k]);
      }
    } catch (e) {}

    var cdp = false;
    try {
      const err = new Error();
      Object.defineProperty(err, 'stack', { configurable: true, get: function () { cdp = true; return ''; } });
      console.debug(err);
    } catch (e) {}
    var hf = null;
    try { hf = document.hasFocus(); } catch (e) {}
    var pn = '';
    try { pn = (typeof Notification !== 'undefined') ? String(Notification.permission) : ''; } catch (e) {}
    var rtt = -1;
    try { rtt = (n.connection && typeof n.connection.rtt === 'number') ? n.connection.rtt : -1; } catch (e) {}
    var jua = '';
    try { jua = String(n.userAgent || '').slice(0, 512); } catch (e) {}
    return {
      wd:      !!navigator.webdriver,
      plg:     (navigator.plugins ? navigator.plugins.length : 0),
      lng:     (navigator.languages ? navigator.languages.length : 0),
      wgl:     wgl.slice(0, 64),
      chr:     !!window.chrome,
      perm_ok: typeof Notification !== 'undefined',
      v:   2,
      pf:  String(n.platform || '').slice(0, 32),
      uad: uad,
      ow:  window.outerWidth, oh: window.outerHeight,
      sw:  (screen && screen.width) || 0, sh: (screen && screen.height) || 0,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      mt:  (typeof n.maxTouchPoints === 'number') ? n.maxTouchPoints : -1,
      tzo: new Date().getTimezoneOffset(),
      rtt: rtt,
      pdf: (typeof n.pdfViewerEnabled === 'boolean') ? n.pdfViewerEnabled : null,
      hc:  n.hardwareConcurrency || 0,
      dm:  n.deviceMemory || 0,
      jua: jua,
      ag:  ag.slice(0, 8),
      cdp: cdp,
      pn:  pn,
      pq:  __permQuery,
      vis: document.visibilityState,
      hf:  hf,
    };
  }

  let lastEng     = 0;
  let lastInteraction = Date.now();
  let engThisTick = 0;
  let lastPath    = location.pathname;

  let virtualPath = (typeof window.snkPresencePath === 'string' && window.snkPresencePath) ? window.snkPresencePath : '';

  let backoffMs    = 0;
  let lastFailedAt = 0;
  const BACKOFF_MAX = 60000;

  function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\\/+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function classifySource(ref, qs) {
    const utm = (qs.get('utm_source') || qs.get('source') || '').trim();
    if (utm) return utm.slice(0, 64);
    if (qs.get('gclid') || qs.get('gbraid') || qs.get('wbraid')) return 'Google';
    if (qs.get('fbclid')) return 'Facebook';
    if (qs.get('msclkid')) return 'Bing';
    if (!ref) return 'Direct';
    try {
      const h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase();
      if (!h || h === location.hostname.replace(/^www\./, '').toLowerCase()) return 'Direct';
      if (/(^|\.)google\./.test(h)) return 'Google';
      if (/(^|\.)bing\.com$/.test(h)) return 'Bing';
      if (/(^|\.)duckduckgo\.com$/.test(h)) return 'DuckDuckGo';
      if (/(^|\.)yahoo\./.test(h)) return 'Yahoo';
      if (/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/.test(h)) return 'ChatGPT';
      if (/(^|\.)perplexity\.ai$/.test(h)) return 'Perplexity';
      if (/(^|\.)reddit\.com$/.test(h)) return 'Reddit';
      if (/(^|\.)t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/.test(h)) return 'Twitter/X';
      if (/(^|\.)facebook\.com$|(^|\.)instagram\.com$/.test(h)) return 'Meta';
      if (/(^|\.)telegram\.org$|(^|\.)t\.me$/.test(h)) return 'Telegram';
      return h.slice(0, 64);
    } catch (e) {
      return 'Referral';
    }
  }

  function firstTouch() {
    const qs = new URLSearchParams(location.search || '');
    let src = readCookie('_src') || (ls && ls.getItem('_src')) || '';
    let sref = readCookie('_src_ref') || (ls && ls.getItem('_src_ref')) || '';
    let slan = readCookie('_src_land') || (ls && ls.getItem('_src_land')) || '';
    if (!src) {
      src = classifySource(document.referrer || '', qs);
      sref = (document.referrer || '').slice(0, 512);
      slan = (location.pathname + location.search).slice(0, 512);
      try {
        if (ls) {
          ls.setItem('_src', src);
          ls.setItem('_src_ref', sref);
          ls.setItem('_src_land', slan);
        }
      } catch (e) {}
    }
    return { src, sref, slan };
  }

  function normalizedClientPath(path) {
    const p = String(path || '/').split('?')[0].split('#')[0];
    return p.charAt(0) === '/' ? p : '/' + p;
  }

  var __vp = '';
  function __majVp() { __vp = window.innerWidth + 'x' + window.innerHeight; }
  addEventListener('resize', __majVp, { passive: true });

  function basePayload(evt) {
    const p = virtualPath || normalizedClientPath(location.pathname);
    const ft = firstTouch();
    return {
      evt: evt,
      v:   visitor,
      s:   session,
      p:   p,
      ref:  document.referrer || '',
      src:  ft.src,
      sref: ft.sref,
      slan: ft.slan,
      lang: navigator.language || '',
      tz:   __warmTz,
      vp:   __vp,
      idle_s: Math.max(0, Math.floor((Date.now() - lastInteraction) / 1000)),
      ev:   evCounters(),
    };
  }

  function noteFailure() {
    lastFailedAt = Date.now();
    backoffMs = Math.min(BACKOFF_MAX, backoffMs ? backoffMs * 2 : 5000);
  }

  function send(payload, useBeacon) {

    const isLeave = payload && payload.evt === 'leave';
    if (!isLeave && backoffMs > 0 && (Date.now() - lastFailedAt) < backoffMs) return;
    const body = JSON.stringify(payload);
    if (useBeacon && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        return;
      } catch (e) {}
    }
    fetch(ENDPOINT, {
      method:      'POST',
      body:        body,
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive:   true,
    }).then(r => {
      if (r.ok || r.status === 204) { backoffMs = 0; lastFailedAt = 0; }
      else noteFailure();
    }).catch(noteFailure);
  }

  function init() {
    lastInteraction = Date.now();
    const p = basePayload('init');
    try { __probeCache = uaProbe(); } catch (e) { __probeCache = null; }
    if (__probeCache) p.ua_probe = __probeCache;
    send(p, false);
    lastPath = p.p;
  }

  function ping() {
    const p = basePayload('ping');
    p.eng = engThisTick > 0 ? 1 : 0;
    engThisTick = 0;

    if (!__probeResent && __probeCache) {
      __probeResent = true;
      __probeCache.pq = __permQuery;
      p.ua_probe = __probeCache;
    }
    send(p, false);
  }

  function pageEvt(force) {
    const p = basePayload('page');
    if (!force && p.p === lastPath) return;
    lastInteraction = Date.now();
    p.idle_s = 0;
    p.ref_p = lastPath;
    lastPath = p.p;
    send(p, false);
  }

  window.snkPresencePage = function (path) {
    virtualPath = path ? normalizedClientPath(path) : '';
    pageEvt(true);
  };

  function leave() {
    send(basePayload('leave'), true);
  }

  function onEng() {
    lastInteraction = Date.now();
    engThisTick++;
    if (lastEng === 0) {
      send(basePayload('engaged'), false);
      lastEng = Date.now();
    }
  }

  let mmThrottle = 0;
  ['mousemove', 'touchstart'].forEach(t => addEventListener(t, () => {
    const n = Date.now();
    if (n - mmThrottle < 1000) return;
    mmThrottle = n;
    onEng();
  }, { passive: true }));
  ['click', 'scroll', 'keydown'].forEach(t => addEventListener(t, onEng, { passive: true }));

  let hbTimer = null;
  function scheduleHB() {
    clearTimeout(hbTimer);
    hbTimer = setTimeout(() => {
      ping();
      scheduleHB();
    }, document.visibilityState === 'visible' ? HB_VISIBLE : HB_HIDDEN);
  }
  document.addEventListener('visibilitychange', scheduleHB);

  ['pushState', 'replaceState'].forEach(fn => {
    const orig = history[fn];
    if (typeof orig !== 'function') return;
    history[fn] = function () {
      const ret = orig.apply(this, arguments);
      setTimeout(pageEvt, 0);
      return ret;
    };
  });
  addEventListener('popstate', pageEvt);

  addEventListener('pagehide', leave);
  addEventListener('beforeunload', leave);

  function start() { __majVp(); init(); scheduleHB(); }
  function startWhenIdle() {

    if (document.prerendering) { addEventListener('prerenderingchange', startWhenIdle, { once: true }); return; }
    if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 120);
  }
  if (document.readyState === 'complete') startWhenIdle();
  else addEventListener('load', startWhenIdle, { once: true });
})();
