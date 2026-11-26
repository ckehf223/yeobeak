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
const progress = form.querySelector('progress');
const counter = document.querySelector('#question-count');
const back = document.querySelector('#application-back');
const next = document.querySelector('#application-next');
const result = document.querySelector('#application-result');
const answers = {};
let step = 0;
let submitting = false;

function element(tag, text, attributes = {}) {
  const item = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) item.setAttribute(name, value);
  if (text) item.textContent = text;
  return item;
}

function option(name, value, type, checked) {
  const label = element('label', '', { class: 'question-option' });
  const input = element('input', '', { name, value, type });
  input.checked = checked;
  label.append(input, document.createTextNode(value));
  return label;
}

function checklistFields(current) {
  const group = element('div', '', { class: 'question-checklist' });
  for (const [key, text] of checklist) {
    const field = element('fieldset', '', { class: 'question-checklist-row' });
    field.append(element('legend', text), option(key, 'O', 'radio', current?.[key] === 'O'), option(key, 'X', 'radio', current?.[key] === 'X'));
    group.append(field);
  }
  return group;
}

function questionFields(question, current) {
  if (question.type === 'checklist') return checklistFields(current);
  if (question.options) {
    const group = element('div', '', { class: 'question-options' });
    const multiple = question.type === 'multiple';
    for (const value of question.options) {
      const checked = multiple ? Boolean(current?.selected.includes(value)) : current === value;
      group.append(option(question.key, value, multiple ? 'checkbox' : 'radio', checked));
    }
    if (multiple) {
      const other = element('input', '', { name: 'plansOther', type: 'text', maxlength: '400', placeholder: '기타', 'aria-label': '기타 계획' });
      other.hidden = !current?.selected.includes('기타');
      other.value = current?.other || '';
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
  input.value = current || '';
  return input;
}

function showQuestion(focus = true) {
  const question = questions[step];
  const heading = element('legend', 'Q' + (step + 1) + '. ' + question.label, { tabindex: '-1', id: 'question-heading' });
  const fieldset = element('fieldset', '', { class: 'question-fields', 'aria-labelledby': heading.id });
  fieldset.append(heading);
  if (question.hint) {
    fieldset.setAttribute('aria-describedby', 'question-hint');
    fieldset.append(element('p', question.hint, { id: 'question-hint' }));
  }
  const fields = questionFields(question, answers[question.key]);
  if (fields.matches('input, textarea')) fields.setAttribute('aria-labelledby', heading.id);
  fieldset.append(fields);
  panel.replaceChildren(fieldset);
  progress.value = step + 1;
  counter.textContent = (step + 1) + ' / ' + questions.length;
  back.hidden = step === 0;
  next.textContent = step === questions.length - 1 ? '제출완료' : '다음';
  message.textContent = '';
  if (focus) heading.focus({ preventScroll: true });
}

function currentAnswer(question) {
  const data = new FormData(form);
  if (question.type === 'multiple') return { selected: data.getAll(question.key), other: data.get('plansOther') };
  if (question.type === 'checklist') return Object.fromEntries(checklist.map(([key]) => [key, data.get(key)]));
  return data.get(question.key);
}

back.addEventListener('click', () => {
  if (submitting || step === 0) return;
  const question = questions[step];
  const current = currentAnswer(question);
  answers[question.key] = current;
  step -= 1;
  showQuestion();
});

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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;

  const question = questions[step];
  const value = parseAnswer(question, currentAnswer(question));
  if (value === null) {
    message.textContent = answerError(question);
    panel.querySelector('input:not([hidden]), textarea')?.focus();
    return;
  }
  answers[question.key] = value;
  if (step < questions.length - 1) {
    step += 1;
    showQuestion();
    return;
  }

  submitting = true;
  next.disabled = true;
  back.disabled = true;
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
    next.disabled = false;
    back.disabled = false;
  }
});

form.hidden = false;
showQuestion(false);

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
