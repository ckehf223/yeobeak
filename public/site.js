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
import { answerError, checklist, parseAnswer, questions } from './questions.js';

const form = document.querySelector('#application-form');
const panel = document.querySelector('#question-panel');
const message = document.querySelector('#application-message');
const submit = document.querySelector('#application-submit');
const result = document.querySelector('#application-result');
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

function checklistFields() {
  const group = element('div', '', { class: 'question-checklist' });
  for (const [key, text] of checklist) {
    const field = element('fieldset', '', { class: 'question-checklist-row' });
    field.append(element('legend', text), option('check-' + key, 'O', 'radio'), option('check-' + key, 'X', 'radio'));
    group.append(field);
  }
  return group;
}

function questionFields(question) {
  if (question.type === 'checklist') return checklistFields();
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
  if (question.autocomplete) attrs.autocomplete = question.autocomplete;
  if (question.inputMode) attrs.inputmode = question.inputMode;
  const input = question.type === 'textarea'
    ? element('textarea', '', { ...attrs, rows: '5' })
    : element('input', '', { ...attrs, type: question.type });
  return input;
}

function renderQuestion(question) {
  const titleId = 'question-' + question.key;
  const fieldset = element('fieldset', '', {
    class: 'question-fields', id: 'field-' + question.key, 'aria-labelledby': titleId
  });
  const label = element('legend', question.label, { id: titleId });
  if (question.required) label.append(element('span', ' *', { class: 'question-required', 'aria-label': '필수' }));
  fieldset.append(label);
  if (question.hint) {
    const hintId = 'hint-' + question.key;
    fieldset.setAttribute('aria-describedby', hintId);
    fieldset.append(element('p', question.hint, { id: hintId, class: 'question-hint' }));
  }
  const fields = questionFields(question);
  if (fields.matches('input, textarea')) fields.setAttribute('aria-labelledby', titleId);
  fieldset.append(fields);
  return fieldset;
}

function readAnswer(question, data) {
  if (question.type === 'multiple') return { selected: data.getAll(question.key), other: data.get('plansOther') };
  if (question.type === 'checklist') return Object.fromEntries(checklist.map(([key]) => [key, data.get('check-' + key)]));
  return data.get(question.key);
}

function showResult(data) {
  const db = data.database === 'sent';
  const sheet = data.spreadsheet === 'sent';
  const both = db && sheet;
  result.querySelector('h3').textContent = both ? '신청이 접수되었습니다' : db || sheet ? '일부 전송이 완료되었습니다' : '전송에 실패했습니다';
  result.querySelector('p').textContent = '접수번호 ' + data.applicationId + ' · DB ' + (db ? '전송 완료' : '전송 실패') + ' · 스프레드시트 ' + (sheet ? '전송 완료' : '전송 실패');
  form.hidden = true;
  result.hidden = false;
  result.focus();
}

form.addEventListener('input', (event) => {
  const field = event.target.closest('.question-fields[data-invalid]');
  if (!field) return;
  field.removeAttribute('data-invalid');
  message.textContent = '';
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
      message.textContent = question.label + ' ' + answerError(question);
      const field = document.getElementById('field-' + question.key);
      field.dataset.invalid = '';
      field.scrollIntoView({ block: 'center' });
      field.querySelector('input:not([hidden]), textarea')?.focus({ preventScroll: true });
      return;
    }
    answers[question.key] = value;
  }

  submitting = true;
  submit.disabled = true;
  message.textContent = '신청을 전송하고 있습니다.';
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers)
    });
    const data = await response.json();
    if (data.applicationId) showResult(data);
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
form.hidden = false;

const navigation = document.querySelector('#doz_header_wrap');
navigation?.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#doz_"]');
  if (!link) return;
  navigation.querySelectorAll('a[href^="#doz_"]').forEach((item) => {
    item.classList.toggle('active', item.hash === link.hash);
  });
});

function updateHeader() {
  document.body.classList.toggle('yeobaek-scrolled', window.scrollY >= 105);
}
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();
