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
  curNoDiff: '현재는 시나리오 차이가 없습니다',
  noData: '자료 없음',
  loadFail: '자료를 불러오지 못했어요.',
  retry: '다시 시도',
  loading: '불러오는 중…',
  needB: 'B 시나리오를 고르면 두 시나리오의 차이를 볼 수 있어요',
  appCalc: '앱 계산',
  clampNote: '범위를 넘는 값은 양 끝 색으로 칠했어요.',
  pickerIntro: '네 시나리오 모두 IPCC 제6차 평가보고서(AR6)에서 같은 방법으로 계산한 결과입니다. 차이는 "미래 사회와 온실가스 배출을 어떻게 가정했는가"입니다.',
  pickerNameHelp: '이름 읽는 법: SSP 뒤 숫자 = 어떤 사회인가 / 하이픈 뒤 숫자 = 2100년에 지구를 데우는 힘(W/m²)',
  pickerTextbook: '교과서 그래프는 전 지구 평균·산업화 이전 기준이라 이 앱(우리나라·2000~2019 기준)과 숫자가 다릅니다.',
  emissionCaption: '전 지구 연간 CO₂ 배출량(GtCO₂/년) · 대기 중 농도가 아님 · 출처 IPCC AR6',
  co2Label: '2100년 예상 대기 중 CO₂ 농도',
  noneScenario: '선택 안 함',
  noneScenarioDesc: '시나리오 하나만 봅니다.',
  curColumnNote: '현재 열은 현재기후(2000~2019) 값이라 모든 시나리오에서 같습니다.',
  auxTitle: '보조 분석',
  auxBody: '준비 중: 지역 순위 막대, 기온–폭염일수 산점도',
  footerSources: '자료: 기상청 기후정보포털(SSP 남한상세 행정구역 전망, MK-PRISM), 기상청 관측자료, IPCC AR6 WG1 (CC BY 4.0)',
};

/** p3처럼 파생 기간의 안내 문구 — 기간 정보(start/end)로 만듭니다. */
export function derivedNote(meta) {
  const a = meta.start;
  const b = meta.start + 10;
  return `* 공식 10년 값(${a}~${a + 9}, ${b}~${b + 9})의 평균으로 앱에서 계산했습니다.`;
}
export const derivedChipNote = '* 공식 10년 값의 평균(앱 계산)';

/** 시나리오 한 줄 설명 (기상청 설명을 학생 눈높이로) */
export const SCEN_DESC = {
  ssp126: '재생에너지 기술이 발달하고 화석연료 사용이 줄어드는, 지속가능한 성장을 가정해요.',
  ssp245: '기후변화 완화와 사회경제 발전이 중간 정도로 진행된다고 가정해요.',
  ssp370: '기후변화 완화 정책이 소극적이고, 지역 간 경쟁으로 협력이 약한 사회를 가정해요.',
  ssp585: '화석연료에 크게 의존하는 빠른 경제성장을 가정해요.',
};

/** 기후요소 정의와 생활 연결 (ⓘ 창) — 결론을 미리 말하지 않는 열린 문장 */
export const ELEMENT_INFO = {
  tavg: { def: '1년 동안의 기온을 평균한 값.', life: '생물이 사는 범위, 농작물, 에너지 사용과 관련이 있어요.' },
  prcp: { def: '1년 동안 내린 비와 눈의 양.', life: '물 자원, 홍수와 가뭄, 생태계와 관련이 있어요.' },
  heat: { def: '하루 최고기온이 33℃ 이상인 날의 수.', life: '건강, 야외 활동, 전력 사용과 관련이 있어요.' },
  tropical: { def: '하루 최저기온이 25℃ 이상인 날의 수.', life: '잠, 건강, 냉방과 관련이 있어요.' },
  cold: { def: '하루 최저기온이 −12℃ 이하인 날의 수.', life: '난방, 겨울철 생활, 겨울 생태와 관련이 있어요.' },
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
  return pct ? '현재 대비 변화율(%)' : '현재 대비 변화량';
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
    if (pm) parts.push(pm.id === 'cur' ? `${periodYears(pm)}(현재)` : pm.derived ? `${periodYears(pm)}(앱 계산)` : periodYears(pm));
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

/** HTML에 넣을 글자 이스케이프 */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
