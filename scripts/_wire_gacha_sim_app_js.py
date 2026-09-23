# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "static" / "js" / "app.js"
src = p.read_text(encoding="utf-8")


def must_replace(old: str, new: str, label: str) -> None:
    global src
    if old not in src:
        raise SystemExit(f"MISSING: {label}")
    src = src.replace(old, new, 1)
    print("ok", label)


# Locale labels
for a, b in [
    (
        "tab_banner_timeline:'Unit Assembly'",
        "tab_banner_timeline:'Unit Assembly',tab_gacha_sim:'Gacha Sim'",
    ),
    (
        "tab_banner_timeline:'ユニットアセンブリ'",
        "tab_banner_timeline:'ユニットアセンブリ',tab_gacha_sim:'ガチャシミュ'",
    ),
    (
        "tab_banner_timeline:'機體組裝'",
        "tab_banner_timeline:'機體組裝',tab_gacha_sim:'抽卡模擬'",
    ),
]:
    c = src.count(a)
    print("label count", c)
    if c:
        src = src.replace(a, b)

must_replace(
    "setNavTabText('navBannerTimelineTab',t('tab_banner_timeline'));setNavTabText('navInvestmentTab',t('tab_investment'));",
    "setNavTabText('navBannerTimelineTab',t('tab_banner_timeline'));setNavTabText('navGachaSimTab',t('tab_gacha_sim'));setNavTabText('navInvestmentTab',t('tab_investment'));",
    "applyLang nav",
)

must_replace(
    "async function loadInvestmentPriority(){await ensureSpInvestmentLoaded();if(S.currentTab==='investment_priority')armScrollTopFabBaseline();if(window.GgenSpInvestment&&typeof GgenSpInvestment.onTabShown==='function'){await GgenSpInvestment.onTabShown();GgenSpInvestment._ready=true}}",
    "async function loadInvestmentPriority(){await ensureSpInvestmentLoaded();if(S.currentTab==='investment_priority')armScrollTopFabBaseline();if(window.GgenSpInvestment&&typeof GgenSpInvestment.onTabShown==='function'){await GgenSpInvestment.onTabShown();GgenSpInvestment._ready=true}}\n"
    "function ensureGachaSimLoaded(){if(window.GgenGachaSim)return Promise.resolve(window.GgenGachaSim);const lazy=window.__GGEN_LAZY__;if(lazy&&typeof lazy.ensureGachaSim==='function')return lazy.ensureGachaSim();return Promise.resolve(null)}\n"
    "async function loadGachaSim(){await ensureGachaSimLoaded();if(S.currentTab==='gacha_sim')armScrollTopFabBaseline();if(window.GgenGachaSim&&typeof GgenGachaSim.onTabShown==='function')await GgenGachaSim.onTabShown()}",
    "loadGachaSim",
)

must_replace(
    "investment_priority:'/ip'};",
    "investment_priority:'/ip',gacha_sim:'/gacha-sim'};",
    "MAIN_TAB_PATH_SHORT",
)

must_replace(
    "if(seg.length===1&&seg[0]==='ip')return{kind:'main_tab',tab:'investment_priority'};",
    "if(seg.length===1&&seg[0]==='ip')return{kind:'main_tab',tab:'investment_priority'};\n"
    "if(seg.length===1&&seg[0]==='gacha-sim')return{kind:'main_tab',tab:'gacha_sim'};",
    "parseBrowseShortPath",
)

must_replace(
    "else if(tab==='investment_priority'){armScrollTopFabBaseline();void loadInvestmentPriority()}else if(tab==='calculator')",
    "else if(tab==='investment_priority'){armScrollTopFabBaseline();void loadInvestmentPriority()}else if(tab==='gacha_sim'){armScrollTopFabBaseline();void loadGachaSim()}else if(tab==='calculator')",
    "switchTab branch",
)

must_replace(
    "if(tab!=='investment_priority'&&/^\\/ip\\/?$/.test(location.pathname))replaceHistoryToBrowsePath('/');",
    "if(tab!=='investment_priority'&&/^\\/ip\\/?$/.test(location.pathname))replaceHistoryToBrowsePath('/');"
    "if(tab!=='gacha_sim'&&/^\\/gacha-sim\\/?$/.test(location.pathname))replaceHistoryToBrowsePath('/');",
    "leave path",
)

src = src.replace(
    "S.currentTab==='investment_priority'||S.currentTab==='calculator'||S.currentTab==='team_builder'||S.currentTab==='meta_synergy')",
    "S.currentTab==='investment_priority'||S.currentTab==='gacha_sim'||S.currentTab==='calculator'||S.currentTab==='team_builder'||S.currentTab==='meta_synergy')",
)
print(
    "spotlight/recall",
    src.count("gacha_sim'||S.currentTab==='calculator"),
)

must_replace(
    "if(S.currentTab==='investment_priority')void loadInvestmentPriority();scheduleDeferredContentBootstraps",
    "if(S.currentTab==='investment_priority')void loadInvestmentPriority();if(S.currentTab==='gacha_sim')void loadGachaSim();scheduleDeferredContentBootstraps",
    "boot load",
)

p.write_text(src, encoding="utf-8")
print("wrote", p, "len", len(src))
