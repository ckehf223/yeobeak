import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { submitApplication } from '../functions/api/application.js';

const requestUrl = 'https://yeobaek.example/api/application';
const env = {
  SMOA_APPLICATION_URL: 'https://smoa.example/api/applications',
  SMOA_APPLICATION_TOKEN: 'test',
  GOOGLE_SHEET_ID: 'test',
  GOOGLE_CLIENT_EMAIL: 'test@example.com',
  GOOGLE_PRIVATE_KEY: 'test'
};
const formHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const privacyConsent = formHtml.match(/name="privacyConsent" value="([^"]+)"/)?.[1];
const answers = {
  privacyConsent,
  directing: '커리어',
  plans: { selected: ['여행', '기타'], other: '가상 계획' },
  name: '가상 신청자',
  gender: '여',
  phone: '010-0000-0000',
  birthDate: '2001.01.13',
  residence: '가상동',
  location: '군자',
  occupation: '학생',
  field: '가상 분야',
  availability: '가상 일정',
  referral: 'TEST',
  notes: ''
};

function request(body = answers) {
  return new Request(requestUrl, {
    method: 'POST',
    headers: { Origin: 'https://yeobaek.example', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

for (const [database, spreadsheet] of [[true, true], [true, false], [false, true], [false, false]]) {
  test('independent single writes: DB ' + database + ', Sheets ' + spreadsheet, async () => {
    const calls = [];
    let releaseDatabase;
    const delayDatabase = new Promise((resolve) => { releaseDatabase = resolve; });
    const result = await submitApplication(request(), env, {
      getAccessToken: async () => 'fake-access',
      client: async (input, init) => {
        const url = new URL(input);
        const body = JSON.parse(init.body);
        calls.push({ host: url.host, body });
        if (url.host === 'smoa.example') {
          const guard = AbortSignal.timeout(1000);
          await Promise.race([delayDatabase, new Promise((_, reject) => guard.addEventListener('abort', reject, { once: true }))]);
          return new Response(null, { status: database ? 204 : 503 });
        }
        releaseDatabase();
        return new Response(null, { status: spreadsheet ? 204 : 503 });
      }
    });

    assert.equal(result.status, database || spreadsheet ? 200 : 502);
    assert.deepEqual(calls.map((call) => call.host).sort(), ['sheets.googleapis.com', 'smoa.example']);
    const status = await result.json();
    const db = calls.find((call) => call.host === 'smoa.example').body;
    const sheet = calls.find((call) => call.host === 'sheets.googleapis.com').body.values[0];
    assert.equal(status.database, database ? 'sent' : 'failed');
    assert.equal(status.spreadsheet, spreadsheet ? 'sent' : 'failed');
    assert.equal(db.applicationId, status.applicationId);
    assert.equal(sheet[0], status.applicationId);
    assert.equal(sheet.length, 18);
    assert.deepEqual(db.privacyConsent, { version: privacyConsent, agreedAt: db.submittedAt });
    assert.equal(sheet[16], db.privacyConsent.version);
    assert.equal(sheet[17], db.privacyConsent.agreedAt);
    assert.equal(db.answers.phone, '01000000000');
    assert.equal(db.answers.birthDate, '2001-01-13');
    assert.equal(sheet[7], db.answers.phone);
  });
}

test('missing, unchecked, and outdated privacy consent stop both deliveries', async () => {
  let calls = 0;
  for (const consent of [undefined, false, 'outdated']) {
    const result = await submitApplication(request({ ...answers, privacyConsent: consent }), env, {
      client: async () => { calls += 1; },
      getAccessToken: async () => { calls += 1; }
    });
    assert.equal(result.status, 422);
  }
  assert.equal(calls, 0);
});

test('an invalid dropdown value stops delivery to both destinations', async () => {
  let calls = 0;
  const result = await submitApplication(request({ ...answers, location: '기타' }), env, {
    client: async () => { calls += 1; }
  });
  assert.equal(result.status, 422);
  assert.equal(calls, 0);
});

test('the service account exchanges one signed assertion before calling Sheets', async () => {
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const privateKey = Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).toString('base64');
  const hosts = [];
  const result = await submitApplication(request(), { ...env, GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\n' + privateKey + '\n-----END PRIVATE KEY-----' }, {
    client: async (input, init) => {
      const host = new URL(input).host;
      hosts.push(host);
      if (host === 'oauth2.googleapis.com') {
        const [header, payload, signature] = init.body.get('assertion').split('.');
        const claims = JSON.parse(Buffer.from(payload, 'base64url'));
        assert.equal(claims.iss, env.GOOGLE_CLIENT_EMAIL);
        assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets');
        assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
        assert(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', keys.publicKey,
          Buffer.from(signature, 'base64url'), Buffer.from(header + '.' + payload)));
        return Response.json({ access_token: 'mock-token' });
      }
      if (host === 'sheets.googleapis.com') assert.equal(init.headers.Authorization, 'Bearer mock-token');
      return new Response(null, { status: 204 });
    }
  });
  assert.deepEqual((await result.json()).spreadsheet, 'sent');
  assert.deepEqual(hosts, ['smoa.example', 'oauth2.googleapis.com', 'sheets.googleapis.com']);
});
