(function (global) {
  'use strict';

  var RATING_FIELDS = [
    { key: 'overall', titleKey: 'feedback_q1_title', promptKey: 'feedback_q1_prompt', loKey: 'feedback_q1_lo', hiKey: 'feedback_q1_hi' },
    { key: 'navigation', titleKey: 'feedback_q2_title', promptKey: 'feedback_q2_prompt', loKey: 'feedback_q2_lo', hiKey: 'feedback_q2_hi' },
    { key: 'visual_design', titleKey: 'feedback_q3_title', promptKey: 'feedback_q3_prompt', loKey: 'feedback_q3_lo', hiKey: 'feedback_q3_hi' },
    { key: 'content_quality', titleKey: 'feedback_q4_title', promptKey: 'feedback_q4_prompt', loKey: 'feedback_q4_lo', hiKey: 'feedback_q4_hi' },
    { key: 'page_speed', titleKey: 'feedback_q5_title', promptKey: 'feedback_q5_prompt', loKey: 'feedback_q5_lo', hiKey: 'feedback_q5_hi' },
    { key: 'mobile_experience', titleKey: 'feedback_q6_title', promptKey: 'feedback_q6_prompt', loKey: 'feedback_q6_lo', hiKey: 'feedback_q6_hi' },
    { key: 'functionality', titleKey: 'feedback_q7_title', promptKey: 'feedback_q7_prompt', loKey: 'feedback_q7_lo', hiKey: 'feedback_q7_hi' }
  ];

  var TOOL_USAGE_FIELDS = [
    { key: 'damage_sim_usage', titleKey: 'feedback_q8_damage_title', promptKey: 'feedback_q8_damage_prompt', loKey: 'feedback_q8_lo', hiKey: 'feedback_q8_hi' },
    { key: 'team_builder_usage', titleKey: 'feedback_q8_team_title', promptKey: 'feedback_q8_team_prompt', loKey: 'feedback_q8_lo', hiKey: 'feedback_q8_hi' }
  ];

  var LANG_STORAGE_KEY = 'ggen_lang';
  var _pageLang = null;
  var _appLang = null;
  var _langLockedByUser = false;
  var _pageLanguages = ['EN', 'TW', 'HK', 'JP'];

  function isStandaloneFeedbackPage() {
    return !!document.getElementById('siteFeedbackLangBtn');
  }

  var EN_FALLBACK = (typeof global.GGEN_FEEDBACK_I18N !== 'undefined' && global.GGEN_FEEDBACK_I18N.EN)
    ? global.GGEN_FEEDBACK_I18N.EN
    : {
    feedback_page_doc_title: 'Feedback — GGen Database',
    feedback_esc_hint: 'Press Esc to return to the database.',
    feedback_title: 'How was your experience on our website?',
    feedback_intro: 'Rate each area from 1 (lowest) to 5 (highest). Your answers help us improve GGen Database.',
    feedback_q1_title: 'Overall Experience',
    feedback_q1_prompt: 'How would you rate your overall experience on our website?',
    feedback_q1_lo: 'Very Poor',
    feedback_q1_hi: 'Excellent',
    feedback_q2_title: 'Ease of Navigation',
    feedback_q2_prompt: 'How easy was it to find what you were looking for?',
    feedback_q2_lo: 'Very Difficult',
    feedback_q2_hi: 'Very Easy',
    feedback_q3_title: 'Visual Design',
    feedback_q3_prompt: 'How would you rate the visual design and layout of the website?',
    feedback_q3_lo: 'Poor',
    feedback_q3_hi: 'Excellent',
    feedback_q4_title: 'Content Quality',
    feedback_q4_prompt: 'How useful, clear, and relevant was the information on the website?',
    feedback_q4_lo: 'Not Useful',
    feedback_q4_hi: 'Extremely Useful',
    feedback_q5_title: 'Page Loading Speed',
    feedback_q5_prompt: 'How fast did the pages load?',
    feedback_q5_lo: 'Very Slow',
    feedback_q5_hi: 'Very Fast',
    feedback_q6_title: 'Mobile Experience',
    feedback_q6_prompt: 'How well did the website work on your mobile/tablet?',
    feedback_q6_lo: 'Poor',
    feedback_q6_hi: 'Excellent',
    feedback_q7_title: 'Functionality & Reliability',
    feedback_q7_prompt: 'Did you encounter any bugs, broken links, or technical issues?',
    feedback_q7_lo: 'Many issues',
    feedback_q7_hi: 'No issues at all',
    feedback_q8_section_title: 'Tool usage',
    feedback_q8_damage_title: 'Damage Simulator',
    feedback_q8_damage_prompt: 'How often do you use the Damage Simulator?',
    feedback_q8_team_title: 'Team Builder',
    feedback_q8_team_prompt: 'How often do you use the Team Builder?',
    feedback_q8_lo: 'Never',
    feedback_q8_hi: 'Very often',
    feedback_device_label: 'Which device(s) did you use?',
    feedback_device_prompt: 'Select all that apply. Desktop/PC only skips the mobile experience question.',
    feedback_device_desktop: 'Desktop/PC',
    feedback_device_mobile: 'Mobile',
    feedback_device_tablet: 'Tablet',
    feedback_mobile_optout_hint: 'Mobile experience skipped — desktop/PC only.',
    feedback_liked_label: 'What did you like most about the website?',
    feedback_improve_label: 'What new features would you like to see implemented?',
    feedback_improve_prompt: 'Please describe the feature or issue in detail (what it should do, why it would be useful, and any specific requirements you have).',
    feedback_submit: 'Submit feedback',
    feedback_submitting: 'Sending…',
    feedback_success: 'Thank you — your feedback was submitted.',
    feedback_err_required: 'Please rate every required question from 1 to 5.',
    feedback_err_devices: 'Please select at least one device.',
    feedback_err_submit: 'Could not submit feedback. Please try again later.',
    feedback_err_rate_limit: 'You already submitted feedback recently. Please try again later.',
    feedback_privacy_note: 'Anonymous feedback only — no account required.',
    feedback_close: 'Close'
  };

  function normalizeLang(code) {
    var l = String(code || 'EN').trim().toUpperCase();
    if (l === 'JA') return 'JP';
    return l;
  }

  function readPersistedLang() {
    try {
      var s = localStorage.getItem(LANG_STORAGE_KEY);
      return s && String(s).trim() ? normalizeLang(s) : '';
    } catch (e) {
      return '';
    }
  }

  (function initSavedPageLang() {
    var saved = readPersistedLang();
    if (saved) _pageLang = saved;
  })();

  function persistPageLang(l) {
    try {
      if (l) localStorage.setItem(LANG_STORAGE_KEY, l === 'JP' ? 'JA' : String(l));
    } catch (e) {}
  }

  function readMainAppLangLabel() {
    try {
      var el = document.getElementById('langLabel');
      if (el && el.textContent) return normalizeLang(el.textContent);
    } catch (e) {}
    return '';
  }

  function currentLang() {
    if (isStandaloneFeedbackPage()) {
      if (_pageLang) return normalizeLang(_pageLang);
      var savedPage = readPersistedLang();
      if (savedPage) return savedPage;
    } else {
      if (_appLang) return normalizeLang(_appLang);
      if (global.S && global.S.lang) return normalizeLang(global.S.lang);
      var fromLabel = readMainAppLangLabel();
      if (fromLabel) return fromLabel;
      if (_pageLang) return normalizeLang(_pageLang);
    }
    return readPersistedLang() || 'EN';
  }

  function feedbackPack(lang) {
    var packs = global.GGEN_FEEDBACK_I18N;
    if (!packs) return EN_FALLBACK;
    var l = normalizeLang(lang);
    if (l === 'JP') return packs.JP || packs.JA || packs.EN || EN_FALLBACK;
    if (l === 'JA') return packs.JP || packs.JA || packs.EN || EN_FALLBACK;
    return packs[l] || packs.EN || EN_FALLBACK;
  }

  function trKey(key, lang) {
    var pack = feedbackPack(lang || currentLang());
    if (pack && pack[key] != null && pack[key] !== '') return pack[key];
    if (typeof global.t === 'function') {
      var v = global.t(key);
      if (v && v !== key) return v;
    }
    var en = (global.GGEN_FEEDBACK_I18N && global.GGEN_FEEDBACK_I18N.EN) || EN_FALLBACK;
    return (en && en[key]) || key;
  }

  function tr(key) {
    return trKey(key, currentLang());
  }

  function allRatingFields() {
    return RATING_FIELDS.concat(TOOL_USAGE_FIELDS);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function scaleGroupHtml(field, ariaLabel, lang) {
    var radios = '';
    for (var n = 1; n <= 5; n++) {
      var id = 'fb-' + field.key + '-' + n;
      radios += '<span class="site-feedback-radio-cell">';
      radios += '<input class="site-feedback-radio" type="radio" name="fb_' + field.key + '" id="' + id + '" value="' + n + '">';
      radios += '<label class="site-feedback-radio-label" for="' + id + '" data-value="' + n + '">' + n + '</label>';
      radios += '</span>';
    }
    return ''
      + '<div class="site-feedback-scale" role="group" aria-label="' + esc(ariaLabel) + '">'
      + '<div class="site-feedback-radios">' + radios + '</div>'
      + '<div class="site-feedback-scale-ends">'
      + '<span class="site-feedback-scale-end site-feedback-scale-end--lo">' + esc(trKey(field.loKey, lang)) + '</span>'
      + '<span class="site-feedback-scale-end site-feedback-scale-end--hi">' + esc(trKey(field.hiKey, lang)) + '</span>'
      + '</div>'
      + '</div>';
  }

  function ratingBlockHtml(field, idx, lang) {
    return ''
      + '<section class="site-feedback-block" data-fb-field="' + esc(field.key) + '">'
      + '<div class="site-feedback-q-num">' + (idx + 1) + '</div>'
      + '<h3 class="site-feedback-q-title">' + esc(trKey(field.titleKey, lang)) + '</h3>'
      + '<p class="site-feedback-q-prompt">' + esc(trKey(field.promptKey, lang)) + '</p>'
      + scaleGroupHtml(field, trKey(field.titleKey, lang), lang)
      + '</section>';
  }

  function devicesFromForm(form) {
    var devices = [];
    if (!form) return devices;
    form.querySelectorAll('input[name="fb_device"]:checked').forEach(function (el) {
      devices.push(el.value);
    });
    return devices;
  }

  function mobileExperienceRequired(devices) {
    return devices.indexOf('mobile') >= 0 || devices.indexOf('tablet') >= 0;
  }

  function deviceSectionHtml(lang) {
    return ''
      + '<section class="site-feedback-block site-feedback-block--devices" data-fb-field="devices">'
      + '<h3 class="site-feedback-q-title">' + esc(trKey('feedback_device_label', lang)) + '</h3>'
      + '<p class="site-feedback-q-prompt">' + esc(trKey('feedback_device_prompt', lang)) + '</p>'
      + '<div class="site-feedback-device-row" role="group" aria-label="' + esc(trKey('feedback_device_label', lang)) + '">'
      + '<label class="site-feedback-device-opt"><input type="checkbox" name="fb_device" value="desktop"> ' + esc(trKey('feedback_device_desktop', lang)) + '</label>'
      + '<label class="site-feedback-device-opt"><input type="checkbox" name="fb_device" value="mobile"> ' + esc(trKey('feedback_device_mobile', lang)) + '</label>'
      + '<label class="site-feedback-device-opt"><input type="checkbox" name="fb_device" value="tablet"> ' + esc(trKey('feedback_device_tablet', lang)) + '</label>'
      + '</div>'
      + '<p class="site-feedback-device-hint" id="siteFeedbackDeviceHint" hidden>' + esc(trKey('feedback_mobile_optout_hint', lang)) + '</p>'
      + '</section>';
  }

  function clearMobileExperienceAnswers(form) {
    if (!form) return;
    form.querySelectorAll('input[name="fb_mobile_experience"]').forEach(function (el) {
      el.checked = false;
    });
  }

  function renumberFeedbackForm(form, lang) {
    if (!form) return;
    var mobileRequired = mobileExperienceRequired(devicesFromForm(form));
    var L = function (key) { return trKey(key, lang || currentLang()); };
    var n = 0;
    for (var i = 0; i < RATING_FIELDS.length; i++) {
      var field = RATING_FIELDS[i];
      if (field.key === 'mobile_experience') {
        var wrap = form.querySelector('#siteFeedbackMobileQWrap');
        if (wrap) {
          wrap.hidden = !mobileRequired;
          var block = wrap.querySelector('.site-feedback-block');
          if (mobileRequired && block) {
            n += 1;
            var numEl = block.querySelector('.site-feedback-q-num');
            if (numEl) numEl.textContent = n;
          }
        }
        continue;
      }
      var block = form.querySelector('.site-feedback-block[data-fb-field="' + field.key + '"]');
      if (block) {
        n += 1;
        var num = block.querySelector('.site-feedback-q-num');
        if (num) num.textContent = n;
      }
      if (field.key === 'functionality') {
        var tool = form.querySelector('.site-feedback-block[data-fb-field="tool_usage"]');
        if (tool) {
          n += 1;
          var toolNum = tool.querySelector('.site-feedback-q-num');
          if (toolNum) toolNum.textContent = n;
        }
      }
    }
    form.querySelectorAll('.site-feedback-block--open[data-fb-open]').forEach(function (block) {
      n += 1;
      var title = block.querySelector('.site-feedback-q-title');
      if (title) title.textContent = n + '. ' + L(block.getAttribute('data-fb-open'));
    });
  }

  function syncMobileExperienceVisibility(form, lang) {
    if (!form) return;
    var devices = devicesFromForm(form);
    var mobileRequired = mobileExperienceRequired(devices);
    var wrap = form.querySelector('#siteFeedbackMobileQWrap');
    var hint = form.querySelector('#siteFeedbackDeviceHint');
    if (wrap) {
      if (!mobileRequired) clearMobileExperienceAnswers(form);
      wrap.hidden = !mobileRequired;
    }
    if (hint) hint.hidden = !(devices.length > 0 && !mobileRequired);
    renumberFeedbackForm(form, lang);
  }

  function wireDeviceInputs(form, root, lang) {
    function onDeviceChange() {
      syncMobileExperienceVisibility(form, lang);
      preserveScrollHost(root);
    }
    form.querySelectorAll('input[name="fb_device"]').forEach(function (el) {
      el.addEventListener('change', onDeviceChange);
    });
    syncMobileExperienceVisibility(form, lang);
  }

  function toolUsageSectionHtml(sectionNum, lang) {
    var h = ''
      + '<section class="site-feedback-block site-feedback-block--tools" data-fb-field="tool_usage">'
      + '<div class="site-feedback-q-num">' + sectionNum + '</div>'
      + '<h3 class="site-feedback-q-title">' + esc(trKey('feedback_q8_section_title', lang)) + '</h3>';
    for (var i = 0; i < TOOL_USAGE_FIELDS.length; i++) {
      var field = TOOL_USAGE_FIELDS[i];
      h += '<div class="site-feedback-tool-row" data-fb-field="' + esc(field.key) + '">'
        + '<h4 class="site-feedback-q-subtitle">' + esc(trKey(field.titleKey, lang)) + '</h4>'
        + '<p class="site-feedback-q-prompt">' + esc(trKey(field.promptKey, lang)) + '</p>'
        + scaleGroupHtml(field, trKey(field.titleKey, lang), lang)
        + '</div>';
    }
    h += '</section>';
    return h;
  }

  function formHtml(forLang) {
    var lang = normalizeLang(forLang || currentLang());
    function L(key) { return trKey(key, lang); }
    var h = '<form class="site-feedback-form" id="siteFeedbackForm" novalidate>';
    h += '<p class="site-feedback-intro">' + esc(L('feedback_intro')) + '</p>';
    for (var i = 0; i < RATING_FIELDS.length; i++) {
      var field = RATING_FIELDS[i];
      if (field.key === 'mobile_experience') {
        h += deviceSectionHtml(lang);
        h += '<div class="site-feedback-mobile-q-wrap" id="siteFeedbackMobileQWrap" hidden>';
        h += ratingBlockHtml(field, 6, lang);
        h += '</div>';
        continue;
      }
      h += ratingBlockHtml(RATING_FIELDS[i], i + 1, lang);
      if (RATING_FIELDS[i].key === 'functionality') {
        h += toolUsageSectionHtml(8, lang);
      }
    }
    h += '<section class="site-feedback-block site-feedback-block--open" data-fb-open="feedback_liked_label">'
      + '<h3 class="site-feedback-q-title">9. ' + esc(L('feedback_liked_label')) + '</h3>'
      + '<textarea class="site-feedback-textarea" name="fb_liked" rows="4" maxlength="4000" placeholder=""></textarea>'
      + '</section>';
    h += '<section class="site-feedback-block site-feedback-block--open" data-fb-open="feedback_improve_label">'
      + '<h3 class="site-feedback-q-title">10. ' + esc(L('feedback_improve_label')) + '</h3>'
      + '<p class="site-feedback-q-prompt">' + esc(L('feedback_improve_prompt')) + '</p>'
      + '<textarea class="site-feedback-textarea" name="fb_improve" rows="4" maxlength="4000" placeholder=""></textarea>'
      + '</section>';
    h += '<div class="site-feedback-honeypot" aria-hidden="true">'
      + '<label>Website<input type="text" name="fb_website" tabindex="-1" autocomplete="off"></label>'
      + '</div>';
    h += '<p class="site-feedback-msg" id="siteFeedbackMsg" hidden></p>';
    h += '<div class="site-feedback-actions">'
      + '<button type="submit" class="site-feedback-submit" id="siteFeedbackSubmit">' + esc(L('feedback_submit')) + '</button>'
      + '<p class="site-feedback-note">' + esc(L('feedback_privacy_note')) + '</p>'
      + '</div>';
    h += '</form>';
    return h;
  }

  function collectPayload(form) {
    var ratings = {};
    var fields = allRatingFields();
    for (var i = 0; i < fields.length; i++) {
      var key = fields[i].key;
      var sel = form.querySelector('input[name="fb_' + key + '"]:checked');
      ratings[key] = sel ? parseInt(sel.value, 10) : null;
    }
    var devices = [];
    form.querySelectorAll('input[name="fb_device"]:checked').forEach(function (el) {
      devices.push(el.value);
    });
    return {
      ratings: ratings,
      devices: devices,
      liked: (form.querySelector('[name="fb_liked"]') || {}).value || '',
      improve: (form.querySelector('[name="fb_improve"]') || {}).value || '',
      website: (form.querySelector('[name="fb_website"]') || {}).value || '',
      lang: currentLang() === 'JP' ? 'JA' : currentLang(),
      page_url: global.location ? global.location.pathname + global.location.search : ''
    };
  }

  function allRatingsPresent(ratings, devices) {
    if (!devices || !devices.length) return false;
    var mobileRequired = mobileExperienceRequired(devices);
    var fields = allRatingFields();
    for (var i = 0; i < fields.length; i++) {
      var key = fields[i].key;
      if (key === 'mobile_experience' && !mobileRequired) continue;
      var v = ratings[key];
      if (!(v >= 1 && v <= 5)) return false;
    }
    return true;
  }

  function setMessage(form, text, ok) {
    var el = form.querySelector('#siteFeedbackMsg');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'site-feedback-msg';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'site-feedback-msg ' + (ok ? 'site-feedback-msg--ok' : 'site-feedback-msg--err');
  }

  function preserveScrollHost(scrollHost) {
    if (!scrollHost || typeof scrollHost.scrollTop !== 'number') return;
    var top = scrollHost.scrollTop;
    var left = scrollHost.scrollLeft;
    var restore = function () {
      scrollHost.scrollTop = top;
      scrollHost.scrollLeft = left;
    };
    restore();
    requestAnimationFrame(restore);
    requestAnimationFrame(function () { requestAnimationFrame(restore); });
  }

  function wireRatingInputs(form, root) {
    function blockFocusScroll(ev) {
      ev.preventDefault();
    }
    form.querySelectorAll('.site-feedback-radio-label').forEach(function (label) {
      label.addEventListener('mousedown', blockFocusScroll);
      label.addEventListener('click', function () {
        var id = label.getAttribute('for');
        var radio = id ? document.getElementById(id) : null;
        if (!radio) return;
        var wasChecked = radio.checked;
        form.querySelectorAll('input[name="' + radio.name + '"]').forEach(function (peer) {
          peer.checked = false;
        });
        radio.checked = true;
        if (!wasChecked) {
          preserveScrollHost(root);
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
    form.querySelectorAll('.site-feedback-radio').forEach(function (radio) {
      radio.addEventListener('change', function () {
        preserveScrollHost(root);
      });
    });
  }

  function wireForm(root) {
    var form = root.querySelector('#siteFeedbackForm');
    if (!form || form.dataset.fbWired === '1') return form;
    form.dataset.fbWired = '1';
    wireRatingInputs(form, root);
    wireDeviceInputs(form, root, currentLang());
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var payload = collectPayload(form);
      if (payload.website) return;
      if (!payload.devices.length) {
        setMessage(form, tr('feedback_err_devices'), false);
        return;
      }
      if (!allRatingsPresent(payload.ratings, payload.devices)) {
        setMessage(form, tr('feedback_err_required'), false);
        return;
      }
      var btn = form.querySelector('#siteFeedbackSubmit');
      if (btn) {
        btn.disabled = true;
        btn.textContent = tr('feedback_submitting');
      }
      setMessage(form, '', false);
      fetch('/api/feedback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, data: d };
        });
      }).then(function (res) {
        if (res.ok && res.data && res.data.ok) {
          setMessage(form, tr('feedback_success'), true);
          form.reset();
          syncMobileExperienceVisibility(form);
          if (btn) btn.disabled = true;
          return;
        }
        var err = (res.data && res.data.error) || '';
        if (err === 'rate_limited') setMessage(form, tr('feedback_err_rate_limit'), false);
        else setMessage(form, tr('feedback_err_submit'), false);
        if (btn) btn.disabled = false;
      }).catch(function () {
        setMessage(form, tr('feedback_err_submit'), false);
        if (btn) {
          btn.disabled = false;
          btn.textContent = tr('feedback_submit');
        }
      }).finally(function () {
        if (btn && !btn.disabled) btn.textContent = tr('feedback_submit');
      });
    });
    return form;
  }

  function renderInto(container, forLang) {
    if (!container) return null;
    container.innerHTML = formHtml(forLang || currentLang());
    return wireForm(container);
  }

  function applyContactPageShell() {
    if (!isStandaloneFeedbackPage()) return;
    var title = document.getElementById('siteFeedbackPageTitle');
    var intro = document.getElementById('siteFeedbackPageIntro');
    var escHint = document.getElementById('siteFeedbackEscHint');
    if (title) title.textContent = tr('feedback_page_title');
    if (intro) intro.textContent = tr('feedback_page_intro');
    if (escHint) escHint.textContent = tr('feedback_esc_hint');
    document.title = tr('feedback_page_doc_title');
    var htmlLang = currentLang();
    if (htmlLang === 'TW' || htmlLang === 'HK') document.documentElement.lang = 'zh-Hant';
    else if (htmlLang === 'JP') document.documentElement.lang = 'ja';
    else document.documentElement.lang = 'en';
  }

  function renderContactLangDropdown() {
    var dd = document.getElementById('siteFeedbackLangDropdown');
    if (!dd) return;
    var lang = currentLang();
    dd.innerHTML = _pageLanguages.map(function (l) {
      return '<div class="site-feedback-lang-option' + (l === lang ? ' selected' : '') + '" data-lang="' + l + '" role="option">' + l + '</div>';
    }).join('');
  }

  function setContactLang(l) {
    l = normalizeLang(l);
    if (_pageLanguages.indexOf(l) < 0) return;
    _langLockedByUser = true;
    _pageLang = l;
    persistPageLang(l);
    var lab = document.getElementById('siteFeedbackLangLabel');
    if (lab) lab.textContent = l;
    var dd = document.getElementById('siteFeedbackLangDropdown');
    if (dd) dd.classList.remove('active');
    applyContactPageShell();
    var root = document.getElementById('siteFeedbackRoot');
    if (root) refreshLabels(root, l);
    renderContactLangDropdown();
  }

  function wireContactLangUi() {
    var btn = document.getElementById('siteFeedbackLangBtn');
    var dd = document.getElementById('siteFeedbackLangDropdown');
    if (!btn || !dd || btn.dataset.fbLangWired === '1') return;
    btn.dataset.fbLangWired = '1';
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      dd.classList.toggle('active');
    });
    dd.addEventListener('click', function (ev) {
      var opt = ev.target.closest('[data-lang]');
      if (!opt) return;
      setContactLang(opt.getAttribute('data-lang'));
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.site-feedback-lang-selector')) dd.classList.remove('active');
    });
  }

  async function initContactPageLang() {
    var root = document.getElementById('siteFeedbackRoot');
    if (!root) return;
    var def = 'EN';
    try {
      var r = await fetch('/api/languages');
      var d = await r.json();
      var langs = (d && d.languages) || ['EN'];
      _pageLanguages = langs.map(function (l) {
        return normalizeLang(l);
      }).filter(function (l, i, a) { return l && a.indexOf(l) === i; });
      def = normalizeLang(d.default || 'EN');
    } catch (e) {}
    if (!_langLockedByUser) {
      var savedNow = readPersistedLang();
      _pageLang = savedNow && _pageLanguages.indexOf(savedNow) >= 0
        ? savedNow
        : (_pageLanguages.indexOf(def) >= 0 ? def : _pageLanguages[0] || 'EN');
    } else if (_pageLang && _pageLanguages.indexOf(_pageLang) < 0) {
      _pageLang = _pageLanguages.indexOf(def) >= 0 ? def : _pageLanguages[0] || 'EN';
    }
    var lab = document.getElementById('siteFeedbackLangLabel');
    if (lab) lab.textContent = currentLang();
    renderContactLangDropdown();
    wireContactLangUi();
    applyContactPageShell();
  }

  function refreshModalChrome() {
    var title = document.getElementById('siteFeedbackTitleEl');
    var closeBtn = document.getElementById('siteFeedbackCloseBtn');
    if (title) {
      title.innerHTML = '<img class="whats-new-ic" src="' + (typeof global.imgUrl === 'function' ? global.imgUrl('/static/images/UI/UI_Common_MenuIcon_Contact.webp') : '/static/images/UI/UI_Common_MenuIcon_Contact.webp') + '" alt=""> <span>' + esc(tr('feedback_title')) + '</span>';
    }
    if (closeBtn) closeBtn.setAttribute('aria-label', tr('feedback_close'));
  }

  function onLangChange(appLang) {
    if (appLang) _appLang = normalizeLang(appLang);
    applyContactPageShell();
    var lang = currentLang();
    var ov = document.getElementById('siteFeedbackOverlay');
    var body = document.getElementById('siteFeedbackBody');
    if (ov && ov.classList.contains('active') && body) {
      refreshModalChrome();
      refreshLabels(body, lang);
    }
    var root = document.getElementById('siteFeedbackRoot');
    if (root && root.querySelector('#siteFeedbackForm')) refreshLabels(root, lang);
  }

  function refreshLabels(root, forLang) {
    if (!root) return;
    var lang = normalizeLang(forLang || currentLang());
    root.innerHTML = formHtml(lang);
    wireForm(root);
  }

  function syncAppLang(l) {
    _appLang = normalizeLang(l);
  }

  function openModal() {
    var ov = document.getElementById('siteFeedbackOverlay');
    var body = document.getElementById('siteFeedbackBody');
    if (!ov || !body) {
      global.location.href = '/feedback';
      return;
    }
    var langDd = document.getElementById('langDropdown');
    if (langDd) langDd.classList.remove('active');
    refreshModalChrome();
    renderInto(body, currentLang());
    ov.classList.add('active');
    ov.setAttribute('aria-hidden', 'false');
    if (typeof global.applyBackgroundScrollLock === 'function') global.applyBackgroundScrollLock();
  }

  function closeModal() {
    var ov = document.getElementById('siteFeedbackOverlay');
    if (!ov || !ov.classList.contains('active')) return;
    ov.classList.remove('active');
    ov.setAttribute('aria-hidden', 'true');
    if (typeof global.releaseBackgroundScrollLock === 'function') global.releaseBackgroundScrollLock();
  }

  function ensureFeedbackI18nReady(cb) {
    if (global.GGEN_FEEDBACK_I18N) {
      cb();
      return;
    }
    var existing = document.getElementById('ggenFeedbackI18nScript');
    if (existing) {
      existing.addEventListener('load', cb, { once: true });
      existing.addEventListener('error', cb, { once: true });
      return;
    }
    var s = document.createElement('script');
    s.id = 'ggenFeedbackI18nScript';
    s.src = '/static/js/feedback_i18n.js?v=3';
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }

  function wireFeedbackPageEsc() {
    if (!isStandaloneFeedbackPage() || document.body.dataset.fbEscWired === '1') return;
    document.body.dataset.fbEscWired = '1';
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      var dd = document.getElementById('siteFeedbackLangDropdown');
      if (dd && dd.classList.contains('active')) {
        ev.preventDefault();
        dd.classList.remove('active');
        return;
      }
      ev.preventDefault();
      global.location.href = '/';
    });
  }

  function initPageRoot() {
    var root = document.getElementById('siteFeedbackRoot');
    if (!root) return;
    ensureFeedbackI18nReady(function () {
      if (typeof global.mergeGgenFeedbackI18nIntoT === 'function') {
        global.mergeGgenFeedbackI18nIntoT();
      }
      applyContactPageShell();
      var lab = document.getElementById('siteFeedbackLangLabel');
      if (lab) lab.textContent = currentLang();
      wireContactLangUi();
      wireFeedbackPageEsc();
      initContactPageLang().then(function () {
        applyContactPageShell();
        renderInto(root, currentLang());
      });
    });
  }

  global.GgenSiteFeedback = {
    renderInto: renderInto,
    refreshLabels: refreshLabels,
    openModal: openModal,
    closeModal: closeModal,
    initPageRoot: initPageRoot,
    onLangChange: onLangChange,
    syncAppLang: syncAppLang
  };

  global.openSupportFeedback = openModal;
  global.closeSupportFeedback = closeModal;
  global.setFeedbackPageLang = setContactLang;

  if (typeof global.mergeGgenFeedbackI18nIntoT === 'function') {
    global.mergeGgenFeedbackI18nIntoT();
  }

  if (document.getElementById('siteFeedbackRoot')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPageRoot);
    } else {
      initPageRoot();
    }
  }
})(window);
