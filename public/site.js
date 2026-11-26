const promotion = document.querySelector('#promotion');
const hideUntilKey = 'yeobaek-promotion-hide-until';

function closePromotion() {
  promotion.hidden = true;
}

let hideUntil = 0;
try {
  hideUntil = Number(localStorage.getItem(hideUntilKey));
} catch {}
promotion.hidden = hideUntil > Date.now();

promotion.addEventListener('click', (event) => {
  if (event.target.closest('[data-hide-promotion]')) {
    try {
      localStorage.setItem(hideUntilKey, String(Date.now() + 86_400_000));
    } catch {}
    closePromotion();
  }
  if (event.target.closest('[data-close-promotion]')) closePromotion();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !promotion.hidden) closePromotion();
});
import { answerError, parseAnswer, questionFor, questions } from './questions.js';

const form = document.querySelector('#application-form');
const panel = document.querySelector('#question-panel');
const message = document.querySelector('#application-message');
const submit = document.querySelector('#application-submit');
const consent = document.querySelector('#application-consent');
const consentError = document.querySelector('#application-consent-error');
const result = document.querySelector('#application-result');
const previewApplication = form.hasAttribute('data-preview');
document.querySelector('#application-preview-notice').hidden = !previewApplication;
if (previewApplication) {
  form.autocomplete = 'off';
  const consentFieldset = consent.closest('fieldset');
  consentFieldset.disabled = true;
  consentFieldset.hidden = true;
  for (const note of document.querySelectorAll('[data-live-application-only]')) note.hidden = true;
}
let submitting = false;

function element(tag, text, attributes = {}) {
  const item = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) item.setAttribute(name, value);
  if (text) item.textContent = text;
  return item;
}

function option(name, value, type) {
  const label = element('label', '', { class: 'question-option' });
  const input = element('input', '', { name, value, type });
  label.append(input, document.createTextNode(value));
  return label;
}

function selectField(question) {
  const select = element('select', '', { name: question.key, id: 'answer-' + question.key });
  select.append(element('option', '선택', { value: '', disabled: '', selected: '' }));
  for (const value of question.options) select.append(element('option', value, { value }));
  return select;
}

function questionFields(question) {
  if (question.type === 'select') return selectField(question);
  if (question.options) {
    const group = element('div', '', { class: 'question-options' });
    const multiple = question.type === 'multiple';
    for (const value of question.options) {
      group.append(option(question.key, value, multiple ? 'checkbox' : 'radio'));
    }
    if (multiple) {
      const other = element('input', '', { name: 'plansOther', type: 'text', maxlength: '400', placeholder: '기타', 'aria-label': '기타 계획' });
      other.hidden = true;
      group.append(other);
      group.addEventListener('change', (event) => {
        if (event.target.name === 'plans' && event.target.value === '기타') other.hidden = !event.target.checked;
      });
    }
    return group;
  }

  const attrs = { name: question.key, id: 'answer-' + question.key, placeholder: question.placeholder || '텍스트를 입력해 주세요.', maxlength: question.limit };
  if (!previewApplication && question.autocomplete) attrs.autocomplete = question.autocomplete;
  if (question.inputMode) attrs.inputmode = question.inputMode;
  const input = question.type === 'textarea'
    ? element('textarea', '', { ...attrs, rows: '5' })
    : element('input', '', { ...attrs, type: question.type });
  return input;
}

const halfWidth = ['name', 'gender', 'phone', 'birthDate', 'residence', 'location'];

function renderQuestion(question) {
  const titleId = 'question-' + question.key;
  const fieldset = element('fieldset', '', {
    class: 'question-fields' + (halfWidth.includes(question.key) ? ' question-half' : ''), id: 'field-' + question.key, 'aria-labelledby': titleId
  });
  const label = element('legend', question.label, { id: titleId });
  if (question.required) label.append(element('span', ' *', { class: 'question-required', 'aria-label': '필수' }));
  fieldset.append(label);
  const showHint = question.hint && !(previewApplication && ['birthDate', 'residence'].includes(question.key));
  if (showHint) {
    const hintId = 'hint-' + question.key;
    fieldset.setAttribute('aria-describedby', hintId);
    fieldset.append(element('p', question.hint, { id: hintId, class: 'question-hint' }));
  }
  const fields = questionFields(question);
  if (fields.matches('input, textarea, select')) fields.setAttribute('aria-labelledby', titleId);
  fieldset.append(fields);
  // Side-by-side fields keep their hint below so the inputs line up.
  if (halfWidth.includes(question.key) && showHint) fieldset.append(fieldset.querySelector('.question-hint'));
  return fieldset;
}

function readAnswer(question, data) {
  if (question.type === 'multiple') return { selected: data.getAll(question.key), other: data.get('plansOther') };
  return data.get(question.key);
}

function showResult(title, description = '') {
  result.querySelector('h3').textContent = title;
  const detail = result.querySelector('p');
  detail.textContent = description;
  detail.hidden = !description;
  form.hidden = true;
  result.hidden = false;
  result.focus();
}

function showSubmissionResult(data) {
  const db = data.database === 'sent';
  const sheet = data.spreadsheet === 'sent';
  const both = db && sheet;
  const title = both ? '신청이 접수되었습니다' : db || sheet ? '일부 전송이 완료되었습니다' : '전송에 실패했습니다';
  const description = '접수번호 ' + data.applicationId + ' · DB ' + (db ? '전송 완료' : '전송 실패') + ' · 스프레드시트 ' + (sheet ? '전송 완료' : '전송 실패');
  showResult(title, description);
}

form.addEventListener('input', (event) => {
  const field = event.target.closest('.question-fields[data-invalid]');
  if (!field) return;
  field.removeAttribute('data-invalid');
  message.textContent = '';
});

consent.addEventListener('change', () => {
  if (!consent.checked) return;
  consent.removeAttribute('aria-invalid');
  consentError.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;

  const data = new FormData(form);
  const answers = {};
  panel.querySelectorAll('[data-invalid]').forEach((field) => field.removeAttribute('data-invalid'));
  for (const question of questions) {
    const value = parseAnswer(question, readAnswer(question, data));
    if (value === null) {
      message.textContent = questionFor(question, data.get('occupation')).label + ' ' + answerError(question);
      const field = document.getElementById('field-' + question.key);
      field.dataset.invalid = '';
      field.scrollIntoView({ block: 'center' });
      field.querySelector('input:not([hidden]), select, textarea')?.focus({ preventScroll: true });
      return;
    }
    answers[question.key] = value;
  }

  if (previewApplication) {
    form.reset();
    showResult('신청완료 되었습니다.');
    return;
  }

  if (!consent.checked) {
    consentError.textContent = '여백 체험 개인정보 수집·이용에 동의해 주세요.';
    consentError.hidden = false;
    consent.setAttribute('aria-invalid', 'true');
    consent.focus();
    return;
  }

  submitting = true;
  submit.disabled = true;
  message.textContent = '신청을 전송하고 있습니다.';
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...answers, privacyConsent: consent.value })
    });
    const data = await response.json();
    if (data.applicationId) showSubmissionResult(data);
    else message.textContent = data.message || '전송 결과를 확인할 수 없습니다.';
  } catch {
    message.textContent = '연결이 끊겨 전송 결과를 확인할 수 없습니다.';
  } finally {
    submitting = false;
    submit.disabled = false;
  }
});

const application = document.querySelector('#application');
const mobileApplication = window.matchMedia('(max-width: 991px)');
function positionApplication() {
  const slot = document.getElementById(mobileApplication.matches ? 'application-mobile-slot' : 'application-desktop-slot');
  if (application.parentElement !== slot) slot.append(application);
}
positionApplication();
mobileApplication.addEventListener('change', positionApplication);
panel.append(...questions.map(renderQuestion));

// The schedule question appears once a job type is chosen and is reworded for office workers.
const schedule = questions.find((question) => question.key === 'availability');
const scheduleField = document.querySelector('#field-availability');
const scheduleInput = scheduleField.querySelector('input');
let askedAsWorker = null;

function updateSchedule() {
  const occupation = new FormData(form).get('occupation');
  scheduleField.hidden = !occupation;
  if (!occupation) return;
  const asked = questionFor(schedule, occupation);
  scheduleField.querySelector('legend').firstChild.textContent = asked.label;
  scheduleInput.placeholder = asked.placeholder || '텍스트를 입력해 주세요.';
  // A schedule typed for one question must not be sent as the answer to the other.
  const worker = occupation === '직장인';
  if (askedAsWorker !== null && askedAsWorker !== worker) scheduleInput.value = '';
  askedAsWorker = worker;
}
form.addEventListener('change', (event) => {
  if (event.target.name === 'occupation') updateSchedule();
});
updateSchedule();
form.hidden = false;

// The story menu goes to the brand story; PC and mobile each have their own section.
document.addEventListener('click', (event) => {
  if (!event.target.closest('a[data-url="index"]')) return;
  const story = [...document.querySelectorAll('[data-brand-story]')].find((section) => section.getClientRects().length);
  if (!story) return;
  event.preventDefault();
  story.scrollIntoView();
});

// Highlight the menu entry for the section currently on screen.
const menuLinks = [...document.querySelectorAll('#doz_header_wrap :is(a[data-url], .nav-item a)[href^="#doz_"]')];
const menuTargets = ['#doz_menu_20', '#doz_menu_status', '#doz_menu_info'];

function updateMenu() {
  let current = '#doz_body';
  for (const hash of menuTargets) {
    const target = document.querySelector(hash);
    if (target?.getClientRects().length && target.getBoundingClientRect().top <= 180) current = hash;
  }
  for (const link of menuLinks) link.classList.toggle('active', link.hash === current);
}

function updateHeader() {
  document.body.classList.toggle('yeobaek-scrolled', window.scrollY >= 105);
  updateMenu();
}
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

// Replay the original site's fade-in widgets as they scroll into view.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('yb-wait');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -60px' });
  for (const widget of document.querySelectorAll('#site-content [data-widget-anim^="fade"]:not(.yeobaek-application)')) {
    if (widget.querySelector('#application')) continue;
    widget.style.setProperty('--reveal-duration', (Number(widget.dataset.widgetAnimDuration) || 0.7) + 's');
    widget.style.setProperty('--reveal-delay', (Number(widget.dataset.widgetAnimDelay) || 0) + 's');
    widget.classList.add('yb-reveal', 'yb-wait');
    if (widget.dataset.widgetAnim === 'fadeInUp') widget.classList.add('yb-up');
    observer.observe(widget);
  }
}
