// replay-beacon.js — human-only rrweb session recorder.
// Records the visit into an in-memory buffer and, once the visitor has dwelled
// long enough to be classified 'human' by the presence pipeline, ships batches to
// the same-origin relay (which forwards to the internal service/network-api/replay.php).
// The hub persists a batch ONLY when the visitor's live status is 'human', so
// bots / crawlers / headless automation never produce a stored recording.
// Shares the exact _nv (visitor) / _ns (session) ids with network-beacon.js.
(function () {
  'use strict';

  // Never record: Do-Not-Track, automation, or internal endpoints.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return;
  if (navigator.webdriver) return;
  if (/\/api\//.test(location.pathname)) return;

  var rr = window.rrweb;
  if (!rr || typeof rr.record !== 'function') return; // recorder script missing

  var ENDPOINT         = '/api/r.php';
  var GATE_MS          = 8000;              // dwell before the first upload (past the 5s human-promotion)
  var FLUSH_MS         = 5000;              // batch cadence while the tab is visible
  var FLUSH_AT_BYTES   = 120000;            // opportunistic flush once the pending buffer grows past this
  var MAX_BATCH_BYTES  = 700000;            // never let a single POST body exceed the relay cap (800 KB)
  var MAX_TOTAL_BYTES  = 6 * 1024 * 1024;   // stop recording after ~6 MB shipped …
  var MAX_DURATION_MS  = 20 * 60 * 1000;    // … or after 20 minutes

  // ---- shared visitor / session ids (identical scheme + keys to network-beacon.js) ----
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

  // ---- recorder ----
  var buffer = [];      // events captured but not yet shipped
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
      inlineStylesheet: true,    // inline the page's own CSS so the replay is fully styled
      recordAfter: 'load',       // defer the first snapshot until all stylesheets have loaded
      checkoutEveryNms: 30000,   // periodic full snapshot -> a dropped early batch self-heals
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

  // The dwell gate counts PAGE age, not recorder age. They are different clocks:
  // presence starts counting at page load, but the recorder only starts after the
  // visitor's first interaction plus a 266 KB rrweb download -- routinely 5-15 s
  // later. Gating on recorder age therefore withheld the first upload until the
  // visit was already 15-25 s old, and because the test lived INSIDE flush() it
  // applied to the unload path too: a visitor who left before it opened lost the
  // entire buffer, full snapshot included. Measured 2026-08-25 on human sessions:
  // 1-2 interactions -> 1.1% had a stored recording; 3-10 -> 77%; 11+ -> 91%.
  // 8 s of PAGE age still clears the hub's 5 s human promotion with margin
  // (the presence init beacon fires ~0.5-2.5 s after load).
  function pageAgeMs() {
    try { return performance.now(); } catch (e) { return Date.now() - startedAt; }
  }
  // force=true is the unload/hidden path: shipping a batch the hub may reject
  // costs one 204; NOT shipping it loses the recording for good.
  function flush(useBeacon, force) {
    if (!force && pageAgeMs() < GATE_MS) return;
    if (sending && !useBeacon) return;
    var batch = takeBatch();
    if (!batch) return;
    var body = JSON.stringify({ v: visitor, s: session, q: seq, e: batch.events });
    seq++;
    totalBytes += batch.bytes;

    if (useBeacon && navigator.sendBeacon) {
      // Unload-only path. NOTE: sendBeacon (like keepalive fetch) caps the body at
      // ~64 KB, so this reliably ships only the small tail. The large initial
      // full-snapshot batch always goes out earlier via the plain fetch below.
      try { navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' })); } catch (e) {}
    } else {
      // Regular in-session flush: a PLAIN fetch (NO keepalive). The browser caps
      // keepalive request bodies at 64 KB, which would silently drop the
      // ~300-500 KB initial full-snapshot batch and the recording could never
      // start. A normal fetch has no such limit while the page is alive.
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
  // Ship the first batch (which carries the full snapshot) as soon as the dwell
  // gate opens, rather than waiting for the next 5 s tick.
  // The recorder usually starts well after the gate would have opened, so wait
  // only for whatever is LEFT of it instead of a further full GATE_MS.
  setTimeout(function () { flush(false); }, Math.max(0, GATE_MS - pageAgeMs()) + 150);

  // Tab hidden but not necessarily unloading: flush via regular fetch so a large
  // pending batch isn't lost to the 64 KB sendBeacon cap. Real unload is handled
  // by pagehide/beforeunload (small tail only).
  // NOT forced: an onglet that is merely hidden can come back, and takeBatch()
  // DRAINS the buffer -- a batch the hub rejects (visitor not yet 'human')
  // would take the full snapshot with it and the recording could only
  // restart at the next 30 s checkout. Only pagehide/beforeunload force,
  // because there the alternative is losing everything anyway.
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(false); });
  window.addEventListener('pagehide', function () { teardown(true); });
  window.addEventListener('beforeunload', function () { flush(true, true); });
})();
