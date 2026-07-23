/* RENMAD Proposal Builder - bundled libs (auto-concatenated; edit sources in renmad-builders\). */

/* ===== lib\renmad-deck.js ===== */
/* ============================================================================
   RENMAD shared deck library  ·  reusable across ALL browser builders
   ----------------------------------------------------------------------------
   Wraps PptxGenJS with the RENMAD brand + a set of on-brand slide helpers so
   every builder (Proposal, Brochure, ...) renders decks the same way, in the
   browser, with zero server. Load AFTER pptxgen.bundle.js.

   Design goal: a builder should be able to say
       const d = RENMAD.newDeck();
       RENMAD.slides.cover(d, {...});
       RENMAD.slides.package(d, {...});
       await RENMAD.save(d, "proposal.pptx");
   and get a branded .pptx download — no PptxGenJS boilerplate repeated per tool.
   ============================================================================ */
(function (global) {
  "use strict";

  const T = {
    orange: "FF4A00", charcoal: "1C2529", ink: "2B2B2B", muted: "7A7E84",
    bio: "483078", h2: "307818", dc: "0090D8", red: "D32230",
    paper: "FFFFFF", light: "F5F5F7", line: "E3E1DA", white: "FFFFFF",
    fontHead: "Montserrat", fontBody: "Inter",
  };

  // 16:9 widescreen, in inches (13.333 x 7.5).
  const W = 13.333, H = 7.5;

  function newDeck() {
    const p = new PptxGenJS();
    p.defineLayout({ name: "RENMAD_16x9", width: W, height: H });
    p.layout = "RENMAD_16x9";
    p.author = "RENMAD Events";
    p.company = "ATA Insights";
    return p;
  }

  // A thin left accent bar + small footer used on content slides.
  function _chrome(slide, accent) {
    slide.addShape("rect", { x: 0, y: 0, w: 0.18, h: H, fill: { color: accent || T.orange } });
    slide.addText("RENMAD EVENTS", {
      x: 0.5, y: H - 0.45, w: 6, h: 0.3, fontFace: T.fontHead, fontSize: 8,
      color: T.muted, charSpacing: 2,
    });
  }

  const slides = {
    // Cover: full charcoal bg, big orange kicker + title + client line.
    cover(pptx, o) {
      const s = pptx.addSlide();
      s.background = { color: T.charcoal };
      s.addShape("rect", { x: 0, y: H - 1.4, w: W, h: 1.4, fill: { color: T.orange } });
      s.addText((o.kicker || "SPONSORSHIP PROPOSAL").toUpperCase(), {
        x: 0.9, y: 1.5, w: 11.5, h: 0.5, fontFace: T.fontHead, fontSize: 15,
        color: T.orange, bold: true, charSpacing: 3,
      });
      s.addText(o.title || "RENMAD Events", {
        x: 0.9, y: 2.1, w: 11.5, h: 1.8, fontFace: T.fontHead, fontSize: 44,
        color: T.white, bold: true, lineSpacingMultiple: 1.0,
      });
      if (o.tag) s.addText(o.tag, {
        x: 0.9, y: 3.9, w: 10.5, h: 0.8, fontFace: T.fontBody, fontSize: 16, color: "C7CBD0",
      });
      if (o.client) s.addText([
        { text: (o.preparedFor || "Prepared for") + "  ", options: { color: "1C2529", fontSize: 13 } },
        { text: o.client, options: { color: "1C2529", bold: true, fontSize: 15 } },
      ], { x: 0.9, y: H - 1.15, w: 11.5, h: 0.9, fontFace: T.fontBody, valign: "middle" });
      return s;
    },

    // Section divider.
    section(pptx, o) {
      const s = pptx.addSlide();
      s.background = { color: T.light };
      _chrome(s, o.accent);
      if (o.kicker) s.addText(o.kicker.toUpperCase(), {
        x: 0.9, y: 2.7, w: 11, h: 0.4, fontFace: T.fontHead, fontSize: 13,
        color: o.accent || T.orange, bold: true, charSpacing: 2,
      });
      s.addText(o.title || "", {
        x: 0.9, y: 3.1, w: 11.5, h: 1.4, fontFace: T.fontHead, fontSize: 34, color: T.charcoal, bold: true,
      });
      return s;
    },

    // A sponsorship package slide: name, price, what's included.
    package(pptx, o) {
      const s = pptx.addSlide();
      s.background = { color: T.paper };
      _chrome(s, o.accent);
      // header band
      s.addShape("rect", { x: 0.7, y: 0.55, w: 12, h: 1.15, fill: { color: T.charcoal } });
      s.addText(o.name || "Package", {
        x: 1.0, y: 0.55, w: 7.5, h: 1.15, fontFace: T.fontHead, fontSize: 28,
        color: T.white, bold: true, valign: "middle",
      });
      if (o.price != null) s.addText([
        { text: RENMAD.money(o.price), options: { fontSize: 26, bold: true, color: (o.accent || T.orange) } },
        { text: o.priceNote ? ("\n" + o.priceNote) : "", options: { fontSize: 9, color: "C7CBD0" } },
      ], { x: 8.3, y: 0.55, w: 4.1, h: 1.15, fontFace: T.fontHead, align: "right", valign: "middle" });
      if (o.tagline) s.addText(o.tagline, {
        x: 1.0, y: 1.9, w: 11.3, h: 0.5, fontFace: T.fontBody, italic: true, fontSize: 14, color: T.muted,
      });
      const items = (o.incl || []).map((t) => ({
        text: t, options: { bullet: { code: "2022", indent: 18 }, color: T.ink, fontSize: 13, paraSpaceAfter: 6 },
      }));
      s.addText(items.length ? items : [{ text: "" }], {
        x: 1.0, y: 2.5, w: 11.3, h: 4.2, fontFace: T.fontBody, valign: "top",
      });
      return s;
    },

    // Events calendar: a simple branded table of name / date / city.
    calendar(pptx, o) {
      const s = pptx.addSlide();
      s.background = { color: T.paper };
      _chrome(s, o.accent);
      s.addText(o.title || "The RENMAD events calendar", {
        x: 0.7, y: 0.5, w: 12, h: 0.7, fontFace: T.fontHead, fontSize: 26, color: T.charcoal, bold: true,
      });
      if (o.sub) s.addText(o.sub, {
        x: 0.7, y: 1.15, w: 12, h: 0.5, fontFace: T.fontBody, fontSize: 12, color: T.muted,
      });
      const head = ["Event", "Dates", "City"].map((t) => ({
        text: t, options: { fill: { color: T.charcoal }, color: T.white, bold: true, fontSize: 12, fontFace: T.fontHead },
      }));
      const rows = (o.events || []).map((e, i) => ([
        { text: e.name, options: { bold: true, color: T.charcoal } },
        { text: e.date || "—", options: { color: T.ink } },
        { text: e.city || "—", options: { color: T.muted } },
      ].map((c) => ({ ...c, options: { ...c.options, fontFace: T.fontBody, fontSize: 12, fill: { color: i % 2 ? "F5F5F7" : "FFFFFF" } } }))));
      s.addTable([head, ...rows], {
        x: 0.7, y: 1.75, w: 12, colW: [6.2, 3.4, 2.4], border: { type: "solid", color: T.line, pt: 0.5 },
        rowH: 0.42, valign: "middle", margin: [3, 6, 3, 6],
      });
      return s;
    },
  };

  function money(n) {
    if (n == null) return "";
    return "€" + Number(n).toLocaleString("es-ES");
  }

  async function save(pptx, fileName) {
    return pptx.writeFile({ fileName: fileName || "RENMAD_proposal.pptx" });
  }
  // For headless verification: return the deck as a base64 string.
  async function toBase64(pptx) {
    return pptx.write({ outputType: "base64" });
  }

  global.RENMAD = Object.assign(global.RENMAD || {}, { theme: T, W, H, newDeck, slides, money, save, toBase64 });
})(window);


/* ===== lib\extractor.js ===== */
/* ============================================================================
   RENMAD web-extractor client  ·  the SHARED "designs from websites" building
   block that every builder reuses (Proposal today, Brochure next, ...).
   ----------------------------------------------------------------------------
   Browsers can't fetch other websites (CORS) and can't put cross-origin images
   into a PPTX/PDF (tainted canvas). So a tiny serverless function does the
   fetching+parsing server-side and hands back the text + images as ready-to-use
   data URLs. This client is the single interface all builders call:

       RENMAD.extractor.configure({ endpoint, anonKey, token });
       const info = await RENMAD.extractor.extract("https://acme.com");
       // -> { ok, title, description, headings[], text, images:[{src,dataUrl,w,h}] }

   Until the function is deployed, extract() returns { ok:false, reason } so the
   builder can degrade gracefully (the deck still generates without it).
   ============================================================================ */
(function (global) {
  "use strict";
  const cfg = { endpoint: null, anonKey: null, token: null };

  function configure(o) { Object.assign(cfg, o || {}); }

  // Decode HTML entities (&nbsp; &amp; &#8217; ...) so pulled text is clean in decks.
  function _dec(s) {
    if (typeof s !== "string") return s;
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  }
  function _clean(data) {
    if (data.title) data.title = _dec(data.title);
    if (data.description) data.description = _dec(data.description);
    if (Array.isArray(data.headings)) data.headings = data.headings.map(_dec).filter(Boolean);
    if (Array.isArray(data.text)) data.text = data.text.map(_dec).filter(Boolean);
    return data;
  }

  async function extract(url, opts) {
    if (!cfg.endpoint) {
      return { ok: false, reason: "extractor-not-configured", hint: "Deploy the web-extractor Edge Function and call RENMAD.extractor.configure({endpoint,anonKey,token}).", images: [] };
    }
    try {
      const headers = { "Content-Type": "application/json" };
      if (cfg.anonKey) headers["apikey"] = cfg.anonKey;
      if (cfg.token) headers["Authorization"] = "Bearer " + cfg.token;
      const r = await fetch(cfg.endpoint, {
        method: "POST", headers,
        body: JSON.stringify({ url, maxImages: (opts && opts.maxImages) || 8 }),
      });
      if (!r.ok) return { ok: false, reason: "http-" + r.status, images: [] };
      const data = await r.json();
      return _clean(Object.assign({ ok: true, images: [] }, data));
    } catch (e) {
      return { ok: false, reason: "network", detail: String(e), images: [] };
    }
  }

  global.RENMAD = Object.assign(global.RENMAD || {}, { extractor: { configure, extract, _cfg: cfg } });
})(window);


/* ===== proposal\data.js ===== */
/* AUTO-GENERATED from proposal_builder/spx_data.py — do not hand-edit. */
window.PB = {
 "families": {
  "storage": "Storage Spain & Italy",
  "dcbh2": "Datacenter · Biometano · H2",
  "invest": "Invest & Other",
  "other": "Invest & Other"
 },
 "familyOrder": [
  "storage",
  "dcbh2",
  "invest",
  "other"
 ],
 "strings": {
  "en": {
   "cover_kicker": "SPONSORSHIP PROPOSAL",
   "cover_tag": "The benchmark executive meetings for the energy sector.",
   "prepared_for": "Prepared for",
   "proposal_for": "Proposal for",
   "about_k": "ABOUT RENMAD",
   "about_t": "Where the energy sector does business",
   "about_body": "RENMAD is the benchmark series of executive meetings connecting senior executives, investors, developers, utilities, manufacturers and institutional decision-makers across the energy transition. Each event is a working environment built for real conversations, deal-flow and high-level networking — a selective forum where seniority and relevance generate new business.",
   "stats": [
    [
     "trophy",
     "12",
     "years convening"
    ],
    [
     "globe",
     "8",
     "countries"
    ],
    [
     "people",
     "1,500+",
     "attendees / yr"
    ],
    [
     "building",
     "500+",
     "companies"
    ],
    [
     "mic",
     "300+",
     "speakers / yr"
    ],
    [
     "net",
     "60,000+",
     "reached"
    ]
   ],
   "attendee_k": "ATTENDEE PROFILE",
   "attendee_t": "A selective, senior audience",
   "sector_dist": "Sector distribution",
   "sectors": [
    [
     "Developers & IPPs",
     92
    ],
    [
     "Utilities & TSOs",
     70
    ],
    [
     "Technology & EPC",
     60
    ],
    [
     "Investors & banks",
     50
    ],
    [
     "Consulting",
     40
    ],
    [
     "Government & regulators",
     26
    ]
   ],
   "big75_sub": "of attendees are senior decision-makers",
   "seniority": "Seniority mix",
   "seniority_rows": [
    [
     "C-level",
     38
    ],
    [
     "Directors",
     27
    ],
    [
     "Managers",
     22
    ],
    [
     "Other",
     13
    ]
   ],
   "why_k": "WHY SPONSOR",
   "why_t": "Reach that works before, during & after",
   "why_cards": [
    [
     "target",
     "Reach decision-makers",
     "Face time with C-level and investment leads who control budgets — in a focused, business-first setting."
    ],
    [
     "mega",
     "Position your brand",
     "Your logo across a campaign reaching 700,000+ emails and 32,500+ LinkedIn impressions per cycle."
    ],
    [
     "hands",
     "Generate opportunities",
     "A pre-scheduled, qualified audience to open conversations and close deals on-site."
    ],
    [
     "mic",
     "Lead the conversation",
     "Keynotes, panels and presentations that establish you as a thought leader in your vertical."
    ]
   ],
   "events_k": "RENMAD EVENTS · THE SEASON AHEAD",
   "events_t": "The RENMAD events calendar",
   "events_sub": "One executive forum per vertical, across Europe and the Americas. Sponsor a single event or combine several for a multi-event discount.",
   "cal_2026_h": "STILL TO COME IN 2026",
   "cal_2027_h": "THE 2027 SEASON",
   "cal_summits": "summits",
   "comp_title": "Compare the packages",
   "comp_sub": "Every benefit, package by package — Diamond at the top down to entry-level Standard. No prices here; see each package next.",
   "comp_pkgcol": "Package",
   "benefits": [
    "Avail.",
    "Keynote",
    "Present.",
    "Panel",
    "Webinar",
    "Brand.",
    "Passes",
    "Interview",
    "News.",
    "Stand"
   ],
   "comp_rows": [
    "Diamond",
    "Platinum",
    "Gold",
    "Silver",
    "Bronze",
    "Std·Talk",
    "Std·Panel",
    "Std·Stand"
   ],
   "pkg_goodfor": "Good for",
   "pkg_included": "What's included",
   "pkg_price": "Price · {s} (tax not incl.)",
   "brand_k": "BRANDING OPTIONS",
   "brand_t": "Make your brand unmissable",
   "brand_intro": "Beyond your package, own high-visibility branding moments across the event. Availability rises with your tier.",
   "brand_silver_head": "SILVER & ABOVE",
   "brand_gold_head": "GOLD & ABOVE",
   "brand_silver": [
    [
     "wifi",
     "Networking app",
     "Full branding of the event app + a sponsor landing page."
    ],
    [
     "doc",
     "Seat drop",
     "Your brochure on every seat for immediate impact."
    ],
    [
     "doc",
     "Notepads & pens",
     "Your logo on the official stationery for all attendees."
    ],
    [
     "bolt",
     "Chill & charge area",
     "Branding of the relaxation and charging zone."
    ]
   ],
   "brand_gold": [
    [
     "coffee",
     "Coffee sponsor",
     "“Coffee sponsored by you” signage + branded cups."
    ],
    [
     "meal",
     "Lunch sponsor",
     "Signage, menu placement and agenda visibility at lunch."
    ],
    [
     "bolt",
     "Co-branded bottles",
     "Official event water bottles with your logo."
    ],
    [
     "cocktail",
     "Networking drinks",
     "Exclusive branding of the day-1 drinks reception."
    ]
   ],
   "brand2_t": "Exclusive — Platinum & Diamond",
   "brand2": [
    [
     "star",
     "Pre-registration & VIP cocktail",
     "Branding at the first attendee touchpoint plus premium positioning at the exclusive VIP cocktail reception."
    ],
    [
     "badge",
     "Registration & welcome pack",
     "Logo at the registration desks and inclusion in the official welcome pack handed to every attendee."
    ],
    [
     "meal",
     "Gala dinner sponsor",
     "“Dinner sponsored by you” signage, menu branding, agenda visibility and table logos at the gala dinner."
    ],
    [
     "badge",
     "Lanyards",
     "Your logo on every attendee and speaker badge lanyard — continuous, event-wide visibility."
    ]
   ],
   "addons_k": "OPTIONAL ADD-ONS",
   "addons_t": "Extend your impact beyond the event",
   "addons_intro": "Maximise your investment with high-impact extras you can attach to any package: generate qualified leads with your own webinar, and stay front-of-mind across the sector all year as a newsletter sponsor.",
   "addons_web_card": "Exclusive webinar",
   "addons_web_desc": "Your own webinar to the entire RENMAD community — capture every registrant as a qualified lead.",
   "addons_news_card": "Newsletter sponsor",
   "addons_news_desc": "Your brand named in every bi-weekly RENMAD newsletter, in English and Spanish, all year round.",
   "addon_from": "From",
   "addon_note": "Optional — add it to any sponsorship package",
   "webinar_k": "CONTENT ADD-ON",
   "webinar_t": "Host your own exclusive webinar",
   "webinar_body": "Run your own webinar, promoted across the entire RENMAD community of 50,211 active contacts — with hosting, moderation and all follow-up handled by us.",
   "webinar_feats": [
    [
     "net",
     "Promoted to 50,211 active contacts — a weekly email, a dedicated email and a newsletter"
    ],
    [
     "people",
     "Full registration management, technical support and moderation"
    ],
    [
     "doc",
     "Recording + PDF presentation sent to every registrant afterwards — attended or not"
    ]
   ],
   "webinar_opt1_t": "Webinar + attendee list",
   "webinar_opt1_s": "Every live registrant delivered to you as a qualified lead.",
   "webinar_opt2_t": "Webinar",
   "webinar_opt2_s": "Full promotion, hosting and recording (no attendee list).",
   "news_k": "BRAND ADD-ON",
   "news_t": "Become a newsletter sponsor",
   "news_body": "Stay visible to the whole sector all year long: your brand named as sponsor — and hyperlinked to your website — in every bi-weekly RENMAD newsletter, published in English and Spanish.",
   "news_relevant": "Recommended for this event",
   "news_feats": [
    [
     "mail",
     "Named sponsor in every bi-weekly newsletter — English & Spanish editions"
    ],
    [
     "globe",
     "Your name hyperlinked directly to your website"
    ],
    [
     "net",
     "Reaching {c} active contacts across the database"
    ]
   ],
   "news_reach": "active contacts",
   "news_year": "Sponsorship · all year",
   "news_foot": "Named sponsor in every bi-weekly newsletter — English & Spanish — with your name hyperlinked to your website.",
   "save_k": "SAVE MORE",
   "save_t": "Multi-event sponsorship discount",
   "save_intro": "Sponsor more than one RENMAD event and your investment is rewarded with a growing discount across the portfolio.",
   "save_hero": "One partnership,\nmany stages.",
   "save_tiers": [
    [
     "1",
     "1 event",
     "Full price",
     false
    ],
    [
     "2",
     "2 events",
     "–5%",
     false
    ],
    [
     "3",
     "3 events",
     "–10%",
     false
    ],
    [
     "4",
     "4 events",
     "Ask for pricing",
     true
    ]
   ],
   "save_foot": "Discount tiers indicative — final terms confirmed per proposal.",
   "contact_k": "LET'S TALK",
   "contact_t": "Shall we talk about your next event?",
   "contact_sub": "For questions, comments or partnership proposals, reach out directly.",
   "contact_phonesub": "Call or WhatsApp"
  },
  "es": {
   "cover_kicker": "PROPUESTA DE PATROCINIO",
   "cover_tag": "Los encuentros ejecutivos de referencia del sector energético.",
   "prepared_for": "Preparado para",
   "proposal_for": "Propuesta para",
   "about_k": "SOBRE RENMAD",
   "about_t": "Donde el sector energético hace negocio",
   "about_body": "RENMAD es la serie de referencia de encuentros ejecutivos que conecta a altos directivos, inversores, promotores, utilities, fabricantes y responsables institucionales de toda la transición energética. Cada evento es un entorno de trabajo diseñado para conversaciones reales, generación de negocio y networking de alto nivel: un foro selecto donde la seniority y la relevancia generan nuevas oportunidades.",
   "stats": [
    [
     "trophy",
     "12",
     "años de trayectoria"
    ],
    [
     "globe",
     "8",
     "países"
    ],
    [
     "people",
     "1.500+",
     "asistentes / año"
    ],
    [
     "building",
     "500+",
     "empresas"
    ],
    [
     "mic",
     "300+",
     "ponentes / año"
    ],
    [
     "net",
     "60.000+",
     "alcanzados"
    ]
   ],
   "attendee_k": "PERFIL DEL ASISTENTE",
   "attendee_t": "Una audiencia selecta y senior",
   "sector_dist": "Distribución por sector",
   "sectors": [
    [
     "Promotores e IPP",
     92
    ],
    [
     "Utilities y TSO",
     70
    ],
    [
     "Tecnología y EPC",
     60
    ],
    [
     "Inversores y banca",
     50
    ],
    [
     "Consultoría",
     40
    ],
    [
     "Gobierno y reguladores",
     26
    ]
   ],
   "big75_sub": "de los asistentes son decisores senior",
   "seniority": "Nivel de responsabilidad",
   "seniority_rows": [
    [
     "Alta dirección",
     38
    ],
    [
     "Directores",
     27
    ],
    [
     "Mandos intermedios",
     22
    ],
    [
     "Otros",
     13
    ]
   ],
   "why_k": "POR QUÉ PATROCINAR",
   "why_t": "Impacto antes, durante y después",
   "why_cards": [
    [
     "target",
     "Llega a los decisores",
     "Contacto directo con la alta dirección y responsables de inversión que controlan los presupuestos, en un entorno enfocado y orientado al negocio."
    ],
    [
     "mega",
     "Posiciona tu marca",
     "Tu logo en una campaña que alcanza más de 700.000 emails y más de 32.500 impresiones en LinkedIn por ciclo."
    ],
    [
     "hands",
     "Genera oportunidades",
     "Una audiencia cualificada y con agenda previa para abrir conversaciones y cerrar acuerdos in situ."
    ],
    [
     "mic",
     "Lidera la conversación",
     "Ponencias, paneles y presentaciones que te posicionan como referente en tu vertical."
    ]
   ],
   "events_k": "RENMAD EVENTS · LA TEMPORADA",
   "events_t": "El calendario de eventos RENMAD",
   "events_sub": "Un foro ejecutivo por vertical, en Europa y América. Patrocina un solo evento o combina varios y aprovecha el descuento multi-evento.",
   "cal_2026_h": "AÚN POR LLEGAR EN 2026",
   "cal_2027_h": "LA TEMPORADA 2027",
   "cal_summits": "cumbres",
   "comp_title": "Compara los paquetes",
   "comp_sub": "Cada beneficio, paquete a paquete — de Diamond arriba hasta el Standard de entrada. Sin precios aquí; los verás en cada paquete a continuación.",
   "comp_pkgcol": "Paquete",
   "benefits": [
    "Disp.",
    "Ponencia",
    "Present.",
    "Panel",
    "Webinar",
    "Brand.",
    "Pases",
    "Entrev.",
    "News.",
    "Stand"
   ],
   "comp_rows": [
    "Diamond",
    "Platinum",
    "Gold",
    "Silver",
    "Bronze",
    "Est·Ponencia",
    "Est·Panel",
    "Est·Stand"
   ],
   "pkg_goodfor": "Ideal para",
   "pkg_included": "Qué incluye",
   "pkg_price": "Precio · {s} (IVA no incl.)",
   "brand_k": "OPCIONES DE BRANDING",
   "brand_t": "Haz que tu marca destaque",
   "brand_intro": "Más allá de tu paquete, hazte con momentos de marca de alta visibilidad por todo el evento. La disponibilidad aumenta según tu nivel.",
   "brand_silver_head": "SILVER Y SUPERIOR",
   "brand_gold_head": "GOLD Y SUPERIOR",
   "brand_silver": [
    [
     "wifi",
     "App de networking",
     "Branding completo de la app del evento + una landing de patrocinador."
    ],
    [
     "doc",
     "Folleto en asiento",
     "Tu folleto en cada asiento para un impacto inmediato."
    ],
    [
     "doc",
     "Libretas y bolígrafos",
     "Tu logo en la papelería oficial para todos los asistentes."
    ],
    [
     "bolt",
     "Zona chill & carga",
     "Branding de la zona de descanso y carga."
    ]
   ],
   "brand_gold": [
    [
     "coffee",
     "Patrocinador del café",
     "Cartelería “café patrocinado por ti” + vasos personalizados."
    ],
    [
     "meal",
     "Patrocinador del almuerzo",
     "Cartelería, presencia en el menú y visibilidad en agenda durante el almuerzo."
    ],
    [
     "bolt",
     "Botellas co-branded",
     "Botellas de agua oficiales del evento con tu logo."
    ],
    [
     "cocktail",
     "Cóctel de networking",
     "Branding exclusivo del cóctel del día 1."
    ]
   ],
   "brand2_t": "Exclusivo — Platinum y Diamond",
   "brand2": [
    [
     "star",
     "Pre-registro y cóctel VIP",
     "Branding en el primer punto de contacto con el asistente y posicionamiento premium en el cóctel VIP exclusivo."
    ],
    [
     "badge",
     "Registro y welcome pack",
     "Logo en los mostradores de registro e inclusión en el welcome pack oficial que recibe cada asistente."
    ],
    [
     "meal",
     "Patrocinador de la cena de gala",
     "Cartelería “cena patrocinada por ti”, branding en el menú, visibilidad en agenda y logos en mesa en la cena de gala."
    ],
    [
     "badge",
     "Lanyards",
     "Tu logo en el cordón de cada acreditación de asistentes y ponentes — visibilidad continua en todo el evento."
    ]
   ],
   "addons_k": "COMPLEMENTOS OPCIONALES",
   "addons_t": "Amplía tu impacto más allá del evento",
   "addons_intro": "Maximiza tu inversión con extras de alto impacto que puedes añadir a cualquier paquete: genera leads cualificados con tu propio webinar y mantente presente en todo el sector durante todo el año como patrocinador de la newsletter.",
   "addons_web_card": "Webinar exclusivo",
   "addons_web_desc": "Tu propio webinar a toda la comunidad RENMAD: capta cada registrado como lead cualificado.",
   "addons_news_card": "Patrocinador de newsletter",
   "addons_news_desc": "Tu marca en cada newsletter quincenal de RENMAD, en inglés y español, todo el año.",
   "addon_from": "Desde",
   "addon_note": "Opcional — añádelo a cualquier paquete de patrocinio",
   "webinar_k": "COMPLEMENTO DE CONTENIDO",
   "webinar_t": "Organiza tu propio webinar exclusivo",
   "webinar_body": "Organiza tu propio webinar, promocionado a toda la comunidad RENMAD de 50.211 contactos activos, con la organización, moderación y seguimiento a cargo de nosotros.",
   "webinar_feats": [
    [
     "net",
     "Promoción a 50.211 contactos activos: un email semanal, un email dedicado y una newsletter"
    ],
    [
     "people",
     "Gestión completa del registro, soporte técnico y moderación"
    ],
    [
     "doc",
     "Grabación + PDF enviados a cada registrado después, asistiera o no"
    ]
   ],
   "webinar_opt1_t": "Webinar + lista de asistentes",
   "webinar_opt1_s": "Cada registrado en directo, entregado como lead cualificado.",
   "webinar_opt2_t": "Webinar",
   "webinar_opt2_s": "Promoción, organización y grabación completas (sin lista de asistentes).",
   "news_k": "COMPLEMENTO DE MARCA",
   "news_t": "Conviértete en patrocinador de la newsletter",
   "news_body": "Mantente visible para todo el sector durante todo el año: tu marca como patrocinador —con enlace a tu web— en cada newsletter quincenal de RENMAD, publicada en inglés y español.",
   "news_relevant": "Recomendado para este evento",
   "news_feats": [
    [
     "mail",
     "Patrocinador en cada newsletter quincenal: ediciones en inglés y español"
    ],
    [
     "globe",
     "Tu nombre enlazado directamente a tu web"
    ],
    [
     "net",
     "Llegando a {c} contactos activos de la base de datos"
    ]
   ],
   "news_reach": "contactos activos",
   "news_year": "Patrocinio · todo el año",
   "news_foot": "Patrocinador en cada newsletter quincenal —en inglés y español— con tu nombre enlazado a tu web.",
   "save_k": "AHORRA MÁS",
   "save_t": "Descuento por patrocinio multi-evento",
   "save_intro": "Patrocina más de un evento RENMAD y tu inversión se premia con un descuento creciente en todo el portfolio.",
   "save_hero": "Una alianza,\nmuchos escenarios.",
   "save_tiers": [
    [
     "1",
     "1 evento",
     "Precio completo",
     false
    ],
    [
     "2",
     "2 eventos",
     "–5%",
     false
    ],
    [
     "3",
     "3 eventos",
     "–10%",
     false
    ],
    [
     "4",
     "4 eventos",
     "Consulta el precio",
     true
    ]
   ],
   "save_foot": "Niveles de descuento orientativos — condiciones finales confirmadas por propuesta.",
   "contact_k": "HABLEMOS",
   "contact_t": "¿Hablamos de tu próximo evento?",
   "contact_sub": "Para preguntas, comentarios o propuestas de colaboración, escríbeme directamente.",
   "contact_phonesub": "Llamada o WhatsApp"
  }
 },
 "events": [
  {
   "key": "general",
   "name": "RENMAD Events",
   "family": "storage",
   "portfolio": true,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Europe & the Americas",
    "es": "Europa y América"
   },
   "date": {
    "en": "2026 – 2027 season",
    "es": "Temporada 2026 – 2027"
   },
   "short": "Events"
  },
  {
   "key": "italian_market",
   "name": "RENMAD Italian Market",
   "family": "storage",
   "portfolio": true,
   "members": [
    "dc_italia_26",
    "storage_italia_27",
    "dc_italia_27",
    "invest_italia_27"
   ],
   "color": "FF4A00",
   "city": {
    "en": "Italy",
    "es": "Italia"
   },
   "date": {
    "en": "2026 – 2027 season",
    "es": "Temporada 2026 – 2027"
   },
   "short": "Italian Market"
  },
  {
   "key": "spanish_market",
   "name": "RENMAD Spanish Market",
   "family": "storage",
   "portfolio": true,
   "members": [
    "h2_26",
    "dc_27",
    "biometano_27",
    "almacenamiento_27",
    "h2_27",
    "invest_27",
    "usefulai_27"
   ],
   "color": "FF4A00",
   "city": {
    "en": "Spain",
    "es": "España"
   },
   "date": {
    "en": "2026 – 2027 season",
    "es": "Temporada 2026 – 2027"
   },
   "short": "Spanish Market"
  },
  {
   "key": "dc_italia_26",
   "name": "RENMAD Datacenters Italia 2026",
   "family": "dcbh2",
   "portfolio": false,
   "members": null,
   "color": "0090D8",
   "city": {
    "en": "Milan, Italy",
    "es": "Milán, Italia"
   },
   "date": {
    "en": "11–12 November 2026",
    "es": "11–12 de noviembre de 2026"
   },
   "short": "Datacenters Italia"
  },
  {
   "key": "h2_26",
   "name": "RENMAD Hidrógeno 2026",
   "family": "dcbh2",
   "portfolio": false,
   "members": null,
   "color": "307818",
   "city": {
    "en": "Zaragoza, Spain",
    "es": "Zaragoza, España"
   },
   "date": {
    "en": "18–19 November 2026",
    "es": "18–19 de noviembre de 2026"
   },
   "short": "Hidrógeno"
  },
  {
   "key": "dc_27",
   "name": "RENMAD Datacenters 2027",
   "family": "dcbh2",
   "portfolio": false,
   "members": null,
   "color": "0090D8",
   "city": {
    "en": "Zaragoza, Spain",
    "es": "Zaragoza, España"
   },
   "date": {
    "en": "27–28 January 2027",
    "es": "27–28 de enero de 2027"
   },
   "short": "Datacenters"
  },
  {
   "key": "storage_italia_27",
   "name": "RENMAD Storage Italia 2027",
   "family": "storage",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Bologna, Italy",
    "es": "Bolonia, Italia"
   },
   "date": {
    "en": "9–10 February 2027",
    "es": "9–10 de febrero de 2027"
   },
   "short": "Storage Italia"
  },
  {
   "key": "biometano_27",
   "name": "RENMAD Biometano 2027",
   "family": "dcbh2",
   "portfolio": false,
   "members": null,
   "color": "483078",
   "city": {
    "en": "Toledo, Spain",
    "es": "Toledo, España"
   },
   "date": {
    "en": "10–11 February 2027",
    "es": "10–11 de febrero de 2027"
   },
   "short": "Biometano"
  },
  {
   "key": "almacenamiento_27",
   "name": "RENMAD Almacenamiento 2027",
   "family": "storage",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Seville, Spain",
    "es": "Sevilla, España"
   },
   "date": {
    "en": "31 March – 1 April 2027",
    "es": "31 de marzo – 1 de abril de 2027"
   },
   "short": "Almacenamiento"
  },
  {
   "key": "chile_27",
   "name": "RENMAD Chile 2027",
   "family": "other",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Santiago, Chile",
    "es": "Santiago de Chile"
   },
   "date": {
    "en": "29–30 July 2027",
    "es": "29–30 de julio de 2027"
   },
   "short": "Chile"
  },
  {
   "key": "h2_27",
   "name": "RENMAD Hidrógeno 2027",
   "family": "dcbh2",
   "portfolio": false,
   "members": null,
   "color": "307818",
   "city": {
    "en": "Zaragoza, Spain",
    "es": "Zaragoza, España"
   },
   "date": {
    "en": "November 2027",
    "es": "noviembre de 2027"
   },
   "short": "Hidrógeno"
  },
  {
   "key": "dc_italia_27",
   "name": "RENMAD Datacenters Italia 2027",
   "family": "dcbh2",
   "portfolio": false,
   "members": null,
   "color": "0090D8",
   "city": {
    "en": "Milan, Italy",
    "es": "Milán, Italia"
   },
   "date": {
    "en": "November 2027",
    "es": "noviembre de 2027"
   },
   "short": "Datacenters Italia"
  },
  {
   "key": "invest_27",
   "name": "RENMAD Invest 2027",
   "family": "invest",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Madrid, Spain",
    "es": "Madrid, España"
   },
   "date": {
    "en": "Dates soon",
    "es": "Próximamente"
   },
   "short": "Invest"
  },
  {
   "key": "invest_italia_27",
   "name": "RENMAD Invest Italia 2027",
   "family": "invest",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Milan, Italy",
    "es": "Milán, Italia"
   },
   "date": {
    "en": "Dates soon",
    "es": "Próximamente"
   },
   "short": "Invest Italia"
  },
  {
   "key": "mexico_27",
   "name": "RENMAD Mexico 2027",
   "family": "other",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Mexico City",
    "es": "Ciudad de México"
   },
   "date": {
    "en": "22–23 June 2027",
    "es": "22–23 de junio de 2027"
   },
   "short": "Mexico"
  },
  {
   "key": "storage_polska_27",
   "name": "RENMAD Storage Polska 2027",
   "family": "other",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Warsaw, Poland",
    "es": "Varsovia, Polonia"
   },
   "date": {
    "en": "27–28 April 2027",
    "es": "27–28 de abril de 2027"
   },
   "short": "Storage Polska"
  },
  {
   "key": "usefulai_27",
   "name": "RENMAD UsefulAI 2027",
   "family": "other",
   "portfolio": false,
   "members": null,
   "color": "FF4A00",
   "city": {
    "en": "Madrid, Spain",
    "es": "Madrid, España"
   },
   "date": {
    "en": "Dates soon",
    "es": "Próximamente"
   },
   "short": "UsefulAI"
  }
 ],
 "packages": [
  {
   "id": "diamond",
   "name": {
    "en": "Diamond",
    "es": "Diamond"
   },
   "tagline": {
    "en": "The maximum package",
    "es": "El paquete máximo"
   },
   "good": {
    "en": "Sponsors who want the most complete presence available.",
    "es": "Patrocinadores que buscan la presencia más completa posible."
   },
   "pitch": {
    "en": "Shine bright. Diamond is the pinnacle of the RENMAD range — the single, unmissable partner whose brand sets the tone for the entire event. The largest logo above all others, a keynote on the main stage, a panel seat, two lead-generating webinars, two branding moments and the biggest stand: every channel RENMAD has, working for one name. When you want the room to remember a single brand, this is the package that makes it happen.",
    "es": "Brilla con luz propia. Diamond es la cúspide de la gama RENMAD: el único patrocinador imprescindible cuya marca define el tono de todo el evento. El logo más grande de todos, una ponencia magistral, un asiento en panel, dos webinars de generación de leads, dos actividades de branding y el stand más grande: todos los canales de RENMAD trabajando para un solo nombre."
   },
   "highlights": {
    "en": [
     [
      "mic",
      "Keynote, day 1 + panel seat"
     ],
     [
      "monitor",
      "2 webinars + attendee lists"
     ],
     [
      "mega",
      "2 branding activities"
     ],
     [
      "booth",
      "Exhibition stand 6×9 m"
     ],
     [
      "people",
      "12 delegate passes"
     ]
    ],
    "es": [
     [
      "mic",
      "Ponencia día 1 + panel"
     ],
     [
      "monitor",
      "2 webinars + listas de leads"
     ],
     [
      "mega",
      "2 actividades de branding"
     ],
     [
      "booth",
      "Stand de exposición 6×9 m"
     ],
     [
      "people",
      "12 pases"
     ]
    ]
   },
   "incl": {
    "en": [
     "Exclusive Diamond sponsor — largest logo, above all others",
     "Keynote, day 1 morning + panel discussion seat",
     "2 exclusive webinars + attendee lists (qualified leads)",
     "2 branding activities (to be agreed)",
     "Interview at the event + sectorial newsletter feature",
     "Exhibition booth 6×9 m",
     "12 complimentary passes · 30% / 20% extra-pass discount",
     "Premium branding throughout the event"
    ],
    "es": [
     "Patrocinador Diamond exclusivo — el logo más grande, por encima de todos",
     "Ponencia magistral, mañana del día 1 + asiento en panel",
     "2 webinars exclusivos + listas de asistentes (leads cualificados)",
     "2 actividades de branding (a convenir)",
     "Entrevista en el evento + reportaje en newsletter sectorial",
     "Stand de exposición 6×9 m",
     "12 pases gratuitos · 30% / 20% de descuento en pases extra",
     "Branding premium durante todo el evento"
    ]
   },
   "avail": 1,
   "price": {
    "storage": 42500,
    "dcbh2": 38250,
    "invest": 34000,
    "other": 34000
   }
  },
  {
   "id": "platinum",
   "name": {
    "en": "Platinum",
    "es": "Platinum"
   },
   "tagline": {
    "en": "Headline-level presence",
    "es": "Presencia de primer nivel"
   },
   "good": {
    "en": "Market leaders seeking near-headline, multi-channel presence.",
    "es": "Líderes del mercado que buscan una presencia multicanal casi protagonista."
   },
   "pitch": {
    "en": "Platinum puts you on the main stage with a keynote and surrounds your brand with two branding activities, a webinar, an interview and a newsletter feature — the package for a recognised leader that wants to be impossible to miss without taking full exclusivity.",
    "es": "Platinum te sube al escenario principal con una ponencia magistral y rodea tu marca de dos actividades de branding, un webinar, una entrevista y un reportaje en newsletter: el paquete para un líder reconocido que quiere ser imposible de pasar por alto sin asumir la exclusividad total."
   },
   "highlights": {
    "en": [
     [
      "mic",
      "Keynote, day 1 + panel seat"
     ],
     [
      "monitor",
      "1 webinar + attendee list"
     ],
     [
      "mega",
      "2 branding activities"
     ],
     [
      "booth",
      "Exhibition stand 4×6 m"
     ],
     [
      "people",
      "10 delegate passes"
     ]
    ],
    "es": [
     [
      "mic",
      "Ponencia día 1 + panel"
     ],
     [
      "monitor",
      "1 webinar + lista de leads"
     ],
     [
      "mega",
      "2 actividades de branding"
     ],
     [
      "booth",
      "Stand de exposición 4×6 m"
     ],
     [
      "people",
      "10 pases"
     ]
    ]
   },
   "incl": {
    "en": [
     "Keynote, day 1 morning + panel discussion seat",
     "Exclusive webinar + attendee list (leads)",
     "2 branding activities (to be agreed)",
     "Interview at the event + sectorial newsletter feature",
     "Exhibition booth 4×6 m",
     "10 complimentary passes · 25% / 15% extra-pass discount",
     "Premium branding, top logo tier"
    ],
    "es": [
     "Ponencia magistral, mañana del día 1 + asiento en panel",
     "Webinar exclusivo + lista de asistentes (leads)",
     "2 actividades de branding (a convenir)",
     "Entrevista en el evento + reportaje en newsletter sectorial",
     "Stand de exposición 4×6 m",
     "10 pases gratuitos · 25% / 15% de descuento en pases extra",
     "Branding premium, máximo nivel de logo"
    ]
   },
   "avail": 3,
   "price": {
    "storage": 33500,
    "dcbh2": 30150,
    "invest": 26800,
    "other": 26800
   }
  },
  {
   "id": "gold",
   "name": {
    "en": "Gold",
    "es": "Gold"
   },
   "tagline": {
    "en": "Senior visibility + lead-gen",
    "es": "Visibilidad senior + generación de leads"
   },
   "good": {
    "en": "Senior brands wanting strong visibility and qualified leads.",
    "es": "Marcas senior que buscan gran visibilidad y leads cualificados."
   },
   "pitch": {
    "en": "Gold combines a presentation, a panel seat, a lead-generating webinar and an on-stage interview with a larger 4×6 m stand — a complete, senior-level presence for brands that want both visibility and a measurable pipeline of contacts.",
    "es": "Gold combina una presentación, un asiento en panel, un webinar de generación de leads y una entrevista en escenario con un stand más amplio de 4×6 m: una presencia completa y de nivel senior para marcas que quieren visibilidad y un flujo medible de contactos."
   },
   "highlights": {
    "en": [
     [
      "speaker",
      "Presentation + panel seat"
     ],
     [
      "monitor",
      "1 webinar + attendee list"
     ],
     [
      "mega",
      "1 branding activity"
     ],
     [
      "booth",
      "Exhibition stand 4×6 m"
     ],
     [
      "people",
      "7 delegate passes"
     ]
    ],
    "es": [
     [
      "speaker",
      "Presentación + panel"
     ],
     [
      "monitor",
      "1 webinar + lista de leads"
     ],
     [
      "mega",
      "1 actividad de branding"
     ],
     [
      "booth",
      "Stand de exposición 4×6 m"
     ],
     [
      "people",
      "7 pases"
     ]
    ]
   },
   "incl": {
    "en": [
     "Individual presentation + panel discussion seat",
     "Exclusive webinar + attendee list (leads)",
     "1 branding activity (to be agreed)",
     "Interview at the event",
     "Exhibition booth 4×6 m",
     "Logo larger than Standard / Bronze / Silver",
     "7 complimentary passes · 25% / 15% extra-pass discount"
    ],
    "es": [
     "Presentación individual + asiento en panel",
     "Webinar exclusivo + lista de asistentes (leads)",
     "1 actividad de branding (a convenir)",
     "Entrevista en el evento",
     "Stand de exposición 4×6 m",
     "Logo más grande que Standard / Bronze / Silver",
     "7 pases gratuitos · 25% / 15% de descuento en pases extra"
    ]
   },
   "avail": 10,
   "price": {
    "storage": 25500,
    "dcbh2": 22950,
    "invest": 20400,
    "other": 20400
   }
  },
  {
   "id": "silver",
   "name": {
    "en": "Silver",
    "es": "Silver"
   },
   "tagline": {
    "en": "Visibility, leads & a stage",
    "es": "Visibilidad, leads y escenario"
   },
   "good": {
    "en": "The most popular tier — visibility, lead-gen and a speaking role.",
    "es": "El nivel más popular: visibilidad, generación de leads y un rol como ponente."
   },
   "pitch": {
    "en": "The most chosen package: a presentation, a panel seat, a lead-generating webinar, a branding activity and a stand. Silver gives you a genuine speaking role and a steady flow of leads at a mid-range investment — the best all-round value in the range.",
    "es": "El paquete más elegido: una presentación, un asiento en panel, un webinar de generación de leads, una actividad de branding y un stand. Silver te da un verdadero rol como ponente y un flujo constante de leads con una inversión media: la mejor relación valor-precio de la gama."
   },
   "highlights": {
    "en": [
     [
      "speaker",
      "Presentation + panel seat"
     ],
     [
      "monitor",
      "1 webinar + attendee list"
     ],
     [
      "mega",
      "1 branding activity"
     ],
     [
      "booth",
      "Exhibition stand 2×3 m"
     ],
     [
      "people",
      "7 delegate passes"
     ]
    ],
    "es": [
     [
      "speaker",
      "Presentación + panel"
     ],
     [
      "monitor",
      "1 webinar + lista de leads"
     ],
     [
      "mega",
      "1 actividad de branding"
     ],
     [
      "booth",
      "Stand de exposición 2×3 m"
     ],
     [
      "people",
      "7 pases"
     ]
    ]
   },
   "incl": {
    "en": [
     "Individual presentation + panel discussion seat",
     "Exclusive webinar + attendee list (leads)",
     "1 branding activity (basic, to be agreed)",
     "Exhibition booth 2×3 m",
     "Logo larger than Standard & Bronze",
     "7 complimentary passes · 25% / 15% extra-pass discount",
     "Premium branding + social mention"
    ],
    "es": [
     "Presentación individual + asiento en panel",
     "Webinar exclusivo + lista de asistentes (leads)",
     "1 actividad de branding (básica, a convenir)",
     "Stand de exposición 2×3 m",
     "Logo más grande que Standard y Bronze",
     "7 pases gratuitos · 25% / 15% de descuento en pases extra",
     "Branding premium + mención en redes"
    ]
   },
   "avail": 12,
   "price": {
    "storage": 18500,
    "dcbh2": 16650,
    "invest": 14800,
    "other": 14800
   }
  },
  {
   "id": "bronze",
   "name": {
    "en": "Bronze",
    "es": "Bronze"
   },
   "tagline": {
    "en": "Talk + booth, accessible",
    "es": "Ponencia + stand, accesible"
   },
   "good": {
    "en": "Companies wanting a talk and a booth at an accessible price.",
    "es": "Empresas que quieren una ponencia y un stand a un precio accesible."
   },
   "pitch": {
    "en": "Bronze is the entry point into the branded tiers: a 20-minute presentation, a 2×3 m stand and a larger logo than Standard sponsors. Ideal for companies that want a speaking slot and a presence on the floor without a senior-tier budget.",
    "es": "Bronze es la puerta de entrada a los niveles con marca: una presentación de 20 minutos, un stand de 2×3 m y un logo más grande que los patrocinadores Standard. Ideal para empresas que quieren una ponencia y presencia en la zona de exposición sin un presupuesto de nivel senior."
   },
   "highlights": {
    "en": [
     [
      "speaker",
      "Presentation, 20 min"
     ],
     [
      "booth",
      "Exhibition stand 2×3 m"
     ],
     [
      "people",
      "5 delegate passes"
     ]
    ],
    "es": [
     [
      "speaker",
      "Presentación, 20 min"
     ],
     [
      "booth",
      "Stand de exposición 2×3 m"
     ],
     [
      "people",
      "5 pases"
     ]
    ]
   },
   "incl": {
    "en": [
     "Individual presentation, day 1 afternoon (20 min incl. Q&A)",
     "Logo displayed larger than Standard sponsors",
     "Exhibition booth 2×3 m",
     "5 complimentary passes · 20% / 10% extra-pass discount",
     "Premium logo branding + social mention"
    ],
    "es": [
     "Presentación individual, tarde del día 1 (20 min incl. Q&A)",
     "Logo mostrado más grande que los patrocinadores Standard",
     "Stand de exposición 2×3 m",
     "5 pases gratuitos · 20% / 10% de descuento en pases extra",
     "Branding premium de logo + mención en redes"
    ]
   },
   "price": {
    "storage": 12500,
    "dcbh2": 11250,
    "invest": 10000,
    "other": 10000
   }
  },
  {
   "id": "std_talk",
   "name": {
    "en": "Standard · Presentation",
    "es": "Estándar · Presentación"
   },
   "tagline": {
    "en": "Your solution from the stage",
    "es": "Tu solución desde el escenario"
   },
   "good": {
    "en": "Showcasing a product or solution in a solo slot.",
    "es": "Presentar un producto o solución en un espacio propio."
   },
   "pitch": {
    "en": "A focused, affordable way to put your solution in front of the room: a dedicated 20-minute presentation on day 2, plus full logo branding. Perfect for a clear product or technology message without a stand.",
    "es": "Una forma enfocada y asequible de poner tu solución frente a la sala: una presentación dedicada de 20 minutos el día 2, además de branding completo de logo. Perfecto para un mensaje claro de producto o tecnología sin stand."
   },
   "highlights": {
    "en": [
     [
      "speaker",
      "Presentation, 20 min"
     ],
     [
      "people",
      "3 delegate passes"
     ]
    ],
    "es": [
     [
      "speaker",
      "Presentación, 20 min"
     ],
     [
      "people",
      "3 pases"
     ]
    ]
   },
   "incl": {
    "en": [
     "Individual presentation, day 2 (20 min incl. Q&A)",
     "3 complimentary passes",
     "20% / 10% (Invest) discount on extra passes",
     "Logo on website, agenda & marketing materials",
     "Social media mention"
    ],
    "es": [
     "Presentación individual, día 2 (20 min incl. Q&A)",
     "3 pases gratuitos",
     "20% / 10% (Invest) de descuento en pases extra",
     "Logo en web, agenda y materiales de marketing",
     "Mención en redes sociales"
    ]
   },
   "price": {
    "storage": 9000,
    "dcbh2": 9000,
    "invest": 8100,
    "other": 8100
   }
  },
  {
   "id": "std_panel",
   "name": {
    "en": "Standard · Panel",
    "es": "Estándar · Panel"
   },
   "tagline": {
    "en": "A voice in the debate",
    "es": "Una voz en el debate"
   },
   "good": {
    "en": "Positioning a spokesperson as a sector voice.",
    "es": "Posicionar a un portavoz como voz del sector."
   },
   "pitch": {
    "en": "Put your expert on a panel alongside the sector's leaders. Standard · Panel is the most cost-effective way to earn a speaking role and be seen as part of the conversation, with full logo branding included.",
    "es": "Pon a tu experto en un panel junto a los líderes del sector. Estándar · Panel es la forma más rentable de conseguir un rol como ponente y formar parte de la conversación, con branding completo de logo incluido."
   },
   "highlights": {
    "en": [
     [
      "mic",
      "Panel discussion seat"
     ],
     [
      "people",
      "2 passes + 1 panellist"
     ]
    ],
    "es": [
     [
      "mic",
      "Plaza en panel"
     ],
     [
      "people",
      "2 pases + 1 panelista"
     ]
    ]
   },
   "incl": {
    "en": [
     "Speaker seat on a panel discussion (topic to be agreed)",
     "2 delegate passes + 1 panellist pass (3 in total)",
     "20% / 10% (Invest) discount on extra passes",
     "Logo on website, agenda & marketing materials",
     "Social media mention"
    ],
    "es": [
     "Plaza de ponente en un panel (tema a convenir)",
     "2 pases de delegado + 1 pase de panelista (3 en total)",
     "20% / 10% (Invest) de descuento en pases extra",
     "Logo en web, agenda y materiales de marketing",
     "Mención en redes sociales"
    ]
   },
   "price": {
    "storage": 7500,
    "dcbh2": 7500,
    "invest": 6750,
    "other": 6750
   }
  },
  {
   "id": "std_stand",
   "name": {
    "en": "Standard · Stand",
    "es": "Estándar · Stand"
   },
   "tagline": {
    "en": "Entry-level floor presence",
    "es": "Presencia básica en la exposición"
   },
   "good": {
    "en": "First-time exhibitors who want a presence on the floor.",
    "es": "Expositores primerizos que quieren presencia en la zona de exposición."
   },
   "pitch": {
    "en": "The simplest way to be there: a 2×3 m exhibition booth, two passes and full logo branding. A low-commitment entry point for first-time exhibitors who want to meet attendees on the floor.",
    "es": "La forma más sencilla de estar presente: un stand de exposición de 2×3 m, dos pases y branding completo de logo. Un punto de entrada de bajo compromiso para expositores primerizos que quieren conocer a los asistentes en la zona de exposición."
   },
   "highlights": {
    "en": [
     [
      "booth",
      "Exhibition stand 2×3 m"
     ],
     [
      "people",
      "2 delegate passes"
     ]
    ],
    "es": [
     [
      "booth",
      "Stand de exposición 2×3 m"
     ],
     [
      "people",
      "2 pases"
     ]
    ]
   },
   "incl": {
    "en": [
     "Exhibition booth 2×3 m (table, chairs, electricity)",
     "2 complimentary passes",
     "20% / 10% (Invest) discount on extra passes",
     "Logo on website, agenda & marketing materials",
     "Social media mention"
    ],
    "es": [
     "Stand de exposición 2×3 m (mesa, sillas, electricidad)",
     "2 pases gratuitos",
     "20% / 10% (Invest) de descuento en pases extra",
     "Logo en web, agenda y materiales de marketing",
     "Mención en redes sociales"
    ]
   },
   "price": {
    "storage": 6000,
    "dcbh2": 6000,
    "invest": 5400,
    "other": 5400
   }
  }
 ],
 "newsletters": {
  "general": {
   "price": 14500,
   "contacts": {
    "en": "51,000",
    "es": "51.000"
   },
   "scope": {
    "en": "General newsletter",
    "es": "Newsletter general"
   }
  },
  "storage": {
   "price": 9500,
   "contacts": {
    "en": "31,000",
    "es": "31.000"
   },
   "scope": {
    "en": "Storage newsletter",
    "es": "Newsletter de Almacenamiento"
   }
  },
  "hydrogen": {
   "price": 6500,
   "contacts": {
    "en": "19,000",
    "es": "19.000"
   },
   "scope": {
    "en": "Hydrogen newsletter",
    "es": "Newsletter de Hidrógeno"
   }
  }
 },
 "salespeople": {
  "cintia": {
   "name": "Cintia Hernández",
   "role": {
    "en": "Business Development · RENMAD Events",
    "es": "Desarrollo de Negocio · RENMAD Events"
   },
   "email": "cintia.hernandez@ata.email",
   "phone": "+34 605 40 85 93"
  },
  "ian": {
   "name": "Ian Casares",
   "role": {
    "en": "Business Development · RENMAD Events",
    "es": "Desarrollo de Negocio · RENMAD Events"
   },
   "email": "ian.casares@ata.email",
   "phone": "+34 665 161 069"
  },
  "sheetal": {
   "name": "Sheetal Shamdasani",
   "role": {
    "en": "Business Development & Sponsorship Director",
    "es": "Directora de Desarrollo de Negocio y Patrocinios"
   },
   "email": "sheetal.shamdasani@ata.email",
   "phone": "+34 630 637 276"
  }
 },
 "talksPackages": [
  {
   "id": "talk_panel",
   "group": "content",
   "price": 4000,
   "avail": 6,
   "name": {
    "en": "Sponsored Panel",
    "es": "Panel Patrocinado"
   },
   "incl": {
    "en": [
     "Seat on a 50-min panel alongside 3–4 sector-leading companies",
     "Positioning as a reference before the event's key audience",
     "1 panellist pass + 2 complimentary passes",
     "Visibility in the agenda, website and email communications"
    ],
    "es": [
     "Participación en un panel de 50 min junto a 3-4 empresas líderes del sector",
     "Posicionamiento como referente ante la audiencia clave del evento",
     "1 pase para el panelista + 2 pases de cortesía",
     "Visibilidad en agenda, web y comunicaciones por email"
    ]
   }
  },
  {
   "id": "talk_presentation",
   "group": "content",
   "price": 5500,
   "avail": 2,
   "name": {
    "en": "Individual Presentation",
    "es": "Presentación Individual"
   },
   "incl": {
    "en": [
     "Solo 20-min slot to present your value proposition, no shared stage",
     "Maximum brand and message exposure, undiluted",
     "1 speaker pass + 2 complimentary passes",
     "Visibility in the agenda, website and email communications"
    ],
    "es": [
     "Espacio en solitario de 20 min para presentar tu propuesta de valor sin compartir escenario",
     "Máxima exposición de marca y mensaje sin diluir",
     "1 pase para el ponente + 2 pases de cortesía",
     "Visibilidad en agenda, web y comunicaciones por email"
    ]
   }
  },
  {
   "id": "talk_coffee",
   "group": "branding",
   "price": 2000,
   "avail": 1,
   "name": {
    "en": "Coffee Sponsor",
    "es": "Coffee Sponsor"
   },
   "incl": {
    "en": [
     "Exclusive signage: \"Coffee sponsored by [Company]\"",
     "Presence in the agenda as official coffee sponsor",
     "Inclusion in website and email marketing",
     "Exclusive banner as Coffee Sponsor"
    ],
    "es": [
     "Señalética exclusiva: \"Coffee sponsored by [Company]\"",
     "Presencia en agenda como sponsor oficial del café",
     "Inclusión en web y email marketing",
     "Banner exclusivo como Coffee Sponsor"
    ]
   }
  },
  {
   "id": "talk_lunch",
   "group": "branding",
   "price": 3000,
   "avail": 1,
   "name": {
    "en": "Lunch Sponsor",
    "es": "Lunch Sponsor"
   },
   "incl": {
    "en": [
     "Exclusive branding during the official lunch",
     "Signage: \"Lunch sponsored by [Company]\"",
     "Agenda presence and digital promotion as Lunch Sponsor",
     "Inclusion in website and email marketing"
    ],
    "es": [
     "Branding exclusivo durante el almuerzo oficial",
     "Señalética: \"Lunch sponsored by [Company]\"",
     "Presencia en agenda y promoción digital como Lunch Sponsor",
     "Inclusión en web y email marketing"
    ]
   }
  },
  {
   "id": "talk_registration",
   "group": "branding",
   "price": 4000,
   "avail": 1,
   "name": {
    "en": "Registration Sponsor",
    "es": "Registration Sponsor"
   },
   "incl": {
    "en": [
     "Exclusive logo on speaker and attendee lanyards/badges",
     "Logo at the registration points (first event touchpoint)",
     "Logo as Registration Sponsor on the event website and app"
    ],
    "es": [
     "Logo exclusivo en las acreditaciones (lanyards) de ponentes y asistentes",
     "Logo en los puntos de registro (primer contacto con el evento)",
     "Logo como Registration Sponsor en web y app del evento"
    ]
   }
  }
 ],
 "talksEvents": [
  {
   "key": "E059",
   "name": "RENMAD Talks · BESS Invest 2026",
   "date_es": "22 sep 2026"
  },
  {
   "key": "E060",
   "name": "RENMAD Talks · Biometano 2026",
   "date_es": "6 oct 2026"
  },
  {
   "key": "E061",
   "name": "RENMAD Talks · Datacenters Off-Grid 2026",
   "date_es": "10 nov 2026"
  }
 ]
};


/* ===== proposal\build.js ===== */
/* Proposal deck assembly. Consumes the full data (data.js, generated from
   spx_data.py) + the picker's opts: { client, lang, events:[obj], packages:[id], brand }.
   Everything brand/layout lives in ../lib/renmad-deck.js so other builders reuse it. */
(function () {
  "use strict";
  const L = (o, lang) => (o && (o[lang] != null ? o[lang] : o.en)) || "";

  PB.buildDeck = function (opts) {
    const o = opts || {};
    const lang = o.lang || "en";
    const str = PB.strings[lang] || PB.strings.en;
    const events = (o.events && o.events.length) ? o.events : PB.events.filter((e) => !e.portfolio);
    const family = events[0] ? events[0].family : "storage";
    const accent = events[0] ? events[0].color : RENMAD.theme.orange;
    const ids = (o.packages && o.packages.length) ? o.packages : PB.packages.map((p) => p.id);
    const multi = events.length > 1;
    const d = RENMAD.newDeck();

    // Cover — for the specific event, or the portfolio when multi-event.
    RENMAD.slides.cover(d, {
      kicker: str.cover_kicker,
      title: multi ? "RENMAD Events" : (events[0] ? events[0].name : "RENMAD Events"),
      tag: multi ? (events.length + " events · " + str.cover_tag) : (events[0] ? (events[0].date[lang] + "  ·  " + events[0].city[lang]) : str.cover_tag),
      client: o.client || "",
      preparedFor: str.prepared_for,
    });

    // About RENMAD
    const about = RENMAD.slides.section(d, { kicker: str.about_k, title: str.about_t, accent: accent });
    if (str.about_body) about.addText(str.about_body, {
      x: 0.9, y: 4.35, w: 11.6, h: 2.5, fontFace: RENMAD.theme.fontBody, fontSize: 14.5,
      color: RENMAD.theme.ink, valign: "top", lineSpacingMultiple: 1.15,
    });

    // Calendar — the whole season (real events).
    RENMAD.slides.calendar(d, {
      title: str.events_t, sub: str.events_sub, accent: accent,
      events: PB.events.filter((e) => !e.portfolio).map((e) => ({
        name: e.name, date: e.date[lang], city: e.city[lang],
      })),
    });

    // Package slides — priced by the event's group, accented by the event colour.
    const priceNote = (str.pkg_price || "Price · {s}").replace("{s}", PB.families[family] || "");
    PB.packages.filter((p) => ids.includes(p.id)).forEach((p) => {
      RENMAD.slides.package(d, {
        name: L(p.name, lang), accent: accent, tagline: L(p.tagline, lang),
        price: p.price[family], priceNote: priceNote, incl: p.incl[lang] || p.incl.en || [],
      });
    });

    // Optional "prepared for" slide from the pulled client website.
    if (o.brand && o.brand.ok) {
      const s = RENMAD.slides.section(d, { kicker: str.prepared_for.toUpperCase(), title: o.brand.title || o.client || "", accent: accent });
      if (o.brand.images && o.brand.images[0]) {
        try { s.addImage({ data: o.brand.images[0].dataUrl, x: 8.7, y: 1.2, w: 3.7, h: 2.5, sizing: { type: "contain", w: 3.7, h: 2.5 } }); } catch (e) {}
      }
      if (o.brand.description) s.addText(o.brand.description, {
        x: 0.9, y: 4.35, w: 7.4, h: 2.4, fontFace: RENMAD.theme.fontBody, fontSize: 13, color: RENMAD.theme.ink, valign: "top",
      });
    }
    return d;
  };

  PB.generate = async function (opts) {
    const ev = opts && opts.events && opts.events[0];
    const fn = "RENMAD_proposal_" + ((ev ? ev.short : "multi").replace(/\s+/g, "_")) + ".pptx";
    return RENMAD.save(PB.buildDeck(opts), fn);
  };
  PB.toBase64 = async function (opts) { return RENMAD.toBase64(PB.buildDeck(opts)); };
})();


/* ===== proposal\pricing.js ===== */
/* ============================================================================
   RENMAD Proposal Builder — pricing (browser port)
   ----------------------------------------------------------------------------
   Faithful JS port of proposal_builder/pricing.py + the conservative per-event
   reduction in register.py, so a proposal built in the browser produces the
   EXACT same €-figures and SPX child lines as the Streamlit app.

   Mirrors:
     pricing.py  line_price()            -> linePrice()          (pricing.py:18-21)
     pricing.py  eur()                   -> eur()                (pricing.py:24-28)
     pricing.py  lines_from_selections() -> linesFromSelections()(pricing.py:31-52)
     pricing.py  quote()                 -> rawQuote()           (pricing.py:55-66)
     pricing.py  out_lines()             -> outLines()           (pricing.py:69-76)
     pricing.py  summarise_lines()       -> summariseLines()     (pricing.py:79-87)
     register.py _event_lines()          -> eventLines()         (register.py:358-375)
   Plus PBP.quote() = the conservative per-event line list + total that board.js
   turns into dc_spx_lines child rows (the board-facing shape the caller wants).

   Prices come from window.PB (data.js): PB.packages[].price[family], with the
   family taken from the event (PB.events[].family) — identical to
   pricing.line_price -> PACKAGES[pid]['price'][EVENTS_BY_KEY[ek]['family']].

   Python round() is round-half-to-EVEN (banker's rounding). JS Math.round is
   round-half-up, so pyRound() below reproduces Python exactly for the .5 cases
   a discount can produce (e.g. odd price * pct/100).
   ============================================================================ */
(function (global) {
  "use strict";

  function _data() { return global.PB || {}; }
  function _evByKey() {
    const m = {};
    (_data().events || []).forEach(function (e) { m[e.key] = e; });
    return m;
  }
  function _pkgById() {
    const m = {};
    (_data().packages || []).forEach(function (p) { m[p.id] = p; });
    return m;
  }
  // RENMAD Talks carry their OWN packages (flat price, not per-family) — data.js
  // PB.talksPackages. Events flagged type:"talks" price against this map instead.
  function _talksPkgById() {
    const m = {};
    (_data().talksPackages || []).forEach(function (p) { m[p.id] = p; });
    return m;
  }

  // Python round(): round half to even. All our values are positive.
  function pyRound(x) {
    const fl = Math.floor(x);
    const frac = x - fl;
    if (Math.abs(frac - 0.5) < 1e-9) return (fl % 2 === 0) ? fl : fl + 1;
    return Math.round(x);
  }

  // pricing.line_price (pricing.py:18-21): price of one package at one event =
  // that package's price for the event's family.
  function linePrice(eventKey, pid) {
    const ev = _evByKey()[eventKey];
    if (!ev) return 0;
    if (ev.type === "talks") {                       // Talks: flat, own package list
      const tp = _talksPkgById()[pid];
      return tp ? tp.price : 0;
    }
    const pkg = _pkgById()[pid];
    if (!pkg) return 0;
    return pkg.price[ev.family];
  }

  // pricing.eur (pricing.py:24-28): Spanish-style euro (1.234 €), None -> em dash.
  function eur(v) {
    if (v === null || v === undefined) return "—";
    const s = Math.round(v).toLocaleString("en-US").replace(/,/g, ".");
    return s + " €";
  }

  // pricing.lines_from_selections (pricing.py:31-52): selections=[[ek,[pids]],...]
  // -> flat per-package line list. Uses the event's precomputed `short` (data.js
  // already replicates D.event_short).
  function linesFromSelections(selections, lang) {
    lang = lang || "en";
    const EV = _evByKey(), PKG = _pkgById(), TPK = _talksPkgById();
    const out = [];
    (selections || []).forEach(function (sel) {
      const ek = sel[0], pids = sel[1] || [];
      if (!(ek in EV)) return;
      const ev = EV[ek];
      const isTalks = ev.type === "talks";
      pids.forEach(function (pid) {
        const pkg = isTalks ? TPK[pid] : PKG[pid];
        if (!pkg) return;
        out.push({
          event_key: ek,
          event: ev.name,
          event_short: ev.short,
          package: pid,
          package_label: pkg.name[lang],
          price: linePrice(ek, pid),
        });
      });
    });
    return out;
  }

  // pricing.quote (pricing.py:55-66): subtotal / discount / total for a flat bundle.
  function rawQuote(selections, discountPct, lang) {
    discountPct = discountPct || 0;
    const lines = linesFromSelections(selections, lang);
    const subtotal = lines.reduce(function (s, l) { return s + l.price; }, 0);
    const discEur = pyRound(subtotal * discountPct / 100);
    return {
      lines: lines,
      subtotal: subtotal,
      discount_pct: discountPct,
      discount_eur: discEur,
      total: subtotal - discEur,
    };
  }

  // pricing.out_lines (pricing.py:69-76): each line + its discount-adjusted value.
  function outLines(selections, discountPct, lang) {
    discountPct = discountPct || 0;
    const factor = (100 - discountPct) / 100.0;
    return linesFromSelections(selections, lang).map(function (l) {
      return Object.assign({}, l, { value: pyRound(l.price * factor) });
    });
  }

  // pricing.summarise_lines (pricing.py:79-87): [events_summary, packages_summary].
  function summariseLines(lines) {
    const events = [];
    (lines || []).forEach(function (l) {
      if (events.indexOf(l.event_short) === -1) events.push(l.event_short);
    });
    const eventsSummary = events.join(", ");
    const packagesSummary = (lines || [])
      .map(function (l) { return l.event_short + " · " + l.package_label; })
      .join("; ");
    return [eventsSummary, packagesSummary];
  }

  // register._event_lines (register.py:358-375): ONE conservative child line per
  // event. value = the SMALLEST selected package's (discounted) value at that
  // event; contents lists the package label(s) offered, joined by " / ".
  function eventLines(selections, discountPct, lang) {
    const out = outLines(selections, discountPct, lang);
    const order = [], byev = {};
    out.forEach(function (l) {
      const ek = l.event_key;
      if (!(ek in byev)) {
        byev[ek] = {
          eventKey: ek, eventName: l.event,
          valueEur: Number(l.value), labels: [l.package_label],
        };
        order.push(ek);
      } else {
        byev[ek].labels.push(l.package_label);
        byev[ek].valueEur = Math.min(byev[ek].valueEur, Number(l.value));
      }
    });
    return order.map(function (ek) {
      return {
        eventKey: byev[ek].eventKey,
        eventName: byev[ek].eventName,
        valueEur: byev[ek].valueEur,
        valueEdited: false,
        contents: byev[ek].labels.join(" / "),
      };
    });
  }

  // Board-facing quote: the conservative per-event lines + their sum. This is the
  // exact set of dc_spx_lines board.js POSTs, so it reproduces register.py's
  // record_single (menu -> smallest) / record_multi (sum of children) rules.
  //   1 package at an event  -> firm quote (that package's value)
  //   N packages at an event -> menu -> line value = SMALLEST package (min)
  //   several events         -> one line each; total = sum of the child lines
  //   no pick / whole deck   -> [] (caller flags isGeneral; board adds the
  //                             "General" value-0 placeholder line, Belen 18 Jul)
  // eventId is intentionally NOT set here (register.py never sets it -> the row's
  // eventId stays null; Jesus links the line to a Money/dc_finance row later).
  function quote(selections, discountPct, lang) {
    discountPct = discountPct || 0;
    lang = lang || "en";
    const lines = eventLines(selections, discountPct, lang).map(function (l) {
      return {
        eventKey: l.eventKey,
        eventId: null,
        eventName: l.eventName,
        valueEur: l.valueEur,
        valueEdited: false,
        contents: l.contents,
      };
    });
    const total = lines.reduce(function (s, l) { return s + l.valueEur; }, 0);
    return { lines: lines, total: total };
  }

  global.PBP = {
    pyRound: pyRound,
    linePrice: linePrice,
    eur: eur,
    linesFromSelections: linesFromSelections,
    rawQuote: rawQuote,
    outLines: outLines,
    summariseLines: summariseLines,
    eventLines: eventLines,
    quote: quote,
  };
})(window);


/* ===== proposal\deck.js ===== */
/* ============================================================================
   RENMAD Proposal Builder  ·  browser deck generator (PptxGenJS)
   ----------------------------------------------------------------------------
   Port of proposal_builder/deck_builder.py to a static, dependency-free
   browser build. Same slide SEQUENCE and copy, rendered in the browser.

   Exposes:  window.PBDECK = { buildFullDeck(opts) }  ->  PptxGenJS deck object

   opts = {
     client:      string  (client name)
     lang:        'en' | 'es'
     events:      [eventObj]        (from window.PB.events; events[0] is primary)
     packages:    [packageId]       (subset; empty/undefined => whole deck)
     brand:       { ok, title, description, images:[{dataUrl}] }  (optional, web-extractor)
     discountPct: number            (optional, informative only)
     salesperson: 'cintia'|'ian'|'sheetal' | {name,email,phone}   (optional)
   }

   Reads events / packages / STRINGS from window.PB (proposal/data.js) and the
   RENMAD theme + newDeck() from lib/renmad-deck.js. Requires several STRINGS
   keys and two package fields (pitch, highlights) that data.js does NOT yet
   carry — see the header note returned to Belén. Missing keys degrade
   gracefully (slide skipped or a fallback used) so the deck still renders.
   ============================================================================ */
(function (global) {
  "use strict";

  // ---- brand palette (mirrors deck_builder.py) ----------------------------
  var HEAD = "Montserrat", BODY = "Inter";
  var CH = "1C2529", IK = "26282E", GR = "F3F3F5", WH = "FFFFFF", MU = "7A7E84";
  var LN = "DDDDDD", DEEP = "101618", DM = "CDC8C4", SLATE = "363E42";
  var ALT = "ECECF0", TRACK = "E4E4E8";
  var SW = 13.333, SH = 7.5;
  var RENMAD_RED = "D32230", BIO_PURPLE = "483078";

  // ---- data not present in data.js (embedded here; not STRINGS) ------------
  var NEWSLETTERS = {
    general:  { price: 14500, contacts: { en: "51,000", es: "51.000" }, scope: { en: "General newsletter", es: "Newsletter general" } },
    storage:  { price: 9500,  contacts: { en: "31,000", es: "31.000" }, scope: { en: "Storage newsletter", es: "Newsletter de Almacenamiento" } },
    hydrogen: { price: 6500,  contacts: { en: "19,000", es: "19.000" }, scope: { en: "Hydrogen newsletter", es: "Newsletter de Hidrógeno" } },
  };
  var SALESPEOPLE = {
    cintia:  { name: "Cintia Hernández",   email: "cintia.hernandez@ata.email",   phone: "+34 605 40 85 93" },
    ian:     { name: "Ian Casares",        email: "ian.casares@ata.email",        phone: "+34 665 161 069" },
    sheetal: { name: "Sheetal Shamdasani", email: "sheetal.shamdasani@ata.email", phone: "+34 630 637 276" },
  };

  // Package comparison matrix (indexed pi 0..7 = std_stand .. diamond),
  // exactly as deck_builder.py. Row r (0=Diamond .. 7=Std·Stand) uses pi = 7-r.
  // Benefit order: Avail, Keynote, Present, Panel, Webinar, Brand, Passes, Interview, News, Stand.
  var BV = {
    1: ["–", "–", "–", "–", "–", "–", "✓", "✓"],                 // Keynote
    2: ["–", "–", "✓", "✓", "✓", "✓", "–", "–"],                 // Presentation
    3: ["–", "✓", "–", "–", "✓", "✓", "✓", "✓"],                 // Panel
    4: ["–", "–", "–", "–", "✓", "✓", "✓", "2"],                 // Webinar
    5: ["–", "–", "–", "–", "1", "1", "2", "2"],                 // Branding
    6: ["2", "2+1", "3", "5", "7", "7", "10", "12"],             // Passes
    7: ["–", "–", "–", "–", "–", "✓", "✓", "✓"],                 // Interview
    8: ["–", "–", "–", "–", "–", "–", "✓", "✓"],                 // Newsletter
    9: ["2×3", "–", "–", "2×3", "2×3", "4×6", "4×6", "6×9"],     // Stand
  };
  var BRANDING_TIERS = { diamond: 1, platinum: 1, gold: 1, silver: 1 };
  var BRANDING_EXCLUSIVE = { diamond: 1, platinum: 1 };

  // ---- colour helpers ------------------------------------------------------
  function hx(h) { h = String(h).replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function toHex(r, g, b) {
    return [r, g, b].map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      var s = v.toString(16);
      return s.length === 1 ? "0" + s : s;
    }).join("").toUpperCase();
  }
  function mix(h, other, t) { var a = hx(h); return toHex(a[0] + (other[0] - a[0]) * t, a[1] + (other[1] - a[1]) * t, a[2] + (other[2] - a[2]) * t); }
  function darken(h, t) { return mix(h, [0, 0, 0], t); }
  function eur(v) { return Number(v).toLocaleString("es-ES") + " €"; }

  // Extra-pass discount rendering ("X% / Y% (Invest)" -> only the one applying).
  function discountText(text, invest) {
    return String(text).replace(/(\d+)\s*%\s*\/\s*(\d+)\s*%(\s*\(Invest\))?/g,
      function (m, a, b) { return (invest ? b : a) + "%"; });
  }

  // ---- low-level slide helpers --------------------------------------------
  function tx(s, x, y, w, h, t, size, color, bold, font, align, valign, extra) {
    var o = { x: x, y: y, w: w, h: h, fontFace: font || BODY, fontSize: size || 14,
      color: color || CH, bold: !!bold, align: align || "left", valign: valign || "top" };
    if (extra) for (var k in extra) o[k] = extra[k];
    s.addText(t, o);
  }
  function rc(s, x, y, w, h, fill, opts) {
    opts = opts || {};
    var o = { x: x, y: y, w: w, h: h };
    if (fill === null || fill === undefined) o.fill = { color: "FFFFFF", transparency: 100 };
    else o.fill = { color: fill };
    if (opts.line) { o.line = { color: opts.line, width: opts.lw || 1 }; if (opts.dash) o.line.dashType = "dash"; }
    if (opts.rad != null) o.rectRadius = opts.rad;
    s.addShape(opts.rad != null ? "roundRect" : "rect", o);
  }
  function ell(s, x, y, d, fill) { s.addShape("ellipse", { x: x, y: y, w: d, h: d, fill: { color: fill } }); }
  function bar(s, x, y, w, h, frac, track, accent) {
    rc(s, x, y, w, h, track, { rad: h / 2 });
    if (frac > 0) rc(s, x, y, Math.max(h, w * frac), h, accent, { rad: h / 2 });
  }
  function addImg(s, x, y, w, h, dataUrl) {
    try {
      if (!dataUrl) return false;
      s.addImage({ data: dataUrl, x: x, y: y, w: w, h: h, sizing: { type: "cover", w: w, h: h } });
      return true;
    } catch (e) { return false; }
  }

  // ==========================================================================
  function buildFullDeck(opts) {
    opts = opts || {};
    var PB = global.PB || {};
    var RENMAD = global.RENMAD;
    var lang = opts.lang === "es" ? "es" : "en";
    var L = (PB.strings && PB.strings[lang]) || {};
    var arr = function (k) { return Array.isArray(L[k]) ? L[k] : []; };
    var str = function (k) { return L[k] != null ? L[k] : ""; };

    var events = (opts.events && opts.events.length) ? opts.events : [(PB.events || [])[0]];
    var ev = events[0] || {};
    var fam = ev.family || "storage";
    var isInvest = fam === "invest";
    var multi = events.length > 1;

    var accent = String(multi ? RENMAD_RED : (ev.color || "FF4A00")).replace("#", "");
    var O = accent;
    var OD = darken(accent, 0.20);
    var SOFT = mix(accent, [255, 255, 255], 0.90);
    var isBio = accent.toUpperCase() === BIO_PURPLE;
    var ODARK = isBio ? "9B7EDB" : accent;          // lighter accent for text on dark slides
    var PRICE_BG = CH, PRICE_LAB = DM, PRICE_VAL = mix(accent, [255, 255, 255], 0.42);

    var brand = opts.brand && opts.brand.ok ? opts.brand : null;
    var brandImgs = (brand && brand.images) ? brand.images.map(function (i) { return i && i.dataUrl; }).filter(Boolean) : [];
    var bimg = function (i) { return brandImgs.length ? brandImgs[i % brandImgs.length] : null; };
    var client = (opts.client || (brand && brand.title) || "").trim();

    // ---- package scope ----
    var allPkgs = PB.packages || [];
    var wantIds = opts.packages && opts.packages.length ? opts.packages : null;
    var chosen = wantIds ? allPkgs.filter(function (p) { return wantIds.indexOf(p.id) >= 0; }) : allPkgs.slice();
    var chosenIds = {}; chosen.forEach(function (p) { chosenIds[p.id] = 1; });
    var wholeDeck = !wantIds;
    var showComparison = wholeDeck;
    var showBrandExcl = Object.keys(chosenIds).some(function (id) { return BRANDING_EXCLUSIVE[id]; });
    var showBrandGeneral = Object.keys(chosenIds).some(function (id) { return BRANDING_TIERS[id]; });

    var sp = typeof opts.salesperson === "string" ? SALESPEOPLE[opts.salesperson]
      : (opts.salesperson || SALESPEOPLE.cintia);
    if (!sp) sp = SALESPEOPLE.cintia;

    var short = ev.short || String(ev.name || "").replace("RENMAD ", "").replace(/ 20\d\d/, "").trim();

    var pptx = RENMAD.newDeck();   // 13.333 x 7.5, RENMAD_16x9 layout

    // small top-right brand mark on content slides (logo assets not available in browser)
    function badge(s) { tx(s, 9.9, 0.42, 2.72, 0.34, "RENMAD EVENTS", 11, MU, true, HEAD, "right"); }
    function kicker(s, x, y, k, title, tsize, tcolor) {
      tx(s, x, y, 10, 0.3, k, 13, O, true, HEAD);
      tx(s, x, y + 0.30, 11.5, 0.7, title, tsize || 30, tcolor || CH, true, HEAD);
      rc(s, x + 0.02, y + 0.95, 0.62, 0.05, O);
    }

    // ===== 1 COVER =========================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CH };
      addImg(s, SW - 4.7, 0, 4.7, SH, bimg(0));
      rc(s, SW - 4.7, 0, 0.06, SH, O);
      tx(s, 0.95, 1.30, 6, 0.9, "RENMAD", 44, WH, true, HEAD);
      tx(s, 0.97, 2.18, 6, 0.4, "EVENTS", 19, O, true, HEAD, "left", "top", { charSpacing: 6 });
      tx(s, 0.95, 3.50, 7.3, 0.5, str("cover_kicker"), 26, WH, true, HEAD);
      tx(s, 0.95, 4.12, 7.3, 1.3, str("cover_tag"), 20, WH, true, HEAD, "left", "top", { lineSpacingMultiple: 1.1 });
      if (client) {
        tx(s, 0.95, 5.55, 6, 0.4, str("prepared_for"), 18, DM, false, BODY);
        tx(s, 0.95, 5.95, 6.5, 0.8, client, 30, WH, true, HEAD);
      }
    })();

    // ===== 2 ABOUT + STATS =================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.55, str("about_k"), str("about_t"));
      if (!addImg(s, 9.55, 1.75, 3.0, 4.55, bimg(1))) rc(s, 9.55, 1.75, 3.0, 4.55, mix(accent, [255, 255, 255], 0.82), { rad: 0.08 });
      tx(s, 0.7, 1.75, 8.5, 2.1, str("about_body"), 18, IK, false, BODY, "left", "top", { lineSpacingMultiple: 1.25 });
      var stats = arr("stats"), x0 = 0.7, y0 = 4.25, bw = 2.55, bh = 1.35, gx = 0.18, gy = 0.2;
      stats.forEach(function (row, i) {
        var n = row[1], l = row[2];
        var x = x0 + (i % 3) * (bw + gx), y = y0 + Math.floor(i / 3) * (bh + gy);
        rc(s, x, y, bw, bh, WH, { line: LN, lw: 1, rad: 0.08 });
        ell(s, x + 0.18, y + 0.2, 0.66, O);
        tx(s, x + 0.95, y + 0.16, bw - 1.0, 0.5, n, 26, CH, true, HEAD);
        tx(s, x + 0.95, y + 0.74, bw - 1.0, 0.4, l, 13, MU, false, BODY);
      });
      badge(s);
    })();

    // ===== 3 ATTENDEE PROFILE ==============================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.55, str("attendee_k"), str("attendee_t"));
      tx(s, 0.7, 1.85, 5, 0.3, str("sector_dist"), 15, CH, true, HEAD);
      arr("sectors").forEach(function (row, i) {
        var nm = row[0], v = row[1], y = 2.3 + i * 0.62;
        tx(s, 0.7, y, 4, 0.3, nm, 13, IK, false, BODY);
        bar(s, 0.7, y + 0.3, 4.7, 0.22, v / 100, TRACK, O);
      });
      rc(s, 6.1, 1.9, 6.5, 1.7, WH, { line: LN, lw: 1, rad: 0.08 });
      ell(s, 6.45, 2.25, 0.95, O);
      tx(s, 7.65, 2.2, 4.6, 0.7, "75%", 46, CH, true, HEAD);
      tx(s, 7.65, 3.05, 4.6, 0.4, str("big75_sub"), 15, MU, false, BODY);
      tx(s, 6.1, 3.95, 4, 0.3, str("seniority"), 15, CH, true, HEAD);
      arr("seniority_rows").forEach(function (row, i) {
        var nm = row[0], v = row[1], y = 4.45 + i * 0.6;
        tx(s, 6.1, y, 2.0, 0.3, nm, 13, IK, false, BODY);
        bar(s, 8.0, y + 0.02, 3.5, 0.22, v / 100, TRACK, O);
        tx(s, 11.6, y - 0.02, 1.0, 0.3, v + "%", 15, O, true, HEAD);
      });
      badge(s);
    })();

    // ===== 4 WHY SPONSOR ===================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.55, str("why_k"), str("why_t"));
      var x0 = 0.7, y0 = 1.85, bw = 5.85, bh = 2.3, g = 0.3;
      arr("why_cards").forEach(function (c, i) {
        var t = c[1], b = c[2];
        var x = x0 + (i % 2) * (bw + g), y = y0 + Math.floor(i / 2) * (bh + g);
        rc(s, x, y, bw, bh, WH, { line: LN, lw: 1, rad: 0.08 });
        rc(s, x, y, 0.1, bh, O);
        ell(s, x + 0.35, y + 0.35, 0.95, O);
        tx(s, x + 1.55, y + 0.42, bw - 1.7, 0.7, t, 22, CH, true, HEAD);
        tx(s, x + 0.35, y + 1.4, bw - 0.7, 0.8, b, 15, IK, false, BODY, "left", "top", { lineSpacingMultiple: 1.2 });
      });
      badge(s);
    })();

    // ===== 5 EVENTS CALENDAR (2026 + 2027) =================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.5, str("events_k"), str("events_t"));
      var calEvents = (ev.members && ev.members.length)
        ? ev.members.map(function (k) { return (PB.events || []).find(function (x) { return x.key === k; }); }).filter(Boolean)
        : (PB.events || []);
      var e26 = calEvents.filter(function (e) { return e.name.indexOf("2026") >= 0; });
      var e27 = calEvents.filter(function (e) { return e.name.indexOf("2027") >= 0; });
      var HY = 1.78, BOT = 6.66;
      var Lx, Lw, Rx, Rw;
      if (e26.length) { Lx = 0.7; Lw = 3.95; Rx = 4.9; Rw = 7.7; }
      else { Lx = null; Lw = 0; Rx = 0.7; Rw = 11.93; }

      // LEFT: 2026 cards
      if (e26.length) {
        rc(s, Lx, HY, Lw, 0.46, SLATE, { rad: 0.08 });
        tx(s, Lx + 0.26, HY, Lw - 0.45, 0.46, str("cal_2026_h"), 12.5, WH, true, HEAD, "left", "middle");
        var ry = HY + 0.62, rh = (BOT - ry - (e26.length - 1) * 0.16) / e26.length;
        e26.forEach(function (e) {
          var sel = e.key === ev.key, ec = String(e.color).replace("#", "");
          rc(s, Lx, ry, Lw, rh, sel ? O : WH, sel ? { rad: 0.08 } : { line: LN, lw: 1, rad: 0.08 });
          rc(s, Lx, ry, 0.11, rh, sel ? WH : ec);
          var gy = ry + (rh - 0.92) / 2;
          tx(s, Lx + 0.34, gy, Lw - 0.55, 0.4, e.short, 15, sel ? WH : CH, true, HEAD);
          tx(s, Lx + 0.34, gy + 0.44, Lw - 0.55, 0.26, e.date[lang], 11.5, sel ? WH : ec, true, BODY);
          tx(s, Lx + 0.34, gy + 0.7, Lw - 0.55, 0.24, e.city[lang], 10.5, sel ? DM : MU, false, BODY);
          ry += rh + 0.16;
        });
      }

      // RIGHT: 2027 table
      var hdr = str("cal_2027_h") + "  ·  " + e27.length + " " + String(str("cal_summits") || "summits").toUpperCase();
      rc(s, Rx, HY, Rw, 0.46, SLATE, { rad: 0.08 });
      tx(s, Rx + 0.26, HY, Rw - 0.45, 0.46, hdr, 12.5, WH, true, HEAD, "left", "middle");
      var ry2 = HY + 0.62, rh2 = (BOT - ry2 - (e27.length - 1) * 0.08) / Math.max(1, e27.length);
      e27.forEach(function (e, i) {
        var sel = e.key === ev.key;
        var ec = String(e.color).replace("#", "").toUpperCase() === accent.toUpperCase() ? O : CH;
        rc(s, Rx, ry2, Rw, rh2, sel ? O : (i % 2 ? WH : ALT), { rad: 0.06 });
        ell(s, Rx + 0.24, ry2 + rh2 / 2 - 0.09, 0.18, sel ? WH : ec);
        tx(s, Rx + 0.62, ry2, 2.55, rh2, e.short, 12.5, sel ? WH : CH, true, HEAD, "left", "middle");
        tx(s, Rx + 3.25, ry2, 1.9, rh2, e.date[lang], 11, sel ? WH : ec, true, BODY, "left", "middle");
        tx(s, Rx + 5.3, ry2, 2.3, rh2, e.city[lang], 11, sel ? DM : MU, false, BODY, "left", "middle");
        ry2 += rh2 + 0.08;
      });
      badge(s);
    })();

    // ===== 6 EVENT DIVIDER =================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CH };
      if (!addImg(s, 0, 0, SW, 4.6, bimg(2))) rc(s, 0, 0, SW, 4.6, darken(accent, 0.35));
      rc(s, 0, 3.4, SW, 1.2, CH);
      tx(s, 0.85, 1.15, 8, 1.0, ev.name || "RENMAD Events", 34, WH, true, HEAD, "left", "middle");
      if (client) {
        tx(s, 7.5, 3.78, 5.1, 0.32, str("proposal_for"), 15, DM, true, BODY, "right");
        tx(s, 7.5, 4.16, 5.1, 0.7, client, 26, WH, true, HEAD, "right");
      }
      var nm = ev.name || "RENMAD Events";
      tx(s, 0.9, 5.12, 11.95, 0.95, nm, nm.length <= 26 ? 40 : 34, WH, true, HEAD);
      rc(s, 0.9, 6.15, 0.6, 0.06, ODARK);
      tx(s, 0.9, 6.35, 11.6, 0.4, (ev.date ? ev.date[lang] : "") + "   ·   " + (ev.city ? ev.city[lang] : ""), 18, ODARK, true, HEAD);
    })();

    // ===== 7 COMPARISON (whole deck only) ==================================
    if (showComparison) {
      var s = pptx.addSlide(); s.background = { color: GR };
      tx(s, 0.7, 0.5, 9, 0.5, str("comp_title"), 30, CH, true, HEAD);
      tx(s, 0.7, 1.15, 9.9, 0.3, str("comp_sub"), 13, MU, false, BODY);
      var benefits = arr("benefits");                       // 10 labels
      var compRows = arr("comp_rows");                      // 8 package labels (Diamond-first)
      // avail row values come from the package data (row r -> packages[r].avail)
      var availOf = function (r) { var p = allPkgs[r]; return (p && p.avail) ? String(p.avail) : "–"; };

      var TX = 0.7, TY = 1.72, TW = 11.93, C0 = 1.78;
      var CW = (TW - C0) / benefits.length;
      var colW = [C0]; for (var c = 0; c < benefits.length; c++) colW.push(CW);
      var rowH = 5.15 / (compRows.length + 1);

      var header = [{ text: str("comp_pkgcol"), options: { fill: { color: SLATE }, color: WH, bold: true, fontSize: 12, fontFace: BODY, align: "left", valign: "middle" } }];
      benefits.forEach(function (b) {
        header.push({ text: b, options: { fill: { color: SLATE }, color: WH, bold: true, fontSize: 10, fontFace: BODY, align: "center", valign: "middle" } });
      });

      var tableRows = [header];
      compRows.forEach(function (pname, r) {
        var pi = 7 - r, dia = r === 0;
        var bg = dia ? O : ((r + 1) % 2 ? ALT : WH);   // ri=r+1: even -> ALT, odd -> WH (Diamond=accent)
        var row = [{ text: pname, options: { fill: { color: bg }, color: dia ? WH : CH, bold: true, fontSize: 12, fontFace: BODY, align: "left", valign: "middle", margin: [1, 1, 1, 6] } }];
        for (var j = 0; j < benefits.length; j++) {
          var v = j === 0 ? availOf(r) : (BV[j] ? BV[j][pi] : "–");
          var col;
          if (v === "✓") col = dia ? WH : O;
          else if (v === "–") col = dia ? "FFCFB8" : "BBBBC0";
          else col = dia ? WH : CH;
          row.push({ text: v, options: { fill: { color: bg }, color: col, bold: true, fontSize: v === "✓" ? 12 : 12, fontFace: BODY, align: "center", valign: "middle" } });
        }
        tableRows.push(row);
      });
      s.addTable(tableRows, { x: TX, y: TY, w: TW, colW: colW, rowH: rowH, valign: "middle", border: { type: "solid", color: "FFFFFF", pt: 1 }, autoPage: false });
    }

    // ===== 8..15 PACKAGE SLIDES ===========================================
    chosen.forEach(function (pk) {
      var s = pptx.addSlide(); s.background = { color: GR };
      var name = pk.name[lang], tagline = pk.tagline[lang], good = pk.good[lang];
      var pitch = (pk.pitch && pk.pitch[lang]) || good;            // fallback: pitch not in data.js yet
      var highlights = (pk.highlights && pk.highlights[lang]) || [];
      var incl = (pk.incl[lang] || []).map(function (it) { return discountText(it, isInvest); });
      var price = pk.price[fam];

      rc(s, 0, 0, SW, 1.55, O);
      tx(s, 0.7, 0.32, 8.5, 0.7, name.toUpperCase(), 38, WH, true, HEAD);
      tx(s, 0.7, 1.08, 8.5, 0.35, tagline, 17, WH, false, HEAD);
      if (pk.avail) {
        var avTxt = lang === "es" ? (pk.avail + " disponible" + (pk.avail !== 1 ? "s" : "")) : (pk.avail + " available");
        var apw = 2.45, aph = 0.52, apx = 12.63 - apw, apy = 0.5;
        rc(s, apx, apy, apw, aph, null, { line: WH, lw: 1.5, rad: aph / 2 });
        tx(s, apx, apy, apw, aph, avTxt, 15, WH, true, HEAD, "center", "middle");
      }
      // "Good for" pill
      rc(s, 0.7, 1.85, 11.95, 0.74, SOFT, { rad: 0.08 });
      ell(s, 0.92, 2.02, 0.42, O);
      tx(s, 1.5, 1.97, 2, 0.3, str("pkg_goodfor"), 13, OD, true, HEAD);
      tx(s, 1.5, 2.2, 11, 0.3, String(good).replace(/\.$/, ""), 15, CH, true, BODY);
      // pitch
      tx(s, 0.7, 2.95, 7.3, 1.45, pitch, 14, IK, false, BODY, "left", "top", { lineSpacingMultiple: 1.22 });
      // what's included
      tx(s, 0.7, 4.5, 4, 0.3, str("pkg_included"), 16, CH, true, HEAD);
      var by = 4.92;
      incl.forEach(function (it) {
        s.addText([
          { text: "✓  ", options: { color: O, bold: true } },
          { text: it, options: { color: IK } },
        ], { x: 0.7, y: by, w: 7.35, h: 0.4, fontFace: BODY, fontSize: 13, valign: "top" });
        by += 0.30;
      });
      // right column: highlight tiles (if available)
      var hy = 2.9;
      highlights.forEach(function (hl) {
        var t = Array.isArray(hl) ? hl[1] : hl;
        rc(s, 8.4, hy, 4.25, 0.5, WH, { line: LN, lw: 1, rad: 0.06 });
        ell(s, 8.56, hy + 0.11, 0.28, O);
        tx(s, 9.05, hy, 3.45, 0.5, t, 13, CH, true, BODY, "left", "middle");
        hy += 0.58;
      });
      // price plate
      rc(s, 8.4, 5.95, 4.25, 1.0, PRICE_BG, { rad: 0.08 });
      tx(s, 8.65, 6.08, 3.8, 0.3, String(str("pkg_price")).replace("{s}", short), 11, PRICE_LAB, false, BODY);
      tx(s, 8.65, 6.36, 3.8, 0.5, eur(price), 32, PRICE_VAL, true, HEAD);
    });

    // ===== 16 EXCLUSIVE BRANDING (Platinum/Diamond) ========================
    if (showBrandExcl) {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.5, str("brand_k"), str("brand2_t"));
      var x0 = 0.7, y0 = 1.95, bw = 5.85, bh = 2.15, g = 0.3;
      arr("brand2").forEach(function (c, i) {
        var nm = c[1], desc = c[2];
        var x = x0 + (i % 2) * (bw + g), y = y0 + Math.floor(i / 2) * (bh + g);
        rc(s, x, y, bw, bh, WH, { line: LN, lw: 1, rad: 0.08 });
        rc(s, x, y, 0.1, bh, O);
        ell(s, x + 0.35, y + 0.3, 0.95, O);
        tx(s, x + 1.55, y + 0.42, bw - 1.7, 0.6, nm, 19, CH, true, HEAD);
        tx(s, x + 0.35, y + 1.25, bw - 0.7, 0.8, desc, 14, IK, false, BODY, "left", "top", { lineSpacingMultiple: 1.18 });
      });
      badge(s);
    }

    // ===== 17 BRANDING OPTIONS (Silver/Gold) ===============================
    if (showBrandGeneral) {
      var s2 = pptx.addSlide(); s2.background = { color: GR };
      kicker(s2, 0.7, 0.5, str("brand_k"), str("brand_t"));
      tx(s2, 0.7, 1.7, 11.9, 0.5, str("brand_intro"), 14, IK, false, BODY);
      var bcard = function (x, head, items) {
        var w = 5.85, h = 4.5;
        rc(s2, x, 2.35, w, h, WH, { line: LN, lw: 1, rad: 0.08 });
        rc(s2, x, 2.35, w, 0.5, O, { rad: 0.08 });
        tx(s2, x + 0.28, 2.35, w - 0.4, 0.5, head, 15, WH, true, HEAD, "left", "middle");
        var yy = 3.16;
        items.forEach(function (it) {
          var nm = it[1], desc = it[2];
          ell(s2, x + 0.28, yy + 0.05, 0.54, SOFT);
          tx(s2, x + 1.0, yy - 0.03, w - 1.18, 0.34, nm, 16.5, CH, true, HEAD);
          tx(s2, x + 1.0, yy + 0.32, w - 1.18, 0.46, desc, 13.5, IK, false, BODY);
          yy += 0.8;
        });
      };
      bcard(0.7, str("brand_silver_head"), arr("brand_silver"));
      bcard(6.78, str("brand_gold_head"), arr("brand_gold"));
      badge(s2);
    }

    // add-on "optional extra" note
    function addonNote(s) {
      rc(s, 0.7, 1.62, 5.05, 0.44, SOFT, { rad: 0.22 });
      tx(s, 0.7, 1.62, 5.05, 0.44, str("addon_note"), 11.5, OD, true, BODY, "center", "middle");
    }
    var SWHT = "E6E6EC";

    // ===== 18 ADD-ON · WEBINAR =============================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.55, str("addons_k"), str("webinar_t"));
      addonNote(s);
      tx(s, 0.7, 2.45, 7.45, 1.2, str("webinar_body"), 17, IK, false, BODY, "left", "top", { lineSpacingMultiple: 1.25 });
      var yy = 3.95;
      arr("webinar_feats").forEach(function (f) {
        var t = Array.isArray(f) ? f[1] : f;
        ell(s, 0.7, yy + 0.08, 0.5, O);
        tx(s, 1.35, yy, 6.9, 0.66, t, 18, CH, false, BODY, "left", "middle", { lineSpacingMultiple: 1.04 });
        yy += 0.82;
      });
      var ox = 8.4, ow = 4.25, oy = 1.95;
      [[str("webinar_opt1_t"), str("webinar_opt1_s"), 5500, O],
       [str("webinar_opt2_t"), str("webinar_opt2_s"), 3500, CH]].forEach(function (opt) {
        rc(s, ox, oy, ow, 2.5, opt[3], { rad: 0.08 });
        tx(s, ox + 0.34, oy + 0.32, ow - 0.62, 0.5, opt[0], 20, WH, true, HEAD);
        tx(s, ox + 0.34, oy + 0.92, ow - 0.66, 0.8, opt[1], 13.5, SWHT, false, BODY, "left", "top", { lineSpacingMultiple: 1.15 });
        tx(s, ox + 0.34, oy + 1.78, ow - 0.6, 0.6, eur(opt[2]), 34, WH, true, HEAD);
        oy += 2.7;
      });
      badge(s);
    })();

    // ===== 19 ADD-ON · NEWSLETTER ==========================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.55, str("news_k"), str("news_t"));
      addonNote(s);
      tx(s, 0.7, 2.35, 11.95, 0.8, str("news_body"), 15.5, IK, false, BODY, "left", "top", { lineSpacingMultiple: 1.18 });
      var cx = 0.7, cw = 3.78, g = 0.305, cy = 3.5, chh = 3.2;
      ["general", "storage", "hydrogen"].forEach(function (nk, i) {
        var nl = NEWSLETTERS[nk], x = cx + i * (cw + g);
        rc(s, x, cy, cw, chh, WH, { line: LN, lw: 1, rad: 0.08 });
        rc(s, x, cy, cw, 0.62, O, { rad: 0.08 });
        tx(s, x + 0.24, cy, cw - 0.45, 0.62, nl.scope[lang], 15.5, WH, true, HEAD, "left", "middle");
        tx(s, x + 0.32, cy + 0.9, cw - 0.6, 0.5, nl.contacts[lang], 30, CH, true, HEAD);
        tx(s, x + 0.34, cy + 1.48, cw - 0.6, 0.34, str("news_reach"), 13, IK, false, BODY);
        rc(s, x + 0.3, cy + 1.98, cw - 0.6, 1.0, PRICE_BG, { rad: 0.08 });
        tx(s, x + 0.54, cy + 2.1, cw - 0.95, 0.3, str("news_year"), 12.5, PRICE_LAB, true, BODY);
        tx(s, x + 0.54, cy + 2.43, cw - 0.95, 0.5, eur(nl.price), 30, PRICE_VAL, true, HEAD);
      });
      tx(s, 0.7, 6.92, 11.95, 0.4, str("news_foot"), 12.5, MU, false, BODY);
      badge(s);
    })();

    // ===== 20 MULTI-EVENT SAVINGS (only when >1 event) =====================
    if (multi) {
      var s = pptx.addSlide(); s.background = { color: GR };
      kicker(s, 0.7, 0.5, str("save_k"), str("save_t"));
      tx(s, 0.7, 1.7, 11.9, 0.5, str("save_intro"), 14, IK, false, BODY);
      if (!addImg(s, 0.7, 2.3, 11.95, 1.4, bimg(3))) rc(s, 0.7, 2.3, 11.95, 1.4, darken(accent, 0.25), { rad: 0.18 });
      tx(s, 0.95, 2.55, 8, 0.8, String(str("save_hero")).replace(/\n/g, " "), 26, WH, true, HEAD);
      var x0 = 0.7, cw = 2.86, g = 0.27;
      arr("save_tiers").forEach(function (t, i) {
        var n = t[0], lab = t[1], val = t[2], hl = t[3];
        var x = x0 + i * (cw + g);
        rc(s, x, 4.0, cw, 2.4, hl ? O : WH, hl ? { rad: 0.08 } : { line: LN, lw: 1, rad: 0.08 });
        rc(s, x + cw / 2 - 0.55, 4.3, 1.1, 1.1, null, { line: hl ? WH : O, lw: 6, rad: 0.55 });
        tx(s, x + cw / 2 - 0.55, 4.3, 1.1, 1.1, n, 40, hl ? WH : O, true, HEAD, "center", "middle");
        tx(s, x, 5.55, cw, 0.4, lab, 16, hl ? WH : MU, true, HEAD, "center");
        var vsize = /\d/.test(val) ? 26 : 19;
        tx(s, x + 0.08, 5.9, cw - 0.16, 0.48, val, vsize, hl ? WH : CH, true, HEAD, "center", "middle");
      });
      tx(s, 0.7, 6.7, 11, 0.3, str("save_foot"), 11, MU, false, BODY);
      badge(s);
    }

    // ===== 21 CONTACT ======================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: DEEP };
      var pw = 4.8;
      if (!addImg(s, SW - pw, 0, pw, SH, bimg(4))) rc(s, SW - pw, 0, pw, SH, darken(accent, 0.30));
      rc(s, 0, 0, 0.14, SH, O);
      // decorative accent dots (stand-ins for the deck's stars)
      ell(s, SW - pw - 0.9, 0.5, 0.7, ODARK);
      ell(s, SW - pw - 0.4, 1.3, 0.42, mix(accent, [255, 255, 255], 0.45));
      tx(s, 0.6, 0.55, 5, 0.3, str("contact_k"), 14, ODARK, true, HEAD);
      rc(s, 0.62, 0.98, 0.9, 0.05, ODARK);
      tx(s, 0.6, 1.2, 7.3, 1.3, str("contact_t"), 34, WH, true, HEAD, "left", "top", { lineSpacingMultiple: 1.02 });
      tx(s, 0.6, 2.7, 7.3, 0.5, str("contact_sub"), 14, DM, false, BODY);
      var cy = 3.62;
      ell(s, 0.6, cy, 0.52, O);
      tx(s, 1.4, cy, 6.7, 0.52, sp.name, 18, WH, true, HEAD, "left", "middle"); cy += 0.58;
      ell(s, 0.6, cy, 0.52, O);
      s.addText(sp.phone, { x: 1.4, y: cy, w: 6.7, h: 0.52, fontFace: HEAD, fontSize: 18, color: WH, bold: true, valign: "middle", hyperlink: { url: "tel:" + sp.phone.replace(/\s/g, "") } }); cy += 0.58;
      ell(s, 0.6, cy, 0.52, O);
      s.addText(sp.email, { x: 1.4, y: cy, w: 6.7, h: 0.52, fontFace: HEAD, fontSize: 18, color: WH, bold: true, valign: "middle", hyperlink: { url: "mailto:" + sp.email } }); cy += 0.58;
      rc(s, 0.6, 5.92, 7.3, 0.02, "393E44");
      tx(s, 0.6, 6.26, 5, 0.5, "RENMAD EVENTS", 20, WH, true, HEAD);
      if (client) {
        tx(s, 3.95, 6.02, 3.3, 0.24, str("prepared_for"), 11, DM, true, BODY);
        tx(s, 3.95, 6.3, 3.3, 0.4, client, 18, WH, true, HEAD);
      }
    })();

    return pptx;
  }

  global.PBDECK = { buildFullDeck: buildFullDeck };
})(window);


/* ===== proposal\board.js ===== */
/* ============================================================================
   RENMAD Proposal Builder — SPX board write (browser port)
   ----------------------------------------------------------------------------
   Faithful JS port of proposal_builder/register.py's board-write path, so a
   proposal built in the browser lands an IDENTICAL row on the SPX board.

   Mirrors:
     register._new_id()        -> newId()      (register.py:168-177; = store.js newId)
     register._parent()        -> buildParent()(register.py:378-411)
     register._write_dispatch()-> buildLines()+submit() (register.py:180-232)
     register._dc_rest()       -> _dcRest()    (register.py:180-190)
     dc_auth DC_SUPABASE_URL / DC_ANON_KEY     (dc_auth.py:22-25)

   The parent goes to POST /rest/v1/dc_spx_proposals, the children to
   /rest/v1/dc_spx_lines, with the same headers register._dc_rest uses
   (apikey=anon, Authorization=Bearer <token>, Prefer=return=minimal). Anti-loss:
   any failure is LOUD and returned as {ok:false, reason, audit} — never silently
   dropped; nothing throws out of submit().

   Token: the page passes the logged-in colleague's fresh Supabase access token as
   opts.token (Dispatch), so RLS + the audit trail record the write AS that
   person; without one we fall back to the anon key (local POC).
   ============================================================================ */
(function (global) {
  "use strict";

  // dc_auth.py:22-25 — the PUBLIC Dispatch Center client credentials (same values
  // shipped in store.js and used by proposal/index.html's extractor.configure).
  const DC_SUPABASE_URL = "https://dxgvbufsifgowwfggvmr.supabase.co";
  const DC_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3ZidWZzaWZnb3d3Zmdndm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODM1OTUsImV4cCI6MjA5ODA1OTU5NX0." +
    "EDMWWjMuDM0jS0d0SwzdhuW_ZnHP0T0kqwL3xc6Cw-w";

  // register._new_id (register.py:168-177) == store.js DB.newId (store.js:1686):
  // epoch-millis*10 + a random digit, kept strictly monotonic within the session
  // so builder- and app-created rows never collide.
  let _lastId = 0;
  function newId() {
    let id = Date.now() * 10 + Math.floor(Math.random() * 10);
    if (id <= _lastId) id = _lastId + 1;
    _lastId = id;
    return id;
  }

  function _today() {
    // datetime.now().strftime("%Y-%m-%d") — stored field, must stay ISO for parity
    // with register._parent (this is a DB value, not a user-facing display date).
    const d = new Date();
    const p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  // register._parent (register.py:378-411). opts:
  //   { spKey, spName, spEmail, client, source, zoho:{accountType,productPackage,
  //     packageTier,followUp}, contacts, mode, fileName, quote, isGeneral,
  //     createdBy, contents? }
  // `quote` is a PBP.quote() result ({lines,total}); quote.lines are the
  // conservative per-event child lines.
  function buildParent(opts) {
    opts = opts || {};
    const isGeneral = !!opts.isGeneral;
    const q = opts.quote || { lines: [], total: 0 };
    const lines = q.lines || [];
    const z = opts.zoho || {};

    let value, contents;
    if (isGeneral) {
      // General = a placeholder line, value 0 (Belen 18 Jul).
      value = 0.0;
      contents = "General";
    } else {
      value = lines.reduce(function (s, l) { return s + l.valueEur; }, 0);
      if (opts.contents !== undefined && opts.contents !== null) {
        contents = opts.contents;
      } else if (lines.length > 1) {
        contents = lines
          .map(function (l) { return l.eventName + ": " + l.contents; })
          .join("; ");
      } else {
        contents = lines.length ? lines[0].contents : "";
      }
    }

    return {
      createdBy: opts.createdBy || "",
      responsable: opts.spKey,
      responsableName: opts.spName,
      responsableEmail: opts.spEmail || "",
      company: opts.client,
      companyId: null,
      source: opts.source || "",
      origen: null,
      accountType: z.accountType || null,
      stage: "Sent - Just email",
      salesStatus: "Sent",
      productPackage: z.productPackage || null,
      packageTier: z.packageTier || null,
      reasonForLoss: null,
      contents: contents,
      valueEur: value,
      valueEdited: false,
      fechaEnvio: _today(),
      fechaSeguimiento: z.followUp || null,
      notas: "",
      contacts: opts.contacts || [],
      fileName: opts.fileName,
      sentLink: null,
      isGeneral: isGeneral,
      mode: opts.mode,
      active: true,
      superseded: false,
    };
  }

  // register._write_dispatch child rows (register.py:208-215): one child per event
  // = dict(line, id=_new_id(), parentId=pid). For a General/whole-deck proposal
  // with no lines, one "General" value-0 placeholder line is added so it still
  // appears in the board's event-grouped views (register.py:208-210).
  function buildLines(quote, parentId, isGeneral) {
    quote = quote || { lines: [] };
    let lines = quote.lines || [];
    if (isGeneral && !lines.length) {
      lines = [{
        eventKey: "general", eventId: null, eventName: "General",
        valueEur: 0.0, valueEdited: false, contents: "General",
      }];
    }
    const pid = (parentId != null) ? parentId : newId();
    return lines.map(function (l) {
      return Object.assign({}, l, { id: newId(), parentId: pid });
    });
  }

  function _auditBase(parent) {
    return {
      ts: new Date().toISOString().replace("T", " ").slice(0, 19),
      company: parent.company,
      fileName: parent.fileName,
      responsable: parent.responsableName || parent.responsable || "",
    };
  }

  // register._dc_rest (register.py:180-190). Loud on any non-2xx: throws with the
  // response body so the caller surfaces it instead of dropping the row.
  async function _dcRest(method, table, token, rows, params) {
    let url = DC_SUPABASE_URL + "/rest/v1/" + table;
    if (params) {
      const qs = Object.keys(params)
        .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); })
        .join("&");
      if (qs) url += "?" + qs;
    }
    const r = await fetch(url, {
      method: method,
      headers: {
        apikey: DC_ANON_KEY,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: (rows !== undefined && rows !== null) ? JSON.stringify(rows) : undefined,
    });
    if (r.status !== 200 && r.status !== 201 && r.status !== 204) {
      let body = "";
      try { body = (await r.text()).slice(0, 300); } catch (e) { body = "(no body)"; }
      throw new Error("dispatch " + method + " " + table + " failed: " + r.status + " " + body);
    }
    return r;
  }

  // register._write_dispatch + register._insert dispatch path (register.py:193-232,
  // 329-331). Mints/uses a fresh token (opts.token from the page; anon fallback),
  // POSTs the parent then the children, then best-effort supersedes this company's
  // older active proposals. Never throws — returns {ok:true,id} or
  // {ok:false,reason,audit}; every attempt is durable in the returned audit.
  async function submit(opts) {
    opts = opts || {};
    let parent;
    try {
      parent = buildParent(opts);
    } catch (e) {
      return { ok: false, reason: "build-parent: " + String(e), audit: null };
    }
    const audit = _auditBase(parent);
    const token = opts.token || DC_ANON_KEY;
    const isGeneral = !!opts.isGeneral;

    try {
      const pid = newId();
      parent.id = pid;
      const lines = buildLines(opts.quote, pid, isGeneral);

      await _dcRest("POST", "dc_spx_proposals", token, [parent], null);
      if (lines.length) {
        await _dcRest("POST", "dc_spx_lines", token, lines, null);
      }

      // Supersede older active proposals for this company (best-effort; RLS only
      // lets us touch our own / the sales lead's). A General/catalogue never
      // buries a firm quote (register.py:219-230).
      const company = parent.company;
      if (company) {
        const params = {
          company: "eq." + company,
          active: "eq.true",
          deleted: "eq.false",
          id: "neq." + pid,
        };
        if (isGeneral) params.isGeneral = "eq.true";
        try {
          await _dcRest("PATCH", "dc_spx_proposals", token,
            { active: false, superseded: true, supersededBy: pid }, params);
        } catch (e) { /* older rows we can't touch stay as they are */ }
      }

      return { ok: true, id: pid };
    } catch (e) {
      // LOUD, never silently dropped (mirrors BoardWriteError + the audit log).
      const err = String(e && e.message ? e.message : e);
      return { ok: false, reason: err, audit: Object.assign({}, audit, { success: false, error: err }) };
    }
  }

  global.PBB = {
    DC_SUPABASE_URL: DC_SUPABASE_URL,
    DC_ANON_KEY: DC_ANON_KEY,
    newId: newId,
    buildParent: buildParent,
    buildLines: buildLines,
    submit: submit,
  };
})(window);


/* ===== proposal\timeline.js ===== */
/* ============================================================================
   Live event dates from the Dispatch timeline (dc_events) — THE CASCADE.
   The builder's calendar is single-source-of-truth: enter a date once in the
   Dispatch timeline, it flows here. Fetches via the `dc-events` Edge Function,
   matches each builder event to its dc_events row strictly by (year+country+topic)
   — unique across the whole portfolio — and overlays the date. Any problem (fn
   not deployed, no match) falls back to the built-in spx_data snapshot, never a
   wrong date. Ported from proposal_builder/timeline_sync.py (already verified).
   ============================================================================ */
(function (global) {
  "use strict";
  const MON_EN = ["", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const MON_ES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DASH = "–";

  function fmtDates(iso, days) {
    const y = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(start.getTime() + (Math.max(1, +days || 1) - 1) * 864e5);
    const ed = end.getUTCDate(), em = end.getUTCMonth() + 1, ey = end.getUTCFullYear();
    let en, es;
    if (end > start) {
      if (em === m) {
        en = d + DASH + ed + " " + MON_EN[m] + " " + y;
        es = d + DASH + ed + " de " + MON_ES[m] + " de " + y;
      } else {
        en = d + " " + MON_EN[m] + " " + DASH + " " + ed + " " + MON_EN[em] + " " + ey;
        es = d + " de " + MON_ES[m] + " " + DASH + " " + ed + " de " + MON_ES[em] + " de " + ey;
      }
    } else {
      en = d + " " + MON_EN[m] + " " + y;
      es = d + " de " + MON_ES[m] + " de " + y;
    }
    return { en: en, es: es };
  }

  // Match by distinctive NAME tokens + year. The timeline's country/topic fields
  // are unreliable in practice (most rows tagged "Spain" / "Renewables / AI"), so
  // the event NAME is the robust signal. kw = any of these tokens; must = all
  // required; not = excluded (keeps the 2027 events apart from 2026 "@ PWC Tower"
  // Talks and from the market variants).
  const NAME_MATCH = {
    dc_italia_26:      { year: 2026, kw: ["datacenter", "data center"], must: ["italia"] },
    h2_26:             { year: 2026, kw: ["hydrogen", "hidrogeno", "hidrógeno"], not: ["pwc"] },
    dc_27:             { year: 2027, kw: ["datacenter", "data center"], not: ["italia", "pwc", "off-grid", "off grid"] },
    storage_italia_27: { year: 2027, kw: ["storage", "almacenamiento"], must: ["italia"] },
    biometano_27:      { year: 2027, kw: ["biomethane", "biometano"], not: ["pwc"] },
    almacenamiento_27: { year: 2027, kw: ["almacenamiento", "storage"], not: ["italia", "polska", "poland", "pwc"] },
    chile_27:          { year: 2027, kw: ["chile"] },
    h2_27:             { year: 2027, kw: ["hydrogen", "hidrogeno", "hidrógeno"], not: ["pwc"] },
    dc_italia_27:      { year: 2027, kw: ["datacenter", "data center"], must: ["italia"] },
    invest_27:         { year: 2027, kw: ["invest"], not: ["italia", "pwc", "bess"] },
    invest_italia_27:  { year: 2027, kw: ["invest"], must: ["italia"] },
    mexico_27:         { year: 2027, kw: ["mexico", "méxico"] },
    storage_polska_27: { year: 2027, kw: ["polska", "poland"] },
    usefulai_27:       { year: 2027, kw: ["useful"] },
  };
  function matchName(rows, m) {
    const c = rows.filter((r) => {
      const iso = r.date || "";
      if (iso.length < 10 || !/^\d{4}/.test(iso)) return false;
      if (+iso.slice(0, 4) !== m.year) return false;
      const n = ((r.name || "") + " " + (r.topic || "")).toLowerCase();
      if (!m.kw.some((k) => n.includes(k))) return false;
      if (m.must && !m.must.every((k) => n.includes(k))) return false;
      if (m.not && m.not.some((k) => n.includes(k))) return false;
      return true;
    });
    return c.length === 1 ? c[0] : null;
  }

  let cfg = { endpoint: null, anonKey: null, token: null };
  function configure(o) { Object.assign(cfg, o || {}); }

  async function fetchEvents() {
    if (!cfg.endpoint) return null;
    try {
      const h = { "Content-Type": "application/json" };
      if (cfg.anonKey) h["apikey"] = cfg.anonKey;
      if (cfg.token) h["Authorization"] = "Bearer " + cfg.token;
      const r = await fetch(cfg.endpoint, { method: "POST", headers: h, body: "{}" });
      if (!r.ok) return null;
      const d = await r.json();
      return (d && d.ok && Array.isArray(d.events)) ? d.events : null;
    } catch (e) { return null; }
  }

  // Mutates events' date {en,es} for confidently-matched rows. Returns status.
  async function applyDates(events) {
    const rows = await fetchEvents();
    if (!rows) return { ok: false, synced: [], reason: "timeline-unavailable" };
    const synced = [];
    events.forEach((ev) => {
      const m = NAME_MATCH[ev.key]; if (!m) return;
      try {
        const row = matchName(rows, m);
        if (row && row.date) { ev.date = fmtDates(row.date, row.days || 1); synced.push(ev.key); }
      } catch (e) {}
    });
    return { ok: true, synced: synced, rows: rows.length };
  }

  global.PBTIMELINE = { configure, applyDates, NAME_MATCH, _fmtDates: fmtDates, _matchName: matchName };
})(window);


/* ===== proposal\talks_deck.js ===== */
/* ============================================================================
   RENMAD Talks Builder  ·  browser deck generator (PptxGenJS)
   ----------------------------------------------------------------------------
   Port of proposal_builder/talks_deck.py to a static, dependency-free browser
   build. Same slide SEQUENCE and copy, rendered in the browser. SPANISH only.

   RENMAD Talks = the boutique half-day format: three ATA×PwC executive
   encuentros (BESS Invest 22 sep · Biometano 6 oct · Datacenters Off-Grid
   10 nov 2026). Brand colour = carmesí #B52030 (NOT ATA orange, NOT the big
   decks' per-event colours). PwC is the co-host, at its Madrid HQ.

   Exposes:  window.PBTALKS = { buildTalksDeck(opts) }  ->  PptxGenJS deck object

   opts = {
     salesperson: { key, name, role, email, phone }   (required-ish; falls back)
     client:      string                              (optional; not shown on
                                                       this deck — kept for parity)
   }

   Uses RENMAD.newDeck() (13.333 x 7.5, RENMAD_16x9). No logo/photo assets are
   available in the browser, so brand marks are rendered as text and every
   would-be image is a guarded fallback shape (see IMG_TRY). The TALKS packages
   and encuentros are read from window.PB.talksPackages / window.PB.talksEvents
   when present, else from the embedded copy below (so this file works stand-
   alone). All the deck-specific rich copy (pitch, agenda, "bueno para", body,
   audiencia/sesiones) lives embedded here regardless — it is not part of the
   TALKS_PACKAGES / TALKS_EVENTS data shape.
   ============================================================================ */
(function (global) {
  "use strict";

  // ---- brand palette (mirrors talks_deck.py; 6-hex, no '#') ----------------
  var HEAD = "Montserrat", BODY = "Inter";
  var RED = "B52030", RED_DARK = "8A1824", CHARCOAL = "1C2529", BLACK = "111618";
  var GREY_BG = "F2F2F0", CARD_LN = "E2DFDC", BLUSH = "F7E8EA", BLUSH_TX = "D4808C";
  var MID = "5B5F63", WHITE = "FFFFFF", ROW_ALT = "F7F6F4", SOFT = "CFD4D8";
  var SW = 13.333, SH = 7.5;

  // ---- embedded copy (fallback when window.PB.* is absent) -----------------
  // The three encuentros. Deck-specific rich copy is ALWAYS embedded here.
  var EVENTS3 = [
    {
      id: "E059", tag: "ALMACENAMIENTO", date_s: "MARTES 22 SEPTIEMBRE", name: "BESS Invest",
      hours: "9:00 – 14:30 · Sede de PwC, Madrid",
      kick: "MARTES 22 SEPTIEMBRE 2026 · 9:00 – 14:30 · SEDE DE PWC, MADRID",
      sub: "Financiación y modelos de negocio para liderar el boom del BESS en 2027",
      pitch: "El almacenamiento español ya es una clase de activo. La aprobación del mercado de capacidad " +
             "(~9.000 M€) estrena el primer ingreso bancable del BESS, la potencia instalada se ha disparado " +
             "tras el cero eléctrico de 2025 y el pipeline apunta a 14 GW en 2030. Siete sesiones sobre lo que " +
             "financia — o hunde — un proyecto BESS en 2027.",
      aud: "Inversores y fondos · desarrolladores e IPPs · operadores · tecnólogos · asesores legales y financieros",
      ses: "Mercado de capacidad · compra-venta de proyectos · merchant y saturación · grid-forming · optimizer · tolling y deuda",
      agenda: [
        ["9:00", "Bienvenida e inauguración (ATA + PwC)", "—"],
        ["9:15", "Suelo firme · mercado de capacidad", "Fireside chat"],
        ["9:35", "Se vende · compra-venta de proyectos", "Panel"],
        ["10:05", "Márgenes a dieta · merchant y saturación", "Panel"],
        ["10:55", "Del vaivén al aplomo · grid-forming", "Panel"],
        ["11:45", "Café networking · encuestas en directo", "Pausa"],
        ["12:15", "El hardware almacena, el software gana · optimizer", "Ponencia"],
        ["12:35", "El peaje de la tranquilidad · tolling y deuda", "Masterclass"],
        ["13:25", "Agenda cargada · cierre y hoja de ruta 2027", "Cierre"],
        ["13:45", "Networking lunch", "—"]
      ],
      note: "Inicio 9:00 · un único descanso a media mañana · cierre con networking lunch en la sede de PwC."
    },
    {
      id: "E060", tag: "GASES RENOVABLES", date_s: "MARTES 6 OCTUBRE", name: "Biometano",
      hours: "9:15 – 13:30 · Sede de PwC, Madrid",
      kick: "MARTES 6 OCTUBRE 2026 · 9:15 – 13:30 · SEDE DE PWC, MADRID",
      sub: "Del residuo al negocio: cuota obligatoria, digestato y financiación del gas verde",
      pitch: "España estrena demanda garantizada por ley: el RDL 7/2026 abre la puerta a cuotas obligatorias " +
             "de biometano con senda creciente hasta 2035. El digestato pasa de residuo a producto de valor y " +
             "la financiación por fin fluye, con más de 3.300 M€ comprometidos en 2024-2025 y 50+ plantas en " +
             "desarrollo. Una mañana para pasar del residuo al negocio.",
      aud: "Promotores de plantas · gasistas y comercializadoras · agroindustria · banca y fondos · asesores",
      ses: "Cuota obligatoria · digestato de valor · garantías de origen · sustrato · financiación de plantas",
      agenda: [
        ["9:15", "Bienvenida e inauguración (ATA + PwC)", "—"],
        ["9:30", "Obligados a crecer · cuota obligatoria", "Panel"],
        ["10:20", "El oro marrón · digestato de valor", "Panel estrella"],
        ["11:10", "Certificar para cobrar · garantías de origen", "Ponencia"],
        ["11:30", "Pausa activa con café · encuestas en directo", "Pausa"],
        ["11:45", "Sin materia, no hay gas · sustrato", "Ponencia"],
        ["12:05", "Del residuo al balance · financiación", "Masterclass"],
        ["12:55", "Networking lunch", "—"]
      ],
      note: "Inicio 9:15 · la pausa activa mantiene la energía · cierre con networking lunch en la sede de PwC."
    },
    {
      id: "E061", tag: "DATACENTERS & IA", date_s: "MARTES 10 NOVIEMBRE", name: "Datacenters Off-Grid",
      hours: "9:15 – 13:30 · Sede de PwC, Madrid",
      kick: "MARTES 10 NOVIEMBRE 2026 · 9:15 – 13:30 · SEDE DE PWC, MADRID",
      sub: "Off-grid, energía firme y financiación para el boom de los datacenters de IA",
      pitch: "Construir un datacenter lleva 12-18 meses; conectarlo a la red, entre 5 y 7 años. Con hasta la " +
             "mitad del pipeline español en riesgo por falta de punto de conexión, generar la energía in situ " +
             "deja de ser exótico: ya hay ~2 GW behind-the-meter en marcha y 90 GW anunciados en EE. UU. Una " +
             "mañana sobre cómo alimentar — y financiar — la nube de la IA.",
      aud: "Hyperscalers y operadores de DC · promotores energéticos · fondos de infraestructura · utilities · asesores",
      ses: "Off-grid y cola de conexión · campus a gigavatio · energía firme 24/7 · España, hub del dato · financiación",
      agenda: [
        ["9:15", "Bienvenida e inauguración (ATA + PwC)", "—"],
        ["9:30", "La cola que asfixia a la nube · off-grid", "Panel"],
        ["10:20", "El valle de los datos · campus a gigavatio", "Panel estrella"],
        ["11:10", "El reto de los 24/7 · energía firme", "Ponencia"],
        ["11:30", "Pausa activa con café · encuestas en directo", "Pausa"],
        ["11:45", "¿Tenemos el enchufe? · España, hub del dato", "Ponencia"],
        ["12:05", "Energía propia, riesgo propio · financiación", "Masterclass"],
        ["12:55", "Networking lunch", "—"]
      ],
      note: "Inicio 9:15 · la pausa activa mantiene la energía · cierre con networking lunch en la sede de PwC."
    }
  ];

  // The five packages. Numeric price/avail can be overridden by PB.talksPackages
  // (matched by id). All the rich sponsorship copy stays embedded.
  var PACKAGES = [
    {
      id: "talk_panel", group: "content", name: "Panel Patrocinado", price: 4000, avail: 6,
      tipo: "Contenido", tag: "Comparte protagonismo con los líderes del sector",
      bueno: "empresas que buscan visibilidad y credibilidad participando en la conversación junto a otros referentes del sector.",
      body: "Un asiento en uno de los paneles de la agenda: 50 minutos de debate junto a 3-4 empresas más, " +
            "ante la audiencia clave del encuentro. Es la vía más natural para asociar su marca a una conversación " +
            "de alto nivel sin asumir el protagonismo — y el coste — de una presentación en solitario.",
      incl: [
        "Participación en un panel de 50 min con 3-4 empresas más",
        "1 pase para el panelista",
        "2 pases complementarios",
        "Visibilidad en agenda, web y comunicaciones por email"
      ]
    },
    {
      id: "talk_presentation", group: "content", name: "Presentación Individual", price: 5500, avail: 2,
      tipo: "Contenido", tag: "Tu mensaje, tu escenario, sin compartir foco",
      bueno: "empresas que quieren presentar un producto, caso de éxito o visión sin diluir su mensaje entre otros ponentes.",
      body: "20 minutos en solitario sobre el escenario principal para presentar tu propuesta de valor tal y como " +
            "quieres contarla. La máxima exposición de marca y mensaje que ofrece el encuentro, con solo dos " +
            "espacios disponibles.",
      incl: [
        "Presentación individual de 20 min",
        "1 pase para el ponente",
        "2 pases complementarios",
        "Visibilidad en agenda, web y comunicaciones por email"
      ]
    },
    {
      id: "talk_coffee", group: "branding", name: "Coffee Sponsor", price: 2000, avail: 1,
      tipo: "Branding · add-on de contenido", tag: "El punto de encuentro informal de la mañana",
      bueno: "empresas que buscan visibilidad constante y presencia de marca en el momento más social de la mañana.",
      body: "Su marca asociada al descanso para el café — el momento en que los asistentes conversan y hacen " +
            "networking de forma distendida. Señalética exclusiva y presencia visual durante toda la pausa.",
      incl: [
        "Branding como: “Coffee sponsored by [Company]”",
        "Presencia en agenda como sponsor oficial del café",
        "Inclusión en web y email marketing",
        "Banner exclusivo como Coffee Sponsor"
      ]
    },
    {
      id: "talk_lunch", group: "branding", name: "Lunch Sponsor", price: 3000, avail: 1,
      tipo: "Branding · add-on de contenido", tag: "Cierre de marca en el momento de mayor permanencia",
      bueno: "empresas que buscan visibilidad prolongada durante el momento de mayor tiempo compartido entre asistentes.",
      body: "Branding exclusivo durante el almuerzo oficial de cierre del encuentro, cuando los asistentes " +
            "permanecen más tiempo juntos. Presencia visual asociada a este momento clave de la jornada.",
      incl: [
        "Branding exclusivo durante la comida",
        "Branding como: “Lunch sponsored by [Company]”",
        "Presencia en agenda y promoción digital como Lunch Sponsor",
        "Inclusión en web y email marketing"
      ]
    },
    {
      id: "talk_registration", group: "branding", name: "Registration Sponsor", price: 4000, avail: 1,
      tipo: "Branding · add-on de contenido", tag: "La primera y última impresión de marca",
      bueno: "marcas que quieren ser lo primero que vea cada asistente — desde la acreditación hasta el final del encuentro.",
      body: "Presencia exclusiva en el punto de entrada al encuentro: acreditaciones, lanyards y mostradores de " +
            "registro. La única marca visible en el primer contacto de cada asistente con el encuentro.",
      incl: [
        "Logo exclusivo en las acreditaciones (lanyards) de ponentes y asistentes",
        "Logo en los puntos de registro (primer contacto con el encuentro)",
        "Logo como Registration Sponsor en web y app del encuentro"
      ]
    }
  ];

  var BENEFITS = [
    ["Alcance directo", "Contacto cara a cara con decisores y responsables de presupuesto, en una sala reducida donde ninguna marca pasa desapercibida."],
    ["Posicionamiento de marca", "Su logo presente en toda la comunicación del encuentro: agenda, web y email marketing de la convocatoria."],
    ["Generación de oportunidades", "Una audiencia cualificada y pre-agendada para abrir conversaciones comerciales in situ."],
    ["Liderazgo de conversación", "Paneles y presentaciones que le posicionan como referente en su vertical, junto al co-host PwC."]
  ];

  var SALESPEOPLE_FALLBACK = {
    cintia:  { key: "cintia",  name: "Cintia Hernández",   role: "Desarrollo de Negocio · RENMAD Events", email: "cintia.hernandez@ata.email",   phone: "+34 605 40 85 93" },
    ian:     { key: "ian",     name: "Ian Casares",        role: "Desarrollo de Negocio · RENMAD Events", email: "ian.casares@ata.email",        phone: "+34 665 161 069" },
    sheetal: { key: "sheetal", name: "Sheetal Shamdasani", role: "Directora de Desarrollo de Negocio y Patrocinios", email: "sheetal.shamdasani@ata.email", phone: "+34 630 637 276" }
  };

  // ---- helpers -------------------------------------------------------------
  function money(n) { return "€ " + Number(n).toLocaleString("es-ES"); }
  function availLabel(n) { return n + (Number(n) === 1 ? " DISPONIBLE" : " DISPONIBLES"); }
  function espacios(n) { return n + (Number(n) === 1 ? " espacio" : " espacios"); }

  // Merge embedded packages with PB.talksPackages (price/avail/name override).
  function resolvePackages(PB) {
    var pb = PB && PB.talksPackages;
    if (!pb || !pb.length) return PACKAGES;
    var byId = {};
    pb.forEach(function (p) { if (p && p.id) byId[p.id] = p; });
    return PACKAGES.map(function (base) {
      var o = byId[base.id];
      if (!o) return base;
      var merged = {};
      for (var k in base) merged[k] = base[k];
      if (o.price != null) merged.price = o.price;
      if (o.avail != null) merged.avail = o.avail;
      // PB name is {en,es}; keep title-case es when present
      if (o.name && o.name.es) merged.name = o.name.es;
      return merged;
    });
  }
  // Encuentros: embedded is the rich source; PB.talksEvents (key/name/date_es)
  // is honoured only for the display name if it differs — dates already match.
  function resolveEvents(PB) {
    return EVENTS3; // embedded copy is strictly richer; PB adds nothing renderable
  }

  function buildTalksDeck(opts) {
    opts = opts || {};
    var PB = global.PB || {};
    var RENMAD = global.RENMAD;
    if (!RENMAD || !RENMAD.newDeck) throw new Error("RENMAD deck library (lib/renmad-deck.js) not loaded");

    var pkgs = resolvePackages(PB);
    var events = resolveEvents(PB);

    var sp = opts.salesperson;
    if (typeof sp === "string") sp = SALESPEOPLE_FALLBACK[sp];
    if (!sp || !sp.name) sp = SALESPEOPLE_FALLBACK.cintia;

    var pptx = RENMAD.newDeck();   // 13.333 x 7.5, RENMAD_16x9 layout

    // ---- low-level slide helpers (mirror deck.js) --------------------------
    function tx(s, x, y, w, h, t, size, color, bold, font, align, valign, extra) {
      var o = {
        x: x, y: y, w: w, h: h, fontFace: font || BODY, fontSize: size || 14,
        color: color || CHARCOAL, bold: !!bold, align: align || "left", valign: valign || "top"
      };
      if (extra) for (var k in extra) o[k] = extra[k];
      s.addText(t, o);
    }
    function rc(s, x, y, w, h, fill, opts2) {
      opts2 = opts2 || {};
      var o = { x: x, y: y, w: w, h: h };
      if (fill === null || fill === undefined) o.fill = { color: "FFFFFF", transparency: 100 };
      else o.fill = { color: fill };
      if (opts2.line) { o.line = { color: opts2.line, width: opts2.lw || 1 }; if (opts2.dash) o.line.dashType = "dash"; }
      if (opts2.rad != null) o.rectRadius = opts2.rad;
      s.addShape(opts2.rad != null ? "roundRect" : "rect", o);
    }
    function ell(s, x, y, d, fill, extra) {
      var o = { x: x, y: y, w: d, h: d, fill: { color: fill } };
      if (extra) for (var k in extra) o[k] = extra[k];
      s.addShape("ellipse", o);
    }
    // Guarded image add (no assets in browser -> always uses the fallback).
    function IMG_TRY(s, x, y, w, h, dataUrl, fallback) {
      try {
        if (dataUrl) {
          s.addImage({ data: dataUrl, x: x, y: y, w: w, h: h, sizing: { type: "cover", w: w, h: h } });
          return true;
        }
      } catch (e) { /* fall through */ }
      if (fallback) fallback();
      return false;
    }

    // Text wordmark stand-in for the Talks logo (no image assets in browser).
    // dark=true -> for placing on dark backgrounds.
    function logoMark(s, x, y, w, dark) {
      var h = Math.max(0.28, w * 0.20);
      s.addText([
        { text: "RENMAD ", options: { color: dark ? WHITE : CHARCOAL, bold: true } },
        { text: "Talks", options: { color: RED, bold: true } }
      ], { x: x, y: y, w: w, h: h, fontFace: HEAD, fontSize: Math.max(11, w * 6.5),
           align: "left", valign: "middle", charSpacing: 0.5 });
    }

    function footer(s, showLogo) {
      tx(s, 0.6, 7.02, 8.0, 0.32, "OPORTUNIDADES DE PATROCINIO · 2026", 8.5, MID, false, HEAD,
        "left", "middle", { charSpacing: 2 });
      if (showLogo !== false) logoMark(s, SW - 0.6 - 1.55, SH - 0.5, 1.55, false);
    }
    function kicker(s, x, y, text, size) {
      tx(s, x, y, 12.0, 0.3, text, size || 11, RED, true, HEAD, "left", "top", { charSpacing: 2.4 });
    }

    // ===== 1 · PORTADA ======================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CHARCOAL };
      logoMark(s, 0.6, 0.5, 2.5, true);
      tx(s, 0.6, 1.72, 12.0, 0.35, "OPORTUNIDADES DE PATROCINIO · 2026", 13, BLUSH_TX, true, HEAD,
        "left", "top", { charSpacing: 2.6 });
      tx(s, 0.6, 2.12, 12.2, 1.55, "Tres encuentros ejecutivos.\nMedia jornada. Un único tema, a fondo.",
        32, WHITE, true, HEAD, "left", "top", { lineSpacingMultiple: 1.05 });
      // cover_band.png -> carmesí band stand-in
      rc(s, 0, 3.95, SW, 0.9, RED);
      tx(s, 0.6, 5.02, 12.2, 0.4, "Madrid · Septiembre – Noviembre 2026 · Co-host: PwC", 14, SOFT, false, BODY);
    })();

    // ===== 2 · QUÉ ES RENMAD TALKS =========================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: WHITE };
      kicker(s, 0.6, 0.55, "QUÉ ES RENMAD TALKS");
      tx(s, 0.6, 0.92, 12.1, 0.7, "El formato pequeño de la casa grande", 26, CHARCOAL, true, HEAD);
      tx(s, 0.6, 1.7, 11.9, 1.25,
        "RENMAD Talks es el nuevo formato de encuentros ejecutivos de RENMAD: media jornada, una sala " +
        "curada y un único tema, a fondo. La misma marca de los eventos RENMAD, en formato boutique — " +
        "co-organizado con PwC como co-host, en su sede de Madrid.",
        13.5, MID, false, BODY, "left", "top", { lineSpacingMultiple: 1.25 });
      var cards = [
        ["½ JORNADA", "Una mañana de martes, de 9:00 a primera hora de la tarde. Alta densidad de decisión, cero paja."],
        ["1 TEMA", "Una sala curada y un único tema tratado a fondo, con las empresas que lo están moviendo."],
        ["AFORO LIMITADO", "Formato ejecutivo: plazas presenciales limitadas y opción de asistencia online."]
      ];
      var cw = 3.85, gap = 0.28, x0 = 0.6, cy = 3.15;
      cards.forEach(function (c, i) {
        var x = x0 + i * (cw + gap);
        rc(s, x, cy, cw, 2.35, GREY_BG, { rad: 0.05 });
        tx(s, x + 0.3, cy + 0.32, cw - 0.6, 0.4, c[0], 15, RED, true, HEAD, "left", "top", { charSpacing: 1.2 });
        tx(s, x + 0.3, cy + 0.85, cw - 0.6, 1.3, c[1], 12.5, CHARCOAL, false, BODY, "left", "top", { lineSpacingMultiple: 1.25 });
      });
      s.addText([
        { text: "Co-host: ", options: { color: MID, bold: false } },
        { text: "PwC", options: { color: CHARCOAL, bold: true } },
        { text: "   ·   Sede de PwC, Madrid   ·   Encuentros en español", options: { color: MID, bold: false } }
      ], { x: 0.6, y: 5.85, w: 11.9, h: 0.7, fontFace: BODY, fontSize: 13, valign: "top" });
      footer(s);
    })();

    // ===== 3 · POR QUÉ PATROCINAR ==========================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GREY_BG };
      kicker(s, 0.6, 0.55, "POR QUÉ PATROCINAR");
      tx(s, 0.6, 0.92, 12.1, 0.7, "Impacto antes, durante y después del encuentro", 28, CHARCOAL, true, HEAD);
      var cw = 5.95, ch = 2.1, gx = 0.25, gy = 0.25;
      BENEFITS.forEach(function (b, i) {
        var x = 0.6 + (i % 2) * (cw + gx), y = 2.0 + Math.floor(i / 2) * (ch + gy);
        rc(s, x, y, cw, ch, WHITE, { line: CARD_LN, lw: 0.75, rad: 0.05 });
        ell(s, x + 0.3, y + 0.32, 0.42, RED);
        tx(s, x + 0.3, y + 0.32, 0.42, 0.42, String(i + 1), 15, WHITE, true, HEAD, "center", "middle");
        tx(s, x + 0.95, y + 0.36, cw - 1.25, 0.4, b[0], 15.5, CHARCOAL, true, HEAD);
        tx(s, x + 0.95, y + 0.88, cw - 1.25, 1.1, b[1], 12, MID, false, BODY, "left", "top", { lineSpacingMultiple: 1.22 });
      });
      footer(s);
    })();

    // ===== 4 · LAS TRES CITAS ==============================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: GREY_BG };
      kicker(s, 0.6, 0.55, "OPORTUNIDADES 2026");
      tx(s, 0.6, 0.92, 12.1, 0.7, "Tres citas, tres tecnologías", 28, CHARCOAL, true, HEAD);
      var cw = 3.85, gap = 0.28, x0 = 0.6, cy = 1.95, ch = 4.35;
      events.forEach(function (ev, i) {
        var x = x0 + i * (cw + gap);
        rc(s, x, cy, cw, ch, WHITE, { line: CARD_LN, lw: 0.75, rad: 0.035 });
        rc(s, x + 0.3, cy + 0.32, 1.9, 0.34, BLUSH, { rad: 0.5 });
        tx(s, x + 0.3, cy + 0.355, 1.9, 0.27, ev.tag, 8.5, RED_DARK, true, HEAD, "center", "top", { charSpacing: 1.5 });
        tx(s, x + 0.3, cy + 0.92, cw - 0.6, 0.3, ev.date_s, 12, RED, true, HEAD, "left", "top", { charSpacing: 1 });
        tx(s, x + 0.3, cy + 1.28, cw - 0.6, 0.6, ev.name, 21, CHARCOAL, true, HEAD);
        tx(s, x + 0.3, cy + 1.95, cw - 0.6, 1.5, ev.sub, 12.5, MID, false, BODY, "left", "top", { lineSpacingMultiple: 1.25 });
        tx(s, x + 0.3, cy + 3.6, cw - 0.6, 0.5, ev.hours, 11, CHARCOAL);
      });
      tx(s, 0.6, 6.55, 12.1, 0.35,
        "Cada encuentro se patrocina por separado — los paquetes son idénticos en los tres.", 12, MID);
      footer(s);
    })();

    // ===== 5 · PAQUETES DE UN VISTAZO ======================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: WHITE };
      kicker(s, 0.6, 0.55, "LOS PAQUETES DE UN VISTAZO");
      tx(s, 0.6, 0.92, 12.1, 0.7, "Compara las oportunidades disponibles", 28, CHARCOAL, true, HEAD);
      var cols = [[0.6, 4.3], [4.95, 4.1], [9.1, 1.7], [10.9, 1.85]];
      var heads = ["PAQUETE", "TIPO", "DISPONIBLES", "PRECIO"];
      var hy = 2.0;
      heads.forEach(function (name, i) {
        tx(s, cols[i][0], hy, cols[i][1], 0.3, name, 10, RED_DARK, true, HEAD, "left", "top", { charSpacing: 1.6 });
      });
      rc(s, 0.6, hy + 0.34, 12.15, 0.025, RED);
      var ry = hy + 0.52, rh = 0.62;
      pkgs.forEach(function (pk, i) {
        if (i % 2 === 1) rc(s, 0.6, ry - 0.08, 12.15, rh, ROW_ALT);
        tx(s, cols[0][0] + 0.06, ry, cols[0][1], 0.4, pk.name, 14, CHARCOAL, true, HEAD);
        tx(s, cols[1][0], ry + 0.03, cols[1][1], 0.4, pk.tipo, 12, MID);
        tx(s, cols[2][0], ry + 0.03, cols[2][1], 0.4, espacios(pk.avail), 12, CHARCOAL);
        tx(s, cols[3][0], ry - 0.02, cols[3][1], 0.4, money(pk.price), 16, BLACK, true, HEAD);
        ry += rh;
      });
      tx(s, 0.6, ry + 0.18, 12.1, 0.6,
        "Precios por encuentro, impuestos no incluidos. Los paquetes de branding pueden contratarse " +
        "como add-on de un paquete de contenido.", 11.5, MID);
      footer(s);
    })();

    // ===== 6–10 · UN SLIDE POR PAQUETE =====================================
    pkgs.forEach(function (pk) {
      var s = pptx.addSlide(); s.background = { color: WHITE };
      tx(s, 0.6, 0.6, 9.0, 0.6, String(pk.name).toUpperCase(), 26, RED, true, HEAD);
      tx(s, 0.6, 1.25, 9.0, 0.45, pk.tag, 15, MID, false, HEAD);
      logoMark(s, SW - 0.6 - 1.85, 0.6, 1.85, false);
      // price block
      var bx = 10.55, bw = 2.2, bh = 1.35, by = 5.35;
      rc(s, bx, by, bw, bh, BLACK, { rad: 0.09 });
      tx(s, bx, by + 0.22, bw, 0.6, money(pk.price), 26, WHITE, true, HEAD, "center");
      tx(s, bx, by + 0.9, bw, 0.3, availLabel(pk.avail), 9.5, BLUSH_TX, true, HEAD, "center", "top", { charSpacing: 1.8 });
      // "bueno para" pill
      rc(s, 0.6, 2.25, 12.15, 1.0, BLUSH, { rad: 0.08 });
      s.addText([
        { text: "BUENO PARA   ", options: { color: RED_DARK, bold: true, fontFace: HEAD } },
        { text: pk.bueno, options: { color: CHARCOAL, bold: false, fontFace: BODY } }
      ], { x: 0.9, y: 2.47, w: 11.6, h: 0.6, fontFace: BODY, fontSize: 13, valign: "top", lineSpacingMultiple: 1.2 });
      tx(s, 0.6, 3.6, 12.0, 1.15, pk.body, 13.5, MID, false, BODY, "left", "top", { lineSpacingMultiple: 1.3 });
      tx(s, 0.6, 4.85, 4.0, 0.35, "QUÉ INCLUYE", 11, RED, true, HEAD, "left", "top", { charSpacing: 2 });
      var iy = 5.25;
      pk.incl.forEach(function (it) {
        s.addText([
          { text: "✓  ", options: { color: RED, bold: true, fontFace: HEAD } },
          { text: it, options: { color: CHARCOAL, bold: false, fontFace: BODY } }
        ], { x: 0.6, y: iy, w: 9.5, h: 0.35, fontFace: BODY, fontSize: 12.5, valign: "top" });
        iy += 0.38;
      });
      footer(s, false);
    });

    // ===== 11–16 · EVENTO + AGENDA ×3 ======================================
    events.forEach(function (ev) {
      // ---- event slide
      var s = pptx.addSlide(); s.background = { color: WHITE };
      var iw = 5.7, ih = 2.3, ix = SW - 0.6 - iw;
      // image top-right (no asset -> branded charcoal panel with the tag)
      IMG_TRY(s, ix, 0.6, iw, ih, null, function () {
        rc(s, ix, 0.6, iw, ih, CHARCOAL, { rad: 0.04 });
        rc(s, ix + 0.28, 0.9, 2.4, 0.34, RED, { rad: 0.5 });
        tx(s, ix + 0.28, 0.935, 2.4, 0.27, ev.tag, 8.5, WHITE, true, HEAD, "center", "top", { charSpacing: 1.5 });
        tx(s, ix + 0.28, 1.45, iw - 0.56, 0.7, ev.name, 20, WHITE, true, HEAD, "left", "middle");
      });
      var wL = ix - 0.6 - 0.45;
      tx(s, 0.6, 0.62, wL, 0.65, ev.kick, 10.5, RED, true, HEAD, "left", "top", { charSpacing: 1.6, lineSpacingMultiple: 1.25 });
      tx(s, 0.6, 1.3, wL, 0.7, ev.name, 29, CHARCOAL, true, HEAD);
      tx(s, 0.6, 2.02, wL, 0.95, ev.sub, 14, RED_DARK, true, HEAD, "left", "top", { lineSpacingMultiple: 1.12 });
      tx(s, 0.6, 2.98, 12.15, 1.0, ev.pitch, 13, MID, false, BODY, "left", "top", { lineSpacingMultiple: 1.22 });
      rc(s, 0.6, 4.12, 12.15, 1.3, GREY_BG, { rad: 0.07 });
      var yy = 4.38;
      [["AUDIENCIA", ev.aud], ["SESIONES", ev.ses]].forEach(function (pair) {
        tx(s, 0.95, yy, 1.55, 0.3, pair[0], 10, RED, true, HEAD, "left", "top", { charSpacing: 1.5 });
        tx(s, 2.6, yy - 0.02, 9.8, 0.4, pair[1], 11.5, CHARCOAL, false, BODY, "left", "top", { lineSpacingMultiple: 1.2 });
        yy += 0.62;
      });
      tx(s, 0.6, 5.66, 11.0, 0.35, "Agenda completa en el siguiente slide →", 10.5, MID);
      footer(s);

      // ---- agenda slide
      var a = pptx.addSlide(); a.background = { color: WHITE };
      kicker(a, 0.6, 0.5, ev.name.toUpperCase() + " · AGENDA DE UN VISTAZO");
      tx(a, 0.6, 0.87, 12.1, 0.6, ev.sub, 18, CHARCOAL, true, HEAD);
      var acols = [[0.6, 1.15], [1.95, 8.3], [10.45, 2.3]];
      var aheads = ["HORA", "BLOQUE", "FORMATO"];
      var ahy = 1.75;
      aheads.forEach(function (name, i) {
        tx(a, acols[i][0], ahy, acols[i][1], 0.3, name, 9.5, RED_DARK, true, HEAD, "left", "top", { charSpacing: 1.6 });
      });
      rc(a, 0.6, ahy + 0.32, 12.15, 0.022, RED);
      var arh = 0.44, ary = ahy + 0.44;
      ev.agenda.forEach(function (row, i) {
        var h = row[0], b = row[1], f = row[2];
        if (i % 2 === 1) rc(a, 0.6, ary - 0.05, 12.15, arh, ROW_ALT);
        tx(a, acols[0][0] + 0.06, ary, acols[0][1], 0.3, h, 11.5, RED, true, HEAD);
        tx(a, acols[1][0], ary, acols[1][1], 0.3, b, 12, CHARCOAL, f === "Panel estrella", BODY);
        tx(a, acols[2][0], ary, acols[2][1], 0.3, f, 11, MID);
        ary += arh;
      });
      tx(a, 0.6, ary + 0.12, 12.1, 0.35, ev.note, 11, MID);
      footer(a);
    });

    // ===== 17 · HABLEMOS ===================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CHARCOAL };
      var panelW = 4.6;
      // salesperson photo (no asset in browser -> carmesí gradient-ish panel)
      IMG_TRY(s, SW - panelW, 0, panelW, SH, null, function () {
        rc(s, SW - panelW, 0, panelW, SH, RED_DARK);
        ell(s, SW - panelW - 0.9, 0.6, 0.7, RED);
        ell(s, SW - panelW - 0.4, 1.5, 0.42, BLUSH_TX);
      });
      tx(s, 0.6, 2.1, 7.6, 0.35, "HABLEMOS", 13, BLUSH_TX, true, HEAD, "left", "top", { charSpacing: 2.6 });
      tx(s, 0.6, 2.55, 7.7, 1.4, "¿Hablamos de tu próximo RENMAD Talk?", 30, WHITE, true, HEAD,
        "left", "top", { lineSpacingMultiple: 1.08 });
      tx(s, 0.6, 3.95, 7.4, 0.5,
        "Para preguntas, comentarios o para reservar tu paquete, escríbeme directamente.", 14, SOFT);
      s.addText([
        { text: sp.name, options: { color: WHITE, bold: true, fontFace: HEAD, breakLine: true } },
        { text: sp.phone, options: { color: SOFT, bold: false, fontFace: BODY, breakLine: true, hyperlink: { url: "tel:" + String(sp.phone).replace(/\s/g, "") } } },
        { text: sp.email, options: { color: SOFT, bold: false, fontFace: BODY, hyperlink: { url: "mailto:" + sp.email } } }
      ], { x: 0.6, y: 4.75, w: 7.4, h: 1.3, fontFace: BODY, fontSize: 16, valign: "top", paraSpaceAfter: 6 });
      logoMark(s, 0.6, 6.35, 1.6, true);
      tx(s, 5.6, 6.75, 2.55, 0.35, "Co-host: PwC", 12, SOFT, false, BODY, "right");
    })();

    return pptx;
  }

  global.PBTALKS = { buildTalksDeck: buildTalksDeck };
})(window);


/* ===== proposal\webinar_deck.js ===== */
/* ============================================================================
   RENMAD / ATA Insights  ·  Webinar Program deck  ·  browser build (PptxGenJS)
   ----------------------------------------------------------------------------
   Port of proposal_builder/webinar_deck.py to a static, dependency-free browser
   build. Same slide SEQUENCE and copy (EN/ES), rendered in the browser with the
   RENMAD newDeck() 16:9 layout. This is the STANDALONE Webinar Program pitch —
   there are NO event packages in this deck.

   Exposes:  window.PBWEB = { buildWebinarDeck(opts) }  ->  PptxGenJS deck object

   opts = {
     lang:        'en' | 'es'
     salesperson: { key, name, role:{en,es}, email, phone }   (optional)
     brand:       { ok, title, description, images:[{dataUrl}] } (optional, web-extractor)
   }

   Client logo -> brand.images[0] if present, else omitted gracefully.
   Image assets from the python deck (cover screenshot, icon PNGs, world map,
   logo wall, salesperson photo, ATA logo) are NOT available in the browser, so
   they are recreated with PptxGenJS shapes / text stand-ins. Copy embedded here
   (mirrors webinar_deck.py STR) rather than in data.js.
   ============================================================================ */
(function (global) {
  "use strict";

  // ---- fonts (browser house = Montserrat / Inter) --------------------------
  var HEAD = "Montserrat", BODY = "Inter";

  // ---- palette (mirrors webinar_deck.py) -----------------------------------
  var CHAR  = "222225", CHAR2 = "2E2E32";
  var SOFT  = "ECECEC", SOFTD = "DCDCDC", CREAM = "ECECEC", WHITE = "FFFFFF";
  var ORANGE = "FF4A00", ORANGE2 = "FF914D", ORANGED = "E03C00";
  var GREEN = "2E7D32", TEAL = "00A6A0", INDIGO = "5B47C9", GOLD = "F2A900";
  var INK = "222225", MUTE = "555558", LINE = "DCDCDC";
  var DEEP = "101618";
  var CYCLE = ["FF4A00", "00A6A0", "2E7D32", "5B47C9", "F2A900"];
  // official RENMAD sector colours (used on the "webinars in action" rows)
  var STORAGE_C = "E84830", H2_C = "3E8C28", BIO_C = "4C3079", DC_C = "29ACE3", REN_C = "FF4A00";
  var WEBEX_COLS = [STORAGE_C, H2_C, BIO_C, DC_C, REN_C];

  var SW = 13.333, SH = 7.5;

  // subtle soft shadow for cards
  var SHADOW = { type: "outer", color: "9AA0A6", blur: 7, offset: 3, angle: 90, opacity: 0.26 };

  // ---- low-level helpers ---------------------------------------------------
  function tx(s, x, y, w, h, t, size, color, bold, font, align, valign, extra) {
    var o = { x: x, y: y, w: w, h: h, fontFace: font || BODY, fontSize: size || 14,
      color: color || INK, bold: !!bold, align: align || "left", valign: valign || "top" };
    if (extra) for (var k in extra) o[k] = extra[k];
    s.addText(t, o);
  }
  function rc(s, x, y, w, h, fill, opts) {
    opts = opts || {};
    var o = { x: x, y: y, w: w, h: h };
    if (fill === null || fill === undefined) o.fill = { color: "FFFFFF", transparency: 100 };
    else o.fill = { color: fill };
    if (opts.line) { o.line = { color: opts.line, width: opts.lw || 1 }; }
    if (opts.rad != null) o.rectRadius = opts.rad;
    if (opts.shadow) o.shadow = SHADOW;
    s.addShape(opts.rad != null ? "roundRect" : "rect", o);
  }
  // ellipse whose CENTER is (cx,cy) with diameter d, optional centred glyph
  function disc(s, cx, cy, d, fill, glyph, gcolor, gsize, gfont) {
    s.addShape("ellipse", { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { color: fill } });
    if (glyph) tx(s, cx - d / 2, cy - d / 2, d, d, glyph, gsize || 16,
      gcolor || WHITE, true, gfont || HEAD, "center", "middle");
  }
  function addImg(s, x, y, w, h, dataUrl, sizingType) {
    try {
      if (!dataUrl) return false;
      s.addImage({ data: dataUrl, x: x, y: y, w: w, h: h,
        sizing: { type: sizingType || "cover", w: w, h: h } });
      return true;
    } catch (e) { return false; }
  }

  // ==========================================================================
  function buildWebinarDeck(opts) {
    opts = opts || {};
    var RENMAD = global.RENMAD;
    var lang = opts.lang === "es" ? "es" : "en";
    var S = STR[lang];
    var get = function (k) { return S[k] != null ? S[k] : ""; };

    var DEFAULT_SP = {
      name: "Cintia Hernández",
      role: { en: "Business Development · RENMAD Events", es: "Desarrollo de Negocio · RENMAD Events" },
      email: "cintia.hernandez@ata.email", phone: "+34 605 40 85 93",
    };
    var sp = opts.salesperson && opts.salesperson.name ? opts.salesperson : DEFAULT_SP;

    var brand = opts.brand && opts.brand.ok ? opts.brand : null;
    var brandImgs = (brand && brand.images) ? brand.images.map(function (i) { return i && i.dataUrl; }).filter(Boolean) : [];
    var CLIENT_LOGO = brandImgs.length ? brandImgs[0] : null;

    var pptx = RENMAD.newDeck();   // 13.333 x 7.5, RENMAD_16x9 layout

    // small "ATA INSIGHTS" mark top-right on light content slides (logo asset n/a)
    function logo_tr(s) { tx(s, 10.0, 0.52, 2.78, 0.34, "ATA INSIGHTS", 11, MUTE, true, HEAD, "right"); }
    function content_header(s, title, sub) {
      tx(s, 0.7, 0.62, 11.9, 0.9, title, 33, INK, true, HEAD);
      if (sub) tx(s, 0.72, 1.28, 11.9, 0.5, sub, 14.5, MUTE, false, BODY);
      logo_tr(s);
    }

    // ===== 1 COVER =========================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CHAR };
      // right "hero" region — screenshot asset n/a, use a lifted charcoal panel
      rc(s, 5.0, 0, 8.34, SH, CHAR2);
      rc(s, 5.0, 0, 0.06, SH, ORANGE);            // orange seam (echoes python fade edge)
      // decorative offset discs (subtle brand motif in the empty hero)
      disc(s, 10.4, 2.4, 3.4, CHAR);
      disc(s, 11.6, 5.3, 1.9, "26262A");
      // brand mark top-left
      tx(s, 0.55, 0.55, 3.6, 0.4, "ATA INSIGHTS", 13, WHITE, true, HEAD);
      tx(s, 0.57, 2.45, 4.2, 0.4, get("cover_kicker"), 13.5, ORANGE, true, HEAD);
      s.addText([
        { text: get("cover_t1"), options: { color: WHITE, breakLine: true } },
        { text: get("cover_t2"), options: { color: ORANGE } },
      ], { x: 0.55, y: 2.84, w: 4.3, h: 1.6, fontFace: HEAD, fontSize: 38, bold: true, lineSpacingMultiple: 0.98 });
      tx(s, 0.57, 4.55, 4.0, 0.9, get("strapline"), 13.5, "E7E1DB", false, BODY, "left", "top", { lineSpacingMultiple: 1.16 });
      if (CLIENT_LOGO) {
        tx(s, 0.57, 6.22, 3.5, 0.28, get("prepared"), 11.5, "C7C1BD", true, HEAD);
        addImg(s, 0.57, 6.42, 3.5, 0.72, CLIENT_LOGO, "contain");
      }
    })();

    // ===== 2 ABOUT =========================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("about_t"), get("about_sub"));
      var cards = get("about_cards");
      var cw = 3.78, ch = 3.35, gap = 0.34, cx0 = 0.7, cy = 2.35;
      var cols = [ORANGE, TEAL, GREEN];
      cards.forEach(function (row, i) {
        var icon = row[0], ttl = row[1], body = row[2];
        var x = cx0 + i * (cw + gap);
        rc(s, x, cy, cw, ch, WHITE, { rad: 0.08, shadow: true });
        disc(s, x + 0.72, cy + 0.78, 0.86, cols[i], icon, WHITE, 15, HEAD);
        tx(s, x + 0.42, cy + 1.4, cw - 0.8, 0.6, ttl, 18.5, INK, true, HEAD);
        tx(s, x + 0.42, cy + 2.0, cw - 0.8, 1.2, body, 12.5, MUTE, false, BODY, "left", "top", { lineSpacingMultiple: 1.18 });
      });
    })();

    // ===== 3 BY THE NUMBERS ================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: SOFT };
      tx(s, 0.7, 0.62, 11.9, 0.9, get("nums_t"), 33, INK, true, HEAD);
      tx(s, 0.72, 1.28, 11.9, 0.5, get("nums_sub"), 14.5, MUTE, false, BODY);
      logo_tr(s);
      var grid = get("nums_grid");
      var gw = 3.74, gh = 1.58, gxs = 0.34, gys = 0.28, gx0 = 0.7, gy0 = 2.15;
      grid.forEach(function (row, i) {
        var n = row[0], l = row[1];
        var r = Math.floor(i / 3), c = i % 3;
        var x = gx0 + c * (gw + gxs), y = gy0 + r * (gh + gys);
        rc(s, x, y, gw, gh, WHITE, { rad: 0.08, shadow: true });
        disc(s, x + gw - 0.55, y + 0.52, 0.62, CYCLE[i % CYCLE.length]);
        tx(s, x + 0.32, y + 0.2, gw - 1.1, 0.75, n, 38, ORANGE, true, HEAD);
        tx(s, x + 0.34, y + 0.98, gw - 0.62, 0.5, l, 12, INK, false, BODY, "left", "top", { lineSpacingMultiple: 1.05 });
      });
      rc(s, 0.7, 6.4, 11.9, 0.72, ORANGE, { rad: 0.1 });
      tx(s, 1.0, 6.4, 11.3, 0.72, get("nums_foot"), 12, WHITE, true, HEAD, "center", "middle");
    })();

    // ===== 4 WHO YOU REACH =================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("reach_t"), get("reach_sub"));
      // world map asset n/a — faint globe motif on the right
      disc(s, 9.9, 4.0, 3.6, "E4E4E4");
      disc(s, 9.9, 4.0, 2.4, SOFTD);
      // left white card with big stat callouts
      rc(s, 0.6, 2.25, 6.15, 3.62, WHITE, { rad: 0.08, shadow: true });
      var lx = 1.0, ly = 2.6;
      get("reach_big").forEach(function (row, i) {
        var n = row[0], l = row[1], y = ly + i * 1.04;
        tx(s, lx, y, 2.0, 0.85, n, 40, ORANGE, true, HEAD);
        tx(s, lx + 1.95, y + 0.08, 3.4, 0.8, l, 12.5, INK, false, BODY, "left", "middle", { lineSpacingMultiple: 1.1 });
      });
      tx(s, 0.72, 6.05, 5, 0.4, get("reach_seg_t"), 12.5, INK, true, HEAD);
      var chx = 0.72, chy = 6.42;
      get("reach_chips").forEach(function (ch, i) {
        var cw2 = 0.4 + ch.length * 0.115;
        rc(s, chx, chy, cw2, 0.44, CYCLE[i % CYCLE.length], { rad: 0.22 });
        tx(s, chx, chy, cw2, 0.44, ch, 10.5, WHITE, true, BODY, "center", "middle");
        chx += cw2 + 0.18;
      });
    })();

    // ===== 5 TOPICS WE COVER ===============================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: SOFT };
      tx(s, 0.7, 0.6, 8, 0.4, get("top_k"), 12.5, ORANGE, true, HEAD);
      tx(s, 0.7, 0.98, 11.5, 0.7, get("top_t"), 33, INK, true, HEAD);
      tx(s, 0.72, 1.64, 11.9, 0.5, get("top_sub"), 14.5, MUTE, false, BODY);
      logo_tr(s);
      var tp = get("topics");
      var col_w = 3.98, row_h = 2.34, left0 = 0.7, top0 = 2.32;
      var cell_w = col_w - 0.14, band_h = 0.84, cell_h = row_h - 0.08;
      tp.forEach(function (row, i) {
        var col = row[0], name = row[1], tag = row[2], events = row[3];
        var r = Math.floor(i / 3), c = i % 3;
        var x = left0 + c * col_w, y = top0 + r * (row_h + 0.06);
        rc(s, x, y, cell_w, cell_h, CHAR, { rad: 0.08, shadow: true });   // dark body
        rc(s, x, y, cell_w, band_h, col, { rad: 0.08 });                  // coloured header
        tx(s, x + 0.28, y + 0.16, cell_w - 0.5, 0.25, tag, 9, WHITE, true, BODY);
        tx(s, x + 0.28, y + 0.44, cell_w - 0.4, 0.4, name, 13.5, WHITE, true, HEAD, "left", "top", { wrap: false });
        tx(s, x + 0.28, y + band_h + 0.14, cell_w - 0.5, cell_h - band_h - 0.2, events, 10.5, "E4E4E6", false, BODY, "left", "top", { lineSpacingMultiple: 1.32 });
      });
      tx(s, 0.72, 7.0, 11.9, 0.32, get("top_foot"), 10.5, MUTE, false, BODY, "left", "top", { italic: true });
    })();

    // ===== 6 WHY SPONSOR ===================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("why_t"), get("why_sub"));
      var cards = get("why_cards");
      var cw = 3.78, ch = 1.95, gap = 0.34;
      var positions = [
        [0.7, 2.35], [0.7 + cw + gap, 2.35], [0.7 + 2 * (cw + gap), 2.35],
        [0.7 + (cw + gap) / 2, 2.35 + ch + 0.3], [0.7 + (cw + gap) / 2 + cw + gap, 2.35 + ch + 0.3],
      ];
      cards.forEach(function (row, i) {
        var num = row[0], ttl = row[1], body = row[2];
        var x = positions[i][0], y = positions[i][1];
        rc(s, x, y, cw, ch, WHITE, { rad: 0.08, shadow: true });
        disc(s, x + 0.6, y + 0.62, 0.72, CYCLE[i], num, WHITE, 17, HEAD);
        tx(s, x + 1.12, y + 0.32, cw - 1.3, 0.6, ttl, 15, INK, true, HEAD, "left", "middle", { lineSpacingMultiple: 1.0 });
        tx(s, x + 0.42, y + 1.05, cw - 0.8, 0.85, body, 11.5, MUTE, false, BODY, "left", "top", { lineSpacingMultiple: 1.13 });
      });
    })();

    // ===== 7 WHAT'S INCLUDED ===============================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("incl_t"), get("incl_sub"));
      rc(s, 0.6, 2.25, 7.75, 4.3, WHITE, { rad: 0.08, shadow: true });
      var lx = 1.0, ly = 2.55;
      get("incl_items").forEach(function (it, i) {
        var y = ly + i * 0.56;
        disc(s, lx + 0.22, y + 0.2, 0.42, GREEN, "✓", WHITE, 13, BODY);
        tx(s, lx + 0.62, y, 6.3, 0.55, it, 12.5, INK, false, BODY, "left", "middle", { lineSpacingMultiple: 1.0 });
      });
      var rx = 8.6, ry = 2.25, rw = 4.07, rh = 4.3;
      rc(s, rx, ry, rw, rh, ORANGE, { rad: 0.06, shadow: true });
      get("incl_stats").forEach(function (row, i) {
        var n = row[0], l = row[1], y = ry + 0.45 + i * 0.98;
        tx(s, rx + 0.4, y, 3.2, 0.7, n, 30, WHITE, true, HEAD);
        tx(s, rx + 0.4, y + 0.55, 3.3, 0.4, l, 11, "FFE7DB", false, BODY);
      });
    })();

    // ===== 8 WAYS TO COLLABORATE ===========================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("ways_t"), get("ways_sub"));
      var ways = get("ways_cards");
      var cw = 3.78, ch = 3.5, gap = 0.34;
      var numCols = [ORANGE, TEAL, INDIGO];
      ways.forEach(function (row, i) {
        var num = row[0], ttl = row[1], tag = row[2], body = row[3];
        var x = 0.7 + i * (cw + gap), y = 2.3;
        rc(s, x, y, cw, ch, WHITE, { rad: 0.08, shadow: true });
        tx(s, x + 0.42, y + 0.4, cw - 0.8, 0.9, num, 44, numCols[i], true, HEAD);
        tx(s, x + 0.42, y + 1.2, cw - 0.8, 0.55, ttl, 17, INK, true, HEAD, "left", "top", { lineSpacingMultiple: 0.98 });
        tx(s, x + 0.42, y + 1.92, cw - 0.8, 0.5, tag, 12, ORANGED, true, BODY);
        tx(s, x + 0.42, y + 2.35, cw - 0.8, 1.0, body, 11.5, MUTE, false, BODY, "left", "top", { lineSpacingMultiple: 1.15 });
      });
    })();

    // ===== 9 INVESTMENT ====================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("inv_t"), get("inv_sub"));
      var pc = get("inv_cards"), cw = 3.62, ch = 3.15;
      pc.forEach(function (row, i) {
        var price = row[0], ttl = row[1], body = row[2];
        var x = 0.7 + i * (cw + 0.3), y = 2.1;
        rc(s, x, y, cw, ch, WHITE, { rad: 0.08, shadow: true });
        rc(s, x + 0.4, y + 0.45, cw - 0.8, 1.05, CHAR, { rad: 0.12 });
        tx(s, x + 0.4, y + 0.45, cw - 0.8, 1.05, price, 37, ORANGE2, true, HEAD, "center", "middle");
        tx(s, x + 0.42, y + 1.72, cw - 0.84, 0.5, ttl, 16, INK, true, HEAD);
        tx(s, x + 0.42, y + 2.22, cw - 0.84, 0.8, body, 12, MUTE, false, BODY, "left", "top", { lineSpacingMultiple: 1.16 });
      });
      var rx = 8.42, ry = 2.1, rw = 4.25, rh = 3.15;
      rc(s, rx, ry, rw, rh, WHITE, { rad: 0.08, shadow: true });
      tx(s, rx + 0.35, ry + 0.3, rw - 0.7, 0.4, get("inv_disc_t"), 14.5, INK, true, HEAD);
      var pillCols = [ORANGE2, ORANGE, ORANGED], pillW = [2.55, 3.05, 3.55];
      get("inv_disc_rows").forEach(function (row, i) {
        var l = row[0], v = row[1];
        var py = ry + 0.98 + i * 0.68, pw = pillW[i];
        rc(s, rx + 0.32, py, pw, 0.56, pillCols[i], { rad: 0.28 });
        tx(s, rx + 0.58, py, pw - 1.15, 0.56, l, 11.5, WHITE, true, BODY, "left", "middle");
        tx(s, rx + 0.32 + pw - 1.05, py, 0.9, 0.56, v, 14, WHITE, true, HEAD, "right", "middle");
      });
      rc(s, 0.7, 5.45, 11.97, 0.98, ORANGE, { rad: 0.08 });
      tx(s, 1.0, 5.58, 11.4, 0.72, get("inv_note"), 12, WHITE, false, BODY, "left", "middle", { lineSpacingMultiple: 1.12 });
      tx(s, 0.72, 6.6, 11.9, 0.35, get("inv_foot"), 10.5, MUTE, false, BODY);
    })();

    // ===== 10 TESTIMONIALS =================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("test_t"), get("test_sub"));
      var quotes = get("test_quotes");
      var cw = 5.85, ch = 1.9, gap = 0.2;
      quotes.forEach(function (row, i) {
        var q = row[0], role = row[1];
        var r = Math.floor(i / 2), c = i % 2, col = CYCLE[i];
        var x = 0.7 + c * (cw + gap), y = 2.35 + r * (ch + 0.28);
        rc(s, x, y, cw, ch, WHITE, { rad: 0.08, shadow: true });
        disc(s, x + 0.62, y + 0.6, 0.62, col, "“", WHITE, 34, HEAD);
        tx(s, x + 1.15, y + 0.26, cw - 1.5, 1.15, q, 12, INK, false, BODY, "left", "top", { italic: true, lineSpacingMultiple: 1.12 });
        tx(s, x + 1.15, y + ch - 0.52, cw - 1.4, 0.4, role, 11, col, true, HEAD);
      });
    })();

    // ===== 11 TRUSTED BY ===================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: CREAM };
      content_header(s, get("wall_t"), get("wall_sub"));
      var card_x = 0.5, card_y = 1.82, card_w = 12.33, card_h = 5.5;
      rc(s, card_x, card_y, card_w, card_h, WHITE, { rad: 0.06, shadow: true });
      // logo-wall PNGs n/a in browser — render a light placeholder grid (drop logos in)
      var ax = 0.9, ay = 2.15, cols = 6, rows = 4;
      var gpx = 0.24, gpy = 0.24;
      var tw = (card_w - 2 * (ax - card_x) - (cols - 1) * gpx) / cols;
      var th = (card_h - 2 * (ay - card_y) - (rows - 1) * gpy) / rows;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = ax + c * (tw + gpx), y = ay + r * (th + gpy);
          rc(s, x, y, tw, th, "F4F4F6", { line: "E6E6EA", lw: 1, rad: 0.06 });
        }
      }
    })();

    // ===== 12 WEBINARS IN ACTION ===========================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: SOFT };
      content_header(s, get("ex_t"), get("ex_sub"));
      var webex = get("webex");
      var ry0 = 2.12, rh = 0.985, ch = 0.9;
      webex.forEach(function (row, i) {
        var label = row[0], title = row[1], reg = row[2], att = row[3], pct = row[4];
        var col = WEBEX_COLS[i];
        var y = ry0 + i * rh, cy = y + ch / 2;
        rc(s, 0.6, y, 12.13, ch, WHITE, { rad: 0.09, shadow: true });
        disc(s, 1.16, cy, 0.62, col);
        tx(s, 1.66, y + 0.13, 6.55, 0.24, label, 8.5, col, true, HEAD);
        tx(s, 1.66, y + 0.37, 6.55, 0.48, title, 10.5, INK, true, HEAD, "left", "top", { lineSpacingMultiple: 0.97 });
        s.addText([
          { text: reg + "  ", options: { bold: true, fontSize: 11.5, color: INK, fontFace: HEAD } },
          { text: get("webex_reg"), options: { fontSize: 9, color: MUTE, fontFace: BODY } },
        ], { x: 8.4, y: cy - 0.29, w: 2.4, h: 0.28, valign: "middle" });
        s.addText([
          { text: att + "  ", options: { bold: true, fontSize: 11.5, color: INK, fontFace: HEAD } },
          { text: get("webex_att"), options: { fontSize: 9, color: MUTE, fontFace: BODY } },
        ], { x: 8.4, y: cy + 0.02, w: 2.4, h: 0.28, valign: "middle" });
        tx(s, 10.95, y + 0.13, 1.72, 0.5, pct, 22, col, true, HEAD, "center");
        tx(s, 10.95, y + 0.6, 1.72, 0.22, get("webex_pct"), 8.5, col, false, BODY, "center");
      });
      tx(s, 0.62, 7.08, 12.1, 0.3, get("webex_foot"), 9.5, MUTE, false, BODY, "left", "top", { italic: true });
    })();

    // ===== 13 CONTACT ======================================================
    (function () {
      var s = pptx.addSlide(); s.background = { color: DEEP };
      var pw = 4.8;
      // salesperson photo asset n/a — dark panel stand-in (or brand hero if any)
      rc(s, SW - pw, 0, pw, SH, CHAR2);
      disc(s, SW - pw / 2, 2.7, 3.0, "26262A");
      rc(s, 0, 0, 0.14, SH, ORANGE);
      // decorative accent dots (stand-ins for the deck's stars)
      disc(s, SW - pw - 0.9 + 0.35, 0.5 + 0.35, 0.7, ORANGED);
      disc(s, SW - pw - 0.4 + 0.21, 1.3 + 0.21, 0.42, "FF9B73");
      tx(s, 0.6, 0.55, 5, 0.3, get("ct_k"), 14, ORANGED, true, HEAD);
      rc(s, 0.62, 0.98, 0.9, 0.05, ORANGED);
      tx(s, 0.6, 1.2, 7.3, 1.3, get("ct_t"), 34, WHITE, true, HEAD, "left", "top", { lineSpacingMultiple: 1.02 });
      tx(s, 0.6, 2.7, 7.3, 0.5, get("ct_sub"), 14, "CDC8C4", false, BODY);
      var cy = 3.62;
      rc(s, 0.6, cy, 0.52, 0.52, ORANGE, { rad: 0.1 });
      tx(s, 1.4, cy, 6.7, 0.52, sp.name, 18, WHITE, true, HEAD, "left", "middle"); cy += 0.58;
      rc(s, 0.6, cy, 0.52, 0.52, TEAL, { rad: 0.1 });
      s.addText(sp.phone, { x: 1.4, y: cy, w: 6.7, h: 0.52, fontFace: HEAD, fontSize: 18, color: WHITE, bold: true, valign: "middle", hyperlink: { url: "tel:" + String(sp.phone).replace(/\s/g, "") } }); cy += 0.58;
      rc(s, 0.6, cy, 0.52, 0.52, INDIGO, { rad: 0.1 });
      s.addText(sp.email, { x: 1.4, y: cy, w: 6.7, h: 0.52, fontFace: HEAD, fontSize: 18, color: WHITE, bold: true, valign: "middle", hyperlink: { url: "mailto:" + sp.email } }); cy += 0.58;
      rc(s, 0.6, 5.9, 7.3, 0.02, "393E44");
      tx(s, 0.62, 6.02, 3.0, 0.24, get("from_lbl"), 9.5, "8E8884", true, HEAD);
      tx(s, 0.6, 6.34, 3.5, 0.5, "ATA INSIGHTS", 20, WHITE, true, HEAD);
      if (CLIENT_LOGO) {
        tx(s, 4.15, 6.02, 3.5, 0.24, get("prepared"), 9.5, "8E8884", true, HEAD);
        addImg(s, 4.15, 6.28, 3.5, 0.9, CLIENT_LOGO, "contain");
      }
    })();

    return pptx;
  }

  // ==========================================================================
  // STRINGS (mirror of webinar_deck.py STR — EN/ES)
  // ==========================================================================
  var STR = {
    en: {
      prepared: "PREPARED FOR",
      from_lbl: "FROM",
      cover_kicker: "SPONSORSHIP OPPORTUNITIES",
      cover_t1: "WEBINAR", cover_t2: "PROGRAM",
      strapline: "Ideas, content and marketing for the energy transition",
      about_t: "About the program",
      about_sub: "The direct channel to the energy sector's professionals",
      about_cards: [
        ["A", "Real reach", "A database of 86,000 energy professionals — 57,000 of them newsletter subscribers. Segmented by geography, language and sector."],
        ["B", "Qualified audience", "Mostly technical and management profiles. From 300 to 1,000 registrations per webinar, with a live attendance rate above 25%."],
        ["C", "Lasting impact", "The recording and slide deck reach everyone registered after the webinar — whether they attended live or not."],
      ],
      nums_t: "The webinar program by the numbers",
      nums_sub: "A decade of building the energy transition's most engaged online audience",
      nums_grid: [
        ["86K", "energy professionals in our community"],
        ["700+", "webinars delivered since 2016"],
        ["90+", "new sessions every year"],
        ["16,000+", "webinar attendees a year"],
        ["~550", "average registrations per session"],
        ["25%+", "live attendance rate"],
      ],
      nums_foot: "200+ expert speakers a year   ·   4 languages: EN · ES · IT · PL   ·   on-demand at my.atainsights.com",
      reach_t: "Who you reach",
      reach_sub: "A senior, global and sharply targetable audience",
      reach_big: [
        ["33%", "based in Spain — our single largest market"],
        ["~32%", "across Latin America (19 countries)"],
        ["~41%", "decision-makers: C-level, directors & managers"],
      ],
      reach_seg_t: "Segment your webinar by:",
      reach_chips: ["Geography", "Language", "Sector", "Seniority", "Market"],
      top_k: "TOPICS WE COVER",
      top_t: "Six sectors. Deep expertise.",
      top_sub: "An industry-leading webinar audience on each one.",
      top_foot: "Every topic is backed by a dedicated audience and a live RENMAD events series.",
      topics: [
        [ORANGE, "Renewables", "OVERARCHING", "Solar PV, wind, grids & markets\nThe cross-cutting webinar track\nReaching all 86K professionals"],
        [CHAR, "Storage", "FLAGSHIP", "BESS technology & markets\nOur most-attended topic\nAligned with RENMAD Almacenamiento"],
        [TEAL, "Renewable Hydrogen", "MULTI-MARKET", "Green H2, delegated acts, offtake\nEU & LATAM audiences\nHydrogen webinar series"],
        [GREEN, "Biomethane & Gases", "GROWING", "Biomethane, biogas & RNG\nA fast-growing audience\nAEBIG-aligned content"],
        [INDIGO, "Datacenters", "NEW", "Energy for AI & datacenters\nOur fastest-rising track\nSiting & waste-heat webinars"],
        [GOLD, "energIA", "AI × ENERGY", "AI applied to the energy sector\nRENMAD UsefulAI content\nGenAI-for-energy webinars"],
      ],
      why_t: "Why sponsor a webinar",
      why_sub: "Five reasons the program works for your brand and your pipeline",
      why_cards: [
        ["1", "Qualified leads", "Hundreds of qualified leads from a single webinar, so your team can focus on selling."],
        ["2", "Thought leadership", "Showcase your expertise to renewable-energy professionals in sessions that add real value."],
        ["3", "Expert marketing", "A decade of marketing to energy audiences, put to work maximising quality attendance."],
        ["4", "Hassle-free", "Leave the set-up, promotion and moderation to us and free up your team's time."],
        ["5", "Room to grow", "Build authority over time with a sustained presence across the year."],
      ],
      incl_t: "What every webinar includes",
      incl_sub: "One price, the full marketing machine behind your session",
      incl_items: [
        "Weekly promotion to the full database (every Monday)",
        "1 dedicated email built entirely around your webinar",
        "1 newsletter promoting the webinar program",
        "Full registration management",
        "Technical support & professional moderation live",
        "Recording sent to every registrant afterwards",
        "Slide deck (PDF) distributed to all registrants",
      ],
      incl_stats: [
        ["300–1,000", "registrations per webinar"],
        ["25%+", "live attendance"],
        ["86K", "contacts reached"],
        ["100%", "receive the recording"],
      ],
      ways_t: "Ways to collaborate",
      ways_sub: "Choose the format that best fits your objectives",
      ways_cards: [
        ["01", "Single webinar", "Immediate, focused impact", "Ideal for product launches, technical news or positioning at a key moment. Maximum visibility concentrated in one action."],
        ["02", "Multi-webinar package", "A continuous positioning strategy", "2, 3, 4 or more webinars with progressive discounts — the option to build authority steadily across the year."],
        ["03", "Webinar within a sponsorship", "Maximum reach & integration", "Add a webinar to your RENMAD event sponsorship and combine physical presence with digital reach, before or after the event."],
      ],
      inv_t: "Investment",
      inv_sub: "Simple, transparent pricing with volume discounts",
      inv_cards: [
        ["3,500 €", "Webinar", "Full promotion, hosting and recording of your session — no attendee list."],
        ["5,500 €", "Webinar + attendee list", "Everything in the base webinar, plus every live registrant delivered to you as a qualified lead."],
      ],
      inv_disc_t: "Multi-webinar discount",
      inv_disc_rows: [["2 webinars", "–5%"], ["3 webinars", "–10%"], ["4+ webinars", "Ask"]],
      inv_note: "The attendee-list package includes the name, email and registration data of every live attendee — a qualified base, ready for your sales team.",
      inv_foot: "Prices exclude VAT. Multi-webinar discount tiers are indicative — final terms confirmed per proposal.",
      test_t: "What energy professionals say",
      test_sub: "Feedback from the audience you'll be speaking to",
      test_quotes: [
        ["The webinars are very interesting, especially to get up to speed on what's going on in the market — even for regions where we're not operating.", "Business Development Manager, ACWA Power"],
        ["Thank you so much for the high-quality webinars and the great speakers.", "Regional Programme Officer MENA, IRENA"],
        ["The live cast was very interesting and very useful to my work. I learned a lot and I look forward to future ones.", "Project Development Director, Ecoplexus"],
        ["Lots of positive feedback on the smooth running, the richness of the presentations and the high level of participation.", "Independent consultant"],
      ],
      wall_t: "Trusted by the industry",
      wall_sub: "A selection of the organisations that have taken part in our webinars",
      ex_t: "Webinars in action",
      ex_sub: "A sample of sessions we've already run — one per sector",
      webex_reg: "registered", webex_att: "attended", webex_pct: "attendance",
      webex_foot: "Real sessions from our recent programme · attendance rate = live attendees ÷ registrants",
      webex: [
        ["STORAGE", "Energy-storage business models under the new capacity mechanism", "1,632", "724", "44%"],
        ["HYDROGEN", "Projecting renewable H₂ demand to 2030: challenges, regulation and opportunities", "704", "260", "37%"],
        ["BIOMETHANE", "Digestate: regulatory and technological keys to its management", "724", "352", "49%"],
        ["DATA CENTERS", "The new CNMC framework: how to read capacity maps and gain a competitive edge", "1,379", "586", "42%"],
        ["RENEWABLES", "Renewables facing zero prices: a temporary risk or the new normal?", "1,076", "464", "43%"],
      ],
      ct_k: "LET'S TALK",
      ct_t: "Shall we talk about your next webinar?",
      ct_sub: "For questions, comments or partnership proposals, reach out directly.",
    },
    es: {
      prepared: "PREPARADO PARA",
      from_lbl: "DE PARTE DE",
      cover_kicker: "OPORTUNIDADES DE PATROCINIO",
      cover_t1: "PROGRAMA DE", cover_t2: "WEBINARS",
      strapline: "Ideas, contenido y marketing para la transición energética",
      about_t: "Sobre el programa",
      about_sub: "El canal directo hacia los profesionales del sector energético",
      about_cards: [
        ["A", "Alcance real", "Una base de datos de 86.000 profesionales de la energía — 57.000 de ellos suscriptores del newsletter. Segmentada por geografía, idioma y sector."],
        ["B", "Audiencia cualificada", "Perfiles mayoritariamente técnicos y de dirección. De 300 a 1.000 registros por webinar, con una tasa de asistencia en vivo superior al 25%."],
        ["C", "Impacto continuo", "La grabación y la presentación llegan a todos los registrados tras el webinar, hayan asistido en vivo o no."],
      ],
      nums_t: "El programa de webinars en cifras",
      nums_sub: "Una década construyendo la audiencia online más activa de la transición energética",
      nums_grid: [
        ["86K", "profesionales en nuestra comunidad"],
        ["+700", "webinars realizados desde 2016"],
        ["+90", "nuevas sesiones cada año"],
        ["+16.000", "asistentes a webinars al año"],
        ["~550", "registros medios por sesión"],
        ["+25%", "tasa de asistencia en vivo"],
      ],
      nums_foot: "+200 ponentes expertos al año   ·   4 idiomas: EN · ES · IT · PL   ·   disponibles en my.atainsights.com",
      reach_t: "A quién llegas",
      reach_sub: "Una audiencia sénior, global y fácilmente segmentable",
      reach_big: [
        ["33%", "en España — nuestro mayor mercado"],
        ["~32%", "en Latinoamérica (19 países)"],
        ["~41%", "decisores: alta dirección, directores y managers"],
      ],
      reach_seg_t: "Segmenta tu webinar por:",
      reach_chips: ["Geografía", "Idioma", "Sector", "Cargo", "Mercado"],
      top_k: "TEMAS QUE CUBRIMOS",
      top_t: "Seis sectores. Experiencia profunda.",
      top_sub: "Una audiencia líder en webinars para cada uno.",
      top_foot: "Cada tema cuenta con una audiencia dedicada y una serie de eventos RENMAD en directo.",
      topics: [
        [ORANGE, "Renovables", "TRANSVERSAL", "Fotovoltaica, eólica, redes y mercados\nEl track transversal de webinars\nLlega a los 86K profesionales"],
        [CHAR, "Almacenamiento", "BUQUE INSIGNIA", "Tecnología y mercados BESS\nNuestro tema más concurrido\nAlineado con RENMAD Almacenamiento"],
        [TEAL, "Hidrógeno renovable", "MULTIMERCADO", "H2 verde, actos delegados, offtake\nAudiencias UE y LATAM\nSerie de webinars de hidrógeno"],
        [GREEN, "Biometano y gases", "EN AUGE", "Biometano, biogás y RNG\nUna audiencia en rápido crecimiento\nContenido alineado con AEBIG"],
        [INDIGO, "Datacenters", "NUEVO", "Energía para IA y datacenters\nNuestro track de mayor crecimiento\nWebinars de ubicación y calor residual"],
        [GOLD, "energIA", "IA × ENERGÍA", "IA aplicada al sector energético\nContenido RENMAD UsefulAI\nWebinars de IA generativa"],
      ],
      why_t: "Por qué patrocinar un webinar",
      why_sub: "Cinco razones por las que el programa funciona para tu marca y tu pipeline",
      why_cards: [
        ["1", "Leads cualificados", "Cientos de leads cualificados de un solo webinar, para que tu equipo se centre en vender."],
        ["2", "Liderazgo de opinión", "Muestra tu know-how a los profesionales de las renovables en sesiones que aportan valor real."],
        ["3", "Marketing experto", "Una década haciendo marketing a audiencias del sector, al servicio de la máxima asistencia de calidad."],
        ["4", "Sin complicaciones", "Déjanos el montaje, la promoción y la moderación y libera el tiempo de tu equipo."],
        ["5", "Espacio para crecer", "Construye autoridad con una presencia sostenida a lo largo del año."],
      ],
      incl_t: "Qué incluye cada webinar",
      incl_sub: "Un solo precio, toda la maquinaria de marketing detrás de tu sesión",
      incl_items: [
        "Difusión semanal a toda la BBDD (todos los lunes)",
        "1 email exclusivo dedicado íntegramente a tu webinar",
        "1 newsletter de promoción del programa de webinars",
        "Gestión integral de inscripciones",
        "Soporte técnico y moderación profesional en directo",
        "Grabación enviada a todos los inscritos tras el evento",
        "Presentación (PDF) distribuida a todos los registrados",
      ],
      incl_stats: [
        ["300–1.000", "registros por webinar"],
        ["+25%", "asistencia en vivo"],
        ["86K", "contactos alcanzados"],
        ["100%", "reciben la grabación"],
      ],
      ways_t: "Modalidades de colaboración",
      ways_sub: "Elige el formato que mejor se adapta a tus objetivos",
      ways_cards: [
        ["01", "Webinar único", "Impacto inmediato y puntual", "Ideal para lanzamientos de producto, novedades técnicas o posicionamiento en un momento concreto. Máxima visibilidad concentrada en una acción."],
        ["02", "Paquete multi-webinar", "Estrategia de posicionamiento continua", "2, 3, 4 o más webinars con descuentos progresivos — la opción para construir autoridad de forma sostenida a lo largo del año."],
        ["03", "Webinar incluido en patrocinio", "Máximo alcance e integración", "Añade un webinar a tu patrocinio de evento RENMAD y combina presencia física con alcance digital, antes o después de la cita."],
      ],
      inv_t: "Inversión",
      inv_sub: "Precios sencillos y transparentes, con descuentos por volumen",
      inv_cards: [
        ["3.500 €", "Webinar", "Promoción, organización y grabación completas de tu sesión — sin lista de asistentes."],
        ["5.500 €", "Webinar + lista de asistentes", "Todo lo del webinar base, más cada registrado en directo entregado como lead cualificado."],
      ],
      inv_disc_t: "Descuento multi-webinar",
      inv_disc_rows: [["2 webinars", "–5%"], ["3 webinars", "–10%"], ["4+ webinars", "A medida"]],
      inv_note: "El paquete con lista de asistentes incluye nombre, email y datos de registro de todos los asistentes en vivo — una base cualificada, lista para tu equipo comercial.",
      inv_foot: "Precios sin IVA. Los tramos de descuento multi-webinar son orientativos — condiciones finales según propuesta.",
      test_t: "Lo que dicen los profesionales del sector",
      test_sub: "Opiniones de la audiencia a la que te dirigirás",
      test_quotes: [
        ["Los webinars son muy interesantes, especialmente para ponerse al día de lo que ocurre en el mercado, incluso en regiones donde no operamos.", "Business Development Manager, ACWA Power"],
        ["Muchas gracias por los webinars de tan alta calidad y por los excelentes ponentes.", "Regional Programme Officer MENA, IRENA"],
        ["La emisión en directo fue muy interesante y muy útil para mi trabajo. Aprendí mucho y espero los próximos con ganas.", "Project Development Director, Ecoplexus"],
        ["Mucho feedback positivo sobre la fluidez de la organización, la riqueza de las presentaciones y el alto nivel de participación.", "Consultor independiente"],
      ],
      wall_t: "Confían en nosotros",
      wall_sub: "Una selección de las organizaciones que han participado en nuestros webinars",
      ex_t: "Webinars en acción",
      ex_sub: "Una muestra de sesiones que ya hemos realizado — una por sector",
      webex_reg: "registrados", webex_att: "asistentes", webex_pct: "asistencia",
      webex_foot: "Sesiones reales de nuestro programa reciente · tasa de asistencia = asistentes en vivo ÷ registrados",
      webex: [
        ["ALMACENAMIENTO", "Análisis de modelos de negocio de almacenamiento de energía con el nuevo mecanismo de capacidad", "1.632", "724", "44%"],
        ["HIDRÓGENO", "Proyección de la demanda de H₂ renovable 2030: retos, regulaciones y oportunidades", "704", "260", "37%"],
        ["BIOMETANO", "Digestato: claves regulatorias y tecnológicas para su gestión", "724", "352", "49%"],
        ["DATACENTERS", "Nuevo marco CNMC: cómo interpretar los mapas de capacidad y ganar ventaja competitiva", "1.379", "586", "42%"],
        ["RENOVABLES", "Las renovables ante los precios cero: ¿riesgo temporal o nueva norma?", "1.076", "464", "43%"],
      ],
      ct_k: "HABLEMOS",
      ct_t: "¿Hablamos de tu próximo webinar?",
      ct_sub: "Para preguntas, comentarios o propuestas de colaboración, escríbeme directamente.",
    },
  };

  global.PBWEB = { buildWebinarDeck: buildWebinarDeck };
})(window);

