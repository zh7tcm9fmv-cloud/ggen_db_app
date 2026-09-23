from pathlib import Path

p = Path(__file__).resolve().parents[1] / "static" / "js" / "gacha_sim.js"
js = p.read_text(encoding="utf-8")

js = js.replace(
    '  document.getElementById("refStrip").innerHTML = refHtml;',
    '  var _refStrip = document.getElementById("refStrip");\n'
    "  if (_refStrip) _refStrip.innerHTML = refHtml;",
)

old = """  document.getElementById("unitGallery").innerHTML = [
    bakeCard("assemble_R.webp", "<b>R</b> · Base + Frame"),
    bakeCard("assemble_SR.webp", "<b>SR</b> · Pats + R_Frame (SR tone)"),
    bakeCard("assemble_SSR.webp", "<b>SSR</b> · Effect_U + Base + Frame"),
    bakeCard("assemble_UR.webp", "<b>UR</b> · Pats + Effect_Material")
  ].join("");

  document.getElementById("suppGallery").innerHTML = [
    bakeCard("assemble_SUPP_SSR.webp", "<b>SSR Supporter</b> · image.psdssr.psd"),
    bakeCard("assemble_SUPP_UR.webp", "<b>UR Supporter</b> · image.psd.psd"),
    '<figure class="gc-slot"><div class="gc gc--baked"><img class="gc-bake" alt="" src="' + LOCAL + 'psd_supporter_SSR_ref.png"></div><figcaption><b>Your SSR PSD</b></figcaption></figure>',
    '<figure class="gc-slot"><div class="gc gc--baked"><img class="gc-bake" alt="" src="' + LOCAL + 'psd_supporter_UR_ref.png"></div><figcaption><b>Your UR PSD</b></figcaption></figure>'
  ].join("");"""

new = """  (function fillDevGalleries() {
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
  })();"""

if old not in js:
    raise SystemExit("gallery block not found")
js = js.replace(old, new)

js = js.replace(
    """    document.getElementById("liveGallery").innerHTML = demos.map(function (o) {
      return '<figure class="gc-slot">' + layerCard(o) + "<figcaption><b>" + o.label + "</b></figcaption></figure>";
    }).join("");""",
    """    var lg = document.getElementById("liveGallery");
    if (!lg) return;
    lg.innerHTML = demos.map(function (o) {
      return '<figure class="gc-slot">' + layerCard(o) + "<figcaption><b>" + o.label + "</b></figcaption></figure>";
    }).join("");""",
)

js = js.replace(
    '    var note = document.querySelector(".note");',
    '    var note = document.querySelector("#gachaSimRoot .note");',
)

p.write_text(js, encoding="utf-8")
print("patched", p)
