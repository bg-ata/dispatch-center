/* imagegen_core.js — shared spine for the three image/deck tools
   (Webinar Studio, Event Marketing, Event Decks & Docs).

   Loaded AFTER store.js on those three pages only. Not part of DISPATCH_TOOLS.
   Provides: the render-API client (with Supabase bearer auth via dcToken()),
   the event-source resolver (§3f), the Dispatch-topic -> generator-theme map,
   a reusable photo/logo pool widget, and result/download helpers.

   The generators themselves live in the external render API (renmad_render_api);
   this file never re-implements a generator — it only assembles inputs and
   renders the bytes the API returns. */
(function (G) {
  'use strict';

  // ── API base (overridable for local testing) ──────────────────────────────
  // Set a different host at runtime with:  localStorage.dc_render_api = 'http://localhost:8000'
  var RENDER_API = (localStorage.getItem('dc_render_api') || 'https://renmad-render-api.onrender.com').replace(/\/$/, '');
  G.RENDER_API = RENDER_API;

  // Shared secret sent on every POST so only the Dispatch (whose JS this is) can
  // drive the render engine. The Dispatch is already login-gated, so a secret in
  // this client code is only readable by logged-in team members. Matches
  // API_SHARED_SECRET on the render service.
  var DC_API_SECRET = 'rmd_a7f3c9e21b8d4f60a5c7e93b21d4f8c6';

  // ── Dispatch topic  ->  generator theme key (BUILD_PROMPT §3d) ─────────────
  var THEME_MAP = {
    'Renewables / AI': 'ata_insights',
    'Storage': 'almacenamiento',
    'Biomethane': 'biometano',
    'Hydrogen': 'hidrogeno',
    'Data Centers': 'datacenters',
    'Investment': 'invest'
  };
  G.IG_THEME_MAP = THEME_MAP;

  // Regional overrides the Dispatch topic field can't carry (manual pick in UI).
  G.IG_THEME_KEYS = ['ata_insights', 'almacenamiento', 'storage_italia', 'storage_polska',
    'mexico', 'invest', 'invest_italia', 'chile', 'datacenters', 'datacenters_italia',
    'hidrogeno', 'biometano'];

  // ── sponsor tier inference from won-deal free text ────────────────────────
  var TIERS = ['diamond', 'platinum', 'global', 'gold', 'silver', 'bronze', 'standard'];
  function inferTier(txt) {
    var t = ('' + (txt || '')).toLowerCase();
    for (var i = 0; i < TIERS.length; i++) { if (t.indexOf(TIERS[i]) >= 0) return TIERS[i]; }
    return 'sponsor';
  }
  G.igInferTier = inferTier;

  // ── event-source resolver (§3f): a Dispatch event -> normalised object ─────
  // The store is authoritative for identity; scrape/upload fill speakers+logos.
  G.igResolveEvent = function (ev) {
    if (!ev) return null;
    var topic = ev.topic || '';
    var sponsors = [];
    try {
      sponsors = (DB.wonDealsForEvent(ev.id) || []).map(function (d) {
        return { company: d.company, tier: inferTier(d.branding || d.contents), eur: d.eur || 0 };
      });
    } catch (e) { sponsors = []; }
    return {
      id: ev.id,
      name: DB.evMasterName(ev) || ev.name || '',
      ecode: DB.evCode(ev) || '',
      acode: ev.acode || '',
      topic: topic,
      themeKey: THEME_MAP[topic] || 'ata_insights',
      colour: (typeof TOPICS !== 'undefined' && TOPICS[topic]) || '#FF4A00',
      dateISO: ev.date || '',
      days: ev.days || 1,
      dateRange: (function () { try { return dateRange(ev); } catch (e) { return ev.date || ''; } })(),
      city: ev.city || '',
      country: ev.country || '',
      pm: ev.pm || '',
      sales: ev.sales || '',
      lead: ev.lead || '',
      sponsors: sponsors
    };
  };

  // Fill an <select> with every event, "— pick an event —" first, newest first.
  G.igEventOptions = function (selectedId) {
    var evs = (DB.events || []).slice().sort(function (a, b) {
      return ('' + (b.date || '')).localeCompare('' + (a.date || ''));
    });
    var html = '<option value="">— pick an event —</option>';
    evs.forEach(function (e) {
      var sel = (e.id == selectedId) ? ' selected' : '';
      var when = '';
      try { when = dateRange(e); } catch (x) { when = e.date || ''; }
      html += '<option value="' + e.id + '"' + sel + '>' +
        _esc(e.name) + ' · ' + _esc(when) + '</option>';
    });
    return html;
  };

  // ── render-API client ─────────────────────────────────────────────────────
  // files = [{key:'p0', blob:Blob}]  (each blob is uploaded with filename = key)
  G.igApi = async function (path, payload, files) {
    var fd = new FormData();
    if (payload !== undefined) fd.append('payload', JSON.stringify(payload));
    (files || []).forEach(function (f) { if (f && f.blob) fd.append('files', f.blob, f.key); });
    var tok = '';
    try { tok = await dcToken(); } catch (e) { tok = ''; }
    var headers = { 'X-DC-Secret': DC_API_SECRET };
    if (tok) headers.Authorization = 'Bearer ' + tok;
    var r = await fetch(RENDER_API + path, { method: 'POST', headers: headers, body: fd });
    if (!r.ok) {
      var msg = '';
      try { var j = await r.json(); msg = j.detail || JSON.stringify(j); } catch (e) { msg = await r.text(); }
      throw new Error('API ' + r.status + ': ' + msg);
    }
    var ct = r.headers.get('content-type') || '';
    return ct.indexOf('application/json') >= 0 ? r.json() : r.blob();
  };

  G.igApiGet = async function (path) {
    var r = await fetch(RENDER_API + path);
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  };

  // Ping /health; resolves to the health JSON or throws.
  G.igHealth = function () { return G.igApiGet('/health'); };

  // ── result helpers: turn a {files:[{name,mime,b64}]} response into UI ──────
  function b64ToBlob(b64, mime) {
    var bin = atob(b64), len = bin.length, arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || 'application/octet-stream' });
  }
  G.igB64ToBlob = b64ToBlob;

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  G.igDownload = download;

  // Render an API multi-file JSON into a container: image thumbnails + a
  // download button per file. Images preview inline (Generate == see it).
  G.igRenderResults = function (container, json, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var files = (json && json.files) || [];
    if (!files.length) { container.innerHTML = '<p class="ig-mut">No files returned.</p>'; return; }
    files.forEach(function (f) {
      var blob = b64ToBlob(f.b64, f.mime);
      var card = document.createElement('div'); card.className = 'ig-out';
      var isImg = (f.mime || '').indexOf('image/') === 0;
      if (isImg) {
        var img = document.createElement('img');
        img.src = URL.createObjectURL(blob); img.alt = f.name; img.loading = 'lazy';
        card.appendChild(img);
      } else {
        var ic = document.createElement('div'); ic.className = 'ig-fileicon';
        ic.textContent = (f.name.split('.').pop() || 'FILE').toUpperCase();
        card.appendChild(ic);
      }
      var row = document.createElement('div'); row.className = 'ig-outrow';
      var nm = document.createElement('span'); nm.className = 'ig-outname'; nm.textContent = f.name;
      var btn = document.createElement('button'); btn.className = 'ig-btn ig-btn-sm'; btn.textContent = 'Download';
      btn.onclick = function () { download(blob, f.name); };
      row.appendChild(nm); row.appendChild(btn);
      card.appendChild(row);
      container.appendChild(card);
    });
    if (opts.downloadAll && files.length > 1) {
      var all = document.createElement('button'); all.className = 'ig-btn'; all.style.marginTop = '10px';
      all.textContent = 'Download all (' + files.length + ')';
      all.onclick = function () {
        files.forEach(function (f, i) {
          setTimeout(function () { download(b64ToBlob(f.b64, f.mime), f.name); }, i * 250);
        });
      };
      container.appendChild(all);
    }
  };

  // ── photo / logo pool widget ──────────────────────────────────────────────
  // A pool is an array of {key, name, blob, url}. Returns a controller.
  var _poolSeq = 0;
  G.igMakePool = function (mountEl, prefix, opts) {
    opts = opts || {};
    var items = [];
    function add(blob, name) {
      var key = prefix + (_poolSeq++);
      var it = { key: key, name: name || key, blob: blob, url: URL.createObjectURL(blob) };
      items.push(it); paint(); return it;
    }
    function remove(key) {
      items = items.filter(function (i) { return i.key !== key; }); paint();
    }
    function paint() {
      mountEl.innerHTML = '';
      items.forEach(function (it) {
        var chip = document.createElement('div'); chip.className = 'ig-chip';
        var im = document.createElement('img'); im.src = it.url; chip.appendChild(im);
        var x = document.createElement('button'); x.className = 'ig-chipx'; x.textContent = '×';
        x.title = 'Remove'; x.onclick = function () { remove(it.key); if (opts.onChange) opts.onChange(); };
        chip.appendChild(x);
        var lbl = document.createElement('span'); lbl.className = 'ig-chiplbl'; lbl.textContent = it.name;
        chip.appendChild(lbl);
        mountEl.appendChild(chip);
      });
      if (opts.onChange) opts.onChange();
    }
    return {
      items: function () { return items; },
      add: add, remove: remove,
      addFiles: function (fileList) {
        Array.prototype.forEach.call(fileList, function (file) { add(file, file.name); });
      },
      clear: function () { items = []; paint(); },
      byKey: function (k) { return items.filter(function (i) { return i.key === k; })[0]; }
    };
  };

  // Fetch a remote image (scraper URL / archive) into a Blob for the pool.
  G.igFetchImage = async function (url) {
    var r = await fetch(url); if (!r.ok) throw new Error('fetch ' + r.status); return r.blob();
  };

  function _esc(s) {
    return ('' + (s == null ? '' : s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  G.igEsc = _esc;

  // ── shared styles (injected once; uses the Dispatch CSS variables so dark
  //    mode from store.js "just works") ──────────────────────────────────────
  var CSS = [
    '.ig-wrap{max-width:1100px;margin:0 auto;padding:0 4px}',
    '.ig-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}',
    '@media(max-width:860px){.ig-grid2{grid-template-columns:1fr}}',
    '.ig-panel{background:var(--card,#fff);border:1px solid var(--line,#e3e1da);border-radius:12px;padding:16px 18px;margin-bottom:16px}',
    '.ig-panel h2{font-size:14px;margin:0 0 12px;color:var(--charcoal,#2B2B2B);text-transform:uppercase;letter-spacing:.04em}',
    '.ig-field{margin-bottom:12px}',
    '.ig-field label{display:block;font-size:12px;color:var(--muted,#7c7c78);margin-bottom:4px}',
    '.ig-field input,.ig-field select,.ig-field textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#e3e1da);border-radius:8px;background:var(--card,#fff);color:var(--ink,#3a3a3a);font:inherit}',
    '.ig-field textarea{min-height:64px;resize:vertical}',
    '.ig-row{display:flex;gap:10px}.ig-row>*{flex:1}',
    '.ig-btn{background:var(--orange,#FF4A00);color:#fff;border:0;border-radius:8px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}',
    '.ig-btn:hover{filter:brightness(1.05)}.ig-btn:disabled{opacity:.5;cursor:default}',
    '.ig-btn-ghost{background:transparent;color:var(--ink,#3a3a3a);border:1px solid var(--line,#e3e1da)}',
    '.ig-btn-sm{padding:5px 10px;font-size:12px}',
    '.ig-mut{color:var(--muted,#7c7c78);font-size:12px}',
    '.ig-cascade{background:rgba(255,74,0,.06);border:1px solid rgba(255,74,0,.25);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.6}',
    '.ig-cascade b{color:var(--charcoal,#2B2B2B)}',
    '.ig-pool{display:flex;flex-wrap:wrap;gap:8px;min-height:8px;margin-top:6px}',
    '.ig-chip{position:relative;width:64px}',
    '.ig-chip img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--line,#e3e1da);background:#fff}',
    '.ig-chipx{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:0;background:#c0392b;color:#fff;cursor:pointer;line-height:1;font-size:12px}',
    '.ig-chiplbl{display:block;font-size:10px;color:var(--muted,#7c7c78);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:64px}',
    '.ig-out{display:inline-block;width:180px;margin:0 10px 12px 0;vertical-align:top}',
    '.ig-out img{width:180px;border-radius:8px;border:1px solid var(--line,#e3e1da);display:block;background:#fff}',
    '.ig-fileicon{width:180px;height:110px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--line,#e3e1da);background:var(--bg,#f3f2ee);color:var(--muted,#7c7c78);font-weight:700}',
    '.ig-outrow{display:flex;align-items:center;gap:6px;margin-top:5px}',
    '.ig-outname{flex:1;font-size:11px;color:var(--muted,#7c7c78);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ig-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}',
    '.ig-dot-ok{background:#3aa856}.ig-dot-bad{background:#c0392b}.ig-dot-wait{background:#e2a43f}',
    '.ig-new{display:inline-block;background:#FF4A00;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:8px;vertical-align:middle;letter-spacing:.03em}',
    '.ig-drop{border:1.5px dashed var(--line,#e3e1da);border-radius:8px;padding:10px;text-align:center;color:var(--muted,#7c7c78);font-size:12px;cursor:pointer}',
    '.ig-drop:hover{border-color:var(--orange,#FF4A00)}',
    '.ig-busy{opacity:.6;pointer-events:none}',
    '.ig-spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:igspin .7s linear infinite;vertical-align:middle;margin-right:6px}',
    '@keyframes igspin{to{transform:rotate(360deg)}}'
  ].join('');
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  // A compact live "API: online/offline" chip the pages can drop in a header.
  G.igStatusChip = function (mountEl) {
    mountEl.innerHTML = '<span class="ig-dot ig-dot-wait"></span><span class="ig-mut">checking render API…</span>';
    G.igHealth().then(function (h) {
      mountEl.innerHTML = '<span class="ig-dot ig-dot-ok"></span><span class="ig-mut">render API online' +
        (h.rembg ? '' : ' · silhouette fallback') + '</span>';
    }).catch(function () {
      mountEl.innerHTML = '<span class="ig-dot ig-dot-bad"></span><span class="ig-mut">render API offline — ' +
        'set localStorage.dc_render_api or deploy the service</span>';
    });
  };

})(window);
