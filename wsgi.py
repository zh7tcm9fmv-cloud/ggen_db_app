"""
Fast-bind WSGI entry for Railway / gunicorn.

`import app` loads the full master DB and can take tens of seconds. During that
window gunicorn cannot accept connections if the entrypoint is `app:app`, so
browsers sit on a blank screen after deploys or container restarts.

This module binds immediately, serves a tiny boot shell + /health, then swaps
to the real Flask app once `import app` finishes in a background thread.
"""
from __future__ import annotations

import os
import sys
import threading
import time
import traceback

from flask import Flask, jsonify, make_response

_BOOT_STARTED = time.time()
_STATE = {
    'phase': 'starting',  # starting | loading | ready | error
    'error': None,
    'error_detail': None,
    'ready_at': None,
}

_BOOT_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>GGen DB — Starting</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; min-height: 100%; background: #0e1218; color: #e8eef7;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
  body { display: flex; align-items: center; justify-content: center; padding: 2rem; }
  main { max-width: 28rem; text-align: center; }
  h1 { font-size: 1.35rem; font-weight: 650; letter-spacing: 0.02em; margin: 0 0 0.5rem; }
  p { margin: 0.35rem 0; line-height: 1.45; color: #a8b3c4; font-size: 0.95rem; }
  .spin { width: 2.25rem; height: 2.25rem; margin: 0 auto 1.25rem; border-radius: 50%;
    border: 3px solid #2a3545; border-top-color: #7eb6ff; animation: r 0.85s linear infinite; }
  @keyframes r { to { transform: rotate(360deg); } }
  .err { color: #ffb4b4; white-space: pre-wrap; text-align: left; font-size: 0.85rem;
    background: #1a1214; border: 1px solid #5a3030; border-radius: 8px; padding: 0.75rem; margin-top: 1rem; }
</style>
</head>
<body>
<main>
  <div class="spin" aria-hidden="true"></div>
  <h1>GGen DB is starting</h1>
  <p id="msg">Loading game data after a server restart. This usually takes under a minute — the page will open automatically.</p>
  <p id="age"></p>
  <div id="err" class="err" hidden></div>
</main>
<script>
(function () {
  var msg = document.getElementById('msg');
  var age = document.getElementById('age');
  var err = document.getElementById('err');
  var t0 = Date.now();
  function tickAge() {
    var s = Math.round((Date.now() - t0) / 1000);
    age.textContent = 'Waiting… ' + s + 's';
  }
  tickAge();
  setInterval(tickAge, 1000);
  function poll() {
    fetch('/health', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.booting === false && d.ok !== false) {
        msg.textContent = 'Ready — opening…';
        location.reload();
        return;
      }
      if (d && d.phase === 'error') {
        msg.textContent = 'Startup failed. Please try again in a moment.';
        err.hidden = false;
        err.textContent = d.error || 'Unknown error';
        return;
      }
      setTimeout(poll, 1500);
    }).catch(function () { setTimeout(poll, 2000); });
  }
  setTimeout(poll, 800);
})();
</script>
</body>
</html>
"""


def _make_boot_app() -> Flask:
    boot = Flask('ggen_boot')

    @boot.route('/health')
    def health():
        payload = {
            'ok': True,
            'booting': True,
            'phase': _STATE['phase'],
            'uptime_s': round(time.time() - _BOOT_STARTED, 1),
        }
        if _STATE['error']:
            payload['ok'] = False
            payload['error'] = _STATE['error']
        return jsonify(payload), 200

    @boot.route('/', defaults={'path': ''})
    @boot.route('/<path:path>')
    def shell(path: str):
        # Prefer real static files if present (favicon etc.) without waiting for DB.
        if path.startswith('static/'):
            try:
                from flask import send_from_directory
                root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
                rel = path[len('static/') :].replace('\\', '/')
                if rel and not any(seg == '..' for seg in rel.split('/')):
                    return send_from_directory(root, rel)
            except Exception:
                pass
        if path.startswith('api/'):
            return jsonify({
                'error': 'warming_up',
                'retry_after': 2,
                'phase': _STATE['phase'],
            }), 503
        resp = make_response(_BOOT_HTML)
        resp.headers['Content-Type'] = 'text/html; charset=utf-8'
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        return resp

    return boot


class BootDispatcher:
    """WSGI app that switches from boot shell → real Flask app when DB import finishes."""

    def __init__(self):
        self.boot_app = _make_boot_app()
        self.real_app = None
        self._load_started = False

    def __call__(self, environ, start_response):
        app = self.real_app
        if app is not None:
            return app(environ, start_response)
        return self.boot_app(environ, start_response)

    def start_background_load(self):
        if self._load_started:
            return
        self._load_started = True

        def _run():
            _STATE['phase'] = 'loading'
            print('wsgi: background import of app starting…', flush=True)
            t0 = time.perf_counter()
            try:
                import app as real_mod  # noqa: WPS433 — intentional late import
                self.real_app = real_mod.app
                _STATE['phase'] = 'ready'
                _STATE['ready_at'] = time.time()
                print(f'wsgi: app ready in {time.perf_counter() - t0:.1f}s', flush=True)
            except Exception as e:
                _STATE['phase'] = 'error'
                _STATE['error'] = str(e)
                _STATE['error_detail'] = traceback.format_exc()
                print('wsgi: app import FAILED', file=sys.stderr, flush=True)
                traceback.print_exc()

        threading.Thread(target=_run, name='ggen-db-load', daemon=True).start()


application = BootDispatcher()
application.start_background_load()

# Local convenience: `python wsgi.py` (production uses gunicorn wsgi:application)
if __name__ == '__main__':
    port = int(os.environ.get('PORT') or os.environ.get('FLASK_PORT') or '5000')
    # werkzeug server can host the dispatcher directly
    from werkzeug.serving import run_simple
    run_simple('0.0.0.0', port, application, use_reloader=False, threaded=True)
