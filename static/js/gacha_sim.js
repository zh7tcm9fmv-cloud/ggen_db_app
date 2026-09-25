window.GgenGachaSim = (function () {
  function uiLang() {
    try {
      var l = (window.S && S.lang) || "EN";
      if (l === "JP") return "JA";
      return l;
    } catch (e) {
      return "EN";
    }
  }

  function tt(key, vars) {
    var s = "";
    try {
      if (typeof window.t === "function") s = window.t(key);
    } catch (e) {}
    if (!s || s === key) {
      try {
        var lang = uiLang();
        var pack = (window.T && (T[lang] || T.EN)) || {};
        s = pack[key] || (T && T.EN && T.EN[key]) || key;
      } catch (e2) {
        s = key;
      }
    }
    if (vars && typeof s === "string") {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function logoLangSuffix() {
    var l = uiLang();
    if (l === "JA") return "ja";
    if (l === "TW") return "tw";
    if (l === "HK") return "hk";
    return "en";
  }

  function resolveGashaId() {
    try {
      if (window.S && S.gashaSimGashaId) return String(S.gachaSimGashaId).trim();
    } catch (e) {}
    try {
      var m = String(location.pathname || "").match(/\/gacha-sim\/([^/]+)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
      var q = new URLSearchParams(location.search);
      return String(q.get("gasha") || q.get("gasha_id") || "").trim();
    } catch (e2) {}
    return "";
  }

  function exportPageUrl() {
    var gid = resolveGashaId() || (poolMeta && poolMeta.gasha_id) || "";
    var base = "https://ggendb.up.railway.app/gacha-sim";
    return gid ? base + "/" + encodeURIComponent(gid) : base;
  }

  /* Owner promo tweet — Share to X opens as a quote of this status. */
  var GS_SHARE_QUOTE_TWEET_URL = "https://x.com/Mikew00911/status/2103358880449458340";

  function onTabShown() {
    var gid = resolveGashaId();
    if (gid && window.S) S.gachaSimGashaId = gid;
    ensureTekoFont();
    applyLang();
    syncRotateHint();
    if (gid !== String(poolMeta.gasha_id || "") || poolMeta.source === "pending" || poolMeta.lang !== uiLang()) {
      loadPublishedPool(gid);
    }
    return Promise.resolve(window.GgenGachaSim);
  }

  /** Gacha HUD uses Teko (1.5 Special Design) even in Classic — load if 1.5 toggle did not. */
  function ensureTekoFont() {
    try {
      if (document.getElementById("ggen15Fonts") || document.getElementById("gachaSimTekoFont")) return;
      var l = document.createElement("link");
      l.id = "gachaSimTekoFont";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&display=swap";
      l.media = "print";
      l.onload = function () { this.media = "all"; };
      document.head.appendChild(l);
    } catch (e) {}
  }

  function syncRotateHint() {
    var el = document.getElementById("gsRotateHint");
    if (!el) return;
    var narrow = false;
    var portrait = false;
    try {
      narrow = window.matchMedia("(max-width: 900px)").matches;
      portrait = window.matchMedia("(orientation: portrait)").matches;
    } catch (e) {
      narrow = window.innerWidth <= 900;
      portrait = window.innerHeight >= window.innerWidth;
    }
    var show = narrow && portrait;
    el.hidden = !show;
    el.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function applyLang() {
    var root = document.getElementById("gachaSimRoot");
    if (!root) return;
    var setTxt = function (sel, text) {
      var el = root.querySelector(sel);
      if (el) el.textContent = text;
    };
    var setHtml = function (sel, html) {
      var el = root.querySelector(sel);
      if (el) el.innerHTML = html;
    };
    setTxt(".kicker", tt("gs_kicker"));
    setTxt(".shell > h1", tt("gs_title"));
    setTxt("#disclaimer", tt("gs_disclaimer"));
    setTxt("#gsRotateCopy", tt("gs_rotate_hint"));
    var rot = document.getElementById("gsRotateHint");
    if (rot) rot.setAttribute("aria-label", tt("gs_rotate_hint_aria"));
    var pity = root.querySelector(".hud .pity");
    if (pity) {
      var pts = pity.querySelector("#pts");
      var n = pts ? pts.textContent : "0";
      pity.innerHTML = tt("gs_exchange_pts") + " <b id=\"pts\">" + n + "</b>";
    }
    syncPullButtons();
    var optCol = root.querySelector("label.opt-row[for], label.opt-row");
    var optRows = root.querySelectorAll("label.opt-row");
    if (optRows[0]) {
      var inp0 = optRows[0].querySelector("input");
      optRows[0].childNodes.forEach(function (n) {
        if (n.nodeType === 3 && String(n.textContent || "").trim()) n.textContent = " " + tt("gs_opt_collections");
      });
      if (!inp0) {/* keep */}
      // Rebuild label text safely
      var c0 = optRows[0].querySelector("input");
      if (c0) {
        optRows[0].innerHTML = "";
        optRows[0].appendChild(c0);
        optRows[0].appendChild(document.createTextNode(" " + tt("gs_opt_collections")));
      }
    }
    if (optRows[1]) {
      var c1 = optRows[1].querySelector("input");
      if (c1) {
        optRows[1].innerHTML = "";
        optRows[1].appendChild(c1);
        optRows[1].appendChild(document.createTextNode(" " + tt("gs_opt_skip_anim")));
      }
    }
    var sessHead = root.querySelector(".session-head strong");
    if (sessHead) sessHead.textContent = tt("gs_session");
    var sessPullWrap = root.querySelector(".session-head > span");
    if (sessPullWrap) {
      var sp = sessPullWrap.querySelector("#sessPulls");
      var sn = sp ? sp.textContent : "0";
      sessPullWrap.innerHTML = tt("gs_total_pulls") + " <b id=\"sessPulls\">" + sn + "</b>";
    }
    var sessSave = document.getElementById("sessSave");
    if (sessSave) sessSave.innerHTML = "<small>" + tt("gs_save") + "</small><b>" + tt("gs_session_btn") + "</b>";
    var sessReset = document.getElementById("sessReset");
    if (sessReset) sessReset.innerHTML = "<small>" + tt("gs_reset") + "</small><b>" + tt("gs_session_btn") + "</b>";
    try { applyShareXBtnLabels(); } catch (eShareLbl) {}
    var unitsLbl = document.getElementById("sessStatsUnitsLbl");
    if (unitsLbl) unitsLbl.textContent = tt("tab_unit");
    var suppLbl = root.querySelector(".session-stats-pane--supp .session-stats-label");
    if (suppLbl) suppLbl.textContent = tt("gs_supp_label");
    var urHits = root.querySelector(".session-ur-hits > strong");
    if (urHits) urHits.textContent = tt("gs_ur_ssr_hits");
    setTxt(".session-log-label", tt("gs_every_multi"));
    setTxt(".results-title", tt("gs_results_title"));
    var pityAfter = root.querySelector(".results-meta .pity-line");
    if (pityAfter) {
      var pa = pityAfter.querySelector("#ptsAfter");
      var pn = pa ? pa.textContent : "0";
      pityAfter.innerHTML = tt("gs_exchange_pts") + " <b id=\"ptsAfter\">" + pn + "</b>";
    }
    try { syncBulkResultChrome(); } catch (ePity) {}
    var share = document.getElementById("shareStrip");
    if (share) share.textContent = tt("gs_save_collections");
    var done = document.getElementById("done");
    if (done) done.textContent = tt("gs_back");
    var again = document.getElementById("again");
    if (again) again.textContent = tt("gs_assemble_again");
    var skipBtn = document.getElementById("skip");
    if (skipBtn) skipBtn.textContent = tt("gs_skip");
    var op = root.querySelector(".op strong");
    if (op) op.textContent = tt("gs_sortie");
    if (typeof renderSession === "function") {
      try { renderSession(); } catch (e) {}
    }
    // Refresh banner logo locale
    if (poolMeta && poolMeta.logo) {
      var logoEl = document.getElementById("bannerLogo");
      if (logoEl && poolMeta.logo) {
        logoEl.src = CDN + "Gasha/" + poolMeta.logo + "_" + logoLangSuffix() + ".webp";
      }
    }
  }

  function onLangChange() {
    applyLang();
    var gid = resolveGashaId() || (poolMeta && poolMeta.gasha_id) || "";
    loadPublishedPool(gid);
  }

  var CDN = (function () {
    try {
      if (window.__GGEN_IMAGE_CDN__ && window.__GGEN_GAME_IMAGES_USE_CDN__ !== false) {
        return String(window.__GGEN_IMAGE_CDN__).replace(/\/?$/, '/') + 'images/';
      }
    } catch (e) {}
    return "https://cdn.jsdelivr.net/gh/zh7tcm9fmv-cloud/ggen_db_images@main/images/";
  })();
  var GS = CDN + "UI/gasha_sim/";
  /* Card chrome on CDN (UI/gasha_sim); /static/gacha_sim only when CDN is off */
  var LOCAL_FB = "/static/gacha_sim/";
  var LOCAL = (function () {
    try {
      if (window.__GGEN_IMAGE_CDN__ && window.__GGEN_GAME_IMAGES_USE_CDN__ !== false) {
        return GS;
      }
    } catch (e) {}
    return LOCAL_FB;
  })();
  var REFS = LOCAL + "refs/";
  function chromeUrl(file) {
    return LOCAL + file;
  }
  /* Prefer CDN; fall back to Railway /static until ggen_db_images push propagates */
  function chromeImg(cls, file) {
    var src = chromeUrl(file);
    var attrs =
      ' class="' + cls + '" alt="" src="' + src + '" decoding="async"';
    if (LOCAL !== LOCAL_FB) {
      attrs +=
        ' data-gs-fb="' + LOCAL_FB + file +
        '" onerror="if(this.dataset.gsFb){var u=this.dataset.gsFb;delete this.dataset.gsFb;this.src=u}"';
    }
    return "<img" + attrs + ">";
  }
  /* BromideHeightIndex → object-position Y (face-first; H2 is catalog majority). */
  var POR_Y_BY_HEIGHT = { "0": "8%", "1": "12%", "2": "14%", "3": "24%", "4": "34%", "5": "44%" };
  function porYFromItem(item) {
    if (!item) return "14%";
    var h = item.bromide_height != null ? item.bromide_height : item.bromideHeight;
    if (h != null && h !== "" && POR_Y_BY_HEIGHT[String(h)] != null) {
      return POR_Y_BY_HEIGHT[String(h)];
    }
    var y = String(item.por_y || item.porY || "").trim();
    return y || "14%";
  }

  function findPoolItemById(id) {
    var sid = String(id || "");
    if (!sid) return null;
    var keys = Object.keys(POOL);
    for (var i = 0; i < keys.length; i++) {
      var list = POOL[keys[i]] || [];
      for (var j = 0; j < list.length; j++) {
        if (String(list[j].id || "") === sid) return list[j];
      }
    }
    return null;
  }

  function resolvePorY(card) {
    if (!card) return "14%";
    var fromPool = card.id ? findPoolItemById(card.id) : null;
    if (fromPool) {
      return porYFromItem({
        bromide_height: fromPool.bromide_height != null ? fromPool.bromide_height : card.bromide_height,
        bromideHeight: fromPool.bromideHeight != null ? fromPool.bromideHeight : card.bromideHeight,
        por_y: fromPool.por_y || card.por_y || card.porY,
        porY: fromPool.porY || card.porY || card.por_y
      });
    }
    return porYFromItem(card);
  }

  /* Browse /c+/u role icons (Attack / Durability / Support) — not Melee/Ranged */
  /* Unit role icons only — never use Support role for Supporters (separate card kind) */
  var ROLE = {
    Attack: CDN + "UI/UI_Common_TypeIcon_Attack_M.webp",
    Durability: CDN + "UI/UI_Common_TypeIcon_Defense_M.webp",
    Defense: CDN + "UI/UI_Common_TypeIcon_Defense_M.webp",
    Support: CDN + "UI/UI_Common_TypeIcon_Support_M.webp"
  };
  var RARITY_ICON = {
    r: CDN + "UI/UI_Common_RarityIcon_R.webp",
    sr: CDN + "UI/UI_Common_RarityIcon_SR.webp",
    ssr: CDN + "UI/UI_Common_RarityIcon_SSR.webp",
    ur: CDN + "UI/UI_Common_RarityIcon_UR.webp"
  };
  (function wireSessionTierIcons() {
    var root = document.getElementById("sessionPanel") || document;
    root.querySelectorAll(".tier-icon[data-rarity]").forEach(function (img) {
      var r = String(img.getAttribute("data-rarity") || "").toLowerCase();
      if (RARITY_ICON[r]) {
        img.src = RARITY_ICON[r];
        img.decoding = "async";
      }
    });
  })();
  var CHAR_BASE = {
    r: CDN + "UI/UI_Common_Tmb_Square_R_Base.webp",
    sr: CDN + "UI/UI_Common_Tmb_Square_SR_Base.webp",
    ssr: CDN + "UI/UI_Common_Tmb_Square_SSR_Base.webp",
    ur: CDN + "UI/UI_Common_Tmb_Square_UR_Base.webp"
  };
  var CHAR_FRAME = {
    r: CDN + "UI/UI_Common_Tmb_Square_R_Frame.webp",
    sr: CDN + "UI/UI_Common_Tmb_Square_SR_Frame.webp",
    ssr: CDN + "UI/UI_Common_Tmb_Square_SSR_Frame.webp",
    ur: CDN + "UI/UI_Common_Tmb_Square_UR_Frame.webp"
  };
  var SUPP_FRAME = {
    ssr: {
      /* Exact image.psdssr.psd Layers 7–10 — distinct pieces, no flip */
      l: "psd_SSR_Frame_L.webp",
      r: "psd_SSR_Frame_R.webp",
      t: "psd_SSR_Frame_T.webp",
      b: "psd_SSR_Frame_B.webp",
      mirror: false
    },
    ur: {
      /* Exact image.psd.psd Layers 1–4 */
      l: "psd_UR_Frame_L.webp",
      r: "psd_UR_Frame_R.webp",
      t: "psd_UR_Frame_T.webp",
      b: "psd_UR_Frame_B.webp",
      mirror: false
    }
  };
  var ACQ = CDN + "UI/UI_Common_Icon_Source_Gasha.webp";
  /* Gain = exact PSD layers only (SSR Layer 11 / UR Layer 5) — no extra CSS glow */
  var SUPP_GAIN = {
    ssr: "fx_SUPP_SSR_Gain.webp",
    ur: "fx_SUPP_UR_Gain.webp"
  };
  var SUPP_BASE = {
    ssr: "psd_SSR_Base.webp",
    ur: "psd_UR_Base.webp"
  };

  function artUrl(path) {
    if (!path) return "";
    /* Prefer full bromides over list thumbs (sharp when zoomed) */
    path = String(path)
      .replace(/Trait\/thum\/thum_([^/.]+)\.(webp|png)/i, "portraits/cb_$1.webp")
      .replace(/^\/static\/images\//, "");
    if (/^https?:\/\//i.test(path)) return path;
    return CDN + path;
  }

  /* Result portraits: CDN blip / missing ub_ → thum → soft keep visible */
  window.__gachaPorErr = function (img) {
    if (!img) return;
    var step = Number(img.getAttribute("data-fb") || 0);
    var art = img.getAttribute("data-art") || "";
    if (step === 0 && /unit_portraits\/ub_/i.test(art)) {
      img.setAttribute("data-fb", "1");
      img.src = CDN + art.replace(/unit_portraits\/ub_/i, "Trait/thum/thum_");
      return;
    }
    if (step <= 1) {
      img.setAttribute("data-fb", "2");
      var base = artUrl(art) || img.src;
      img.src = base + (base.indexOf("?") >= 0 ? "&" : "?") + "retry=" + Date.now();
      return;
    }
    img.style.opacity = "0.4";
  };

  function porImgHtml(art, delay, porY, cors) {
    if (!art) return "";
    var src = artUrl(art);
    var y = porY || "14%";
    var attrs = ' class="gc-por" alt="" src="' + src +
      '" data-art="' + String(art).replace(/"/g, "&quot;") + '"' +
      ' style="object-position:50% ' + y + '"' +
      ' onerror="window.__gachaPorErr&&window.__gachaPorErr(this)"';
    if (cors) {
      attrs += ' crossorigin="anonymous" decoding="async"';
    } else {
      attrs += ' decoding="async"' + (delay != null && delay > 120 ? "" : ' fetchpriority="high"');
    }
    return '<div class="gc-por-wrap"><img' + attrs + "></div>";
  }

  /* Ref strip */
  var refHtml = "";
  for (var ri = 1; ri <= 8; ri++) {
    refHtml += '<img alt="ref ' + ri + '" src="' + REFS + "ref_" + ri + '.jpg" onerror="this.remove()">';
  }
  var _refStrip = document.getElementById("refStrip");
  if (_refStrip) _refStrip.innerHTML = refHtml;

  function charThumbHtml(rarity, charArt) {
    if (!charArt) return "";
    return (
      '<div class="gc-pilot"><div class="gc-pilot-inner">' +
        '<img class="gc-pilot-base" alt="" src="' + CHAR_BASE[rarity] + '">' +
        '<div class="gc-pilot-por-wrap"><img class="gc-pilot-por" alt="" src="' + artUrl(charArt) + '" decoding="async" onerror="this.onerror=null;this.src=this.src.replace(/portraits\\/cb_/,\"Trait/thum/thum_\")"></div>' +
        '<img class="gc-pilot-frame" alt="" src="' + CHAR_FRAME[rarity] + '">' +
      "</div></div>"
    );
  }

  function layerCard(opts) {
    var r = opts.rarity;
    var kind = opts.kind === "supp" ? "supp" : "unit";
    var delay = opts.delay != null ? opts.delay : 0;
    var fromPull = !!opts.fromPull;
    var cls = "gc gc--" + r +
      (kind === "supp" ? " gc--supp" : "") +
      (opts.isNew && kind === "unit" ? " gc--new" : "") +
      (fromPull ? " gc--pull-result" : "");
    var fx = "", body = "", hudExtra = "";

    if (kind === "supp") {
      var sf = SUPP_FRAME[r] || SUPP_FRAME.ssr;
      /* PSD order: plate (base+art+frames) then Gain rim, then rarity — no extras */
      fx = chromeImg("gc-fx", SUPP_GAIN[r] || SUPP_GAIN.ssr);
      body =
        '<div class="gc-supp-plate">' +
          chromeImg("gc-base", SUPP_BASE[r] || SUPP_BASE.ssr) +
          (opts.art ? porImgHtml(opts.art, delay, opts.porY, !!opts.export) : "") +
          chromeImg("gc-supp-side gc-supp-side--l", sf.l) +
          chromeImg("gc-supp-side gc-supp-side--r", sf.r) +
          chromeImg("gc-supp-end gc-supp-end--t", sf.t) +
          chromeImg("gc-supp-end gc-supp-end--b", sf.b) +
        "</div>";
      if (fromPull) {
        hudExtra =
          '<span class="gc-supp-label"><img alt="" src="' + CDN + 'UI/UI_Common_Icon_Category_Supporter_Main.webp">' + tt("gs_supp_label") + "</span>";
      }
    } else {
      var base = "", frame = "";
      if (r === "r") {
        base = chromeImg("gc-base", "layer_R_Base.webp");
        frame = chromeImg("gc-frame", "layer_R_Frame.webp");
      } else if (r === "sr") {
        base = chromeImg("gc-base", "layer_SR_Base.webp");
        frame = chromeImg("gc-frame", "layer_SR_Frame.webp");
      } else if (r === "ssr") {
        fx = chromeImg("gc-fx", "fx_unit_SSR_glow.webp");
        /* New Project(2).psd Layer 5 + Layer 6 exact */
        base = chromeImg("gc-base", "psd_unit_base.webp");
        frame = chromeImg("gc-frame", "psd_unit_frame.webp");
      } else {
        fx = chromeImg("gc-fx", "fx_unit_UR_glow.webp");
        base = chromeImg("gc-base", "layer_UR_Base.webp");
        frame = chromeImg("gc-frame", "layer_UR_Frame.webp");
      }
      var por = porImgHtml(opts.art, delay, opts.porY, !!opts.export);
      body = base + por + frame;
    }

    var hud;
    if (kind === "supp") {
      /* PSD: rarity badge only — no type icon */
      hud =
        '<div class="gc-hud">' +
          '<img class="gc-rarity" alt="" src="' + RARITY_ICON[r] + '">' +
        "</div>";
    } else {
      var roleSrc = ROLE[opts.role] || ROLE.Attack;
      hud =
        '<div class="gc-hud">' +
          '<img class="gc-rarity" alt="" src="' + RARITY_ICON[r] + '">' +
          '<img class="gc-role" alt="" src="' + roleSrc + '">' +
          '<img class="gc-acq" alt="" src="' + ACQ + '">' +
          (opts.isNew ? '<span class="gc-new">' + tt("gs_new") + "</span>" : "") +
        "</div>";
    }

    var pilot = opts.isNew && kind === "unit" ? charThumbHtml(r, opts.charArt) : "";
    /* Supporters: plate first, then Gain rim on top (PSD Layer 5 above frames) */
    if (kind === "supp") {
      return '<div class="' + cls + '">' + body + fx + hud + hudExtra + "</div>";
    }
    return '<div class="' + cls + '">' + fx + body + hud + pilot + hudExtra + "</div>";
  }

  function bakeCard(file, label) {
    return (
      '<figure class="gc-slot">' +
        '<div class="gc gc--baked">' + chromeImg("gc-bake", file) + "</div>" +
        "<figcaption>" + label + "</figcaption></figure>"
    );
  }

  (function fillDevGalleries() {
    var ug = document.getElementById("unitGallery");
    var sg = document.getElementById("suppGallery");
    if (ug) {
      ug.innerHTML = [
        bakeCard("assemble_R.webp", "<b>R</b> · Base + Frame"),
        bakeCard("assemble_SR.webp", "<b>SR</b> · Pats + R_Frame (SR tone)"),
        bakeCard("assemble_SSR.webp", "<b>SSR</b> · Effect_U + Base + Frame"),
        bakeCard("assemble_UR.webp", "<b>UR</b> · Pats + Effect_Material")
      ].join("");
    }
    if (sg) {
      sg.innerHTML = [
        bakeCard("assemble_SUPP_SSR.webp", "<b>SSR Supporter</b> · image.psdssr.psd"),
        bakeCard("assemble_SUPP_UR.webp", "<b>UR Supporter</b> · image.psd.psd"),
        '<figure class="gc-slot"><div class="gc gc--baked"><img class="gc-bake" alt="" src="' + LOCAL + 'psd_supporter_SSR_ref.png"></div><figcaption><b>Your SSR PSD</b></figcaption></figure>',
        '<figure class="gc-slot"><div class="gc gc--baked"><img class="gc-bake" alt="" src="' + LOCAL + 'psd_supporter_UR_ref.png"></div><figcaption><b>Your UR PSD</b></figcaption></figure>'
      ].join("");
    }
  })();

  var NORMAL = [
    ["URU", 3], ["URS", 1], ["SSRU", 15], ["SSRS", 3], ["SR", 30], ["R", 48]
  ];
  var TENTH = [
    ["URU", 3], ["URS", 1], ["SSRU", 80], ["SSRS", 16]
  ];
  var POOL = { URU: [], URS: [], SSRU: [], SSRS: [], SR: [], R: [] };
  var poolMeta = { gasha_id: "", source: "pending" };

  function poolBucketOk(pool) {
    if (!pool) return false;
    /* Featured-only banners omit SR/R — those pulls render empty frames. */
    return (pool.SR || []).length > 0 && (pool.R || []).length > 0;
  }

  function primaryPullN() {
    var n = Number(poolMeta && poolMeta.display_pull_n) || 0;
    return n > 0 ? n : 10;
  }

  function isBulkTicketPool() {
    var n = primaryPullN();
    if (!(n >= 20)) return false;
    /* Prefer explicit bulk_mode; also treat large display_pull_n as bulk. */
    return !!(poolMeta && (poolMeta.bulk_mode || n >= 20));
  }

  function shouldHideOnceButton() {
    if (isBulkTicketPool()) return true;
    /* While pool JSON is loading for a banner deep-link, don't flash Use 1 time. */
    return !!(poolMeta && poolMeta.source === "pending" && poolMeta.gasha_id);
  }

  function guaranteeTailN() {
    var t = Number(poolMeta && poolMeta.guarantee_tail);
    if (t > 0) return t;
    return isBulkTicketPool() ? 2 : 1;
  }

  function pullButtonLabel(n) {
    if (n === 1) return tt("gs_pull_once");
    if (n === 10) return tt("gs_pull_ten");
    if (n === 47) return tt("gs_pull_47");
    return (tt("gs_pull_n") || "Use {n} time(s)").replace(/\{n\}/g, String(n));
  }

  function syncBulkResultChrome() {
    var bulk = isBulkTicketPool();
    var root = document.getElementById("gachaSimRoot");
    if (root) root.classList.toggle("is-bulk-ticket", !!bulk);
    var pityAfter = document.querySelector(".results-meta .pity-line");
    if (pityAfter) {
      pityAfter.hidden = !!bulk;
      pityAfter.setAttribute("aria-hidden", bulk ? "true" : "false");
      pityAfter.style.display = bulk ? "none" : "";
    }
    var sessSave = document.getElementById("sessSave");
    if (sessSave) {
      sessSave.title = bulk
        ? tt("gs_save_pull_title")
        : tt("gs_save_session_title");
    }
  }

  function clearStuckExportChrome() {
    try {
      document.querySelectorAll(".gacha-export-live-foot").forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    } catch (e0) {}
    var actions = document.querySelector("#stage .results-actions");
    if (actions) actions.style.display = "";
    var resultsFoot = document.querySelector("#stage .results-foot");
    if (resultsFoot) resultsFoot.style.display = "";
    var skipBtn = document.querySelector("#stage .skip");
    if (skipBtn) skipBtn.style.display = "";
    var results = document.querySelector("#stage .results");
    if (results) results.classList.remove("gacha-export-capturing");
  }

  function syncPullButtons() {
    var one = document.getElementById("one");
    var ten = document.getElementById("ten");
    var again = document.getElementById("again");
    var bulk = isBulkTicketPool();
    var hideOne = shouldHideOnceButton();
    var spent = bulk && !!sim.bulkSpent;
    var n = primaryPullN();
    if (one) {
      one.hidden = !!hideOne;
      one.setAttribute("aria-hidden", hideOne ? "true" : "false");
      one.style.display = hideOne ? "none" : "";
      if (!hideOne) one.innerHTML = "<small>" + pullButtonLabel(1) + "</small>";
    }
    if (ten) {
      ten.hidden = false;
      ten.setAttribute("aria-hidden", "false");
      ten.style.display = "";
      ten.classList.toggle("pull--bulk", !!bulk);
      ten.classList.toggle("pull--spent", !!spent);
      ten.disabled = !!spent;
      ten.innerHTML = "<small>" + pullButtonLabel(bulk ? n : 10) + "</small>";
      ten.title = spent ? tt("gs_pull_limit_spent") : "";
    }
    if (again) {
      again.disabled = !!spent;
      again.classList.toggle("is-spent", !!spent);
      again.title = spent ? tt("gs_pull_limit_spent") : "";
    }
    try { syncBulkResultChrome(); } catch (eB) {}
  }

  function applyPoolData(data, source) {
    if (!data || !data.pool || !poolBucketOk(data.pool)) return false;
    POOL = data.pool;
    if (data.normal && data.normal.length) NORMAL = data.normal;
    if (data.tenth && data.tenth.length) TENTH = data.tenth;
    var logo = data.logo_resource_id || "";
    if (!logo && data.gasha_id) logo = "gasha_logo_" + data.gasha_id;
    poolMeta = {
      gasha_id: data.gasha_id || "",
      name: data.name || "",
      source: source || "json",
      lang: uiLang(),
      logo: logo || "",
      gasha_movie_setting_id: data.gasha_movie_setting_id || "",
      gasha_movie_setting: data.gasha_movie_setting || null,
      once_roll_count: Number(data.once_roll_count) || 0,
      fake_once_roll_count: Number(data.fake_once_roll_count) || 0,
      display_pull_n: Number(data.display_pull_n) || 0,
      required_tickets: Number(data.required_tickets) || 0,
      guarantee_tail: Number(data.guarantee_tail) || 0,
      bulk_mode: !!data.bulk_mode
    };
    try { syncPullButtons(); } catch (e0) {}
    var logoEl = document.getElementById("bannerLogo");
    if (logoEl) {
      if (logo) {
        logoEl.src = CDN + "Gasha/" + logo + "_" + logoLangSuffix() + ".webp";
        logoEl.onerror = function () {
          this.onerror = null;
          this.src = CDN + "Gasha/" + logo + "_en.webp";
        };
        logoEl.hidden = false;
      } else {
        logoEl.removeAttribute("src");
        logoEl.hidden = true;
      }
    }
    renderLiveGallery();
    if (typeof rematchPorYInDom === "function") {
      var stageEl = document.getElementById("stage");
      if (stageEl) rematchPorYInDom(stageEl);
    }
    if (typeof renderSession === "function") renderSession();
    return true;
  }

  function renderLiveGallery() {
    var demos = [];
    function first(bucket, rarity, kind) {
      var list = POOL[bucket] || [];
      var it = list.find(function (x) { return x.pickup; }) || list[0];
      if (!it) return;
      demos.push({
        rarity: rarity,
        kind: kind || "unit",
        art: it.art,
        role: it.role || "",
        label: (kind === "supp" ? "Supp " : "") + rarity.toUpperCase() + " · " + (it.name || it.id),
        isNew: false
      });
    }
    first("R", "r");
    first("SR", "sr");
    first("SSRU", "ssr");
    first("URU", "ur");
    first("SSRS", "ssr", "supp");
    first("URS", "ur", "supp");
    var lg = document.getElementById("liveGallery");
    if (!lg) return;
    lg.innerHTML = demos.map(function (o) {
      return '<figure class="gc-slot">' + layerCard(o) + "<figcaption><b>" + o.label + "</b></figcaption></figure>";
    }).join("");
  }

  function applyDemoPool() {
    /* Last resort only — keeps SR/R frames filled if published JSON is unreachable. */
    POOL = {
      URU: [{ name: "Gundam Avalanche Astrea Type F Dash", id: "1080000150", role: "Attack", art: "unit_portraits/ub_g0800u00150.webp", charArt: "Trait/thum/thum_g0800c00101.webp", pickup: true, w: 3 }],
      URS: [{ name: "Bright Noa & White Base", role: "", art: "Supporters/sb_g0310s00200.webp", pickup: true, w: 1 }],
      SSRU: [{ name: "Jinx III (Federation)", role: "Durability", art: "unit_portraits/ub_g0600u00350.webp", charArt: "Trait/thum/thum_g0600c01500.webp", pickup: true, w: 2 }],
      SSRS: [{ name: "Kati Mannequin & Virginia", role: "", art: "Supporters/sb_g0600s00100.webp", w: 2 }],
      SR: [{ name: "Char's Zaku II", role: "Durability", art: "unit_portraits/ub_g0010u00100.webp", w: 1 }],
      R: [{ name: "GM", role: "Attack", art: "unit_portraits/ub_g0010u00300.webp", w: 1 }]
    };
    poolMeta = { gasha_id: "", source: "demo", bulk_mode: false, display_pull_n: 0 };
    try { syncPullButtons(); } catch (e1) {}
    renderLiveGallery();
    if (typeof renderSession === "function") renderSession();
  }

  /* Published pool (full SR/R). Prefer API by gasha_id; static copy is default-banner fallback. */
  function loadPublishedPool(gashaId) {
    var gid = String(gashaId || resolveGashaId() || "").trim();
    var lang = uiLang();
    poolMeta = {
      gasha_id: gid,
      name: (poolMeta && poolMeta.name) || "",
      source: "pending",
      lang: lang,
      logo: poolMeta.logo || "",
      bulk_mode: !!(poolMeta && poolMeta.bulk_mode),
      display_pull_n: Number(poolMeta && poolMeta.display_pull_n) || 0,
      gasha_movie_setting_id: (poolMeta && poolMeta.gasha_movie_setting_id) || "",
      gasha_movie_setting: (poolMeta && poolMeta.gasha_movie_setting) || null
    };
    try { syncPullButtons(); } catch (eP) {}
    var langQ = "&lang=" + encodeURIComponent(lang);
    var urls = [];
    if (gid) urls.push("/api/gacha_sim/pool?gasha_id=" + encodeURIComponent(gid) + langQ);
    urls.push("/api/gacha_sim/pool?lang=" + encodeURIComponent(lang));
    urls.push("/static/gacha_sim/pool.json");
    function tryAt(i) {
      if (i >= urls.length) {
        applyDemoPool();
        return;
      }
      fetch(urls[i], { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) return Promise.reject(new Error("pool_http_" + r.status));
          return r.json();
        })
        .then(function (d) {
          if (gid && d && d.gasha_id && String(d.gasha_id) !== gid && i === 0) {
            tryAt(i + 1);
            return;
          }
          if (!applyPoolData(d, i === 0 ? "master+official rates" : "static pool")) tryAt(i + 1);
        })
        .catch(function () { tryAt(i + 1); });
    }
    tryAt(0);
  }
  loadPublishedPool(resolveGashaId());

  var skip = false;
  var timer = 0;
  var runId = 0;
  var lastN = 10;
  var lastRows = [];
  function simStorageKey() {
    var gid = resolveGashaId() || (poolMeta && poolMeta.gasha_id) || "";
    return gid ? "ggen_gacha_sim_v1_" + gid : "ggen_gacha_sim_v1";
  }
  var COL_KEY = "ggen_collections_v1";
  var HIST_CAP = 120;   /* multi-pull batches kept */
  var DRAW_CAP = 2500;  /* individual cards kept (full name log) */

  function emptySim() {
    return {
      pulls: 0,
      pts: 0,
      history: [],
      draws: [],
      firstPickupAt: {},
      simOwned: {},
      tierCounts: { ur: 0, ssr: 0, sr: 0, r: 0 },
      bulkSpent: false
    };
  }

  function normalizeCard(c, atFallback) {
    if (!c || typeof c !== "object") return null;
    return {
      at: Number(c.at) || Number(atFallback) || 0,
      id: String(c.id || ""),
      name: String(c.name || c.id || "?"),
      rarity: String(c.rarity || "").toLowerCase(),
      kind: c.kind === "supp" ? "supp" : "unit",
      art: String(c.art || ""),
      role: String(c.role || ""),
      charArt: String(c.charArt || ""),
      bromide_height: c.bromide_height != null ? c.bromide_height : c.bromideHeight,
      porY: resolvePorY(c),
      pickup: !!c.pickup,
      isNew: !!c.isNew
    };
  }

  function loadSim() {
    try {
      var o = JSON.parse(localStorage.getItem(simStorageKey()) || "{}");
      var history = Array.isArray(o.history) ? o.history.slice(0, HIST_CAP) : [];
      var draws = [];
      if (Array.isArray(o.draws)) {
        draws = o.draws.map(function (c) { return normalizeCard(c); }).filter(Boolean).slice(0, DRAW_CAP);
      } else {
        history.forEach(function (h) {
          if (!h || !Array.isArray(h.cards)) return;
          h.cards.forEach(function (c) {
            var n = normalizeCard(c, h.at);
            if (n) draws.push(n);
          });
        });
      }
      return {
        pulls: Number(o.pulls) || 0,
        pts: Number(o.pts) || 0,
        history: history,
        draws: draws,
        firstPickupAt: o.firstPickupAt && typeof o.firstPickupAt === "object" ? o.firstPickupAt : {},
        simOwned: o.simOwned && typeof o.simOwned === "object" ? o.simOwned : {},
        tierCounts: o.tierCounts && typeof o.tierCounts === "object"
          ? {
              ur: Number(o.tierCounts.ur) || 0,
              ssr: Number(o.tierCounts.ssr) || 0,
              sr: Number(o.tierCounts.sr) || 0,
              r: Number(o.tierCounts.r) || 0
            }
          : { ur: 0, ssr: 0, sr: 0, r: 0 },
        bulkSpent: !!o.bulkSpent
      };
    } catch (e) {
      return emptySim();
    }
  }
  var sim = loadSim();
  /* Anniversary 47-ticket pools: recover once-only lock from prior multi history. */
  (function recoverBulkSpent() {
    if (sim.bulkSpent) return;
    var hist = sim.history || [];
    for (var i = 0; i < hist.length; i++) {
      if (hist[i] && Number(hist[i].n) >= 20) {
        sim.bulkSpent = true;
        return;
      }
    }
  })();
  /* Reconcile owned set from every prior draw (not only cards that once got New). */
  (function rebuildOwnedFromDraws() {
    var owned = {};
    (sim.draws || []).forEach(function (c) {
      if (c && c.id) owned[String(c.id)] = true;
    });
    Object.keys(sim.simOwned || {}).forEach(function (id) { owned[id] = true; });
    sim.simOwned = owned;
  })();
  var pts = Number(sim.pts) || 0;

  function saveSim() {
    try {
      sim.pts = pts;
      localStorage.setItem(simStorageKey(), JSON.stringify({
        pulls: sim.pulls,
        pts: pts,
        history: sim.history.slice(0, HIST_CAP),
        draws: (sim.draws || []).slice(0, DRAW_CAP),
        firstPickupAt: sim.firstPickupAt,
        simOwned: sim.simOwned,
        tierCounts: sim.tierCounts,
        bulkSpent: !!sim.bulkSpent
      }));
    } catch (e) {}
  }

  function syncPtsUi() {
    document.getElementById("pts").textContent = String(pts);
    document.getElementById("ptsAfter").textContent = String(pts);
  }
  syncPtsUi();

  function useCollectionsOwned() {
    var el = document.getElementById("optCollections");
    return !el || el.checked;
  }

  function skipAnimPreferred() {
    var el = document.getElementById("optSkipAnim");
    return !!(el && el.checked);
  }

  var OPTS_KEY = "ggen_gacha_sim_opts_v2";
  function loadOpts() {
    try {
      return JSON.parse(localStorage.getItem(OPTS_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function saveOpts() {
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify({
        collections: useCollectionsOwned(),
        skipAnim: skipAnimPreferred()
      }));
    } catch (e) {}
  }
  (function restoreOpts() {
    var o = loadOpts();
    var c = document.getElementById("optCollections");
    var s = document.getElementById("optSkipAnim");
    if (c && typeof o.collections === "boolean") c.checked = o.collections;
    if (s && typeof o.skipAnim === "boolean") s.checked = o.skipAnim;
  })();

  function dbOrigin() {
    if (location.protocol === "http:" || location.protocol === "https:") {
      return location.origin;
    }
    return "https://ggendb.up.railway.app";
  }
  function detailUrl(kind, id) {
    if (!id) return "";
    var path = (kind === "supp" || kind === "supporter" ? "/s/" : "/u/") + encodeURIComponent(String(id));
    return dbOrigin() + path;
  }
  function openDbDetail(kind, id) {
    if (!id) return;
    var type = (kind === "supp" || kind === "supporter") ? "supporter" : "unit";
    /* Stay on /gacha-sim — open site detail modal (same UX as /u / /s) */
    if (typeof window.openDetail === "function") {
      window.openDetail(type, String(id), { skipHistory: true });
      return;
    }
    var url = detailUrl(kind, id);
    if (url) location.assign(url);
  }

  function collectionsUnitOwned(uid) {
    if (!uid) return false;
    try {
      var o = JSON.parse(localStorage.getItem(COL_KEY) || "{}");
      var u = (o.units || {})[uid];
      return u != null && u !== false && u !== "" && Number(u) !== -1;
    } catch (e) {
      return false;
    }
  }

  function isAlreadyOwned(uid) {
    if (!uid) return false;
    if (sim.simOwned[uid]) return true;
    if (useCollectionsOwned() && collectionsUnitOwned(uid)) return true;
    return false;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCardChip(c, idx) {
    var rar = (c.rarity || "").toLowerCase();
    var cls = rar === "ur" ? "hit-ur" : rar === "ssr" ? "hit-ssr" : rar === "sr" ? "hit-sr" : "hit-r";
    var localized = resolvePoolName(c.id) || c.name || c.id || rar.toUpperCase();
    var name = rar === "ur" || rar === "ssr" ? localized : rar.toUpperCase();
    var kindCls = c.kind === "supp" ? " hit-supp" : "";
    if (rar === "ur" || rar === "ssr") {
      return '<span class="hit-chip ' + cls + kindCls + '" data-draw-at="' + (c.at || "") +
        '" data-draw-id="' + esc(c.id) + '">' + esc(name) + "</span>";
    }
    return '<span class="' + cls + kindCls + '">' + esc(name) + "</span>";
  }

  function highRarityHits() {
    return (sim.draws || []).filter(function (c) {
      return c.rarity === "ur" || c.rarity === "ssr";
    });
  }

  function lookupDrawCard(at, id) {
    var list = sim.draws || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (String(c.at) === String(at) && (!id || String(c.id) === String(id))) return c;
    }
    for (var j = 0; j < list.length; j++) {
      if (String(list[j].id) === String(id) && (list[j].rarity === "ur" || list[j].rarity === "ssr")) {
        return list[j];
      }
    }
    return null;
  }

  function enrichArtFromPool(card) {
    if (!card) return card;
    var needArt = !card.art;
    var needChar = !card.charArt;
    var needPor = !card.porY && card.bromide_height == null;
    if (!needArt && !needChar && !needPor && card.porY) {
      /* Still refresh porY from height map when pool is ready */
      var hit = findPoolItemById(card.id);
      if (hit) {
        if (hit.bromide_height != null) card.bromide_height = hit.bromide_height;
        card.porY = porYFromItem(hit);
        if (!card.charArt && hit.charArt) card.charArt = hit.charArt;
        if (!card.role && hit.role) card.role = hit.role;
      }
      return card;
    }
    var buckets = card.kind === "supp" ? ["URS", "SSRS"] : ["URU", "SSRU", "SR", "R"];
    for (var bi = 0; bi < buckets.length; bi++) {
      var list = POOL[buckets[bi]] || [];
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(card.id)) {
          card.art = card.art || list[i].art || "";
          card.role = card.role || list[i].role || "";
          card.charArt = card.charArt || list[i].charArt || "";
          if (list[i].name) card.name = list[i].name;
          if (list[i].bromide_height != null) card.bromide_height = list[i].bromide_height;
          card.porY = porYFromItem(list[i]);
          return card;
        }
      }
    }
    return card;
  }

  var hoverPop = document.getElementById("cardHoverPop");
  var _cardHoverEl = null;
  var _urAcqAnchor = null;

  /* Phones / tablets: hover previews become tap-to-reveal (tap again / outside dismiss). */
  function gsPreferTapReveal() {
    try {
      if (typeof window.matchMedia !== "function") return false;
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return false;
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.matchMedia("(hover: none)").matches) return true;
    } catch (_) {}
    return false;
  }

  function hideCardHover() {
    if (!hoverPop) return;
    hoverPop.hidden = true;
    hoverPop.setAttribute("aria-hidden", "true");
    hoverPop.innerHTML = "";
    _cardHoverEl = null;
  }
  function showCardHover(card, clientX, clientY, anchorEl) {
    if (!hoverPop || !card) return;
    hideUrAcqPop();
    card = enrichArtFromPool(card);
    if (!card.art && !card.name) return;
    hoverPop.innerHTML = layerCard({
      rarity: card.rarity,
      kind: card.kind,
      art: card.art,
      role: card.role,
      charArt: card.charArt,
      porY: resolvePorY(card),
      isNew: !!card.isNew,
      fromPull: false,
      delay: 0
    });
    hoverPop.hidden = false;
    hoverPop.setAttribute("aria-hidden", "false");
    _cardHoverEl = anchorEl || null;
    var pad = 16;
    var w = 280;
    var h = 160;
    var x = Math.min(window.innerWidth - w / 2 - pad, Math.max(w / 2 + pad, clientX));
    var y = Math.max(h + pad, clientY - 8);
    hoverPop.style.left = x + "px";
    hoverPop.style.top = y + "px";
  }

  function bindHitHover(root) {
    if (!root) return;
    root.querySelectorAll("[data-draw-at]").forEach(function (el) {
      if (el._gsHitBound) return;
      el._gsHitBound = 1;
      el.addEventListener("mouseenter", function (ev) {
        if (gsPreferTapReveal()) return;
        var card = lookupDrawCard(el.getAttribute("data-draw-at"), el.getAttribute("data-draw-id"));
        showCardHover(card, ev.clientX, ev.clientY, el);
      });
      el.addEventListener("mousemove", function (ev) {
        if (gsPreferTapReveal()) return;
        if (hoverPop && !hoverPop.hidden) {
          var pad = 16;
          var w = 280;
          var x = Math.min(window.innerWidth - w / 2 - pad, Math.max(w / 2 + pad, ev.clientX));
          var y = Math.max(170, ev.clientY - 8);
          hoverPop.style.left = x + "px";
          hoverPop.style.top = y + "px";
        }
      });
      el.addEventListener("mouseleave", function () {
        if (gsPreferTapReveal()) return;
        hideCardHover();
      });
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        var card = lookupDrawCard(el.getAttribute("data-draw-at"), el.getAttribute("data-draw-id"));
        if (gsPreferTapReveal()) {
          ev.stopPropagation();
          /* First tap = preview; second tap on same row = open DB detail */
          if (_cardHoverEl === el && hoverPop && !hoverPop.hidden) {
            hideCardHover();
            if (card && card.id) openDbDetail(card.kind, card.id);
            return;
          }
          var r = el.getBoundingClientRect();
          showCardHover(card, r.left + r.width / 2, Math.max(r.top, 24), el);
          return;
        }
        hideCardHover();
        if (card && card.id) openDbDetail(card.kind, card.id);
      });
    });
  }

  function countTiersByKind() {
    var unit = { ur: 0, ssr: 0, sr: 0, r: 0 };
    var supp = { ur: 0, ssr: 0, sr: 0, r: 0 };
    (sim.draws || []).forEach(function (c) {
      if (!c) return;
      var bag = c.kind === "supp" ? supp : unit;
      var k = c.rarity === "ur" ? "ur" : c.rarity === "ssr" ? "ssr" : c.rarity === "sr" ? "sr" : "r";
      bag[k] = (bag[k] || 0) + 1;
    });
    return { unit: unit, supp: supp };
  }

  var GS_X_LOGO_SVG =
    '<svg class="gs-x-logo" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>' +
    "</svg>";
  var GS_SHARE_HASHTAGS_BASE = "#ジージェネエターナル #GGETユニット組立シミュレーター";

  /** Pool-specific share tags — e.g. 47-ticket anniversary → #47連 (not only 2609400505). */
  function shareHashtags() {
    var tags = GS_SHARE_HASHTAGS_BASE;
    var n = 0;
    try {
      n = Number(poolMeta && poolMeta.display_pull_n) || 0;
    } catch (e) {}
    if (!(n > 0)) {
      try {
        if (isBulkTicketPool()) n = primaryPullN() || 0;
      } catch (e2) {}
    }
    /* Bulk / multi-ticket assemblies (20+): add #{n}連 */
    if (n >= 20) {
      var multi = "#" + n + "連";
      if (tags.indexOf(multi) < 0) tags += " " + multi;
    }
    return tags;
  }

  function fmtSharePct(n, total) {
    if (!(total > 0)) return "—";
    return ((n / total) * 100).toFixed(1) + "%";
  }

  /** Aggregate UR names (×N for dupes), ordered by count then name. */
  function aggregateUrNames(cards, kind) {
    var map = {};
    (cards || []).forEach(function (c) {
      if (!c || c.rarity !== "ur") return;
      var isSupp = c.kind === "supp";
      if (kind === "unit" && isSupp) return;
      if (kind === "supp" && !isSupp) return;
      var id = String(c.id || "").trim();
      var name = resolvePoolName(id) || String(c.name || "").trim() || id || "?";
      var key = id || ("name:" + name);
      if (!map[key]) map[key] = { name: name, count: 0 };
      map[key].count += 1;
      if (name && map[key].name === "?") map[key].name = name;
    });
    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.name).localeCompare(String(b.name));
      });
  }

  function formatUrNameList(rows, maxNames) {
    maxNames = maxNames == null ? 12 : maxNames;
    if (!rows || !rows.length) return tt("gs_share_none") || "—";
    var shown = rows.slice(0, maxNames).map(function (r) {
      return r.count > 1 ? (r.name + " ×" + r.count) : r.name;
    });
    var extra = rows.length - shown.length;
    var s = shown.join(" · ");
    if (extra > 0) s += " · +" + extra;
    return s;
  }

  function urShareStatsFromCards(cards) {
    var list = Array.isArray(cards) ? cards : [];
    var unitUr = 0;
    var suppUr = 0;
    var total = 0;
    var hasSuppKind = false;
    list.forEach(function (c) {
      if (!c) return;
      total += 1;
      if (c.kind === "supp") hasSuppKind = true;
      if (c.rarity === "ur") {
        if (c.kind === "supp") suppUr += 1;
        else unitUr += 1;
      }
    });
    var totalUr = unitUr + suppUr;
    return {
      total: total,
      totalUr: totalUr,
      unitUr: unitUr,
      suppUr: suppUr,
      hasSupp: hasSuppKind || suppUr > 0,
      totalUrPct: fmtSharePct(totalUr, total),
      unitUrPct: fmtSharePct(unitUr, total),
      suppUrPct: fmtSharePct(suppUr, total),
      unitNames: aggregateUrNames(list, "unit"),
      suppNames: aggregateUrNames(list, "supp")
    };
  }

  function resolveShareBannerName() {
    var raw = "";
    try {
      if (poolMeta && poolMeta.name) raw = String(poolMeta.name || "").trim();
    } catch (e0) {}
    if (!raw) {
      try {
        var gid = resolveGashaId() || (poolMeta && poolMeta.gasha_id) || "";
        var bans = (window.S && S.btCacheData && S.btCacheData.banners) || [];
        for (var i = 0; i < bans.length; i++) {
          if (String(bans[i].gasha_id) === String(gid) && bans[i].name) {
            raw = String(bans[i].name || "").trim();
            break;
          }
        }
      } catch (e1) {}
    }
    if (!raw) return "";
    /* Short share label: drop parentheticals + trailing "Unit Assembly" / locale equivalents. */
    var s = raw.replace(/\s*\([^)]*\)/g, "").trim();
    s = s.replace(/\bAnniv\.?/gi, "Anniversary");
    s = s.replace(/\s+(Unit Assembly|ユニット組立|機體補給).*$/i, "").trim();
    s = s.replace(/\s+/g, " ").replace(/[.\s]+$/g, "").trim();
    return s || raw;
  }

  function buildGachaShareText(scope) {
    var cards = scope === "result"
      ? (lastRows && lastRows.length ? lastRows : [])
      : (sim.draws || []);
    var st = urShareStatsFromCards(cards);
    if (!(st.total > 0)) return "";
    var url = exportPageUrl();
    var head = scope === "result"
      ? (tt("gs_share_head_result") || "GGET Unit Assembly — this pull")
      : (tt("gs_share_head_session") || "GGET Unit Assembly — session");
    var rateLine;
    if (st.hasSupp) {
      rateLine = (tt("gs_share_rate_split") ||
        "Total UR {total_pct}% ({ur}/{n}) · Units {unit_pct}% · Supporters {supp_pct}%")
        .replace(/\{total_pct\}/g, st.totalUrPct)
        .replace(/\{ur\}/g, String(st.totalUr))
        .replace(/\{n\}/g, String(st.total))
        .replace(/\{unit_pct\}/g, st.unitUrPct)
        .replace(/\{supp_pct\}/g, st.suppUrPct);
    } else {
      rateLine = (tt("gs_share_rate") || "Total UR {total_pct}% ({ur}/{n})")
        .replace(/\{total_pct\}/g, st.totalUrPct)
        .replace(/\{ur\}/g, String(st.totalUr))
        .replace(/\{n\}/g, String(st.total));
    }
    var banner = resolveShareBannerName();
    var pullsLine = "";
    if (scope === "session" && sim.pulls > 0) {
      if (banner) {
        pullsLine = (tt("gs_share_pulls_named") || "{banner} {n} pulls")
          .replace(/\{banner\}/g, banner)
          .replace(/\{n\}/g, String(sim.pulls));
      } else {
        pullsLine = (tt("gs_share_pulls") || "{n} pulls").replace(/\{n\}/g, String(sim.pulls));
      }
    } else if (scope === "result" && st.total > 0) {
      if (banner) {
        pullsLine = (tt("gs_share_pull_size_named") || "{banner} {n}-pull")
          .replace(/\{banner\}/g, banner)
          .replace(/\{n\}/g, String(st.total));
      } else {
        pullsLine = (tt("gs_share_pull_size") || "{n}-pull").replace(/\{n\}/g, String(st.total));
      }
    }
    /* Names omitted — X compose runs out of space once rates + hashtags + quote URL are in. */
    var lines = [head, rateLine];
    if (pullsLine) lines.push(pullsLine);
    lines.push("");
    lines.push(shareHashtags());
    lines.push(url);
    return lines.join("\n");
  }

  function syncShareXButtons() {
    var sessBtn = document.getElementById("sessShareX");
    if (sessBtn) sessBtn.disabled = !(sim.draws && sim.draws.length);
    var resBtn = document.getElementById("resultShareX");
    if (resBtn) resBtn.disabled = !(lastRows && lastRows.length);
  }

  function applyShareXBtnLabels() {
    var sess = document.getElementById("sessShareX");
    if (sess) {
      sess.innerHTML = "<small>" + tt("gs_share") + "</small><b><span class=\"gs-share-to-pair\">" +
        tt("gs_share_to_x_short") + GS_X_LOGO_SVG + "</span></b>";
      sess.title = tt("gs_share_session_title") || "Share session UR rates on X";
      sess.setAttribute("aria-label", tt("gs_share_session_aria") || "Share session to X");
    }
    var res = document.getElementById("resultShareX");
    if (res) {
      res.innerHTML = (tt("gs_share_to_x") || "Share to {x}").split("{x}").join(GS_X_LOGO_SVG);
      res.title = tt("gs_share_result_title") || "Share this pull’s UR rates on X";
      res.setAttribute("aria-label", tt("gs_share_result_aria") || "Share this pull to X");
    }
  }

  function shareGachaOnX(scope) {
    var text = buildGachaShareText(scope);
    if (!text) return;
    /* `url` = status link → X compose opens as a Quote of that post; pool link stays in text. */
    var intent = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) +
      "&url=" + encodeURIComponent(GS_SHARE_QUOTE_TWEET_URL);
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  /* Aggregate UR draws by id — duplicates become x2 / x3… */
  function aggregateUrAcquisitions(kind) {
    var map = {};
    (sim.draws || []).forEach(function (c) {
      if (!c || c.rarity !== "ur") return;
      var isSupp = c.kind === "supp";
      if (kind === "unit" && isSupp) return;
      if (kind === "supp" && !isSupp) return;
      var id = String(c.id || "").trim();
      var name = String(c.name || "").trim() || (id ? resolvePoolName(id) : "") || id || "?";
      var key = id || ("name:" + name);
      if (!map[key]) {
        map[key] = { id: id, name: name, count: 0, kind: isSupp ? "supp" : "unit" };
      }
      map[key].count += 1;
      if (!map[key].name && name) map[key].name = name;
    });
    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.name).localeCompare(String(b.name));
      });
  }

  var urAcqPop = document.getElementById("urAcqPop");
  var _urAcqHideTimer = null;
  function setUrAcqExpanded(on) {
    document.querySelectorAll("[data-ur-acq]").forEach(function (el) {
      var open = !!(on && _urAcqAnchor === el);
      el.classList.toggle("is-ur-acq-open", open);
      el.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  function hideUrAcqPop() {
    if (_urAcqHideTimer) {
      clearTimeout(_urAcqHideTimer);
      _urAcqHideTimer = null;
    }
    _urAcqAnchor = null;
    setUrAcqExpanded(false);
    if (!urAcqPop) return;
    urAcqPop.hidden = true;
    urAcqPop.setAttribute("aria-hidden", "true");
    urAcqPop.innerHTML = "";
  }
  function positionUrAcqPop(anchorEl) {
    if (!urAcqPop || !anchorEl) return;
    var rect = anchorEl.getBoundingClientRect();
    var pad = 10;
    var w = urAcqPop.offsetWidth || 220;
    var h = urAcqPop.offsetHeight || 120;
    var x = rect.left + rect.width / 2;
    x = Math.min(window.innerWidth - w / 2 - pad, Math.max(w / 2 + pad, x));
    var y = rect.top - 8;
    if (y - h < pad) {
      /* Flip below if not enough room above */
      urAcqPop.style.transform = "translate(-50%, 0)";
      urAcqPop.style.marginTop = "8px";
      y = rect.bottom;
    } else {
      urAcqPop.style.transform = "translate(-50%, -100%)";
      urAcqPop.style.marginTop = "-10px";
    }
    urAcqPop.style.left = x + "px";
    urAcqPop.style.top = y + "px";
  }
  function showUrAcqPop(kind, anchorEl) {
    if (!urAcqPop || !anchorEl) return;
    hideCardHover();
    if (_urAcqHideTimer) {
      clearTimeout(_urAcqHideTimer);
      _urAcqHideTimer = null;
    }
    var rows = aggregateUrAcquisitions(kind);
    var titleKey = kind === "supp" ? "gs_ur_acq_supp" : "gs_ur_acq_units";
    var total = 0;
    rows.forEach(function (r) { total += r.count; });
    var head = tt(titleKey) + (total ? " (" + total + ")" : "");
    var body;
    if (!rows.length) {
      body = '<div class="ur-acq-empty">' + esc(tt("gs_ur_acq_empty")) + "</div>";
    } else {
      body = "<ul>" + rows.map(function (r) {
        var mul = r.count > 1
          ? '<span class="ur-acq-mul">x' + r.count + "</span>"
          : "";
        return '<li data-ur-id="' + esc(r.id) + '" data-ur-kind="' + esc(r.kind) + '">' +
          '<span class="ur-acq-name">' + esc(r.name) + "</span>" + mul +
          "</li>";
      }).join("") + "</ul>";
    }
    urAcqPop.innerHTML = "<strong>" + esc(head) + "</strong>" + body;
    urAcqPop.hidden = false;
    urAcqPop.setAttribute("aria-hidden", "false");
    _urAcqAnchor = anchorEl;
    setUrAcqExpanded(true);
    positionUrAcqPop(anchorEl);
  }
  function bindUrAcqHover() {
    var root = document.getElementById("sessStats");
    if (!root || root._urAcqBound) return;
    root._urAcqBound = 1;
    root.addEventListener("mouseover", function (ev) {
      if (gsPreferTapReveal()) return;
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-ur-acq]") : null;
      if (!el || !root.contains(el)) return;
      if (ev.relatedTarget && el.contains(ev.relatedTarget)) return;
      showUrAcqPop(el.getAttribute("data-ur-acq") || "unit", el);
    });
    root.addEventListener("mouseout", function (ev) {
      if (gsPreferTapReveal()) return;
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-ur-acq]") : null;
      if (!el || !root.contains(el)) return;
      var to = ev.relatedTarget;
      if (to && (el.contains(to) || (urAcqPop && urAcqPop.contains(to)))) return;
      _urAcqHideTimer = setTimeout(function () {
        if (urAcqPop && urAcqPop.matches(":hover")) return;
        hideUrAcqPop();
      }, 120);
    });
    root.addEventListener("focusin", function (ev) {
      if (gsPreferTapReveal()) return;
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-ur-acq]") : null;
      if (!el || !root.contains(el)) return;
      showUrAcqPop(el.getAttribute("data-ur-acq") || "unit", el);
    });
    root.addEventListener("focusout", function (ev) {
      if (gsPreferTapReveal()) return;
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-ur-acq]") : null;
      if (!el) return;
      var to = ev.relatedTarget;
      if (to && (el.contains(to) || (urAcqPop && urAcqPop.contains(to)))) return;
      hideUrAcqPop();
    });
    /* Mobile / coarse pointer: tap toggles the acquired-UR list */
    root.addEventListener("click", function (ev) {
      if (!gsPreferTapReveal()) return;
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-ur-acq]") : null;
      if (!el || !root.contains(el)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var kind = el.getAttribute("data-ur-acq") || "unit";
      if (_urAcqAnchor === el && urAcqPop && !urAcqPop.hidden) {
        hideUrAcqPop();
        return;
      }
      showUrAcqPop(kind, el);
    });
    if (urAcqPop && !urAcqPop._bound) {
      urAcqPop._bound = 1;
      urAcqPop.addEventListener("mouseenter", function () {
        if (_urAcqHideTimer) {
          clearTimeout(_urAcqHideTimer);
          _urAcqHideTimer = null;
        }
      });
      urAcqPop.addEventListener("mouseleave", function () {
        if (gsPreferTapReveal()) return;
        hideUrAcqPop();
      });
      urAcqPop.addEventListener("click", function (ev) {
        var li = ev.target && ev.target.closest ? ev.target.closest("li[data-ur-id]") : null;
        if (!li) return;
        var id = li.getAttribute("data-ur-id");
        var kind = li.getAttribute("data-ur-kind") || "unit";
        if (id) {
          hideUrAcqPop();
          openDbDetail(kind, id);
        }
      });
    }
  }

  /* Tap outside closes sticky mobile previews */
  if (!window._ggenGsTapDismiss) {
    window._ggenGsTapDismiss = 1;
    document.addEventListener(
      "pointerdown",
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        if (hoverPop && !hoverPop.hidden) {
          if (t.closest("#cardHoverPop") || t.closest("[data-draw-at]")) return;
          hideCardHover();
        }
        if (urAcqPop && !urAcqPop.hidden) {
          if (t.closest("#urAcqPop") || t.closest("[data-ur-acq]")) return;
          hideUrAcqPop();
        }
      },
      true
    );
  }

  function resolvePoolName(id) {
    var sid = String(id || "");
    if (!sid) return "";
    var buckets = ["URU", "URS", "SSRU", "SSRS", "SR", "R"];
    for (var i = 0; i < buckets.length; i++) {
      var list = POOL[buckets[i]] || [];
      for (var j = 0; j < list.length; j++) {
        if (String(list[j].id) === sid) return list[j].name || "";
      }
    }
    var draws = sim.draws || [];
    for (var d = 0; d < draws.length; d++) {
      if (draws[d] && String(draws[d].id) === sid && draws[d].name) return draws[d].name;
    }
    return "";
  }

  function renderSession() {
    document.getElementById("sessPulls").textContent = String(sim.pulls);
    var pickKeys = Object.keys(sim.firstPickupAt).sort(function (a, b) {
      return (Number(sim.firstPickupAt[a]) || 0) - (Number(sim.firstPickupAt[b]) || 0);
    });
    var pickupEl = document.getElementById("sessPickup");
    if (!pickKeys.length) {
      pickupEl.textContent = tt("gs_first_pickup_none");
    } else {
      pickupEl.innerHTML = tt("gs_first_pickup_at") + " " + pickKeys.map(function (id) {
        var n = sim.firstPickupAt[id];
        var name = resolvePoolName(id) || id;
        return "<b>" + esc(name) + "</b> @" + n;
      }).join(" · ");
    }
    var bags = countTiersByKind();
    var unitTc = bags.unit;
    var suppTc = bags.supp;
    var unitTotal = unitTc.ur + unitTc.ssr + unitTc.sr + unitTc.r;
    var suppTotal = suppTc.ur + suppTc.ssr + suppTc.sr + suppTc.r;
    var sessionTotal = unitTotal + suppTotal;
    var hasSupp = suppTotal > 0;
    var totalUr = (unitTc.ur || 0) + (suppTc.ur || 0);
    var totalSsr = (unitTc.ssr || 0) + (suppTc.ssr || 0);

    var statsRoot = document.getElementById("sessStats");
    var unitsLbl = document.getElementById("sessStatsUnitsLbl");
    var suppPane = document.getElementById("sessStatsSupp");
    var totalsEl = document.getElementById("sessStatsTotals");
    if (statsRoot) statsRoot.classList.toggle("session-stats--split", hasSupp);
    if (unitsLbl) unitsLbl.hidden = !hasSupp;
    if (suppPane) suppPane.hidden = !hasSupp;
    if (totalsEl) totalsEl.hidden = !(sessionTotal > 0);

    function setTierBag(n, total, pctEl, cntEl) {
      var elP = document.getElementById(pctEl);
      var elC = document.getElementById(cntEl);
      if (!elP || !elC) return;
      var pct = total > 0 ? ((n / total) * 100) : null;
      elP.textContent = pct == null ? "—" : (pct.toFixed(1) + "%");
      elC.textContent = n + " / " + total;
    }
    /* Denominator = all cards this session (same as overall pull rate). */
    setTierBag(totalUr, sessionTotal, "statTotalUrPct", "statTotalUrCnt");
    setTierBag(totalSsr, sessionTotal, "statTotalSsrPct", "statTotalSsrCnt");
    setTierBag(unitTc.ur, sessionTotal, "statUrPct", "statUrCnt");
    setTierBag(unitTc.ssr, sessionTotal, "statSsrPct", "statSsrCnt");
    setTierBag(unitTc.sr, sessionTotal, "statSrPct", "statSrCnt");
    setTierBag(unitTc.r, sessionTotal, "statRPct", "statRCnt");
    if (hasSupp) {
      setTierBag(suppTc.ur, sessionTotal, "statSuppUrPct", "statSuppUrCnt");
      setTierBag(suppTc.ssr, sessionTotal, "statSuppSsrPct", "statSuppSsrCnt");
    }

    var hits = highRarityHits();
    var urList = document.getElementById("sessUrList");
    var urHead = document.querySelector("#sessUrHits > strong");
    var urN = hits.filter(function (c) { return c.rarity === "ur"; }).length;
    var ssrN = hits.filter(function (c) { return c.rarity === "ssr"; }).length;
    var urU = hits.filter(function (c) { return c.rarity === "ur" && c.kind !== "supp"; }).length;
    var urS = hits.filter(function (c) { return c.rarity === "ur" && c.kind === "supp"; }).length;
    var ssrU = hits.filter(function (c) { return c.rarity === "ssr" && c.kind !== "supp"; }).length;
    var ssrS = hits.filter(function (c) { return c.rarity === "ssr" && c.kind === "supp"; }).length;
    if (urHead) {
      urHead.textContent = hasSupp
        ? tt("gs_hits_line_full", { uru: urU, urs: urS, ssru: ssrU, ssrs: ssrS })
        : tt("gs_hits_line", { ur: urN, ssr: ssrN });
    }
    if (!hits.length) {
      urList.innerHTML = '<li class="ur-empty">' + tt("gs_ur_ssr_empty") + "</li>";
    } else {
      urList.innerHTML = hits.map(function (c) {
        var rarLabel = (c.rarity || "").toUpperCase();
        var displayName = resolvePoolName(c.id) || c.name || c.id || "?";
        return '<li class="hit-row" data-draw-at="' + c.at + '" data-draw-id="' + esc(c.id) +
          '" title="' + esc(tt(gsPreferTapReveal() ? "gs_hover_preview_tap" : "gs_hover_preview")) + '">' +
          "#" + c.at + " · <b class=\"hit-" + c.rarity + "\">" + esc(displayName) + "</b>" +
          '<span class="ur-kind">' + rarLabel + (c.kind === "supp" ? " · " + tt("gs_supp_label") : " · " + tt("tab_unit")) + "</span>" +
          (c.pickup ? " · " + esc(tt("gs_pickup")) : "") +
          (c.isNew ? ' · <span class="ur-new">' + tt("gs_new") + "</span>" : "") +
          "</li>";
      }).join("");
    }

    var log = document.getElementById("sessLog");
    log.innerHTML = sim.history.map(function (h) {
      var cards = Array.isArray(h.cards) ? h.cards : null;
      var body;
      if (cards && cards.length) {
        body = cards.map(formatCardChip).join(" · ");
      } else {
        body = esc(h.summary || "");
      }
      var firstBit = "";
      if (h.firstPickupId || h.firstPickup) {
        var fpName = resolvePoolName(h.firstPickupId) || h.firstPickup || "";
        if (fpName) firstBit = " · <b>" + esc(tt("gs_log_first", { name: fpName })) + "</b>";
      }
      return "<li>#" + h.at + " · " + h.n + "p · " + body + firstBit + "</li>";
    }).join("") || "<li>" + esc(tt("gs_no_pulls")) + "</li>";

    bindHitHover(urList);
    bindHitHover(log);
    bindUrAcqHover();
    document.querySelectorAll("[data-ur-acq]").forEach(function (el) {
      el.title = tt(gsPreferTapReveal() ? "gs_ur_acq_hint_tap" : "gs_ur_acq_hint");
      if (!el.hasAttribute("aria-expanded")) el.setAttribute("aria-expanded", "false");
    });
    try { syncShareXButtons(); } catch (eSx) {}
  }
  renderSession();

  document.getElementById("sessReset").onclick = function () {
    sim = emptySim();
    pts = 0;
    syncPtsUi();
    saveSim();
    renderSession();
    try { syncPullButtons(); } catch (eR) {}
    hideCardHover();
    hideUrAcqPop();
  };
  document.getElementById("optCollections").onchange = function () {
    saveOpts();
  };
  document.getElementById("optSkipAnim").onchange = function () {
    saveOpts();
  };

  document.getElementById("strip").addEventListener("click", function (ev) {
    var card = ev.target.closest(".result-card");
    if (!card) return;
    var id = card.getAttribute("data-id");
    var kind = card.getAttribute("data-kind") || "unit";
    if (id) openDbDetail(kind, id);
  });
  document.getElementById("strip").addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    var card = ev.target.closest(".result-card");
    if (!card) return;
    ev.preventDefault();
    var id = card.getAttribute("data-id");
    var kind = card.getAttribute("data-kind") || "unit";
    if (id) openDbDetail(kind, id);
  });

  function pickWeighted(rows) {
    var total = 0;
    for (var i = 0; i < rows.length; i++) total += rows[i][1];
    if (total <= 0) return rows[0] && rows[0][0];
    var r = Math.random() * total;
    for (var j = 0; j < rows.length; j++) {
      r -= rows[j][1];
      if (r <= 0) return rows[j][0];
    }
    return rows[rows.length - 1][0];
  }

  function pickItem(bucket) {
    var list = POOL[bucket] || [];
    if (!list.length) {
      /* Same-tier unit↔supporter only (never SR↔R — wrong rarity chrome). */
      var alt = { URU: "URS", URS: "URU", SSRU: "SSRS", SSRS: "SSRU" }[bucket];
      list = (alt && POOL[alt]) || [];
    }
    if (!list.length) return { name: bucket, art: "", role: "", charArt: "", id: "" };
    if (list[0].w) {
      var rows = list.map(function (it, idx) { return [idx, it.w]; });
      return list[pickWeighted(rows)];
    }
    return list[(Math.random() * list.length) | 0];
  }

  function unitKey(item) {
    return String(item.id || item.art || item.name || "");
  }

  function roll(n) {
    var out = [];
    var seenThisPull = {};
    var pullsBefore = sim.pulls;
    var tail = guaranteeTailN();
    var pityStart = Math.max(0, n - tail);
    for (var i = 0; i < n; i++) {
      var usePity = (n === 10 && i === 9) || (n >= 20 && i >= pityStart);
      var table = usePity ? TENTH : NORMAL;
      var bucket = pickWeighted(table);
      var item = pickItem(bucket);
      var rarity = bucket.indexOf("UR") === 0 ? "ur" : bucket.indexOf("SSR") === 0 ? "ssr" : bucket === "SR" ? "sr" : "r";
      var kind = (bucket === "URS" || bucket === "SSRS") ? "supp" : "unit";
      var uid = unitKey(item);
      var pullIndex = pullsBefore + i + 1;
      /* New = first acquire of a UR/SSR unit this session (pilot inset when charArt exists). */
      var canNew = kind === "unit" && (rarity === "ur" || rarity === "ssr");
      var isNew = canNew && uid && !isAlreadyOwned(uid) && !seenThisPull[uid];
      if (uid) seenThisPull[uid] = true;
      if (isNew && sim.firstPickupAt[uid] == null) sim.firstPickupAt[uid] = pullIndex;
      out.push({
        id: uid,
        name: item.name,
        role: item.role || "",
        art: item.art || "",
        charArt: item.charArt || "",
        bromide_height: item.bromide_height != null ? item.bromide_height : item.bromideHeight,
        porY: porYFromItem(item),
        limited: !!item.limited,
        rarity: rarity,
        kind: kind,
        pickup: !!item.pickup,
        isNew: isNew,
        promo: rarity === "ur"
      });
    }
    Object.keys(seenThisPull).forEach(function (id) { sim.simOwned[id] = true; });
    return out;
  }

  function bestOf(rows) {
    if (rows.some(function (r) { return r.rarity === "ur"; })) return "ur";
    if (rows.some(function (r) { return r.rarity === "ssr"; })) return "ssr";
    return "low";
  }

  function wait(ms, id) {
    return new Promise(function (resolve) {
      if (skip || id !== runId) { resolve(); return; }
      timer = setTimeout(function () { resolve(); }, ms);
    });
  }

  function render343(rows) {
    /* Pad / trim to 10 for classic layout when n===10; 47-pull uses wrap grid. */
    var strip = document.getElementById("strip");
    function cardHtml(r, delay) {
      r = enrichArtFromPool(r || {});
      var showNew = !!r.isNew && r.kind !== "supp";
      return '<div class="result-card" role="link" tabindex="0" title="' + esc(tt("gs_open_detail")) + '" data-kind="' +
        (r.kind === "supp" ? "supp" : "unit") + '" data-id="' + esc(r.id || "") + '">' +
        layerCard({
          rarity: r.rarity, kind: r.kind, art: r.art, role: r.role,
          charArt: r.charArt, porY: resolvePorY(r), isNew: showNew, fromPull: true, delay: delay
        }) + "</div>";
    }
    if (rows.length === 10) {
      var rows343 = [rows.slice(0, 3), rows.slice(3, 7), rows.slice(7, 10)];
      var cls = ["strip-row strip-row--3", "strip-row strip-row--4", "strip-row strip-row--3b"];
      strip.className = "strip-343";
      strip.innerHTML = rows343.map(function (chunk, ri) {
        return '<div class="' + cls[ri] + '">' + chunk.map(function (r, i) {
          return cardHtml(r, (ri * 4 + i) * 50);
        }).join("") + "</div>";
      }).join("");
    } else if (rows.length >= 20) {
      strip.className = "strip-343 strip-343--bulk";
      strip.innerHTML = '<div class="strip-row strip-row--wrap">' + rows.map(function (r, i) {
        return cardHtml(r, Math.min(i * 18, 900));
      }).join("") + "</div>";
    } else {
      strip.className = "strip-343";
      strip.innerHTML = '<div class="strip-row">' + rows.map(function (r, i) {
        return cardHtml(r, i * 60);
      }).join("") + "</div>";
    }
  }

  async function play(n) {
    if (isBulkTicketPool() && n >= 20 && sim.bulkSpent) {
      try { syncPullButtons(); } catch (e0) {}
      return;
    }
    var id = ++runId;
    skip = false;
    lastN = n;
    var rows = roll(n);
    lastRows = rows;
    try { syncShareXButtons(); } catch (eRows) {}
    if (isBulkTicketPool() && n >= 20) {
      sim.bulkSpent = true;
    }
    var firstNews = rows.filter(function (r) { return r.isNew; });
    var firstNames = firstNews.map(function (r) { return r.name || r.id; });
    var firstPickupId = firstNews.length && firstNews[0].id ? String(firstNews[0].id) : "";
    sim.pulls += n;
    if (!sim.tierCounts) sim.tierCounts = { ur: 0, ssr: 0, sr: 0, r: 0 };
    rows.forEach(function (r) {
      var k = r.rarity === "ur" ? "ur" : r.rarity === "ssr" ? "ssr" : r.rarity === "sr" ? "sr" : "r";
      sim.tierCounts[k] = (sim.tierCounts[k] || 0) + 1;
    });
    if (!sim.draws) sim.draws = [];
    var pullsBefore = sim.pulls - n;
    var cardRecords = rows.map(function (r, i) {
      return {
        at: pullsBefore + i + 1,
        id: r.id || "",
        name: r.name || r.id || "?",
        rarity: r.rarity,
        kind: r.kind,
        art: r.art || "",
        role: r.role || "",
        charArt: r.charArt || "",
        bromide_height: r.bromide_height != null ? r.bromide_height : r.bromideHeight,
        porY: resolvePorY(r),
        pickup: !!r.pickup,
        isNew: !!r.isNew
      };
    });
    /* newest pull index first */
    sim.draws = cardRecords.slice().reverse().concat(sim.draws);
    if (sim.draws.length > DRAW_CAP) sim.draws.length = DRAW_CAP;
    sim.history.unshift({
      at: sim.pulls,
      n: n,
      summary: rows.map(function (r) { return r.rarity.toUpperCase(); }).join(" "),
      cards: cardRecords,
      firstPickup: firstNames[0] || "",
      firstPickupId: firstPickupId
    });
    if (sim.history.length > HIST_CAP) sim.history.length = HIST_CAP;
    pts = pts + n;
    syncPtsUi();
    saveSim();
    try { syncPullButtons(); } catch (eSp) {}
    renderSession();
    var best = bestOf(rows);
    var hasUr = rows.some(function (r) { return r.rarity === "ur"; });
    var hasSsr = rows.some(function (r) { return r.rarity === "ssr"; });
    var hasFeaturedHigh = rows.some(function (r) {
      return !!r.pickup && (r.rarity === "ur" || r.rarity === "ssr");
    });
    var hasLimitedFeaturedUr = rows.some(function (r) {
      return !!r.limited && r.rarity === "ur";
    });
    var sayla = hasLimitedFeaturedUr;
    var cutLabel = sayla ? "SAYLA" : (hasUr ? "NEWTYPE" : (hasSsr ? "AMURO·SSR" : "REGULAR"));
    var stage = document.getElementById("stage");
    var wantAnim = !skipAnimPreferred();
    var usedVideo = false;

    async function showResultsShell() {
      if (stage && stage.parentElement !== document.body) {
        document.body.appendChild(stage);
      }
      document.body.classList.add("gacha-sim-stage-open");
      if (typeof window.updateScrollTopFabVisibility === "function") {
        window.updateScrollTopFabVisibility();
      }
      stage.className = "stage on is-open show-results" +
        (best === "ur" ? " is-ur" : best === "ssr" ? " is-ssr" : "");
      stage.setAttribute("aria-hidden", "false");
      document.getElementById("cutLabel").textContent = cutLabel;
      render343(rows);
    }

    if (wantAnim && typeof window.playGachaSimPullCinematic === "function") {
      usedVideo = await new Promise(function (resolve) {
        var settled = false;
        var finish = function (ok) {
          if (settled) return;
          settled = true;
          clearTimeout(safetyTo);
          resolve(!!ok);
        };
        /* Anniversary clips are large (~8–10MB on raw GitHub). Never block results forever. */
        var safetyTo = setTimeout(function () {
          try {
            if (typeof window.gachaVideoSkip === "function") window.gachaVideoSkip();
          } catch (eSk) {}
          finish(false);
        }, 55000);
        var started = window.playGachaSimPullCinematic({
          hasLimitedFeaturedUr: hasLimitedFeaturedUr,
          hasUr: hasUr,
          hasSsr: hasSsr,
          hasFeaturedHigh: hasFeaturedHigh,
          best: best,
          gashaMovieSettingId: (poolMeta && poolMeta.gasha_movie_setting_id) || "",
          gashaMovieSetting: (poolMeta && poolMeta.gasha_movie_setting) || null,
          onDone: function () { finish(true); }
        });
        if (!started) finish(false);
      });
      if (id !== runId) return;
    }

    if (wantAnim && !usedVideo) {
      /* Fallback CSS hatch when Video CDN / player unavailable */
      if (stage && stage.parentElement !== document.body) {
        document.body.appendChild(stage);
      }
      document.body.classList.add("gacha-sim-stage-open");
      if (typeof window.updateScrollTopFabVisibility === "function") {
        window.updateScrollTopFabVisibility();
      }
      stage.className = "stage on" + (best === "ur" ? " is-ur" : best === "ssr" ? " is-ssr" : "");
      stage.setAttribute("aria-hidden", "false");
      document.getElementById("cutLabel").textContent = cutLabel;
      render343(rows);
      void stage.offsetWidth;
      await wait(280, id); if (id !== runId) return;
      stage.classList.add("is-open");
      await wait(720, id); if (id !== runId) return;
      stage.classList.add("show-op");
      await wait(best === "ur" ? 900 : 640, id); if (id !== runId) return;
      stage.classList.remove("show-op");
      if (best !== "low") {
        stage.classList.add("show-cut");
        await wait(700, id); if (id !== runId) return;
        stage.classList.remove("show-cut");
      }
      await wait(280, id); if (id !== runId) return;
      stage.classList.add("show-results");
    } else {
      await showResultsShell();
    }
  }

  function closeStage() {
    runId += 1;
    skip = true;
    clearTimeout(timer);
    try { clearStuckExportChrome(); } catch (eClr) {}
    var stage = document.getElementById("stage");
    stage.className = "stage";
    stage.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gacha-sim-stage-open");
    if (typeof window.updateScrollTopFabVisibility === "function") {
      window.updateScrollTopFabVisibility();
    }
    var root = document.getElementById("gachaSimRoot");
    if (root && stage && stage.parentElement === document.body) {
      root.appendChild(stage);
    }
  }

  function loadImg(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  function ensureHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      s.async = true;
      s.onload = function () {
        if (window.html2canvas) resolve(window.html2canvas);
        else reject(new Error("html2canvas missing"));
      };
      s.onerror = function () { reject(new Error("html2canvas load failed")); };
      document.head.appendChild(s);
    });
  }

  function waitImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll("img"));
    return Promise.all(imgs.map(function (img) {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return new Promise(function (res) {
        img.addEventListener("load", function () { res(); }, { once: true });
        img.addEventListener("error", function () { res(); }, { once: true });
      });
    }));
  }

  function sessionMultisFromHistory() {
    /* Each lobby pull (1× or 10×) is one set; history is newest-first → reverse for chrono. */
    var hist = (sim.history || []).slice().reverse();
    var out = [];
    hist.forEach(function (h) {
      if (!h || !Array.isArray(h.cards) || !h.cards.length) return;
      out.push(h.cards.slice());
    });
    return out;
  }

  function exportCardHtml(r) {
    r = enrichArtFromPool(normalizeCard(r) || r || {});
    var html = '<div class="result-card" data-id="' + esc(r.id || "") + '">' + layerCard({
      rarity: r.rarity || "r",
      kind: r.kind === "supp" ? "supp" : "unit",
      art: r.art || "",
      role: r.role || "",
      charArt: r.charArt || "",
      porY: resolvePorY(r),
      isNew: !!r.isNew,
      fromPull: true,
      export: true,
      delay: 0
    }) + "</div>";
    /* Ensure every raster is CORS-tagged before the browser starts the fetch. */
    return html.replace(/<img(?![^>]*\bcrossorigin=)/g, '<img crossorigin="anonymous"');
  }

  function buildExport343(cards) {
    if (cards.length === 10) {
      var chunks = [cards.slice(0, 3), cards.slice(3, 7), cards.slice(7, 10)];
      var cls = ["strip-row strip-row--3", "strip-row strip-row--4", "strip-row strip-row--3b"];
      return '<div class="strip-343">' + chunks.map(function (chunk, ri) {
        return '<div class="' + cls[ri] + '">' + chunk.map(exportCardHtml).join("") + "</div>";
      }).join("") + "</div>";
    }
    if (cards.length >= 20) {
      return '<div class="strip-343 strip-343--bulk"><div class="strip-row strip-row--wrap">' +
        cards.map(exportCardHtml).join("") + "</div></div>";
    }
    return '<div class="strip-343"><div class="strip-row">' +
      cards.map(exportCardHtml).join("") + "</div></div>";
  }

  var SITE_LOGO = CDN + "UI/IMG_Common_Logo_ETERNALBASE.webp";
  var EXPORT_PAGE_URL = exportPageUrl();
  /* Session PNG budget: 400 pulls ≈ 40×10 → keep latest 20 sets.
     Card 112px @ h2c×2 ≈ ¼ the pixels of old 148px @ ×3 (main speed win). */
  var EXPORT_SET_CAP = 20;
  var EXPORT_SETS_PER_ROW = 5;
  var EXPORT_SESSION_CARD_W = 112;
  var EXPORT_SESSION_H2C_SCALE = 2;
  var EXPORT_SESSION_BAKE_SCALE = 2;

  function exportMetaHtml() {
    return (
      '<div class="gacha-export-meta">' +
        '<img class="gacha-export-meta-logo" alt="GGen Eternal Database" src="' + SITE_LOGO +
          '" width="22" height="22" crossorigin="anonymous">' +
        '<span class="gacha-export-meta-text"> · official published rates · not affiliated with Bandai Namco</span>' +
      "</div>"
    );
  }

  function multisToRows(multis, perRow) {
    var rows = [];
    var n = perRow || EXPORT_SETS_PER_ROW;
    for (var i = 0; i < multis.length; i += n) {
      rows.push(multis.slice(i, i + n));
    }
    return rows;
  }

  function downloadCanvasPng(canvas, filename) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) {
        if (!b) { rej(new Error("toBlob failed")); return; }
        var url = URL.createObjectURL(b);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        res();
      }, "image/png");
    });
  }

  function primeExportImages(root) {
    /* Only force CORS reload when crossorigin is missing — avoid re-fetching hundreds of CDN portraits. */
    root.querySelectorAll("img").forEach(function (img) {
      var s = img.getAttribute("src");
      if (!s || s.indexOf("data:") === 0) return;
      if (img.getAttribute("crossorigin") === "anonymous") return;
      img.setAttribute("crossorigin", "anonymous");
      img.src = s;
    });
    return waitImages(root);
  }

  function parseObjectPositionFrac(img) {
    var st = (img.getAttribute("style") || "").match(/object-position\s*:\s*([^;]+)/i);
    var raw = st ? st[1].trim() : "";
    if (!raw) {
      try { raw = window.getComputedStyle(img).objectPosition || ""; } catch (e) { raw = ""; }
    }
    var parts = String(raw).trim().split(/\s+/);
    var yTok = parts.length >= 2 ? parts[1] : (parts[0] || "14%");
    if (yTok === "top") return 0;
    if (yTok === "center" || yTok === "bottom" && parts.length < 2) return yTok === "bottom" ? 1 : 0.5;
    if (yTok === "bottom") return 1;
    var m = String(yTok).match(/([\d.]+)%/);
    return m ? Math.min(1, Math.max(0, parseFloat(m[1]) / 100)) : 0.14;
  }

  /** Keep live + export crops on face-first por_y (pool / height map), not stale history. */
  function rematchPorYInDom(root) {
    if (!root) return;
    root.querySelectorAll(".result-card[data-id]").forEach(function (cardEl) {
      var id = cardEl.getAttribute("data-id");
      if (!id) return;
      var y = resolvePorY({ id: id });
      cardEl.querySelectorAll("img.gc-por").forEach(function (img) {
        img.style.objectPosition = "50% " + y;
      });
    });
    if (Array.isArray(lastRows)) {
      lastRows.forEach(function (r) {
        if (!r) return;
        r.porY = resolvePorY(r);
      });
    }
  }

  /**
   * html2canvas often ignores object-fit/object-position — bake cover crops to canvas
   * so Save Collections PNG matches the live results strip.
   * @param {number} [bakeScale] — pixel ratio for baked portrait canvases (match h2c scale)
   */
  function bakeCoverObjectFitImages(root, bakeScale) {
    var restores = [];
    var scale = Math.max(1, Number(bakeScale) || 2);
    var smooth = scale >= 2.5 ? "high" : "medium";
    /* Portraits only — pilot thumbs are tiny; baking them costs more than it helps. */
    var nodes = root.querySelectorAll("img.gc-por");
    nodes.forEach(function (img) {
      var wrap = img.parentElement;
      if (!wrap || !img.naturalWidth || !img.naturalHeight) return;
      var cw = wrap.clientWidth || img.clientWidth || 0;
      var ch = wrap.clientHeight || img.clientHeight || 0;
      if (!(cw > 0) || !(ch > 0)) return;
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var sc = Math.max(cw / iw, ch / ih);
      var sw = cw / sc;
      var sh = ch / sc;
      var yFrac = parseObjectPositionFrac(img);
      var sx = (iw - sw) * 0.5;
      var sy = Math.max(0, (ih - sh) * yFrac);
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(cw * scale));
      canvas.height = Math.max(1, Math.round(ch * scale));
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;";
      try {
        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = smooth;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        return;
      }
      var prevDisplay = img.style.display;
      img.style.display = "none";
      wrap.insertBefore(canvas, img);
      restores.push(function () {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        img.style.display = prevDisplay;
      });
    });
    return function restoreBaked() {
      for (var i = restores.length - 1; i >= 0; i--) restores[i]();
    };
  }

  function cardsForBulkExport() {
    var raw = null;
    if (lastRows && lastRows.length) {
      raw = lastRows;
    } else {
      var multis = sessionMultisFromHistory();
      var best = null;
      for (var i = 0; i < multis.length; i++) {
        if (multis[i] && multis[i].length >= 20) best = multis[i];
      }
      if (!best && multis.length) best = multis[multis.length - 1];
      raw = best || [];
    }
    return raw.map(function (c) {
      var n = normalizeCard(c) || c;
      return enrichArtFromPool(n);
    }).filter(function (c) { return c && c.id; });
  }

  function setSaveBtnBusy(btn, busy) {
    if (!btn) return function () {};
    var isSess = btn.id === "sessSave";
    var prevHtml = btn.innerHTML;
    var prevText = btn.textContent;
    if (busy) {
      btn.disabled = true;
      if (isSess) {
        var lab = btn.querySelector("b");
        if (lab) lab.textContent = tt("gs_saving_caps") || "SAVING…";
      } else {
        btn.textContent = tt("gs_saving") || "Saving…";
      }
    }
    return function restore() {
      btn.disabled = false;
      if (isSess) {
        btn.innerHTML = prevHtml || ("<small>" + tt("gs_save") + "</small><b>" + tt("gs_session_btn") + "</b>");
      } else {
        btn.textContent = prevText || tt("gs_save_collections");
      }
    };
  }

  /**
   * Rebuild / reopen the live 47-pull results strip so Save can snapshot it.
   * Uses lastRows, else the bulk multi from session history (post-refresh).
   */
  function ensureBulkResultsOpenForExport() {
    var cards = cardsForBulkExport();
    if (!cards.length) return false;
    lastRows = cards;
    var stage = document.getElementById("stage");
    if (!stage) return false;
    if (stage.parentElement !== document.body) {
      document.body.appendChild(stage);
    }
    try { render343(cards); } catch (e) { return false; }
    var best = bestOf(cards);
    document.body.classList.add("gacha-sim-stage-open");
    stage.className = "stage on is-open show-results" +
      (best === "ur" ? " is-ur" : best === "ssr" ? " is-ssr" : "");
    stage.setAttribute("aria-hidden", "false");
    try { syncBulkResultChrome(); } catch (e0) {}
    if (typeof window.updateScrollTopFabVisibility === "function") {
      try { window.updateScrollTopFabVisibility(); } catch (e1) {}
    }
    return true;
  }

  /**
   * Anniversary / bulk ticket pools (e.g. 47): #shareStrip and #sessSave share
   * this path — reopen live results (from lastRows / history) then snapshot.
   */
  async function shareBulkPullCollections(btn) {
    if (!ensureBulkResultsOpenForExport()) {
      throw new Error("No pull to save yet");
    }
    /* Layout settle after reopen (sessSave from lobby / after refresh). */
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    return shareLivePullResultsPng(btn);
  }

  /** Snapshot the on-screen results panel so PNG matches live scale/layout. */
  async function shareLivePullResultsPng(btn) {
    clearStuckExportChrome();
    var stage = document.getElementById("stage");
    var results = stage && stage.querySelector(".results");
    if (!stage || !results || !stage.classList.contains("show-results")) {
      throw new Error("Open a pull result first");
    }
    var restoreBtn = setSaveBtnBusy(btn, true);
    var actions = results.querySelector(".results-actions");
    var resultsFoot = results.querySelector(".results-foot");
    var skipBtn = stage.querySelector(".skip");
    var foot = null;
    var prevActions = actions ? actions.style.display : "";
    var prevResultsFoot = resultsFoot ? resultsFoot.style.display : "";
    var prevSkip = skipBtn ? skipBtn.style.display : "";
    var capturing = false;
    try {
      if (actions) actions.style.display = "none";
      /* Sticky dark foot gradient reads as a black bar under the card grid in PNGs */
      if (resultsFoot) resultsFoot.style.display = "none";
      if (skipBtn) skipBtn.style.display = "none";
      /* Expand nested bulk scroll so html2canvas gets all cards, not one viewport. */
      if (results.querySelector(".strip-343--bulk")) {
        results.classList.add("gacha-export-capturing");
        capturing = true;
      }
      foot = document.createElement("div");
      foot.className = "gacha-export-live-foot";
      foot.innerHTML =
        '<div class="gacha-export-foot">' + esc(exportPageUrl()) + "</div>" +
        exportMetaHtml();
      results.appendChild(foot);

      var h2c = await ensureHtml2Canvas();
      await document.fonts.ready.catch(function () {});
      await primeExportImages(results);
      rematchPorYInDom(results);
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
      var restoreBake = bakeCoverObjectFitImages(results);
      try {
      var w = Math.max(1, results.scrollWidth || results.clientWidth || results.offsetWidth);
      var h = Math.max(1, results.scrollHeight || results.clientHeight);
      var canvas = await h2c(results, {
        backgroundColor: "#02040a",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h
      });
      await downloadCanvasPng(canvas, "ggendb-gacha-sim-pull-" + sim.pulls + ".png");
      } finally {
        if (typeof restoreBake === "function") restoreBake();
      }
    } finally {
      if (capturing) results.classList.remove("gacha-export-capturing");
      if (foot && foot.parentNode) foot.parentNode.removeChild(foot);
      if (actions) actions.style.display = prevActions;
      if (resultsFoot) resultsFoot.style.display = prevResultsFoot;
      if (skipBtn) skipBtn.style.display = prevSkip;
      clearStuckExportChrome();
      restoreBtn();
    }
  }

  async function shareSessionCollectionsPng(btn) {
    var prevLabel = "";
    if (btn) {
      btn.disabled = true;
      var lab = btn.querySelector("b");
      if (lab) {
        prevLabel = lab.textContent;
        lab.textContent = tt("gs_saving_caps");
      }
    }
    var mount = null;
    try {
      var multis = sessionMultisFromHistory();
      if (!multis.length) throw new Error("No pulls in this session yet");
      var truncated = false;
      if (multis.length > EXPORT_SET_CAP) {
        truncated = true;
        multis = multis.slice(multis.length - EXPORT_SET_CAP);
      }
      var cardCount = multis.reduce(function (n, m) { return n + m.length; }, 0);
      var h2c = await ensureHtml2Canvas();
      await document.fonts.ready.catch(function () {});

      mount = document.createElement("div");
      mount.className = "gacha-export-mount gacha-export-mount--session";
      mount.setAttribute("aria-hidden", "true");
      var setCount = Math.min(EXPORT_SETS_PER_ROW, multis.length);
      var cardW = EXPORT_SESSION_CARD_W;
      /* Each multi ≈ 4 cards wide (middle row); pad + group chrome */
      var multiW = cardW * 4.15 + 28;
      var rowGap = 28;
      mount.style.width = Math.max(720, setCount * multiW + (setCount - 1) * rowGap + 64) + "px";
      mount.style.setProperty("--gc-w", cardW + "px");
      mount.style.setProperty("--gc-h", "calc(var(--gc-w) * 219 / 446)");

      var tc = sim.tierCounts || { ur: 0, ssr: 0, sr: 0, r: 0 };
      var metaLine =
        "Session · " + sim.pulls + " pulls · " + multis.length + " set" + (multis.length === 1 ? "" : "s") +
        " · UR " + (tc.ur || 0) +
        " · SSR " + (tc.ssr || 0) +
        " · SR " + (tc.sr || 0) +
        " · R " + (tc.r || 0) +
        (truncated ? " · latest " + multis.length + " sets" : "");
      var rows = multisToRows(multis, EXPORT_SETS_PER_ROW);
      var bodyHtml =
        '<div class="gacha-export-body gacha-export-body--session">' +
        rows.map(function (row, rowIdx) {
          return '<div class="gacha-export-row">' +
            row.map(function (chunk, colIdx) {
              var setNo = rowIdx * EXPORT_SETS_PER_ROW + colIdx + 1;
              var nCards = chunk.length;
              return '<div class="gacha-export-multi" data-set="' + setNo + '">' +
                '<div class="gacha-export-multi-label">' + nCards + "× pull · set " + setNo + "</div>" +
                buildExport343(chunk) +
                "</div>";
            }).join("") +
            "</div>";
        }).join("") +
        "</div>";

      mount.innerHTML =
        '<div class="gacha-export-brand">' +
          '<img alt="" src="' + SITE_LOGO + '" width="48" height="48" crossorigin="anonymous">' +
          '<div class="gacha-export-brand-text">' +
            "<strong>Gacha Sim Result</strong>" +
            "<span>" + esc(metaLine) + "</span>" +
          "</div>" +
        "</div>" +
        '<h2 class="gacha-export-title">' + tt("gs_export_title") + "</h2>" +
        bodyHtml +
        '<div class="gacha-export-foot">' + esc(exportPageUrl()) + "</div>" +
        exportMetaHtml();

      document.body.appendChild(mount);
      await primeExportImages(mount);
      rematchPorYInDom(mount);
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
      var restoreBake = bakeCoverObjectFitImages(mount, EXPORT_SESSION_BAKE_SCALE);
      try {
      var canvas = await h2c(mount, {
        backgroundColor: "#02040a",
        scale: EXPORT_SESSION_H2C_SCALE,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 8000,
        removeContainer: true
      });
      await downloadCanvasPng(canvas, "ggendb-gacha-sim-session-" + sim.pulls + ".png");
      } finally {
        if (typeof restoreBake === "function") restoreBake();
      }
    } finally {
      if (mount && mount.parentNode) mount.parentNode.removeChild(mount);
      if (btn) {
        btn.disabled = false;
        var bb = btn.querySelector("b");
        if (bb) bb.textContent = prevLabel || tt("gs_session_btn");
      }
    }
  }

  function shareCurrentPullCollections() {
    var btn = document.getElementById("shareStrip");
    /* Bulk 47: same shared path as #sessSave (rebuild live strip → snapshot). */
    var run = isBulkTicketPool() ? shareBulkPullCollections(btn) : shareLivePullResultsPng(btn);
    return run.catch(function (err) {
      try { clearStuckExportChrome(); } catch (e0) {}
      if (btn) {
        btn.disabled = false;
        btn.textContent = tt("gs_save_collections");
      }
      try { console.warn("[gacha-sim] save pull failed", err); } catch (e) {}
    });
  }

  function shareSessionCollections() {
    var btn = document.getElementById("sessSave");
    /* Anniversary 47-ticket: identical to #shareStrip — live strip snapshot. */
    if (isBulkTicketPool()) {
      return shareBulkPullCollections(btn).catch(function (err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = "<small>" + tt("gs_save") + "</small><b>" + tt("gs_session_btn") + "</b>";
        }
        try { console.warn("[gacha-sim] save bulk pull failed", err); } catch (e) {}
      });
    }
    return shareSessionCollectionsPng(btn).catch(function (err) {
      if (btn) {
        btn.disabled = false;
        var bb = btn.querySelector("b");
        if (bb) bb.textContent = tt("gs_session_btn");
      }
      try { console.warn("[gacha-sim] save session failed", err); } catch (e) {}
    });
  }

  document.getElementById("one").onclick = function () { play(1); };
  document.getElementById("ten").onclick = function () {
    if (isBulkTicketPool() && sim.bulkSpent) return;
    play(isBulkTicketPool() ? primaryPullN() : 10);
  };
  document.getElementById("again").onclick = function () {
    if (isBulkTicketPool() && sim.bulkSpent) return;
    play(lastN || (isBulkTicketPool() ? primaryPullN() : 10));
  };
  document.getElementById("shareStrip").onclick = function () { shareCurrentPullCollections(); };
  var sessSaveBtn = document.getElementById("sessSave");
  if (sessSaveBtn) sessSaveBtn.onclick = function () { shareSessionCollections(); };
  var sessShareXBtn = document.getElementById("sessShareX");
  if (sessShareXBtn) sessShareXBtn.onclick = function () { shareGachaOnX("session"); };
  var resultShareXBtn = document.getElementById("resultShareX");
  if (resultShareXBtn) resultShareXBtn.onclick = function () { shareGachaOnX("result"); };
  try { applyShareXBtnLabels(); syncShareXButtons(); } catch (eShareInit) {}
  document.getElementById("skip").onclick = function () {
    skip = true;
    clearTimeout(timer);
    /* Video cinematic: finish whole sequence (not clip-by-clip) */
    if (typeof window.gachaVideoSkip === "function") {
      try { window.gachaVideoSkip(); } catch (e) {}
    }
    var stage = document.getElementById("stage");
    if (stage) stage.classList.add("is-open", "show-results");
  };
  document.getElementById("done").onclick = closeStage;

  try { ensureTekoFont(); } catch (e0) {}
  try { applyLang(); } catch (e) {}
  try { syncRotateHint(); } catch (e2) {}
  if (!window._gsRotateHintBound) {
    window._gsRotateHintBound = 1;
    window.addEventListener("resize", syncRotateHint, { passive: true });
    window.addEventListener("orientationchange", function () {
      setTimeout(syncRotateHint, 120);
    });
  }

  return { onTabShown: onTabShown, openDbDetail: openDbDetail, applyLang: applyLang, onLangChange: onLangChange };
})();
