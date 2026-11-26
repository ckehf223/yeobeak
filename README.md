# 여백 홈페이지

[기존 여백 홈페이지](https://www.yeo-baek.com/)를 기준으로 스토리, 키트 소개, 이벤트 후기, 체험 안내와 모집 팝업을 옮겼습니다. [기존 스모어 신청서](https://smore.im/form/88GCdwu89e)의 13개 문항은 홈페이지 안의 체험신청서에서 작성합니다.

## 로컬에서 확인

Node.js 22 이상에서 다음 명령을 실행하고 화면에 나온 주소를 엽니다. 설치할 패키지는 없습니다.

```powershell
npm run dev
npm test
```

로컬 화면에서는 운영 API로 신청을 보내지 않습니다. 자동 검사는 가상 신청으로 두 전송처가 각각 한 번 호출되는지와 실패가 서로 영향을 주지 않는지 확인합니다.

## Cloudflare Pages에 배포

1. 이 폴더의 변경을 GitHub의 `ckehf223/yeobeak` 저장소 `main` 브랜치에 올립니다.
2. [Cloudflare 대시보드](https://dash.cloudflare.com/)의 **Workers & Pages → Create application → Pages → Connect to Git**에서 GitHub에 연결합니다. 저장소 목록에서 `ckehf223/yeobeak`를 선택합니다.
3. 프로젝트 이름은 `yeobeak`, Production branch는 `main`으로 설정합니다. Framework preset은 **None**, Build command는 **공란**, Build output directory는 **`public`**, Root directory는 **공란(저장소 루트)**으로 설정합니다.
4. **Save and Deploy** 후 Pages가 표시한 `.pages.dev` 주소를 열어 화면과 링크를 확인합니다. 신청 함수는 저장소 루트의 `functions/api/application.js`에서 자동으로 배포됩니다.
5. 사용하려는 도메인은 프로젝트의 **Custom domains → Set up a domain**에서 연결합니다. 루트 도메인 연결에는 Cloudflare 네임서버가 필요합니다. 기존 사이트 주소로 교체하는 경우에는 Pages 주소에서 확인한 뒤 도메인을 전환합니다.

[GitHub 연동 공식 안내](https://developers.cloudflare.com/pages/get-started/git-integration/) · [사용자 지정 도메인 공식 안내](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## 신청 전송 설정

**Workers & Pages → 여백 프로젝트 → Settings → Variables and Secrets**에서 운영 환경에 아래 값을 추가하고 새로 배포합니다. 가상 데이터로 시험할 때는 별도의 테스트 시트와 테스트 API를 연결합니다.

| 변수 | 값 |
| --- | --- |
| `SMOA_APPLICATION_URL` | MariaDB 저장까지 처리하는 SMOA의 HTTPS 접수 API 주소 |
| `SMOA_APPLICATION_TOKEN` | SMOA 접수 API와 공유하는 서버 인증 토큰. **Secret**으로 등록 |
| `GOOGLE_CLIENT_EMAIL` | 스프레드시트 편집 권한을 부여한 Google 서비스 계정 이메일 |
| `GOOGLE_PRIVATE_KEY` | 서비스 계정 키의 `private_key`. **Secret**으로 등록 |
| `GOOGLE_SHEET_ID` | 스프레드시트 주소의 `/d/`와 다음 `/` 사이 값 |
| `GOOGLE_SHEET_RANGE` | 선택 사항. 기본값은 `'신청'!A:T`. 시트 탭 이름에 맞게 지정 |

Google Cloud 프로젝트에서 Sheets API를 활성화하고, 해당 스프레드시트를 서비스 계정 이메일에 편집 권한으로 공유합니다. 신청정보 접근이 필요한 사람에게만 파일을 공유합니다.

시트의 첫 행은 다음 순서로 준비합니다.

```text
접수번호, 접수일시, 디렉팅, 1–2년 계획, 기타 계획, 이름, 성별, 전화번호, 생년월일, 거주지, 선호 장소, 공부·종사 분야, 가능 일정, 추천인 코드, 비고, 나이 파악, 거주지 파악, 학교·직장 위치 및 이동시간 파악, 주 3회 센터 가능 여부, 1–2년 이내 환경 파악
```

Pages Function은 HTTPS 접수 API에 Bearer 인증으로 `applicationId`, `submittedAt`, `answers`를 전달합니다. 접수 API는 MariaDB에 저장한 뒤에 2xx 응답을 반환해야 합니다. 스프레드시트에는 같은 접수번호로 한 행을 보냅니다. 두 작업은 독립적으로 한 번씩 실행되며, 각각의 결과를 신청 화면에 표시합니다.

[Cloudflare 환경 변수와 시크릿](https://developers.cloudflare.com/pages/functions/bindings/) · [Google 서비스 계정 인증](https://developers.google.com/identity/protocols/oauth2/service-account)
