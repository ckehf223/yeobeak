# 여백 홈페이지

[기존 여백 홈페이지](https://www.yeo-baek.com/)를 기준으로 스토리, 키트 소개, 이벤트 후기, 체험 안내와 모집 팝업을 옮겼습니다. [기존 스모어 신청서](https://smore.im/form/88GCdwu89e)의 문항(체크리스트 제외 12개)은 원본 체험 안내 구역의 신청서에 한 화면으로 표시합니다.

## 로컬에서 확인

VS Code Live Server에서는 `public/index.html`을 우클릭해 **Open with Live Server**를 선택합니다. 저장소 전체를 연 경우 브라우저 주소 경로는 `/public/index.html`입니다.

Node.js 22 이상에서는 다음 명령을 실행하고 화면에 나온 주소를 열어도 됩니다. 설치할 패키지는 없습니다.

```powershell
npm run dev
npm test
```

로컬 화면에서는 운영 API로 신청을 보내지 않습니다. 자동 검사는 가상 신청으로 두 전송처가 각각 한 번 호출되는지와 실패가 서로 영향을 주지 않는지 확인합니다.

## Cloudflare Pages에 배포

1. 이 폴더의 변경을 GitHub의 `ckehf223/yeobeak` 저장소 `main` 브랜치에 올립니다.
2. [Cloudflare 대시보드](https://dash.cloudflare.com/)의 **Workers & Pages → Create application → Pages → Connect to Git**에서 GitHub에 연결합니다. 저장소 목록에서 `ckehf223/yeobeak`를 선택합니다.
3. 프로젝트 이름은 `yeobeak`, Production branch는 `main`으로 설정합니다. Framework preset은 **None**, Build command는 **`npm test`**, Build output directory는 **`public`**, Root directory는 **공란(저장소 루트)**으로 설정합니다. 별도 번들링이 필요 없는 HTML/CSS/JS 사이트이므로 기존 7개 검사를 통과하면 Pages가 정적 파일과 Functions를 배포합니다. 검사 실패 시 새 버전은 배포하지 않습니다.
4. **Save and Deploy** 후 Pages가 표시한 `.pages.dev` 주소를 열어 화면과 링크를 확인합니다. 신청 함수는 저장소 루트의 `functions/api/application.js`에서 자동으로 배포됩니다.
5. 사용하려는 도메인은 프로젝트의 **Custom domains → Set up a domain**에서 연결합니다. 루트 도메인 연결에는 Cloudflare 네임서버가 필요합니다. 기존 사이트 주소로 교체하는 경우에는 Pages 주소에서 확인한 뒤 도메인을 전환합니다.

[GitHub 연동 공식 안내](https://developers.cloudflare.com/pages/get-started/git-integration/) · [사용자 지정 도메인 공식 안내](https://developers.cloudflare.com/pages/configuration/custom-domains/)

### 현재 연결 상태 — 2026-11-26

- GitHub `ckehf223/yeobeak` → Cloudflare Pages `yeobeak` 연결 및 `main` 자동 배포가 활성화되어 있습니다. `main`에 push하면 Cloudflare가 자동으로 검사하고 배포합니다. GitHub Actions와 별도 배포 토큰은 필요하지 않습니다.
- 공개 홈페이지 주소: https://yeobeak.pages.dev/
- 운영 빌드 명령을 `npm test`로 저장했으며 로컬 검사 7개를 통과했습니다. 기존 커밋 `3169c2a`를 새 설정으로 다시 배포해 Cloudflare에서도 검사 7개 통과 및 배포 성공을 확인했습니다(배포 ID `dd73d93e-1b43-44ed-963e-489c6be18ccc`).
- `www.yeo-baek.co.kr`은 Pages에서 활성/SSL 사용 상태이며 HTTPS 200 응답을 확인했습니다. 루트 도메인은 아래 별도 진행 상태를 참고하세요.
- 2026-11-27 사용자 요청으로 루트 연결을 추가 진행했습니다. Cloudflare 무료 DNS에 루트와 www CNAME → `yeobeak.pages.dev`를 준비하고, HostingKR 네임서버를 `buck.ns.cloudflare.com` / `carrera.ns.cloudflare.com`으로 변경했습니다. 네임서버 전파·Cloudflare 영역 활성화·Pages 루트 사용자 지정 도메인 등록을 마쳤으며, 루트와 www 양쪽 모두 HTTPS 200 응답 및 여백 HTML 본문을 확인했습니다. 앞으로 DNS 레코드는 Cloudflare에서 관리하며 등록·갱신은 HostingKR에서 합니다.
- 이 도메인은 여백 홈페이지 전용입니다. SMOA 업무 사이트와 연결하지 않습니다.
- 신청 전송 환경 변수는 아직 설정되지 않았습니다. 홈페이지 배포 성공과 실제 접수 API·구글시트 저장 성공은 별도로 검증합니다.

## 검색엔진 설정 — 2026-11-27 적용 완료

대표 주소는 `https://yeo-baek.co.kr/`입니다. SEO 변경 커밋 `9acbbd1`을 GitHub `main`에 반영했고 Cloudflare Pages 자동 배포가 성공했습니다. 아래 설정은 공개 사이트에서 확인했습니다.

- 홈페이지 제목·설명, 대표 주소 `canonical`, Open Graph와 `WebSite` JSON-LD.
- `public/robots.txt`: 홈페이지와 화면 리소스 수집 허용, API 경로 수집 제외, 사이트맵 위치 명시.
- `public/sitemap.xml`: 실제 공개 페이지인 루트 주소 한 개만 포함합니다. 페이지 내부 앵커는 별도 문서로 나열하지 않습니다.
- `public/404.html`: 없는 주소가 홈페이지 HTML을 200으로 반환하는 Pages의 SPA 기본 동작을 방지합니다. 오류 페이지는 `noindex`입니다.
- Googlebot/Yeti 이름으로 요청한 공개 홈페이지가 모두 HTTP 200을 반환하며 `X-Robots-Tag` 차단 헤더가 없음을 확인했습니다. 이는 실제 검색엔진의 수집·색인 완료를 뜻하지 않습니다.
- 로컬의 canonical/JSON-LD/사이트맵 정합성, robots.txt·사이트맵 HTTP 응답 및 MIME 유형, 기존 신청 처리 가상 검사 7개를 확인했습니다.

Chrome에서 Google과 네이버 사이트 소유권 확인을 완료했습니다. Google은 DNS TXT 인증을 사용하고, 네이버는 홈페이지 HTML 메타 태그를 사용합니다. 두 서비스 모두 사이트맵 제출을 마쳤습니다. Google 사이트맵은 처리 완료·발견 페이지 1개를 확인했고 홈페이지 색인 요청도 접수됐습니다. 네이버에도 홈페이지 수집 요청 내역이 등록됐습니다. 소유권 확인용 DNS TXT와 HTML 태그는 삭제하지 않습니다.

공개 `https://yeo-baek.co.kr/robots.txt`와 `https://yeo-baek.co.kr/sitemap.xml`의 HTTP 200 및 올바른 Content-Type을 확인했습니다. 없는 주소가 HTTP 404를 반환하는 것도 확인했습니다. 두 검색 도구에 제출한 주소는 `https://yeo-baek.co.kr/sitemap.xml`입니다. Google에는 도메인 속성 `yeo-baek.co.kr`을 DNS로 확인하면 HTTPS 및 www 범위를 함께 관리할 수 있습니다. 네이버에는 대표 주소 `https://yeo-baek.co.kr`을 등록합니다. 소유권 확인값은 유지해야 합니다. 검색 반영 시점이나 순위를 보장하지 않습니다.

공식 안내: [Google 소유권 확인](https://support.google.com/webmasters/answer/9008080), [Google 사이트맵](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [네이버 사이트 등록](https://searchadvisor.naver.com/guide/faq-start-register).

## 신청 전송 설정

**Workers & Pages → 여백 프로젝트 → Settings → Variables and Secrets**에서 운영 환경에 아래 값을 추가하고 새로 배포합니다. 가상 데이터로 시험할 때는 별도의 테스트 시트와 테스트 API를 연결합니다.

| 변수 | 값 |
| --- | --- |
| `SMOA_APPLICATION_URL` | MariaDB 저장까지 처리하는 SMOA의 HTTPS 접수 API 주소 |
| `SMOA_APPLICATION_TOKEN` | SMOA 접수 API와 공유하는 서버 인증 토큰. **Secret**으로 등록 |
| `GOOGLE_CLIENT_EMAIL` | 스프레드시트 편집 권한을 부여한 Google 서비스 계정 이메일 |
| `GOOGLE_PRIVATE_KEY` | 서비스 계정 키의 `private_key`. **Secret**으로 등록 |
| `GOOGLE_SHEET_ID` | 스프레드시트 주소의 `/d/`와 다음 `/` 사이 값 |
| `GOOGLE_SHEET_RANGE` | 선택 사항. 기본값은 `'신청'!A:R`. 시트 탭 이름에 맞게 지정 |

Google Cloud 프로젝트에서 Sheets API를 활성화하고, 해당 스프레드시트를 서비스 계정 이메일에 편집 권한으로 공유합니다. 신청정보 접근이 필요한 사람에게만 파일을 공유합니다.

시트의 첫 행은 다음 순서로 준비합니다.

```text
접수번호, 접수일시, 디렉팅, 1–2년 계획, 기타 계획, 이름, 성별, 전화번호, 생년월일, 거주지, 선호 장소, 직종, 공부·종사 분야, 가능 일정(직장인은 퇴근시간), 추천인 코드, 비고, 개인정보 동의 문구 버전, 개인정보 동의 일시
```

Pages Function은 HTTPS 접수 API에 Bearer 인증으로 `applicationId`, `submittedAt`, `privacyConsent`(문구 버전과 서버 기록 일시), `answers`를 전달합니다. 접수 API는 MariaDB에 저장한 뒤에 2xx 응답을 반환해야 합니다. 스프레드시트에는 같은 접수번호로 한 행을 보냅니다. 두 작업은 독립적으로 한 번씩 실행되며, 각각의 결과를 신청 화면에 표시합니다.

[Cloudflare 환경 변수와 시크릿](https://developers.cloudflare.com/pages/functions/bindings/) · [Google 서비스 계정 인증](https://developers.google.com/identity/protocols/oauth2/service-account)
