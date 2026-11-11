// text.js — 화면 문구를 모두 이곳에 모읍니다. (조건 문장, 요소·시나리오 설명, 고정 안내, 숫자 형식)
// 결론을 단정하는 문구("~때문에 늘어납니다" 등)는 쓰지 않습니다.

export const APP_NAME = '기후변화 시나리오 탐구실';

export const T = {
  mockBanner: '⚠ 예시 데이터로 화면을 확인하는 중입니다. 표시된 값은 실제 기후 자료가 아닙니다.',
  notWeather: '이 값은 그해의 날씨 예보가 아니라, 이 시나리오에서 예상되는 기후 상태입니다.',
  ensembleNote: '전망값은 5개 기후모델 결과의 평균입니다. 평균을 내면 해마다의 오르내림이 실제보다 작게 보일 수 있어요.',
  obsNote: '관측은 특정 지점의 값이고, 전망은 지역 전체의 평균입니다. 각 자료의 2000~2019년 평균을 기준으로 변화량을 비교합니다.',
  obsNeedsChg: '지점 관측은 면적 평균과 기준이 달라 변화량 모드에서만 비교할 수 있어요.',
  obsOnlyTemp: '장기관측은 평균기온만 제공해요.',
  all4Disabled: '지역 비교 중에는 사용할 수 없어요',
  pickRegionB: '비교할 지역을 지도에서 누르세요',
  noYearData: '이 연도는 자료가 없습니다',
  noSidoYear: '이 연도는 시도 자료가 없습니다 (그래프의 관측은 지점 자료예요)',
  curNoDiff: '현재기후는 시나리오 차이가 없습니다',
  noData: '자료 없음',
  loadFail: '자료를 불러오지 못했어요.',
  retry: '다시 시도',
  loading: '불러오는 중…',
  needB: 'B 시나리오를 고르면 두 시나리오의 차이를 볼 수 있어요',
  appCalc: '앱 계산',
  clampNote: '범위를 넘는 값은 양 끝 색으로 칠했어요.',
  pickerTextbook: '교과서 그래프는 전 지구 평균·산업화 이전 기준이라 이 앱(우리나라·2000~2019 기준)과 숫자가 다릅니다.',
  emissionCaption: '전 지구 연간 CO₂ 배출량(GtCO₂/년) · 대기 중 농도가 아님 · 가로축은 실제 연도 간격(점 = 자료가 있는 해) · 네 곡선 같은 세로축 · 출처 IPCC AR6',
  co2Label: '2100년 예상 대기 중 CO₂ 농도',
  noneScenario: '선택 안 함',
  noneScenarioDesc: '시나리오 하나만 봅니다.',
  curColumnNote: '현재기후 열은 2000~2019년 값이라 모든 시나리오에서 같습니다.',
  auxTitle: '보조 분석',
  auxBody: '준비 중: 지역 순위 막대, 기온–폭염일수 산점도',
  footerSources: '자료: 기상청 기후정보포털(SSP 남한상세 행정구역 전망, MK-PRISM), 기상청 관측자료, IPCC AR6 WG1 (CC BY 4.0)',
};

// 그래프 아래 설명: 견본(선·띠·바탕) 옆 이름 (긴 안내는 그래프 ⓘ 안으로)
T.graphKeyObs = '과거 관측(6개 지점)';
T.graphKeyCur = '현재기후(관측 기반)';
T.graphKeyBand = '현재기후 평균';
T.graphKeyScen = '시나리오 전망';
T.graphKeyShade = '지도에 보이는 기간';
T.graphLineTrend = '점 = 20년 평균, 선 = 변화 추세를 보기 위해 기간 평균을 이은 것';
T.graphLineModel = '미래의 연도별 값은 기후모델 전망이에요. 그해 실제 날씨 예보가 아니에요.';
T.mapHint = '지도를 눌러 바꿀 수 있어요';
T.appCalcValue = '앱 계산값';
T.scenDiff = '두 시나리오 차이';
T.curClimate = '현재기후';
T.curBase = '변화량의 기준값';
T.curHint = (y) => `시나리오는 ${y ?? 2021}년부터 갈라져요. 기간을 바꿔 비교해 보세요.`;
T.obsNoScen = '관측 자료 — 시나리오와 무관';
T.p3Note = '이 기간은 기상청 공식 기간값이 없어, 연도별 전망값의 20년 평균을 앱이 계산한 값입니다.';
T.graphLinePeriodOnly = '점 = 20년 평균, 선 = 변화 추세를 보기 위해 기간 평균을 이은 것';
T.barsFixed = '연도별 값이 없는 지역은 20년 평균이 유일한 자료라 늘 표시해요';
T.mockBadge = '예시';
T.mockWatermark = '예시 데이터';
T.curNoDiffShort = '현재기후는 차이 없음';
T.noYearValue = '연도별 값 없음';
T.details = '기간별 표';
T.regionChooser = '지역 고르기';
T.elementChooser = '기후요소 고르기';
T.periodChooser = '기간 고르기';
T.modeChooser = '표시 방식';
T.regionA = '지역 A';
T.regionB = '비교 지역 B';
T.noCompare = '비교 안 함';
T.endYear = '연도 보기 끝내기';
T.diffMapTag = '차이 B−A 지도';

/** 그래프 ⓘ 창 내용 (그래프 층 설명 + 긴 안내문) */
export const GRAPH_INFO = [
  ['색 선', '시나리오별 전망(지역 면적 평균, 5개 기후모델 평균). 그래프 위 「4개 모두 보기」를 켜면 나머지 두 시나리오가 가는 선으로 더해져요(지역 비교 중에는 쓸 수 없어요).'],
  ['검은 선', '현재기후(2000~2019, 관측 기반, 지역 면적 평균, 이름표 "현재기후 · ○○ 평균"). 그 위의 굵은 회색 띠는 2000~2019년 20년 평균이고, 변화량 모드에서는 0선과 같아요.'],
  ['기간 평균 추세선', '「기간 평균 추세선 보기」를 켜면 각 기간의 20년 평균(공식값)을 기간 가운데 연도(2030·2050·2070·2090)에 점으로 찍고, 같은 시나리오의 점끼리 이어요. 점 = 20년 평균, 선 = 변화 추세를 보기 위해 기간 평균을 이은 것이에요(직선 회귀선이 아니에요). 2061~2080은 공식 20년 값이 없어 앱이 계산한 값이라 속이 빈 점(○)이에요. 현재기후(2000~2019)와는 잇지 않고 2030 점에서 시작해요. 켜면 연도별 선은 흐리게 보여요. 전국은 연도별 값이 없어 늘 추세선으로 보여 줘요.'],
  ['회색 점선', '「과거 관측 보기(1912~)」를 켜면 보이는 장기관측(특정 관측 지점의 값, 이름표 "관측 · 6개 지점 평균(지점값)"). 평균기온 + 변화량 모드에서만 켤 수 있고, 켜면 가로축이 1912년부터예요. 과거 관측 원자료는 평년(1991~2020, 30년 평균)을 기준으로 한 값이라, 이 그래프에서는 현재기후와 같은 2000~2019년 평균 기준으로 옮겨 그렸어요(앱 계산).'],
  ['기간', '위쪽 기간 버튼(현재기후·전반기·중반기·2061~2080·후반기)으로 고르면 그래프에 같은 구간이 옅은 회색 바탕으로 표시되고, 지도는 그 기간의 20년 평균을 보여 줘요.'],
  ['그래프 누르기', '그 연도를 보고, 지도도 그 연도로 바뀌어요.'],
];

/** 현재기후 ⓘ (기간 버튼 옆·숫자 카드의 "현재기후" 옆) — 짧은 단락 3개, 학생용 말투 */
export function curInfoSections(periods) {
  const y = new Date().getFullYear();
  const now = (periods ?? []).find((p) => !p.derived && p.id !== 'cur' && y >= p.start && y <= p.end);
  return [
    ['', `현재기후는 2000~2019년 관측 기반 20년 평균으로, 미래 전망과 비교하는 기준입니다.${now ? ` ${y}년인 지금은 ${now.label}(${now.start}~${now.end})에 속합니다.` : ''}`],
    ['날씨와 기후', '날씨는 오늘처럼 몇 시간~며칠 동안의 대기 상태예요. "내일 비가 온다"는 날씨예요. 기후는 한 지역에서 오랜 기간 나타나는 날씨의 평균과 변동 범위예요. "서울의 8월은 덥고 비가 많다"는 기후예요. 하루하루의 날씨는 들쭉날쭉하기 때문에, 기후는 보통 20~30년의 평균으로 나타내요.'],
    ['현재기후', "이 앱의 '현재기후'는 2000~2019년 20년 동안의 관측 기반 평균이에요. 미래 전망값은 모두 이 기준과 비교한 값이고, '변화량'은 '전망값 − 현재기후'예요."],
    ['그래서 연도별 값은 예보가 아니에요', '그래프의 연도별 값은 기후모델이 계산한 전망값이에요. 그해의 실제 날씨를 예보한 것이 아니에요. 기후의 변화는 하루나 한 해가 아니라 20년 평균끼리 비교해야 해요.'],
  ];
}

/** p3처럼 파생 기간의 안내 문구 — 기간 정보(start/end)로 만듭니다. */
export function derivedNote(meta) {
  const a = meta.start;
  const b = meta.start + 10;
  return `* 공식 10년 값(${a}~${a + 9}, ${b}~${b + 9})의 평균으로 앱에서 계산했습니다.`;
}
export const derivedChipNote = '* 공식 10년 값의 평균(앱 계산)';

/**
 * 파생 기간(2061~2080) 짧은 설명 — 화면용.
 * 자료 파일에 계산 방법(derived.method)이 있으면 "기상청 연도별 값으로 앱에서 계산한 평균"으로 짧게 쓰고,
 * 자세한 방법은 그래프 ⓘ 안에만 보여 줍니다. 방법이 없으면(10년 값으로 앱이 계산) 그 방식대로.
 */
export function derivedShort(meta, method) {
  return method ? `* ${meta.start}~${meta.end}: 기상청 연도별 값으로 앱에서 계산한 평균` : derivedNote(meta);
}

/** 시나리오 설명 — 기상청 기후변화 상황지도(데이터 다운로드 페이지) 원문 그대로 (수정 금지) */
export const SCEN_DESC = {
  ssp126: '재생에너지 기술 발달로 화석연료 사용이 최소화되고 친환경적으로 지속가능한 경제성장을 이룰 것으로 가정하는 경우',
  ssp245: '기후변화 완화 및 사회경제 발전 정도가 중간 단계를 가정하는 경우',
  ssp370: '기후변화 완화 정책에 소극적이며 기술개발이 늦어 기후변화에 취약한 사회구조를 가정하는 경우',
  ssp585: '산업기술의 빠른 발전에 중심을 두어 화석연료 사용이 높고 도시 위주의 무분별한 개발이 확대될 것으로 가정하는 경우',
};
/** ⓘ 시나리오 설명: 맨 위 공통 설명 2줄 → 4개 시나리오 원문 → 전반기 문장 → 출처 */
export const SCEN_INFO = {
  what: "SSP는 '공통 사회경제 경로'로, 인구·경제·에너지·기술·토지 이용 등 미래 사회의 모습을 가정한 시나리오입니다.",
  number: '뒤의 숫자(2.6~8.5)는 2100년에 온실가스 등이 지구를 데우는 힘(복사강제력, W/m²)으로, 클수록 온난화가 큽니다.',
  early: '전반기(2021~2040)에는 두 시나리오의 차이가 아직 작아서, 해마다 달라지는 자연적인 기후 변동 때문에 배출이 많은 시나리오의 값이 더 작게 나올 수도 있습니다. 후반기로 갈수록 배출 경로에 따른 차이가 뚜렷해집니다.',
  sources: [
    '시나리오 설명: 기상청 기후변화 상황지도 (https://climate.go.kr/atlas/ana/cdd)',
    '2100년 CO₂ 농도: 기상청 보도자료(2024.5.16)',
    '배출 낮음~매우 높음 구분: IPCC 제6차 평가보고서',
  ],
};

/** 기후요소 정의와 생활 연결 (ⓘ 창) — 결론을 미리 말하지 않는 열린 문장 */
export const ELEMENT_INFO = {
  tavg: { def: '1년 동안의 기온을 평균한 값.', life: '생물이 사는 범위, 농작물, 에너지 사용과 관련이 있어요.' },
  prcp: { def: '1년 동안 내린 비와 눈의 양.', life: '물 자원, 홍수와 가뭄, 생태계와 관련이 있어요.' },
  heat: { def: '하루 최고기온이 33℃ 이상인 날의 수.', life: '건강, 야외 활동, 전력 사용과 관련이 있어요.' },
  tropical: { def: '하루 최저기온이 25℃ 이상인 날의 수.', life: '잠, 건강, 냉방과 관련이 있어요.' },
  cold: {
    def: '하루 최저기온이 −12℃ 이하인 날의 수.',
    // 실제 자료에서 경남·경북·대구 등은 전반기·중반기 한파일수가 현재보다 크게 나옴 — 값은 그대로 두고 안내만
    note: '현재기후는 관측을 바탕으로 만든 값이고, 전망은 기후모델로 계산한 값이에요. 두 자료는 만든 방법이 달라서 가까운 미래에는 차이가 작거나 방향이 엇갈릴 수 있어요.',
    life: '난방, 겨울철 생활, 겨울 생태와 관련이 있어요.',
  },
};
export const ELEMENT_INFO_LAST = '이 변화가 생태계와 우리 생활에 어떤 영향을 줄지 생각해 보세요.';

/* ───────────── 숫자 형식 ───────────── */

const MINUS = '−';
const nf = new Map();
function formatter(d) {
  if (!nf.has(d)) nf.set(d, new Intl.NumberFormat('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nf.get(d);
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function rounded(v, d) {
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return Object.is(r, -0) ? 0 : r;
}

/** 값: 14.2 / −3.0 (값이 없으면 —) */
export function fmtNum(v, d = 1) {
  if (!isNum(v)) return '—';
  const r = rounded(v, d);
  return (r < 0 ? MINUS : '') + formatter(d).format(Math.abs(r));
}
/** 변화량·차이: +1.3 / −0.4 / 0.0 */
export function fmtSigned(v, d = 1) {
  if (!isNum(v)) return '—';
  const r = rounded(v, d);
  const sign = r > 0 ? '+' : r < 0 ? MINUS : '';
  return sign + formatter(d).format(Math.abs(r));
}
export function withUnit(text, unit) {
  return text === '—' ? text : text + unit;
}

/**
 * 단위 문자열
 *  kind 'value'  → 요소 단위(℃, mm, 일)
 *  kind 'change' → 변화량 단위(강수량 % 모드면 %)
 *  kind 'diff'   → 시나리오 차이 단위(강수량 % 모드면 %p)
 */
export function unitOf(elMeta, pct, kind) {
  if (kind === 'value') return elMeta.unit;
  if (!pct) return elMeta.unit;
  return kind === 'diff' ? '%p' : '%';
}

/** 지금 표시 방식으로 값 하나를 형식화 (abs면 값, chg면 부호 붙은 변화량) */
export function fmtMode(v, elMeta, mode, pct) {
  if (mode === 'abs') return withUnit(fmtNum(v), elMeta.unit);
  return withUnit(fmtSigned(v), unitOf(elMeta, pct, 'change'));
}
export function fmtDiff(v, elMeta, pct) {
  return withUnit(fmtSigned(v), unitOf(elMeta, pct, 'diff'));
}

/* ───────────── 조건 문장 ───────────── */

/** "SSP1-2.6과", "SSP2-4.5와" — 마지막 글자(숫자 읽는 소리 포함)에 맞는 조사 */
export function withGwa(label) {
  const last = String(label).trim().slice(-1);
  const digit = { 0: '과', 1: '과', 2: '와', 3: '과', 4: '와', 5: '와', 6: '과', 7: '과', 8: '과', 9: '와' };
  if (digit[last]) return label + digit[last];
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return label + ((code - 0xac00) % 28 ? '과' : '와');
  return `${label}와(과)`;
}

export function periodYears(meta) {
  return `${meta.start}~${meta.end}년`;
}

/** 표시 방식 이름 */
export function modeName(mode, pct) {
  if (mode === 'abs') return '값';
  return pct ? '현재기후 대비 변화율(%)' : '현재기후 대비 변화량';
}

/**
 * 한 줄 조건 문장 — 화면 캡처의 그림 설명으로 쓰일 수 있게 짧게.
 * v = { s, regionMeta(code), scenMeta(id), elMeta, periodMeta(id), pct }
 */
export function conditionSentence(v) {
  const { s, elMeta, pct } = v;
  if (!elMeta) return '';
  const rA = v.regionMeta(s.regionA)?.short ?? s.regionA;
  const parts = [];
  parts.push(s.regionB ? `${rA}·${v.regionMeta(s.regionB)?.short ?? s.regionB} 비교` : rA);
  parts.push(elMeta.name);
  const A = v.scenMeta(s.scenA)?.label ?? s.scenA;
  const B = s.scenB ? v.scenMeta(s.scenB)?.label ?? s.scenB : null;
  const diffMap = s.mapView === 'diff' && B;
  if (diffMap) parts.push(`${B} − ${A} 차이 지도`);
  else if (B) parts.push(`${withGwa(A)} ${B} 비교`);
  else parts.push(A);
  if (s.year != null) parts.push(`${s.year}년`);
  else {
    const pm = v.periodMeta(s.period);
    if (pm) parts.push(pm.id === 'cur' ? `${periodYears(pm)}(현재기후)` : pm.derived ? `${periodYears(pm)}(앱 계산)` : periodYears(pm));
  }
  if (diffMap) {
    if (pct) parts.push('변화율 차이(%p)');
  } else {
    parts.push(modeName(s.mode, pct));
  }
  return parts.join(' · ');
}

/** "전국은", "서울은", "경기는" — 받침에 맞는 조사 */
export function withEun(word) {
  const last = String(word).trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return word + ((code - 0xac00) % 28 ? '은' : '는');
  return `${word}은(는)`;
}

/** 연별 값이 없고 공식 기간값만 있는 지역 안내 (예: "전국은 기간 평균값만 제공됩니다") */
export const periodOnlyNote = (name) => `${withEun(name)} 기간 평균값만 제공됩니다`;
export const periodOnlyHint = '지도에서 시도를 고르면 연도별 값을 볼 수 있어요.';

/* ───────────── 출처 (푸터) ───────────── */

const SOURCE_LABELS = { projection: '전망', current: '현재기후', official: '공식 기간값', download: '자료 받는 곳', obs: '장기관측', co2: 'CO₂ 배출 경로', scenarioText: '시나리오 설명' };

/** manifest.sources → [{label, text}] — 문구는 파일 그대로 (정해진 순서, 그 밖의 키는 뒤에) */
export function sourceLines(sources) {
  if (!sources) return [];
  const keys = [...Object.keys(SOURCE_LABELS).filter((k) => sources[k]), ...Object.keys(sources).filter((k) => !(k in SOURCE_LABELS))];
  return keys.map((k) => ({ label: SOURCE_LABELS[k] ?? k, text: String(sources[k]) }));
}

/** 글자 속 https 주소를 새 탭 링크로 (먼저 이스케이프) */
export function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s)」,<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

/** HTML에 넣을 글자 이스케이프 */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
