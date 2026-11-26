import { checklist, parseAnswer, questions } from '../../public/questions.js';

const sheetsScope = 'https://www.googleapis.com/auth/spreadsheets';
const googleTokenUrl = 'https://oauth2.googleapis.com/token';
const maxBodyBytes = 16 * 1024;
const encoder = new TextEncoder();

function response(body, status) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function googleAccessToken(env, client) {
  const pem = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const bytes = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s+/g, '')), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const encodePart = (item) => base64Url(encoder.encode(JSON.stringify(item)));
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = encodePart({ alg: 'RS256', typ: 'JWT' }) + '.' +
    encodePart({ iss: env.GOOGLE_CLIENT_EMAIL, scope: sheetsScope, aud: googleTokenUrl, iat, exp: iat + 3600 });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const result = await client(googleTokenUrl, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + base64Url(new Uint8Array(signature))
    }),
    signal: AbortSignal.timeout(6500)
  });
  if (!result.ok) throw new Error('sheets');
  const body = await result.json();
  if (typeof body.access_token !== 'string' || !body.access_token) throw new Error('sheets');
  return body.access_token;
}

async function sendDatabase(application, env, client) {
  if (!env.SMOA_APPLICATION_URL || !env.SMOA_APPLICATION_TOKEN) throw new Error('configuration');
  const endpoint = new URL(env.SMOA_APPLICATION_URL);
  if (endpoint.protocol !== 'https:') throw new Error('configuration');
  const result = await client(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.SMOA_APPLICATION_TOKEN },
    body: JSON.stringify(application),
    redirect: 'error',
    signal: AbortSignal.timeout(6500)
  });
  if (!result.ok) throw new Error('database');
}

async function sendSpreadsheet(application, env, client, getAccessToken) {
  if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) throw new Error('configuration');
  const token = await getAccessToken(env, client);
  const { applicationId, submittedAt, answers } = application;
  const values = [
    applicationId, submittedAt,
    answers.directing, answers.plans.selected.join(', '), answers.plans.other,
    answers.name, answers.gender, answers.phone, answers.birthDate, answers.residence,
    answers.location, answers.field, answers.availability, answers.referral, answers.notes,
    ...checklist.map(([item]) => answers.checklist[item])
  ];
  const sheetId = encodeURIComponent(env.GOOGLE_SHEET_ID);
  const range = encodeURIComponent(env.GOOGLE_SHEET_RANGE || "'신청'!A:T");
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + range +
    ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
  const result = await client(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ values: [values] }),
    redirect: 'error',
    signal: AbortSignal.timeout(6500)
  });
  if (!result.ok) throw new Error('sheets');
}

export async function submitApplication(request, env, { client = fetch, getAccessToken = googleAccessToken } = {}) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
  }

  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) return response({ message: '홈페이지에서 다시 제출해 주세요.' }, 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return response({ message: '올바른 신청 형식으로 보내 주세요.' }, 415);
  }

  let data;
  if (Number(request.headers.get('Content-Length')) > maxBodyBytes) {
    return response({ message: '신청 내용이 너무 깁니다.' }, 413);
  }
  try {
    const raw = await request.text();
    if (encoder.encode(raw).byteLength > maxBodyBytes) return response({ message: '신청 내용이 너무 깁니다.' }, 413);
    data = JSON.parse(raw);
  } catch {
    return response({ message: '신청 내용을 읽을 수 없습니다.' }, 400);
  }

  const answers = {};
  for (const question of questions) {
    const value = parseAnswer(question, data?.[question.key]);
    if (value === null) return response({ message: '신청 항목을 확인해 주세요.', question: question.key }, 422);
    answers[question.key] = value;
  }

  const application = {
    applicationId: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    answers
  };
  const [db, sheet] = await Promise.allSettled([
    sendDatabase(application, env, client),
    sendSpreadsheet(application, env, client, getAccessToken)
  ]);
  const database = db.status === 'fulfilled' ? 'sent' : 'failed';
  const spreadsheet = sheet.status === 'fulfilled' ? 'sent' : 'failed';
  const status = database === 'sent' || spreadsheet === 'sent' ? 200 : 502;
  return response({ applicationId: application.applicationId, database, spreadsheet }, status);
}

export const onRequest = ({ request, env }) => submitApplication(request, env);
