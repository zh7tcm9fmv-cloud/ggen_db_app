(function (global) {
  'use strict';

  var RATING_FIELDS = [
    { key: 'overall', titleKey: 'feedback_q1_title', promptKey: 'feedback_q1_prompt', loKey: 'feedback_q1_lo', hiKey: 'feedback_q1_hi' },
    { key: 'navigation', titleKey: 'feedback_q2_title', promptKey: 'feedback_q2_prompt', loKey: 'feedback_q2_lo', hiKey: 'feedback_q2_hi' },
    { key: 'visual_design', titleKey: 'feedback_q3_title', promptKey: 'feedback_q3_prompt', loKey: 'feedback_q3_lo', hiKey: 'feedback_q3_hi' },
    { key: 'content_quality', titleKey: 'feedback_q4_title', promptKey: 'feedback_q4_prompt', loKey: 'feedback_q4_lo', hiKey: 'feedback_q4_hi' },
    { key: 'page_speed', titleKey: 'feedback_q5_title', promptKey: 'feedback_q5_prompt', loKey: 'feedback_q5_lo', hiKey: 'feedback_q5_hi' },
    { key: 'mobile_experience', titleKey: 'feedback_q6_title', promptKey: 'feedback_q6_prompt', loKey: 'feedback_q6_lo', hiKey: 'feedback_q6_hi' },
    { key: 'functionality', titleKey: 'feedback_q7_title', promptKey: 'feedback_q7_prompt', loKey: 'feedback_q7_lo', hiKey: 'feedback_q7_hi' },
    { key: 'trust', titleKey: 'feedback_q8_title', promptKey: 'feedback_q8_prompt', loKey: 'feedback_q8_lo', hiKey: 'feedback_q8_hi' }
  ];

  var EN_FALLBACK = {
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
    feedback_q8_title: 'Trust & Professionalism',
    feedback_q8_prompt: 'How trustworthy and professional did the website feel?',
    feedback_q8_lo: 'Not at all',
    feedback_q8_hi: 'Extremely',
    feedback_device_label: 'I visited on',
    feedback_device_desktop: 'Desktop',
    feedback_device_mobile: 'Mobile',
    feedback_device_tablet: 'Tablet',
    feedback_liked_label: 'What did you like most about the website?',
    feedback_improve_label: 'What can we improve?',
    feedback_submit: 'Submit feedback',
    feedback_submitting: 'Sending…',
    feedback_success: 'Thank you — your feedback was submitted.',
    feedback_err_required: 'Please rate every question from 1 to 5.',
    feedback_err_submit: 'Could not submit feedback. Please try again later.',
    feedback_err_rate_limit: 'You already submitted feedback recently. Please try again later.',
    feedback_privacy_note: 'Anonymous feedback only — no account required. Do not include personal contact info unless you want us to see it in your comments.',
    feedback_close: 'Close'
  };

  function tr(key) {
    if (typeof global.t === 'function') {
      var v = global.t(key);
      if (v && v !== key) return v;
    }
    return EN_FALLBACK[key] || key;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ratingBlockHtml(field, idx) {
    var radios = '';
    for (var n = 1; n <= 5; n++) {
      var id = 'fb-' + field.key + '-' + n;
      radios += '<input class="site-feedback-radio" type="radio" name="fb_' + field.key + '" id="' + id + '" value="' + n + '">';
      radios += '<label class="site-feedback-radio-label" for="' + id + '" data-value="' + n + '">' + n + '</label>';
    }
    return ''
      + '<section class="site-feedback-block" data-fb-field="' + esc(field.key) + '">'
      + '<div class="site-feedback-q-num">' + (idx + 1) + '</div>'
      + '<h3 class="site-feedback-q-title">' + esc(tr(field.titleKey)) + '</h3>'
      + '<p class="site-feedback-q-prompt">' + esc(tr(field.promptKey)) + '</p>'
      + '<div class="site-feedback-scale" role="group" aria-label="' + esc(tr(field.titleKey)) + '">'
      + '<span class="site-feedback-scale-end site-feedback-scale-end--lo">' + esc(tr(field.loKey)) + '</span>'
      + '<div class="site-feedback-radios">' + radios + '</div>'
      + '<span class="site-feedback-scale-end site-feedback-scale-end--hi">' + esc(tr(field.hiKey)) + '</span>'
      + '</div>'
      + '</section>';
  }

  function formHtml() {
    var h = '<form class="site-feedback-form" id="siteFeedbackForm" novalidate>';
    h += '<p class="site-feedback-intro">' + esc(tr('feedback_intro')) + '</p>';
    for (var i = 0; i < RATING_FIELDS.length; i++) {
      h += ratingBlockHtml(RATING_FIELDS[i], i);
      if (RATING_FIELDS[i].key === 'mobile_experience') {
        h += '<div class="site-feedback-device-row" aria-label="' + esc(tr('feedback_device_label')) + '">'
          + '<span class="site-feedback-q-prompt">' + esc(tr('feedback_device_label')) + '</span>'
          + '<label class="site-feedback-device-opt"><input type="checkbox" name="fb_device" value="desktop"> ' + esc(tr('feedback_device_desktop')) + '</label>'
          + '<label class="site-feedback-device-opt"><input type="checkbox" name="fb_device" value="mobile"> ' + esc(tr('feedback_device_mobile')) + '</label>'
          + '<label class="site-feedback-device-opt"><input type="checkbox" name="fb_device" value="tablet"> ' + esc(tr('feedback_device_tablet')) + '</label>'
          + '</div>';
      }
    }
    h += '<section class="site-feedback-block site-feedback-block--open">'
      + '<h3 class="site-feedback-q-title">9. ' + esc(tr('feedback_liked_label')) + '</h3>'
      + '<textarea class="site-feedback-textarea" name="fb_liked" rows="4" maxlength="4000" placeholder=""></textarea>'
      + '</section>';
    h += '<section class="site-feedback-block site-feedback-block--open">'
      + '<h3 class="site-feedback-q-title">10. ' + esc(tr('feedback_improve_label')) + '</h3>'
      + '<textarea class="site-feedback-textarea" name="fb_improve" rows="4" maxlength="4000" placeholder=""></textarea>'
      + '</section>';
    h += '<div class="site-feedback-honeypot" aria-hidden="true">'
      + '<label>Website<input type="text" name="fb_website" tabindex="-1" autocomplete="off"></label>'
      + '</div>';
    h += '<p class="site-feedback-msg" id="siteFeedbackMsg" hidden></p>';
    h += '<div class="site-feedback-actions">'
      + '<button type="submit" class="site-feedback-submit" id="siteFeedbackSubmit">' + esc(tr('feedback_submit')) + '</button>'
      + '<p class="site-feedback-note">' + esc(tr('feedback_privacy_note')) + '</p>'
      + '</div>';
    h += '</form>';
    return h;
  }

  function collectPayload(form) {
    var ratings = {};
    for (var i = 0; i < RATING_FIELDS.length; i++) {
      var key = RATING_FIELDS[i].key;
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
      lang: (global.S && global.S.lang) ? global.S.lang : 'EN',
      page_url: global.location ? global.location.pathname + global.location.search : ''
    };
  }

  function allRatingsPresent(ratings) {
    for (var i = 0; i < RATING_FIELDS.length; i++) {
      var v = ratings[RATING_FIELDS[i].key];
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

  function wireForm(root) {
    var form = root.querySelector('#siteFeedbackForm');
    if (!form || form.dataset.fbWired === '1') return form;
    form.dataset.fbWired = '1';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var payload = collectPayload(form);
      if (payload.website) return;
      if (!allRatingsPresent(payload.ratings)) {
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

  function renderInto(container) {
    if (!container) return null;
    container.innerHTML = formHtml();
    return wireForm(container);
  }

  function refreshLabels(root) {
    if (!root) return;
    root.innerHTML = formHtml();
    wireForm(root);
  }

  function openModal() {
    var ov = document.getElementById('siteFeedbackOverlay');
    var body = document.getElementById('siteFeedbackBody');
    var title = document.getElementById('siteFeedbackTitleEl');
    var closeBtn = document.getElementById('siteFeedbackCloseBtn');
    if (!ov || !body) {
      global.location.href = '/contact';
      return;
    }
    var langDd = document.getElementById('langDropdown');
    if (langDd) langDd.classList.remove('active');
    if (title) {
      title.innerHTML = '<img class="whats-new-ic" src="' + (typeof global.imgUrl === 'function' ? global.imgUrl('/static/images/UI/UI_Common_MenuIcon_Contact.webp') : '/static/images/UI/UI_Common_MenuIcon_Contact.webp') + '" alt=""> <span>' + esc(tr('feedback_title')) + '</span>';
    }
    if (closeBtn) closeBtn.setAttribute('aria-label', tr('feedback_close'));
    renderInto(body);
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

  function initPageRoot() {
    var root = document.getElementById('siteFeedbackRoot');
    if (root) renderInto(root);
  }

  global.GgenSiteFeedback = {
    renderInto: renderInto,
    refreshLabels: refreshLabels,
    openModal: openModal,
    closeModal: closeModal,
    initPageRoot: initPageRoot
  };

  global.openSupportFeedback = openModal;
  global.closeSupportFeedback = closeModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageRoot);
  } else {
    initPageRoot();
  }
})(window);
