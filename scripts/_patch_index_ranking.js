const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const indexPath = path.join(root, "templates", "index.html");
const snippetPath = path.join(root, "_panel_ranking_snippet.txt");
let html = fs.readFileSync(indexPath, "utf8");
const snippet = fs.readFileSync(snippetPath, "utf8");

const navInsert = `<button class="nav-tab" data-tab="ranking" id="navRankingTab" onclick="switchTab('ranking')"><img class="nav-tab-icon nav-tab-icon--ranking" width="22" height="22" alt="" loading="lazy" decoding="async" src="{% if image_cdn %}{{ image_cdn }}/images/UI/UI_Home_Campaign_Image_01.webp{% else %}/static/images/UI/UI_Home_Campaign_Image_01.webp{% endif %}"><span id="navRankingTabLabel"></span></button>
`;

if (!html.includes("id=\"navRankingTab\"")) {
  const navMatch = html.match(/<button class="nav-tab" data-tab="units" id="navUnitTab"[^>]*>Units<\/button>\r?\n/);
  if (!navMatch) throw new Error("nav anchor missing");
  html = html.replace(navMatch[0], navMatch[0] + navInsert);
}

if (!html.includes("id=\"panel-ranking\"")) {
  const panelNeedle = `<div class="tab-panel" id="panel-units">`;
  const panelIdx = html.indexOf(panelNeedle);
  if (panelIdx < 0) throw new Error("panel-units anchor missing");
  html = html.slice(0, panelIdx) + snippet + "\n" + html.slice(panelIdx);
}


const cssAdd = `#panel-ranking::before{background-image:url('{% if image_cdn %}{{ image_cdn }}/images/UI/UI_Home_Campaign_Image_01.webp{% else %}/static/images/UI/UI_Home_Campaign_Image_01.webp{% endif %}')}
.nav-tab .nav-tab-icon{width:22px;height:22px;object-fit:contain;margin-right:8px;flex-shrink:0;vertical-align:middle;border-radius:4px}
.ranking-top-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin:0 0 14px;position:relative;z-index:1}
.ranking-mode-toggle{display:inline-flex;border-radius:var(--radius-md);border:1px solid var(--border-color);overflow:hidden;background:var(--bg-secondary)}
.ranking-mode-btn{padding:9px 18px;border:none;background:transparent;color:var(--text-secondary);font-weight:700;font-size:15px;cursor:pointer;transition:var(--transition)}
.ranking-mode-btn:hover{color:var(--text-primary)}
.ranking-mode-btn.active{background:var(--bg-card);color:var(--accent-cyan)}
.ranking-sort-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;flex:1;min-width:0}
.ranking-stat-pills{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ranking-stat-pill{padding:6px 12px;border-radius:999px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);font-size:13px;font-weight:600;cursor:pointer;transition:var(--transition)}
.ranking-stat-pill:hover{color:var(--text-primary);border-color:rgba(0,212,255,.35)}
.ranking-stat-pill.active{border-color:var(--accent-cyan);color:var(--accent-cyan);background:rgba(0,212,255,.08)}
.ranking-dir-btn{min-width:42px;padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:15px;cursor:pointer;line-height:1}
.ranking-dir-btn:hover{border-color:var(--accent-cyan)}
.ranking-list-shell{position:relative;min-height:220px;z-index:1;margin-top:4px}
#panel-ranking .list-toolbar-left--browse>.browse-toolbar-top-row{display:flex;flex-wrap:nowrap;align-items:center;gap:10px;min-width:0;flex:1 1 100%;width:100%;max-width:100%;box-sizing:border-box;justify-content:flex-start}
#panel-ranking .browse-toolbar-top-row .browse-toolbar-leading{flex:0 1 auto;min-width:0;max-width:100%}
#panel-ranking .browse-toolbar-top-row .browse-toolbar-leading .filter-input-wrap--organic{flex:0 0 min(21ch,23vw);width:min(21ch,23vw);max-width:min(21ch,23vw);min-width:min(13ch,100%);position:relative;z-index:2}
#panel-ranking .browse-toolbar-top-row .browse-toolbar-leading .filter-input-wrap--organic .filter-input--organic{width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box;field-sizing:fixed}
#panel-ranking .browse-toolbar-top-row .browse-toolbar-leading .filter-input-wrap--organic:focus-within{z-index:55;transform:translateZ(0)}
#panel-ranking .browse-toolbar-top-row .browse-toolbar-leading .filter-input-wrap--organic:focus-within .filter-input--organic{box-shadow:0 0 0 1px rgba(0,212,255,.35),0 12px 40px rgba(0,0,0,.5),0 0 48px rgba(0,212,255,.12);background:linear-gradient(180deg,rgba(14,20,36,.98),rgba(10,14,26,.96));border-color:rgba(0,212,255,.45)}
.ranking-list-inner{display:flex;flex-direction:column;gap:8px}
.ranking-row{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;text-align:left;padding:10px 14px;border:1px solid var(--border-color);border-radius:var(--radius-md);background:var(--bg-card);color:var(--text-primary);cursor:pointer;transition:var(--transition)}
.ranking-row:hover{border-color:rgba(0,212,255,.45);box-shadow:0 4px 16px rgba(0,0,0,.25)}
.ranking-rank-num{font-weight:800;color:var(--accent-gold);min-width:2.6em;font-variant-numeric:tabular-nums}
.ranking-row-thumb{flex-shrink:0;display:flex;align-items:center}
.ranking-row-name{flex:1;min-width:0;font-weight:600;font-size:15px}
.ranking-row-stat{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:100px}
.ranking-stat-val{font-variant-numeric:tabular-nums;font-weight:800;font-size:14px}
.ranking-bar-track{display:block;width:min(128px,28vw);height:6px;border-radius:3px;background:var(--bg-secondary);overflow:hidden}
.ranking-bar-fill{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,rgba(0,212,255,.25),var(--accent-cyan));min-width:2px}
@media(max-width:768px){ #panel-ranking .browse-toolbar-top-row .browse-toolbar-leading .filter-input-wrap--organic .filter-input--organic{width:100%!important;min-width:0;max-width:none!important}.ranking-row{flex-wrap:wrap}.ranking-row-stat{width:100%;align-items:stretch;min-width:0}.ranking-bar-track{width:100%}}
`;

if (!html.includes("#panel-ranking::before")) {
  const anchor = "#panel-units::before,#panel-stages::before";
  const start = html.indexOf(anchor);
  if (start < 0) throw new Error("css anchor missing");
  const end = html.indexOf("\n", start);
  if (end < 0) throw new Error("css line newline missing");
  html = html.slice(0, end + 1) + cssAdd + html.slice(end + 1);
}

fs.writeFileSync(indexPath, html);
console.log("patched", indexPath);
