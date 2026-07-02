(function () {
  'use strict';

  const root = document.getElementById('kofiAdminRoot');
  if (!root) return;

  let state = null;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function setMsg(text, kind) {
    const el = root.querySelector('.kofi-admin-msg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
  }

  async function fetchStatus() {
    const r = await fetch('/api/kofi/notice/admin/status', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!r.ok) throw new Error('status ' + r.status);
    return r.json();
  }

  async function unlock(password) {
    const r = await fetch('/api/kofi/notice/unlock', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    });
    const d = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) throw new Error(d.error || 'unlock failed');
    return d;
  }

  async function setNotice(enabled) {
    const r = await fetch('/api/kofi/notice/set', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !!enabled }),
    });
    const d = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) throw new Error(d.error || 'update failed');
    return d;
  }

  function renderLogin() {
    root.innerHTML =
      '<form class="kofi-admin-login" id="kofiAdminLogin">' +
      '<label for="kofiAdminPassword">Admin password</label>' +
      '<input id="kofiAdminPassword" type="password" autocomplete="current-password" required>' +
      '<button type="submit" class="kofi-admin-btn">Unlock</button>' +
      '</form>' +
      '<div class="kofi-admin-msg"></div>';
    root.querySelector('#kofiAdminLogin').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      const pw = root.querySelector('#kofiAdminPassword').value;
      setMsg('Checking…', '');
      try {
        await unlock(pw);
        setMsg('Unlocked.', 'ok');
        await refresh();
      } catch (e) {
        setMsg(e.message === 'invalid_password' ? 'Wrong password.' : 'Could not unlock.', 'error');
      }
    });
  }

  function renderPanel(data) {
    const on = !!data.notice_enabled;
    root.innerHTML =
      '<div class="kofi-admin-status">' +
      '<div>Notice: <strong>' +
      (on ? 'ON — visitors see the red flare' : 'OFF') +
      '</strong></div>' +
      '<div>Version: <strong>' +
      esc(String(data.notice_version || 0)) +
      '</strong></div>' +
      '</div>' +
      '<div class="kofi-admin-actions">' +
      '<button type="button" class="kofi-admin-btn" id="kofiAdminEnable"' +
      (on ? ' disabled' : '') +
      '>Show notice</button>' +
      '<button type="button" class="kofi-admin-btn kofi-admin-btn--off" id="kofiAdminDisable"' +
      (!on ? ' disabled' : '') +
      '>Hide notice</button>' +
      '</div>' +
      '<div class="kofi-admin-msg"></div>';

    root.querySelector('#kofiAdminEnable').addEventListener('click', function () {
      void toggleNotice(true);
    });
    root.querySelector('#kofiAdminDisable').addEventListener('click', function () {
      void toggleNotice(false);
    });
  }

  function renderNotConfigured() {
    root.innerHTML =
      '<p class="muted">Admin control is not configured on this server. Add <code>GGEN_KOFI_NOTICE_SECRET</code> to Railway environment variables, redeploy, then reload this page.</p>';
  }

  async function toggleNotice(enabled) {
    setMsg(enabled ? 'Turning notice on…' : 'Turning notice off…', '');
    try {
      const d = await setNotice(enabled);
      state = Object.assign({}, state || {}, d);
      renderPanel(state);
      setMsg(enabled ? 'Notice is ON. Visitors will see the flare until they click Ko-fi.' : 'Notice is OFF.', 'ok');
    } catch (e) {
      setMsg('Update failed. Refresh and unlock again.', 'error');
    }
  }

  async function refresh() {
    try {
      state = await fetchStatus();
      if (!state.configured) {
        renderNotConfigured();
        return;
      }
      if (!state.unlocked) {
        renderLogin();
        return;
      }
      renderPanel(state);
    } catch (_) {
      root.innerHTML = '<p class="muted">Could not load admin status.</p>';
    }
  }

  void refresh();
})();
