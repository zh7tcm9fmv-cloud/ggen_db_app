#!/usr/bin/env python3
"""GGen Load Performance — desktop audit UI matching the Cursor canvas layout.

No browser. Press Update to probe live (optional local). Sections mirror
canvases/ggen-load-performance.canvas.tsx: pills, verdict, 8 stats, bar chart,
steady / critical / matrix / RSS / adaptive / deploy-gate tables.

Usage:
  py -3.14 scripts/load_perf_dashboard_app.py
  scripts\\Load_Perf.bat
"""
from __future__ import annotations

import argparse
import sys
import threading
from pathlib import Path
from tkinter import Canvas

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

try:
    import customtkinter as ctk
except ModuleNotFoundError:
    print(
        "customtkinter is required (same as GGen App Update).\n"
        "  py -3.14 -m pip install customtkinter\n"
        "  py -3.14 scripts/load_perf_dashboard_app.py",
        file=sys.stderr,
    )
    sys.exit(1)

from load_perf_lib import (  # noqa: E402
    LIVE_BASE,
    LOCAL_BASE,
    LOCAL_RANGE_EX_CANARY_UID,
    build_dashboard,
    build_verdict,
    chart_bars,
    load_history,
    load_report,
    restart_local_flask,
    run_audit,
    save_report,
)

# Match canvas dark theme from the screenshot
BG = "#181818"
PANEL = "#1f1f1f"
BORDER = "#333333"
TEXT = "#f0f0f0"
MUTED = "#9a9a9a"
OK = "#45a081"
WARN = "#c2996b"
DANGER = "#f07178"
CHART = "#5eead4"
PILL_BG = "#2a2a2a"
ACCENT = "#5eead4"


def _enrich_report(report: dict | None) -> dict | None:
    if not report or not isinstance(report, dict):
        return report
    live = report.get("live") or {}
    if not live:
        return report
    insights = report.get("insights") or []
    if not report.get("verdict"):
        report["verdict"] = build_verdict(live, insights)
    if not report.get("chart_bars"):
        report["chart_bars"] = chart_bars(live)
    if not report.get("dashboard"):
        hist = report.get("history") or load_history()
        report["dashboard"] = build_dashboard(
            live,
            report.get("local") if (report.get("local") or {}).get("steady") else report.get("local"),
            hist,
        )
    return report


def _tone(t: str | None) -> str:
    return {"ok": OK, "success": OK, "warn": WARN, "warning": WARN, "bad": DANGER, "danger": DANGER}.get(
        t or "", TEXT
    )


class LoadPerfApp(ctk.CTk):
    def __init__(self, live_base: str, local_base: str) -> None:
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.title("GGen load performance")
        self.geometry("960x920")
        self.minsize(820, 700)
        self.configure(fg_color=BG)

        self._live_base = live_base.rstrip("/")
        self._local_base = local_base.rstrip("/")
        self._busy = False
        self._include_local = ctk.BooleanVar(value=True)
        self._include_matrix = ctk.BooleanVar(value=True)
        self._stat_labels: dict[str, ctk.CTkLabel] = {}
        self._pill_frame: ctk.CTkFrame | None = None
        self._table_hosts: dict[str, ctk.CTkFrame] = {}

        self._build()
        last = _enrich_report(load_report())
        if last:
            self._apply_report(last, error=None)

    def _build(self) -> None:
        # Top action strip — Restart first so local code changes are easy to pick up
        action = ctk.CTkFrame(self, fg_color=PANEL, corner_radius=10, border_width=1, border_color=BORDER)
        action.pack(fill="x", padx=20, pady=(14, 0))
        action_inner = ctk.CTkFrame(action, fg_color="transparent")
        action_inner.pack(fill="x", padx=12, pady=10)
        self.restart_btn = ctk.CTkButton(
            action_inner,
            text="Restart local flask",
            height=40,
            width=200,
            fg_color="#3b6ea5",
            hover_color="#2f5a87",
            text_color="#f5f8fc",
            font=("Segoe UI", 14, "bold"),
            command=self.run_restart_local,
        )
        self.restart_btn.pack(side="left")
        self.restart_status = ctk.CTkLabel(
            action_inner,
            text="Kills :5000 → python wsgi.py → waits /health → Range-5 EX canary (no SSP)",
            font=("Segoe UI", 11),
            text_color=MUTED,
            anchor="w",
            justify="left",
            wraplength=680,
        )
        self.restart_status.pack(side="left", fill="x", expand=True, padx=(14, 0))

        top = ctk.CTkFrame(self, fg_color=BG)
        top.pack(fill="x", padx=20, pady=(12, 0))

        left = ctk.CTkFrame(top, fg_color="transparent")
        left.pack(side="left", fill="both", expand=True)
        ctk.CTkLabel(
            left,
            text="GGen load performance",
            font=("Segoe UI", 26, "bold"),
            text_color=TEXT,
            anchor="w",
        ).pack(fill="x")
        self.sub = ctk.CTkLabel(
            left,
            text="On-demand live audit · press Update · no browser",
            font=("Segoe UI", 12),
            text_color=MUTED,
            anchor="w",
        )
        self.sub.pack(fill="x", pady=(2, 0))

        right = ctk.CTkFrame(top, fg_color="transparent")
        right.pack(side="right")
        ctk.CTkCheckBox(
            right,
            text="Compare local :5000",
            variable=self._include_local,
            font=("Segoe UI", 12),
            text_color=MUTED,
            fg_color=OK,
            hover_color=OK,
            border_color=BORDER,
        ).pack(anchor="e", pady=2)
        ctk.CTkCheckBox(
            right,
            text="Include /tm /dm APIs",
            variable=self._include_matrix,
            font=("Segoe UI", 12),
            text_color=MUTED,
            fg_color=OK,
            hover_color=OK,
            border_color=BORDER,
        ).pack(anchor="e", pady=2)
        self.update_btn = ctk.CTkButton(
            right,
            text="Update",
            height=40,
            width=130,
            fg_color=OK,
            hover_color="#3a8f72",
            text_color="#041018",
            font=("Segoe UI", 15, "bold"),
            command=self.run_update,
        )
        self.update_btn.pack(anchor="e", pady=(8, 0))

        self._pill_frame = ctk.CTkFrame(self, fg_color="transparent")
        self._pill_frame.pack(fill="x", padx=20, pady=(10, 8))

        scroll = ctk.CTkScrollableFrame(self, fg_color=BG, scrollbar_button_color=BORDER)
        scroll.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self._scroll = scroll

        # Verdict
        self.verdict_frame = ctk.CTkFrame(
            scroll, fg_color="#1a2420", corner_radius=10, border_width=1, border_color=OK
        )
        self.verdict_frame.pack(fill="x", padx=8, pady=(0, 12))
        self.verdict_title = ctk.CTkLabel(
            self.verdict_frame,
            text="Press Update to audit live",
            font=("Segoe UI", 15, "bold"),
            text_color=OK,
            anchor="w",
            justify="left",
            wraplength=880,
        )
        self.verdict_title.pack(fill="x", padx=14, pady=(12, 4))
        self.verdict_body = ctk.CTkLabel(
            self.verdict_frame,
            text="Same sections as the Cursor canvas: stats, warm TTFB chart, steady, critical path, matrix, RSS history, adaptive fingerprint, deploy gate.",
            font=("Segoe UI", 12),
            text_color=TEXT,
            anchor="w",
            justify="left",
            wraplength=880,
        )
        self.verdict_body.pack(fill="x", padx=14, pady=(0, 12))

        # Stats rows
        self._stats_row1 = ctk.CTkFrame(scroll, fg_color="transparent")
        self._stats_row1.pack(fill="x", padx=8, pady=(0, 8))
        self._stats_row2 = ctk.CTkFrame(scroll, fg_color="transparent")
        self._stats_row2.pack(fill="x", padx=8, pady=(0, 12))
        for row, keys in (
            (self._stats_row1, ("rss", "body", "unit", "bsp")),
            (self._stats_row2, ("prior_rss", "prior_body", "char", "health")),
        ):
            labels = {
                "rss": "Live RSS",
                "body": "Body cache",
                "unit": "Unit warm p50",
                "bsp": "BSP warm p50",
                "prior_rss": "Prior Update RSS",
                "prior_body": "Prior body cache",
                "char": "Char warm p50",
                "health": "/health after",
            }
            for i, key in enumerate(keys):
                cell = ctk.CTkFrame(row, fg_color=PANEL, corner_radius=8, border_width=1, border_color=BORDER)
                cell.pack(side="left", expand=True, fill="both", padx=(0 if i == 0 else 8, 0))
                ctk.CTkLabel(cell, text=labels[key], font=("Segoe UI", 11), text_color=MUTED, anchor="w").pack(
                    fill="x", padx=12, pady=(10, 0)
                )
                val = ctk.CTkLabel(cell, text="—", font=("Segoe UI", 24, "bold"), text_color=OK, anchor="w")
                val.pack(fill="x", padx=12, pady=(2, 12))
                self._stat_labels[key] = val

        # Chart
        chart_box = ctk.CTkFrame(scroll, fg_color=PANEL, corner_radius=10, border_width=1, border_color=BORDER)
        chart_box.pack(fill="x", padx=8, pady=(0, 14))
        ctk.CTkLabel(
            chart_box,
            text="Settled warm TTFB (ms)",
            font=("Segoe UI", 13, "bold"),
            text_color=MUTED,
            anchor="w",
        ).pack(fill="x", padx=14, pady=(12, 4))
        self.chart = Canvas(chart_box, height=240, bg=PANEL, highlightthickness=0, bd=0)
        self.chart.pack(fill="x", padx=10, pady=(0, 4))
        self.chart_cap = ctk.CTkLabel(
            chart_box,
            text="Source: this Update run · Y-axis = response time (ms)",
            font=("Segoe UI", 11),
            text_color=MUTED,
            anchor="w",
            wraplength=880,
            justify="left",
        )
        self.chart_cap.pack(fill="x", padx=14, pady=(0, 12))
        # Scroll jank: CTkScrollableFrame fires Configure on the canvas while
        # scrolling; redrawing every tick freezes the wheel. Only redraw on width change.
        self._chart_drawn_w = 0
        self._chart_configure_after: str | None = None
        self.chart.bind("<Configure>", self._on_chart_configure)

        # Tables
        for key, title in (
            ("steady", "Steady warm detail / BSP"),
            ("critical", "Critical path cold vs warm (ms)"),
            ("matrix", "/tm /dm matrix APIs (ms)"),
            ("rss", "RSS / body cache (Update history)"),
            ("adaptive", "Adaptive / cache fingerprint"),
            ("gate", "Deploy gate"),
            ("compare", "Live vs local warm (ms)"),
            ("caveats", "Honest caveats"),
        ):
            box = ctk.CTkFrame(scroll, fg_color=PANEL, corner_radius=10, border_width=1, border_color=BORDER)
            box.pack(fill="x", padx=8, pady=(0, 12))
            ctk.CTkLabel(
                box, text=title, font=("Segoe UI", 14, "bold"), text_color=TEXT, anchor="w"
            ).pack(fill="x", padx=14, pady=(12, 6))
            host = ctk.CTkFrame(box, fg_color="transparent")
            host.pack(fill="x", padx=10, pady=(0, 12))
            self._table_hosts[key] = host

    def _clear_host(self, key: str) -> None:
        host = self._table_hosts[key]
        for w in host.winfo_children():
            w.destroy()

    def _render_table(self, key: str, headers: list[str], rows: list[list[str]], tones: list[str] | None = None) -> None:
        self._clear_host(key)
        host = self._table_hosts[key]
        if not rows:
            ctk.CTkLabel(host, text="No data yet — press Update.", text_color=MUTED, font=("Segoe UI", 12)).pack(
                anchor="w", padx=4
            )
            return
        grid = ctk.CTkFrame(host, fg_color="transparent")
        grid.pack(fill="x")
        for c, h in enumerate(headers):
            ctk.CTkLabel(
                grid,
                text=h,
                font=("Segoe UI", 11, "bold"),
                text_color=MUTED,
                anchor="w",
            ).grid(row=0, column=c, sticky="ew", padx=6, pady=(0, 4))
        for r, row in enumerate(rows, start=1):
            tone = (tones[r - 1] if tones and r - 1 < len(tones) else None)
            color = _tone(tone) if tone else TEXT
            for c, cell in enumerate(row):
                ctk.CTkLabel(
                    grid,
                    text=str(cell),
                    font=("Consolas", 12) if c > 0 else ("Segoe UI", 12),
                    text_color=color if c == len(row) - 1 and tone else TEXT,
                    anchor="w",
                ).grid(row=r, column=c, sticky="ew", padx=6, pady=2)
        for c in range(len(headers)):
            grid.grid_columnconfigure(c, weight=1)

    def _set_pills(self, pills: list[dict]) -> None:
        assert self._pill_frame is not None
        for w in self._pill_frame.winfo_children():
            w.destroy()
        if not pills:
            return
        for p in pills:
            active = bool(p.get("active"))
            lab = ctk.CTkLabel(
                self._pill_frame,
                text=f"  {p.get('text') or ''}  ",
                font=("Segoe UI", 11),
                text_color=OK if active else MUTED,
                fg_color=PILL_BG,
                corner_radius=999,
            )
            lab.pack(side="left", padx=(0, 8), pady=2)

    def _set_busy(self, busy: bool) -> None:
        self._busy = busy
        self.update_btn.configure(state="disabled" if busy else "normal")
        self.update_btn.configure(text="Running…" if busy else "Update")
        if hasattr(self, "restart_btn"):
            self.restart_btn.configure(state="disabled" if busy else "normal")
            self.restart_btn.configure(text="Restarting…" if busy else "Restart local flask")

    def run_restart_local(self) -> None:
        if self._busy:
            return
        self._set_busy(True)
        self.restart_status.configure(
            text="Stopping :5000 and starting wsgi.py — waiting for Database ready…",
            text_color=ACCENT,
        )
        self.verdict_title.configure(text="Restarting local Flask…", text_color=ACCENT)
        self.verdict_body.configure(
            text="Kill listeners on :5000 → python wsgi.py → /health ready → "
            f"canary {LOCAL_RANGE_EX_CANARY_UID} in Seed+Range5 without SSP."
        )

        def work() -> None:
            err = None
            result: dict | None = None
            try:
                result = restart_local_flask(base=self._local_base)
            except Exception as e:
                err = str(e)[:400]

            def done() -> None:
                ok = bool(result and result.get("ok"))
                msg = ""
                if result:
                    msg = result.get("message") or result.get("err") or ""
                if err:
                    msg = (msg + " · " if msg else "") + err
                if ok:
                    self.restart_status.configure(text=msg or "Local Flask ready.", text_color=OK)
                    self.verdict_title.configure(text="Local Flask restarted", text_color=OK)
                    canary = (result or {}).get("canary") or {}
                    self.verdict_body.configure(
                        text=(
                            f"pid {(result or {}).get('pid')} · canary uid {LOCAL_RANGE_EX_CANARY_UID} "
                            f"present={canary.get('present')} total={canary.get('total')} · "
                            "Hard-refresh the browser (Ctrl+F5) so InstantBrowse picks up app.min.js."
                        )
                    )
                else:
                    self.restart_status.configure(text=msg or "Restart failed.", text_color=DANGER)
                    self.verdict_title.configure(text="Local Flask restart failed", text_color=DANGER)
                    self.verdict_body.configure(text=msg or "See restart status.")
                self._set_busy(False)

            self.after(0, done)

        threading.Thread(target=work, name="load-perf-restart-flask", daemon=True).start()

    def _on_chart_configure(self, event) -> None:
        # Ignore height-only Configure events from the scrollable parent.
        w = int(getattr(event, "width", 0) or 0)
        if w <= 1 or w == self._chart_drawn_w:
            return
        if self._chart_configure_after is not None:
            try:
                self.after_cancel(self._chart_configure_after)
            except Exception:
                pass
        self._chart_configure_after = self.after(
            80, lambda: self._redraw_chart(getattr(self, "_bars", []))
        )

    def _redraw_chart(self, bars: list) -> None:
        self._bars = bars or []
        self._chart_configure_after = None
        c = self.chart
        c.delete("all")
        w = max(int(c.winfo_width()), 40)
        self._chart_drawn_w = w
        h = max(int(c.winfo_height()), 120)
        if not self._bars:
            c.create_text(w // 2, h // 2, text="No chart data yet — press Update", fill=MUTED, font=("Segoe UI", 12))
            return
        # Y grid like canvas
        pad_l, pad_r, pad_t, pad_b = 36, 8, 22, 40
        plot_w = w - pad_l - pad_r
        plot_h = h - pad_t - pad_b
        max_ms = max(int(b.get("ms") or 0) for b in self._bars) or 1
        # nice max ~ next 200
        y_max = max(200, ((max_ms + 199) // 200) * 200)
        for tick in range(0, y_max + 1, max(1, y_max // 3)):
            y = pad_t + plot_h - (tick / y_max) * plot_h
            c.create_line(pad_l, y, w - pad_r, y, fill="#2a2a2a")
            c.create_text(pad_l - 6, y, text=str(tick), fill=MUTED, font=("Segoe UI", 8), anchor="e")
        n = len(self._bars)
        gap = 10
        bar_w = max(14, (plot_w - gap * (n - 1)) // n)
        for i, b in enumerate(self._bars):
            ms = int(b.get("ms") or 0)
            bh = max(2, int(plot_h * (ms / y_max)))
            x0 = pad_l + i * (bar_w + gap)
            x1 = x0 + bar_w
            y1 = pad_t + plot_h
            y0 = y1 - bh
            c.create_rectangle(x0, y0, x1, y1, fill=CHART, outline="")
            c.create_text((x0 + x1) / 2, y0 - 10, text=str(ms), fill=TEXT, font=("Consolas", 10, "bold"))
            lab = str(b.get("label") or "")
            if len(lab) > 16:
                lab = lab[:15] + "…"
            c.create_text((x0 + x1) / 2, h - 14, text=lab, fill=MUTED, font=("Segoe UI", 8))

    def _apply_report(self, report: dict, error: str | None) -> None:
        report = _enrich_report(report) or {}
        dash = report.get("dashboard") or {}
        at = report.get("at") or ""
        host = self._live_base.replace("https://", "").replace("http://", "")
        if at:
            self.sub.configure(text=f"Live audit · {at} · {host}")

        self._set_pills(list(dash.get("pills") or []))

        v = report.get("verdict") or {}
        tone = v.get("tone") or "ok"
        self.verdict_title.configure(text=v.get("title") or "No verdict", text_color=_tone(tone))
        body = v.get("body") or ""
        if error:
            body = f"ERROR: {error}\n{body}"
        self.verdict_body.configure(text=body)
        border = {"ok": OK, "warn": WARN, "bad": DANGER}.get(tone, BORDER)
        bg = {"ok": "#1a2420", "warn": "#242018", "bad": "#241818"}.get(tone, PANEL)
        self.verdict_frame.configure(border_color=border, fg_color=bg)

        by_key = {}
        for s in list(dash.get("stats_primary") or []) + list(dash.get("stats_secondary") or []):
            by_key[s.get("key")] = s
        for key, lab in self._stat_labels.items():
            s = by_key.get(key) or {}
            lab.configure(text=str(s.get("value") or "—"), text_color=_tone(s.get("tone") or "ok"))

        self._redraw_chart(report.get("chart_bars") or [])
        self.chart_cap.configure(text=str(dash.get("chart_caption") or "Source: this Update run"))

        # Steady
        steady_rows = [
            [
                str(r.get("metric")),
                str(r.get("n")),
                str(r.get("p50")),
                str(r.get("mean")),
                str(r.get("min")),
                str(r.get("max")),
            ]
            for r in dash.get("steady_rows") or []
        ]
        self._render_table(
            "steady",
            ["Metric", "n", "p50 (ms)", "mean", "min", "max"],
            steady_rows,
        )

        crit = [
            [
                str(r.get("path")),
                "—" if r.get("cold") is None else str(r.get("cold")),
                "—" if r.get("warm") is None else str(r.get("warm")),
                str(r.get("gzip") or "—"),
            ]
            for r in dash.get("critical_rows") or []
        ]
        self._render_table("critical", ["Path", "Cold ms", "Warm ms", "Gzip"], crit)

        mat = [
            [
                str(r.get("path")),
                str(r.get("p50")),
                str(r.get("min")),
                str(r.get("max")),
                str(r.get("gzip") or "—"),
            ]
            for r in dash.get("matrix_rows") or []
        ]
        self._render_table("matrix", ["Board", "p50", "min", "max", "Gzip"], mat)

        rss = [
            [str(r.get("when")), str(r.get("rss")), str(r.get("body")), str(r.get("note"))]
            for r in dash.get("rss_rows") or []
        ]
        self._render_table("rss", ["When", "RSS", "Body cache", "Note"], rss)

        ada = [
            [str(r.get("field")), str(r.get("start")), str(r.get("after")), str(r.get("prior"))]
            for r in dash.get("adaptive_rows") or []
        ]
        self._render_table("adaptive", ["Field", "Audit start", "After warm", "Prior Update"], ada)

        gates = dash.get("gate_rows") or []
        self._render_table(
            "gate",
            ["Check", "Live", "OK?"],
            [[str(g.get("check")), str(g.get("value")), "yes" if g.get("pass") else "NO"] for g in gates],
            tones=["ok" if g.get("pass") else "bad" for g in gates],
        )

        cmp_rows = [
            [
                str(r.get("name")),
                "—" if r.get("live_ms") is None else str(r.get("live_ms")),
                "—" if r.get("local_ms") is None else str(r.get("local_ms")),
            ]
            for r in report.get("compare_rows") or []
        ]
        self._render_table("compare", ["Path", "Live ms", "Local ms"], cmp_rows)

        self._clear_host("caveats")
        host = self._table_hosts["caveats"]
        for line in dash.get("caveats") or []:
            ctk.CTkLabel(
                host, text=f"• {line}", font=("Segoe UI", 12), text_color=TEXT, anchor="w", justify="left", wraplength=880
            ).pack(fill="x", padx=4, pady=2)
        for tip in (report.get("insights") or [])[:6]:
            ctk.CTkLabel(
                host, text=f"• {tip}", font=("Segoe UI", 12), text_color=MUTED, anchor="w", justify="left", wraplength=880
            ).pack(fill="x", padx=4, pady=1)

    def run_update(self) -> None:
        if self._busy:
            return
        self._set_busy(True)
        self.verdict_title.configure(text="Running audit…", text_color=ACCENT)
        self.verdict_body.configure(
            text="Probing live (and local if checked). Matrix adds EN+JA boards — usually 1–3 minutes."
        )
        include_local = bool(self._include_local.get())
        include_matrix = bool(self._include_matrix.get())

        def work() -> None:
            err = None
            report = None
            try:
                report = run_audit(
                    live_base=self._live_base,
                    local_base=self._local_base,
                    include_local=include_local,
                    include_matrix=include_matrix,
                )
                save_report(report)
            except Exception as e:
                err = str(e)[:400]

            def done() -> None:
                if report is not None:
                    self._apply_report(report, error=err)
                elif err:
                    self.verdict_title.configure(text="Audit failed", text_color=DANGER)
                    self.verdict_body.configure(text=err)
                self._set_busy(False)

            self.after(0, done)

        threading.Thread(target=work, name="load-perf-audit", daemon=True).start()


def main() -> None:
    ap = argparse.ArgumentParser(description="GGen Load Performance (desktop, canvas-parity)")
    ap.add_argument("--live", default=LIVE_BASE)
    ap.add_argument("--local", default=LOCAL_BASE)
    args = ap.parse_args()
    app = LoadPerfApp(live_base=args.live, local_base=args.local)
    app.mainloop()


if __name__ == "__main__":
    main()
