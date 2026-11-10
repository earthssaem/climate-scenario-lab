# CLAUDE.md

기후변화 시나리오 탐구실: 기상청 SSP 시나리오 자료를 지도·그래프로 비교하는 고등학교 통합과학·지구과학 웹앱(순수 HTML/CSS/JS, ES 모듈, 빌드 없음)입니다. `main` 브랜치가 Vercel로 배포됩니다(다른 브랜치를 푸시하면 Vercel 미리보기만 만들어짐).

## Git 작업 규칙: 항상 `main`에 머지

변경을 마치면 **사용자에게 따로 묻지 않고 항상 `main`까지 머지하고 푸시**합니다.

1. 작업 브랜치에서 커밋하고 푸시합니다.
2. `main`을 최신으로 받은 뒤, 작업 브랜치를 `main`에 머지합니다.
   - 가능하면 fast-forward(`git merge --ff-only`)로 합칩니다.
   - fast-forward가 안 되면 일반 머지를 하되, **충돌이 나면 멈추고 사용자에게 알립니다.**
3. `main`을 푸시합니다(`git push origin main`).
4. PR은 만들지 않습니다(사용자가 요청할 때만).
5. 머지 전에 아래 '확인'을 통과해야 합니다. 실패하면 머지하지 말고 결과를 알립니다.

```bash
git push -u origin <작업-브랜치>
git checkout main && git pull --ff-only origin main
git merge --ff-only <작업-브랜치>
git push origin main
git checkout <작업-브랜치>
```

## 확인 (머지 전)

- `node tests/data.test.mjs`(Node 22 이상)가 모두 통과해야 합니다.
- `python3 -m http.server`로 열고 Playwright로 태블릿 가로(1280×800)·세로(800×1280), 전자칠판(1920×1080), 폰(390×844)에서 콘솔 오류·가로 스크롤이 없는지 봅니다. 외부 CDN이 막힌 환경에서는 같은 버전의 npm 파일(chart.js 4.5.1, chartjs-plugin-annotation 3.1.0)을 그 주소에 연결해 확인합니다.
- 가로 화면(1280×800, 1920×1080)에서는 페이지 스크롤 없이 지도 두 장·그래프·핵심 수치 줄이 한 화면에 들어와야 합니다(기간별 표·푸터는 그 아래).
- 실제 자료 상태(`data/`, 모든 파일 `"mock": false`)에서는 예시 데이터 띠·워터마크·"예시" 배지가 보이지 않아야 합니다. 예시 데이터는 `python3 tools/make_mock.py` 후 `?data=mock`으로 확인합니다.

## 지켜야 할 것

- 순수 HTML/CSS/JS(ES 모듈), 빌드 도구·프레임워크 없음. 외부 CDN은 Chart.js 4.5.1, chartjs-plugin-annotation 3.1.0, Pretendard만(버전 고정).
- 개인정보 입력칸, 쿠키·localStorage·서버 전송·분석 도구 금지. 화면 상태는 `js/state.js`의 상태 객체 하나에만(메모리) 두고, `fetch`는 `data/` 파일 읽기에만 씁니다.
- 자료: 값을 지어내거나 보간하지 않습니다. 관측과 전망을 한 선으로 잇지 않고, 빈 값은 끊습니다. 앱에서 계산한 값(2061~2080, 시나리오·지역 차이)에는 "앱 계산" 표시를 붙입니다.
- 지역 코드는 기상청 원자료 코드(11 서울, 21 부산, 22 대구, 23 인천, 24 광주, 25 대전, 26 울산, 29 세종, 31 경기, 32 강원, 33 충북, 34 충남, 35 전북, 36 전남, 37 경북, 38 경남, 39 제주, 전국 `00`)입니다. 전국은 기간값만 있고 연도별 값은 없습니다.
- 예시 데이터는 `data-mock/`에만 씁니다(`data/`의 실제 자료를 덮어쓰지 않음). `data/` 파일을 바꾸면 `manifest.json`의 `version`을 바꿉니다.
- 출처 표기 유지: 지도 경계(통계청 SGIS 행정동 경계, 공공누리 제1유형 → vuski/admdongkor, CC BY 4.0), IPCC("IPCC AR6 WG1 SPM.4 data, CC BY 4.0"), 그 밖의 자료 출처는 `manifest.sources`.
- 제목을 누르면 기본 상태(`DEFAULT_STATE`)로, 푸터의 제작자 문구와 허브 링크(`연경쌤의 지구과학 실험실 둘러보기 →`)는 유지합니다.
- 화면 구조나 사용법이 바뀌면 `README.md`도 함께 고칩니다.
