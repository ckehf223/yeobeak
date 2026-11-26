export const checklist = [
  ['age', '나이 파악 여부'],
  ['residence', '거주지 파악 여부'],
  ['schoolOrWork', '대학교(직장)위치 및 이동시간 파악 여부'],
  ['weeklySchedule', '주 3회(월수금) 센터 환경 가능 여부'],
  ['futurePlans', '군입대, 여행 등 1-2년 이내 환경 파악 여부']
];

export const questions = [
  { key: 'directing', label: "나의 '여백'에 필요한 디렉팅은 무엇인가요?", type: 'radio', options: ['커리어', '멘탈 관리', '아우라', '아이덴티티'], required: true },
  { key: 'plans', label: '1-2년 이내 나의 계획은?', hint: '(중복체크 가능)', type: 'multiple', options: ['여행', '해외 유학 / 교환학생 / 워홀', '직장 / 알바', '대외 활동 (동아리 / 공모전 / 인턴십)', '군입대', '기타'], required: true },
  { key: 'name', label: '이름을 입력해주세요.', type: 'text', placeholder: '이름', autocomplete: 'name', limit: 80, required: true },
  { key: 'gender', label: '성별을 입력해주세요.', type: 'radio', options: ['남', '여'], required: true },
  { key: 'phone', label: '전화번호를 입력해주세요.', type: 'tel', placeholder: '010-0000-0000', autocomplete: 'tel', limit: 24, required: true },
  { key: 'birthDate', label: '생년월일을 입력해주세요.', hint: '응답자 식별, 중복 응답 방지 및 연령대별 통계 분석을 위해 생년월일을 수집합니다.', type: 'text', placeholder: '2006.01.13', inputMode: 'numeric', autocomplete: 'bday', limit: 10, required: true },
  { key: 'residence', label: '거주지(동까지)를 입력해주세요.', hint: '지역별 통계 분석 및 서비스 개선을 위해 수집합니다.', type: 'text', limit: 120, required: true },
  { key: 'location', label: '선호 장소를 골라주세요.', type: 'radio', options: ['잠실', '건대', '군자', '천호'], required: true },
  { key: 'field', label: '어떤 분야에서 공부/종사 하시나요?', type: 'text', limit: 200, required: true },
  { key: 'availability', label: '체험단 가능 일정을 입력해주세요.', type: 'text', limit: 400, required: true },
  { key: 'referral', label: '추천인 코드를 적어주세요.', type: 'text', limit: 100, required: true },
  { key: 'notes', label: '[ 비고란 ]', hint: '상세정보 모두 작성해주세요 (성향, 환경, 외모 등)', type: 'textarea', limit: 2000 },
  { key: 'checklist', label: '[ 체크리스트 ]', hint: '모든 항목에 O / X를 선택해 주세요', type: 'checklist', required: true }
];

function tidy(value, limit) {
  if (typeof value !== 'string') return '';
  const result = value.trim();
  return result.length <= limit ? result : '';
}

function normalizeBirthday(value) {
  const match = /^(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})$/.exec(value);
  if (!match) return '';
  const [, yy, mm, dd] = match;
  const iso = yy + '-' + mm + '-' + dd;
  const date = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso && iso <= new Date().toISOString().slice(0, 10) &&
    Number(yy) >= 1900 ? iso : '';
}

export function parseAnswer(question, value) {
  const { key, type, limit, options } = question;
  if (type === 'radio') return options.includes(value) ? value : null;
  if (type === 'multiple') {
    if (!value || !Array.isArray(value.selected) || !value.selected.length || value.selected.some((choice) => !options.includes(choice))) return null;
    const selected = options.filter((choice) => value.selected.includes(choice));
    const other = selected.includes('기타') ? tidy(value.other, 400) : '';
    return selected.includes('기타') && !other ? null : { selected, other };
  }
  if (type === 'checklist') {
    if (!value || checklist.some(([item]) => !['O', 'X'].includes(value[item]))) return null;
    return Object.fromEntries(checklist.map(([item]) => [item, value[item]]));
  }
  const text = tidy(value, limit);
  if (key === 'birthDate') return normalizeBirthday(text) || null;
  if (key === 'phone') {
    if (!/^[\d\s-]+$/.test(text)) return null;
    const digits = text.replace(/\D/g, '');
    return /^0\d{8,10}$/.test(digits) ? digits : null;
  }
  if (typeof value === 'string' && value.trim().length > limit) return null;
  return text || (question.required ? null : '');
}

export function answerError(question) {
  if (question.key === 'phone') return '전화번호를 확인해 주세요.';
  if (question.key === 'birthDate') return '생년월일을 연도, 월, 일 순서로 입력해 주세요.';
  if (question.key === 'plans') return '계획을 선택하고, 기타를 선택했다면 내용을 입력해 주세요.';
  if (question.key === 'checklist') return '모든 체크리스트 항목에서 O 또는 X를 선택해 주세요.';
  if (question.type === 'radio') return '항목을 하나 선택해 주세요.';
  return '답변을 입력해 주세요.';
}
