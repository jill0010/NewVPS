(function () {
  'use strict';

  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return;
  if (navigator.webdriver) return;
  if (/\/api\//.test(location.pathname)) return;

  var rr = window.rrweb;
  if (!rr || typeof rr.record !== 'function') return;

  var ENDPOINT         = '/api/r.php';
  var GATE_MS          = 8000;
  var FLUSH_MS         = 5000;
  var FLUSH_AT_BYTES   = 120000;
  var MAX_BATCH_BYTES  = 700000;
  var MAX_TOTAL_BYTES  = 6 * 1024 * 1024;
  var MAX_DURATION_MS  = 20 * 60 * 1000;

  var ls = (function () { try { var t = '__nv_t'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return localStorage; } catch (e) { return null; } })();
  var ss = (function () { try { return sessionStorage; } catch (e) { return null; } })();
  function uuid() {
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = [].map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20, 32);
  }
  var visitor = (function () {
    var k = '_nv', v = (ls && ls.getItem(k)) || (ss && ss.getItem(k));
    if (!v || !/^[0-9a-f-]{36}$/i.test(v)) { v = uuid(); try { (ls || ss) && (ls || ss).setItem(k, v); } catch (e) {} }
    return v;
  })();
  var session = (function () {
    var k = '_ns', v = ss && ss.getItem(k);
    if (!v || !/^[0-9a-f-]{36}$/i.test(v)) { v = uuid(); try { ss && ss.setItem(k, v); } catch (e) {} }
    return v;
  })();

  var buffer = [];
  var seq = 0;
  var totalBytes = 0;
  var startedAt = Date.now();
  var stopFn = null;
  var flushTimer = null;
  var sending = false;

  function evBytes(ev) { try { return JSON.stringify(ev).length; } catch (e) { return 64; } }
  function bufferBytes() { var n = 0; for (var i = 0; i < buffer.length; i++) n += evBytes(buffer[i]); return n; }

  try {
    stopFn = rr.record({
      emit: function (event) {
        buffer.push(event);
        if (pageAgeMs() >= GATE_MS && bufferBytes() >= FLUSH_AT_BYTES) flush(false);
      },
      maskAllInputs: true,
      sampling: { mousemove: 50, scroll: 150, media: 800, input: 'last' },
      recordCanvas: false,
      collectFonts: false,
      inlineStylesheet: true,
      recordAfter: 'load',
      checkoutEveryNms: 30000,
      slimDOMOptions: { comment: true, headMetaDescKeywords: true }
    });
  } catch (e) { return; }
  if (typeof stopFn !== 'function') return;

  function takeBatch() {
    if (!buffer.length) return null;
    var out = [], bytes = 0;
    while (buffer.length) {
      var s = evBytes(buffer[0]);
      if (out.length && bytes + s > MAX_BATCH_BYTES) break;
      out.push(buffer.shift()); bytes += s;
    }
    return { events: out, bytes: bytes };
  }

  function pageAgeMs() {
    try { return performance.now(); } catch (e) { return Date.now() - startedAt; }
  }

  function flush(useBeacon, force) {
    if (!force && pageAgeMs() < GATE_MS) return;
    if (sending && !useBeacon) return;
    var batch = takeBatch();
    if (!batch) return;
    var body = JSON.stringify({ v: visitor, s: session, q: seq, e: batch.events });
    seq++;
    totalBytes += batch.bytes;

    if (useBeacon && navigator.sendBeacon) {

      try { navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' })); } catch (e) {}
    } else {

      sending = true;
      fetch(ENDPOINT, {
        method: 'POST', body: body,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      }).then(function () { sending = false; }).catch(function () { sending = false; });
    }

    if (totalBytes >= MAX_TOTAL_BYTES || (Date.now() - startedAt) >= MAX_DURATION_MS) teardown(true);
  }

  function teardown(finalFlush) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (stopFn) { try { stopFn(); } catch (e) {} stopFn = null; }
    if (finalFlush) flush(true, true);
  }

  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(function () {
      if (document.visibilityState === 'visible') flush(false);
      if (stopFn) scheduleFlush();
    }, FLUSH_MS);
  }
  scheduleFlush();

  setTimeout(function () { flush(false); }, Math.max(0, GATE_MS - pageAgeMs()) + 150);

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(false); });
  window.addEventListener('pagehide', function () { teardown(true); });
  window.addEventListener('beforeunload', function () { flush(true, true); });
})();
