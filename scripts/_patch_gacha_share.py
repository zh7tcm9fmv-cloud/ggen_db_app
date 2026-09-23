# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "static" / "js" / "gacha_sim.js"
src = p.read_text(encoding="utf-8")
start = src.find("  function loadImg(src) {")
end = src.find("  return { onTabShown: onTabShown, openDbDetail: openDbDetail };")
if start < 0 or end < 0:
    raise SystemExit(f"markers missing start={start} end={end}")

new = r'''  function loadImg(src) {
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

  function sessionCardsChrono() {
    /* sim.draws is newest-first; export oldest→newest like pull order */
    var list = (sim.draws || []).slice();
    list.reverse();
    return list;
  }

  function exportCardHtml(r) {
    return '<div class="result-card">' + layerCard({
      rarity: r.rarity || "r",
      kind: r.kind === "supp" ? "supp" : "unit",
      art: r.art || "",
      role: r.role || "",
      charArt: r.charArt || "",
      porY: r.porY || r.por_y || "",
      isNew: !!r.isNew,
      fromPull: true,
      delay: 0
    }) + "</div>";
  }

  function buildExport343(cards) {
    if (cards.length === 10) {
      var chunks = [cards.slice(0, 3), cards.slice(3, 7), cards.slice(7, 10)];
      var cls = ["strip-row strip-row--3", "strip-row strip-row--4", "strip-row strip-row--3b"];
      return '<div class="strip-343">' + chunks.map(function (chunk, ri) {
        return '<div class="' + cls[ri] + '">' + chunk.map(exportCardHtml).join("") + "</div>";
      }).join("") + "</div>";
    }
    return '<div class="strip-343"><div class="strip-row">' +
      cards.map(exportCardHtml).join("") + "</div></div>";
  }

  var SITE_LOGO = CDN + "UI/IMG_Common_Logo_ETERNALBASE.webp";
  var EXPORT_CARD_CAP = 100;

  async function shareSessionCollections() {
    var buttons = [
      document.getElementById("shareStrip"),
      document.getElementById("sessSave")
    ].filter(Boolean);
    buttons.forEach(function (b) {
      b.disabled = true;
      if (b.id === "sessSave") {
        var lab = b.querySelector("b");
        if (lab) lab.textContent = "SAVING…";
      } else {
        b.textContent = "Saving…";
      }
    });
    var mount = null;
    try {
      var all = sessionCardsChrono();
      if (!all.length) throw new Error("No pulls in this session yet");
      var truncated = all.length > EXPORT_CARD_CAP;
      var cards = truncated ? all.slice(all.length - EXPORT_CARD_CAP) : all;
      var h2c = await ensureHtml2Canvas();
      await document.fonts.ready.catch(function () {});

      mount = document.createElement("div");
      mount.className = "gacha-export-mount";
      mount.setAttribute("aria-hidden", "true");
      var cardW = cards.length > 40 ? 140 : cards.length > 20 ? 170 : 200;
      mount.style.setProperty("--gc-w", cardW + "px");
      mount.style.setProperty("--gc-h", "calc(var(--gc-w) * 219 / 446)");
      mount.style.width = Math.max(720, Math.min(1180, cardW * 5.4 + 80)) + "px";

      var tc = sim.tierCounts || { ur: 0, ssr: 0, sr: 0, r: 0 };
      var metaLine =
        "Total pulls " + sim.pulls +
        " · UR " + (tc.ur || 0) +
        " · SSR " + (tc.ssr || 0) +
        " · SR " + (tc.sr || 0) +
        " · R " + (tc.r || 0) +
        (truncated ? " · showing latest " + cards.length : "");

      var multis = [];
      for (var i = 0; i < cards.length; ) {
        var n = Math.min(10, cards.length - i);
        if (n === 10) {
          multis.push(cards.slice(i, i + 10));
          i += 10;
        } else {
          multis.push(cards.slice(i));
          break;
        }
      }

      mount.innerHTML =
        '<div class="gacha-export-brand">' +
          '<img alt="" src="' + SITE_LOGO + '" width="48" height="48" crossorigin="anonymous">' +
          '<div class="gacha-export-brand-text">' +
            "<strong>Gacha Sim Result</strong>" +
            "<span>" + esc(metaLine) + "</span>" +
          "</div>" +
        "</div>" +
        '<h2 class="gacha-export-title">Unit Assembly Results</h2>' +
        '<div class="gacha-export-body">' +
          multis.map(function (chunk) {
            return '<div class="gacha-export-multi">' + buildExport343(chunk) + "</div>";
          }).join("") +
        "</div>" +
        '<div class="gacha-export-foot">/gacha-sim</div>' +
        '<div class="gacha-export-meta">ggendb · official published rates · not affiliated with Bandai Namco</div>';

      document.body.appendChild(mount);
      await waitImages(mount);
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });

      var canvas = await h2c(mount, {
        backgroundColor: "#02040a",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false
      });
      var blob = await new Promise(function (res, rej) {
        canvas.toBlob(function (b) { b ? res(b) : rej(new Error("toBlob failed")); }, "image/png");
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "ggendb-gacha-sim-session-" + sim.pulls + ".png";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      var logEl = document.getElementById("log");
      if (logEl) {
        logEl.textContent =
          "Saved session PNG (" + cards.length + " card" + (cards.length === 1 ? "" : "s") +
          (truncated ? "; capped at " + EXPORT_CARD_CAP : "") + ").";
      }
    } catch (err) {
      var logErr = document.getElementById("log");
      if (logErr) logErr.textContent = "Save failed: " + (err && err.message ? err.message : err);
    } finally {
      if (mount && mount.parentNode) mount.parentNode.removeChild(mount);
      buttons.forEach(function (b) {
        b.disabled = false;
        if (b.id === "sessSave") {
          var bb = b.querySelector("b");
          if (bb) bb.textContent = "COLLECTIONS";
        } else {
          b.textContent = "Save Collections";
        }
      });
    }
  }

  document.getElementById("one").onclick = function () { play(1); };
  document.getElementById("ten").onclick = function () { play(10); };
  document.getElementById("again").onclick = function () { play(lastN); };
  document.getElementById("shareStrip").onclick = function () { shareSessionCollections(); };
  var sessSaveBtn = document.getElementById("sessSave");
  if (sessSaveBtn) sessSaveBtn.onclick = function () { shareSessionCollections(); };
  document.getElementById("skip").onclick = function () {
    skip = true;
    clearTimeout(timer);
    document.getElementById("stage").classList.add("is-open", "show-results");
  };
  document.getElementById("done").onclick = closeStage;

'''

p.write_text(src[:start] + new + src[end:], encoding="utf-8")
print("patched share + session save")
