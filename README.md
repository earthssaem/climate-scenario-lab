# 🌏 기후변화 시나리오 탐구실

고등학생이 **기상청 SSP 기후변화 시나리오 자료**로 우리나라의 미래 기후를 지역·기후요소·시기별로 직접 비교하는 탐구 웹앱입니다.
통합과학 탐구 「기후 변화로 인한 생태계와 지구계의 미래 시나리오 구상하기」와 연결됩니다.

> ## ⚠ 실제 데이터 교체 전 배포 금지
> 지금 `data/` 폴더에는 화면 확인용 **예시(가짜) 데이터**가 들어 있습니다 (`tools/make_mock.py`로 생성, 모든 파일에 `"mock": true`).
> 예시 데이터가 있는 상태로 학생에게 배포하지 마세요. 예시 데이터일 때는 화면 맨 위에 경고 띠가 항상 보입니다.

---

## 실행하기

빌드 과정이 없는 정적 사이트입니다(순수 HTML/CSS/JS, ES 모듈).
ES 모듈과 `fetch`를 쓰기 때문에 파일을 더블클릭(`file://`)해서는 열리지 않습니다. 간단한 웹 서버로 엽니다.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 을 엽니다. 배포는 GitHub → Vercel(정적 사이트, 빌드 명령 없음)입니다.

외부에서 받는 것은 CDN 두 곳뿐입니다: Chart.js 4.5.1 + chartjs-plugin-annotation 3.1.0(그래프), Pretendard(글꼴).
분석·추적 스크립트, 입력칸, `localStorage`는 없습니다. 모든 상태는 메모리에만 있고 새로고침하면 기본값으로 돌아갑니다.

## 파일 구조

```
index.html
css/style.css
js/
  main.js         초기화, 상태 변경 → 전체 다시 그리기, 모든 클릭 처리
  state.js        상태 객체(DEFAULT_STATE), 규칙 정리(normalize), 상태 변경 함수
  data.js         데이터 로딩·캐시(요청 재사용), 파생값 계산(변화량·%·차이·기간값·y축 범위)
  text.js         모든 화면 문구, 조건 문장, 숫자 형식
  ui-controls.js  상단 조건 바, 시나리오 선택 창, ⓘ 창, 지역 칩
  map.js          지도(나란히 / 차이 B−A) — tiles·paths 두 형식
  chart.js        시계열 그래프
  numbers.js      수치 비교 표 + 기간별 차이 막대
  scales.js       지도 색 범위·색상표
data/
  manifest.json            지역·시나리오·요소·기간 목록, version, mock
  elements/{tavg,prcp,heat,tropical,cold}.json
  obs/stations.json        장기관측(6개 지점 평균 + 개별 지점)
  co2/emissions.json       전 지구 CO₂ 배출 경로(IPCC AR6)
  geo/sido-tiles.json      임시 타일 지도 (나중에 실제 경계로 교체)
tools/make_mock.py         예시 데이터 생성 (값을 만드는 규칙은 파일 맨 위 주석)
tests/data.test.mjs        파생값 계산 단위 시험
vercel.json                data 캐시 헤더
```

## 화면 구성

- **상단 조건 바**: 기후요소 5개(ⓘ 설명), 시나리오 A vs B(선택 창, B는 "선택 안 함" 가능), ☐ 4개 모두, [값 | 변화량], 강수량 변화량일 때만 [mm | %]
- **조건 문장**: 지금 화면의 조건을 한 줄로. 화면 캡처의 그림 설명으로 쓸 수 있습니다.
- **지도**: [나란히 | 차이 B−A], 공통 범례(고정 범위), 기간 칩, 연도 보기, 지역 선택·비교 지역. 지도 영역이 520px보다 좁으면 A/B 전환 탭으로 한 장씩.
- **시계열 그래프**: 관측(켰을 때)·현재기후·시나리오 A·B는 서로 다른 데이터셋이고 선을 잇지 않습니다. 결측은 끊김. 20년 평균 막대, 선택 기간 음영, 그래프를 누르면 그 연도 카드 + 지도 연도 보기.
- **수치 비교**: 기간 × 시나리오 표(칸을 누르면 그 기간으로), 기간별 차이 막대(B−A).
- **보조 분석**: 접힌 자리만 있습니다(준비 중).
- 제목(로고·앱 이름)을 누르면 기본 상태로 돌아갑니다.

앱에서 계산한 값에는 "앱 계산" 표시가 붙습니다: 2061~2080 값(공식 10년 값 2개의 평균), 시나리오 차이 B−A, 지역 차이 A−B.
변화량은 같은 지역·같은 요소의 현재기후(2000~2019) 공식값을 기준으로 합니다.

---

## 실제 데이터로 교체하는 방법

**코드를 고치지 않고 `data/` 파일만 같은 형식으로 바꾸면 됩니다.** (예시 데이터 대신 형식만 같고 값이 다른 파일 + 경계(paths) 지도로 바꿔서 코드 수정 없이 동작하는 것을 확인했습니다.)

1. 아래 형식대로 JSON을 만들어 같은 경로에 덮어씁니다.
2. 모든 파일에서 `"mock": true`를 지우거나 `false`로 바꿉니다. **하나라도 `true`가 남아 있으면 경고 띠가 계속 보입니다.**
3. `manifest.json`의 `version`을 새 문자열로 바꿉니다(예: `"2026-12-01"`). 브라우저·CDN 캐시를 새로 받게 하는 열쇠입니다(아래 「캐시」).
4. `python3 -m http.server`로 열어 경고 띠가 사라졌는지, 콘솔 오류가 없는지 확인합니다.

### `data/manifest.json`

`regions`(code·name·short), `scenarios`(id·label·level·color·co2_2100_ppm), `elements`(id·name·unit·kind·file), `periods`(id·label·start·end, 계산 구간은 `"derived": true`), `sources`, `version`, `mock`.
요소 `kind`: `temp`(장기관측 겹쳐 보기는 이 요소에서만), `prcp`(mm/% 전환), `days`(값 모드 y축 0부터).

### `data/elements/{id}.json`

```jsonc
{
  "element": "tavg", "unit": "℃",
  "current":    { "startYear": 2000, "annual": { "00": [20개, 2000~2019], "11": [...] } },
  "projection": { "startYear": 2021, "annual": { "ssp126": { "00": [80개, 2021~2100] }, "ssp245": {}, "ssp370": {}, "ssp585": {} } },
  "official": {
    "cur": { "00": 11.9 },                                        // 현재기후(2000~2019) 공식값 = 변화량의 기준
    "periods": { "ssp126": { "p1": { "00": 13.2 }, "p2": {}, "p4": {} } },
    "decades": { "ssp126": { "2061": { "00": 13.9 }, "2071": {} } } // 키 = 10년 구간 시작 연도
  },
  "scale": { "abs": [min, max], "chg": 6.5, "diff": 5.0, "pct": 20, "pctDiff": 13 }  // pct·pctDiff는 강수량만
}
```

- 값이 없으면 `null`. 앱은 메우지 않고 선을 끊거나 "자료 없음"(지도 빗금)으로 보여 줍니다.
- 2020년은 배열에 넣지 않습니다(현재기후 2000~2019, 전망 2021~2100).
- `decades`가 없거나 2061·2071 값이 없으면 2061~2080 칩이 비활성화됩니다.
- **`scale`은 4개 시나리오 × 모든 기간(현재·전반기·중반기·2061~2080·후반기) × 모든 지역 기준으로 미리 계산**합니다. 앱은 이 고정 범위를 그대로 써서 조건을 바꿔도 색 범위가 흔들리지 않습니다.
  - `abs` 값 모드 지도 [최소, 최대] / `chg` 최대 |값 − 현재| / `diff` 최대 |시나리오 차이| / `pct` 최대 |변화율(%)| / `pctDiff` 최대 |변화율 차이(%p)|
  - 연도 보기에서 1년 값이 이 범위를 넘으면 양 끝 색으로 칠하고 범례에 그 사실을 적습니다.
  - `scale`이 빠지면 앱이 요소마다 한 번 계산해 고정하지만(콘솔 경고), 실제 데이터에는 넣어 주세요.

### `data/obs/stations.json`

`valueType: "anomaly"`, `baseline: "2000-2019"` — 지점 관측값을 **각 지점의 2000~2019 평균 기준 편차**로 넣습니다(원자료의 1991~2020 평년 대비 편차를 전처리에서 옮긴 값). `series`의 키(`6avg`, `108` …)가 관측 선택 목록이 되고 `name`이 그대로 이름표가 됩니다. 결측은 `null`.

### `data/co2/emissions.json`

`years` 배열을 x축으로 그대로 씁니다(간격이 달라도 됨). `values`는 시나리오 id별 배열. 시나리오 선택 창의 미니 배출 곡선에만 쓰이며 처음 창을 열 때 불러옵니다.

### `data/geo/sido-tiles.json` → 실제 시도 경계

지도는 같은 함수로 두 형식을 그립니다.

```jsonc
// 지금(임시): 타일
{ "type": "tiles", "tiles": [{ "code": "11", "col": 1, "row": 0 }] }   // col·row는 소수도 됨
// 나중(실제 경계): 미리 투영한 SVG 경로
{ "type": "paths", "viewBox": "0 0 600 800",
  "paths": [{ "code": "11", "d": "M…Z", "labelX": 210, "labelY": 140, "labelScale": 0.7 }] }
```

- `labelX`·`labelY`(이름표 위치)와 `labelScale`(이름표 크기 배율)은 선택입니다. 없으면 경로의 가운데에 놓습니다. 서울·세종·대전·광주처럼 작은 지역은 이름표 위치·크기를 직접 주는 것이 좋습니다.
- 이름표 크기는 `viewBox` 폭에 비례해 자동 조정됩니다.
- 파일 이름을 바꾸려면 `js/data.js`의 `PATHS.geo` 한 줄만 고칩니다.
- 실제 경계로 바꾼 뒤에는 `"mock"`을 지워야 경고 띠가 사라집니다.

### 예시 데이터 다시 만들기

```bash
python3 tools/make_mock.py
```

값을 만드는 규칙(직선 추세 + 작은 흔들림)과, 일부러 넣은 상황(2020년 없음, 관측 1950~1953 결측, 기간에 따라 시나리오 순서 바뀜, 기간별 차이가 줄었다 커짐, 한파일수 세종 null, 폭염일수 10년 값 없음)은 스크립트 맨 위 주석에 있고, 실행할 때 자동으로 확인합니다.

---

## 캐시 (`vercel.json`)

- `data/manifest.json`: 매번 서버에 새 버전이 있는지 확인(`max-age=0, must-revalidate`).
- 나머지 `data/*`: 하루 캐시(`max-age=86400, stale-while-revalidate=604800`).
- 앱은 manifest를 받은 뒤 나머지 파일을 `?v=<manifest.version>`을 붙여 요청합니다. **데이터 파일을 바꿀 때 `version`만 바꾸면** 이전 캐시와 상관없이 새 파일을 받습니다. `version`을 안 바꾸면 최대 하루 동안 이전 파일이 보일 수 있습니다.
- `.vercelignore`로 `tools/`, `tests/`는 배포하지 않습니다.

## 성능 — 첫 접속 전송량

첫 접속에는 `manifest.json`, `geo/sido-tiles.json`, `elements/tavg.json`, `obs/stations.json`만 받습니다.
다른 요소 파일은 그 칩을 처음 누를 때, `co2/emissions.json`은 시나리오 선택 창을 처음 열 때 받고, 한 번 받은 파일은 메모리에 두고 다시 받지 않습니다(같은 파일을 동시에 두 번 요청하지 않음).

헤드리스 Chromium으로 첫 화면을 열 때 요청한 파일을 기록해 측정했습니다(2026-11-10, 예시 데이터 기준). 압축 크기는 같은 파일을 gzip -9 / brotli로 압축한 값이며, Vercel·jsDelivr는 압축해서 보냅니다.

| 구분 | 파일 | 원본 | 압축 (gzip / brotli) |
|---|---|---:|---:|
| 앱 | index.html | 3.6 KB | 1.8 / 1.3 KB |
| 앱 | css/style.css | 22.1 KB | 5.6 / 4.7 KB |
| 앱 | js/*.js (9개 모듈) | 86.8 KB | 34.0 / 29.7 KB |
| 앱 | data/manifest.json | 3.8 KB | 1.0 / 0.9 KB |
| 앱 | data/geo/sido-tiles.json | 1.2 KB | 0.3 / 0.2 KB |
| 앱 | data/elements/tavg.json | 39.1 KB | 7.6 / 5.4 KB |
| 앱 | data/obs/stations.json | 4.5 KB | 1.2 / 1.0 KB |
| **앱 합계** | | **161.1 KB** | **51.4 KB (gzip)** |
| CDN | chart.js 4.5.1 (umd.min) | 203.6 KB | 68.9 / 59.6 KB |
| CDN | chartjs-plugin-annotation 3.1.0 | 37.5 KB | 12.3 / 11.0 KB |
| CDN | Pretendard (dynamic subset) | 측정 못 함 | 측정 못 함 |
| **측정한 전체** | | **402.2 KB** | **약 133 KB (gzip)** |

- Pretendard는 측정한 환경에서 CDN 접속이 막혀 있어 재지 못했습니다. dynamic subset은 화면에 쓰인 글자 범위의 조각만 받습니다. 배포 후 브라우저 개발자 도구 Network 탭(캐시 끄기)에서 다시 재서 이 표를 고쳐 주세요.
- 나중에 받는 파일(예시 데이터 기준, 원본/gzip): prcp 52.7/18.1 KB, heat 32.5/11.0 KB, tropical 38.4/12.7 KB, cold 32.9/8.2 KB, emissions 0.4/0.3 KB.

## 시험

```bash
node tests/data.test.mjs   # Node 22 이상
```

파생값 계산(2020년 없음, 2061~2080 계산, 변화량·변화율·%p, y축 범위), 상태 규칙(A≠B, 지역 비교 중 4개 모두 끄기 등), 요청 재사용·다시 시도를 검사합니다.

---

자료: 기상청 기후정보포털(SSP 남한상세 행정구역 전망, MK-PRISM), 기상청 관측자료, IPCC AR6 WG1 (CC BY 4.0)
© 2026 제작: 김연경(earthssaem@gmail.com) | [연경쌤의 지구과학 실험실 둘러보기 →](https://earthssaem-lab.vercel.app/)
