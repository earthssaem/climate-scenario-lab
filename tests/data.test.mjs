// 파생값 계산 단위 시험 — 실행: node tests/data.test.mjs  (Node 22 이상)
// 작은 가짜 요소 객체로 계산 규칙만 확인합니다. (실제·예시 데이터 파일과 무관)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../js/data.js';
import { createStore, DEFAULT_STATE } from '../js/state.js';
import { mapScale, rangeOf } from '../js/scales.js';

const PERIODS = [
  { id: 'cur', start: 2000, end: 2019 },
  { id: 'p1', start: 2021, end: 2040 },
  { id: 'p2', start: 2041, end: 2060 },
  { id: 'p3', start: 2061, end: 2080, derived: true },
  { id: 'p4', start: 2081, end: 2100 },
];

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const EL = {
  current: { startYear: 2000, annual: { '00': range(20, () => 10), 11: range(20, () => null) } },
  projection: {
    startYear: 2021,
    annual: {
      ssp126: { '00': range(80, (i) => 11 + i * 0.01) },
      ssp585: { '00': range(80, (i) => (i === 5 ? null : 12 + i * 0.05)) },
    },
  },
  official: {
    cur: { '00': 10, 11: null },
    periods: { ssp126: { p1: { '00': 11.1 }, p4: { '00': 11.7 } }, ssp585: { p1: { '00': 12.5 }, p4: { '00': 15 } } },
    decades: {
      ssp126: { 2061: { '00': 11.4 }, 2071: { '00': 11.6 } },
      ssp585: { 2061: { '00': 14 } }, // 2071 없음
    },
  },
};

let n = 0;
const test = async (name, fn) => { await fn(); n += 1; console.log("  ✓", name); };

await test('2020년은 시도 자료가 없음', () => {
  assert.equal(D.yearSource(EL, 2020), 'none');
  assert.equal(D.regionYearValue(EL, 'ssp126', '00', 2020), null);
  assert.equal(D.yearSource(EL, 2019), 'current');
  assert.equal(D.yearSource(EL, 2021), 'projection');
  assert.equal(D.yearSource(EL, 1999), 'none');
});

await test('연도 값: 현재기후 기간에는 시나리오와 무관하게 현재기후 값', () => {
  assert.equal(D.regionYearValue(EL, 'ssp126', '00', 2005), 10);
  assert.equal(D.regionYearValue(EL, 'ssp585', '00', 2005), 10);
  assert.equal(D.regionYearValue(EL, 'ssp585', '00', 2026), null); // 빈 값은 그대로 빈 값
  assert.ok(Math.abs(D.regionYearValue(EL, 'ssp585', '00', 2100) - (12 + 79 * 0.05)) < 1e-9);
});

await test('기간 값: 공식값을 그대로, 없으면 null', () => {
  assert.equal(D.periodValue(EL, 'ssp126', 'p1', '00', PERIODS), 11.1);
  assert.equal(D.periodValue(EL, 'ssp126', 'p2', '00', PERIODS), null);
  assert.equal(D.periodValue(EL, 'ssp585', 'cur', '00', PERIODS), 10);
  assert.equal(D.periodValue(EL, 'ssp126', 'p1', '99', PERIODS), null);
});

await test('2061~2080: 10년 공식값(2061, 2071) 평균, 하나라도 없으면 null', () => {
  const p3 = PERIODS[3];
  assert.deepEqual(D.decadeStarts(p3), [2061, 2071]);
  assert.ok(Math.abs(D.periodValue(EL, 'ssp126', 'p3', '00', PERIODS) - 11.5) < 1e-9);
  assert.equal(D.periodValue(EL, 'ssp585', 'p3', '00', PERIODS), null);
  assert.equal(D.derivedAvailable(EL, p3), true);
  assert.equal(D.derivedAvailable({ official: {} }, p3), false);
});

await test('2061~2080: 미리 계산된 값이 있으면 그 값, decades는 두 배치 모두 읽음', () => {
  const p3 = PERIODS[3];
  const PRE = { official: { periods: { ssp126: { p3: { 11: 15.5 } } }, decades: { ssp126: { '00': { 2061: 13.9, 2071: 14.0 } } } } };
  assert.equal(D.periodValue(PRE, 'ssp126', 'p3', '11', PERIODS), 15.5);                 // 미리 계산된 값
  assert.ok(Math.abs(D.periodValue(PRE, 'ssp126', 'p3', '00', PERIODS) - 13.95) < 1e-9);  // decades[시나리오][지역][연도]
  assert.equal(D.decadeValue(EL, 'ssp126', 2061, '00'), 11.4);                            // decades[시나리오][연도][지역]
  assert.equal(D.derivedAvailable(PRE, p3), true);
  assert.equal(D.derivedAvailable({ official: { decades: { ssp126: { '00': { 2061: 1 } } } } }, p3), false); // 2071 없음
  assert.equal(D.derivedMethod({ derived: { p3: { method: '방법' } } }, p3), '방법');
});

await test('변화량·변화율·차이', () => {
  assert.equal(D.toMode(12, 10, 'abs'), 12);
  assert.equal(D.toMode(12, 10, 'chg'), 2);
  assert.equal(D.toMode(12, 10, 'chg', true), 20);
  assert.equal(D.toMode(12, 0, 'chg', true), null);   // 기준이 0이면 %를 계산하지 않음
  assert.equal(D.toMode(12, null, 'chg'), null);
  assert.equal(D.toMode(null, 10, 'chg'), null);
  assert.equal(D.diffBA(11, 15), 4);                 // B − A
  assert.equal(D.diffBA(15, 11), -4);                // 음수도 그대로
  assert.equal(D.diffBA(null, 11), null);
  // % 모드 값끼리의 차이는 %p
  const a = D.toMode(11, 10, 'chg', true);
  const b = D.toMode(13, 10, 'chg', true);
  assert.ok(Math.abs(D.diffBA(a, b) - 20) < 1e-9);
});

await test('measure: 기간·연도 + 표시 방식', () => {
  const o = { region: '00', mode: 'chg', periods: PERIODS };
  assert.ok(Math.abs(D.measure(EL, { ...o, scen: 'ssp585', period: 'p4' }) - 5) < 1e-9);
  assert.equal(D.measure(EL, { ...o, scen: 'ssp585', period: 'cur' }), 0);
  assert.equal(D.measure(EL, { ...o, scen: 'ssp585', year: 2020 }), null);
  assert.equal(D.measure(EL, { ...o, region: '11', scen: 'ssp126', period: 'p1' }), null);
});

await test('y축 범위는 4개 시나리오 전체를 포함하고, A·B 선택과 무관', () => {
  const r = D.chartRange(EL, { regions: ['00'], scenarios: ['ssp126', 'ssp585'], mode: 'abs' });
  assert.ok(r.min <= 10 && r.max >= 12 + 79 * 0.05);
  const c = D.chartRange(EL, { regions: ['00'], scenarios: ['ssp126', 'ssp585'], mode: 'chg' });
  assert.ok(c.min <= 0 && c.max >= 5.95);
  const z = D.chartRange(EL, { regions: ['00'], scenarios: ['ssp126'], mode: 'abs', zeroFloor: true });
  assert.equal(z.min, 0);
});

await test('전국처럼 annual이 없는 지역: 연별 값 없음, 공식 기간값은 그대로, y축은 공식값으로 잡힘', () => {
  const NAT = {
    current: { startYear: 2000, annual: { 11: range(20, () => 12) } },            // 전국("00") 없음
    projection: { startYear: 2021, annual: { ssp126: { 11: range(80, () => 13) }, ssp585: { 11: range(80, () => 15) } } },
    official: { cur: { '00': 10, 11: 12 }, periods: { ssp126: { p4: { '00': 11 } }, ssp585: { p4: { '00': 14 } } } },
  };
  assert.equal(D.hasAnnual(NAT, '00'), false);
  assert.equal(D.hasAnnual(NAT, '11'), true);
  assert.deepEqual(D.blockRange(NAT, 'current'), [2000, 2019]);   // 범위는 다른 지역 배열로 판단
  assert.deepEqual(D.blockRange(NAT, 'projection'), [2021, 2100]);
  assert.equal(D.regionYearValue(NAT, 'ssp585', '00', 2050), null);  // 시도 값을 평균해 만들지 않음
  assert.equal(D.periodValue(NAT, 'ssp585', 'p4', '00', PERIODS), 14);
  const r = D.chartRange(NAT, { regions: ['00'], scenarios: ['ssp126', 'ssp585'], mode: 'chg', periods: PERIODS });
  assert.ok(r.min <= 0 && r.max >= 4);
});

await test('상태: A·B 같은 시나리오 금지, 지역 비교 중 4개 모두 끄기, B 없으면 차이 지도 끄기', () => {
  const manifest = JSON.parse(readFileSync(new URL('../data/manifest.json', import.meta.url)));
  const st = createStore();
  st.setManifest(manifest);
  st.actions.setScenario('B', 'ssp126');               // A와 같음 → 무시
  assert.equal(st.get().scenB, 'ssp585');
  st.actions.setAll4(true);
  st.actions.startPickB();
  st.actions.tapRegion(st.get().regionA);                 // regionA와 같으면 계속 기다림
  assert.equal(st.get().pickingRegionB, true);
  st.actions.tapRegion('21');                            // 부산 (기상청 원자료 코드)
  assert.equal(st.get().regionB, '21');
  assert.equal(st.get().showAll4, false);
  st.actions.setMapView('diff');
  st.actions.setScenario('B', null);
  assert.equal(st.get().mapView, 'side');
  // 과거 관측이 꺼져 있으면(기본) 1912~1999 연도 보기를 고를 수 없음
  st.actions.setYear(1960);
  assert.equal(st.get().year, null);
  // 관측을 쓸 수 없는 조건이 되면 1912~1999 연도 보기는 풀림
  st.actions.setMode('chg');                            // 관측은 평균기온 + 변화량에서만 (기본은 값)
  st.actions.setObsOn(true);
  st.actions.setYear(1960);
  assert.equal(st.get().year, 1960);
  st.actions.setMode('abs');
  assert.equal(st.get().year, null);
  st.actions.reset();
  assert.deepEqual(st.get(), JSON.parse(JSON.stringify(DEFAULT_STATE)));
});

await test('지도 색 범위: [최솟값, 최댓값] 고정, 0은 언제나 흰색', () => {
  assert.deepEqual(rangeOf([1.1, 6.7]), [1.1, 6.7]);
  assert.deepEqual(rangeOf(3), [-3, 3]);               // 예전 대칭 형식
  const el = { scale: { period: { abs: [10, 20], chg: [1.1, 6.7], diff: [-4.3, 4.3] }, annual: { chg: [-0.9, 8] } } };
  const v = (mode, year = null) => ({ s: { mode, year }, elMeta: { id: 'tavg', kind: 'temp' }, el, pct: false });
  const one = mapScale(v('chg'), 'value');              // 최솟값 ≥ 0 → 0부터 한쪽 방향
  assert.equal(one.min, 0);
  assert.equal(one.max, 6.7);
  assert.equal(one.color(0), '#ffffff');
  const ann = mapScale(v('chg', 2057), 'value');        // 연도 보기: 연별 범위, 0 위치는 비대칭
  assert.equal(ann.min, -0.9);
  assert.equal(ann.max, 8);
  assert.ok(Math.abs(ann.zero - (0.9 / 8.9) * 100) < 1e-9);
  assert.equal(ann.color(0), '#ffffff');
  assert.ok(ann.annualRange);
  const d = mapScale(v('chg'), 'diff');
  assert.deepEqual([d.min, d.max, d.zero], [-4.3, 4.3, 50]);
  const abs = mapScale(v('abs'), 'value');              // 값 모드: 한쪽 방향 그대로
  assert.deepEqual([abs.type, abs.min, abs.max], ['seq', 10, 20]);
});

await test('불러오기: 같은 파일 동시 요청은 한 번만, 실패하면 다시 시도 가능', async () => {
  let calls = 0;
  let fail = true;
  D.setFetch(async () => {
    calls += 1;
    if (fail) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, json: async () => ({ mock: true }) };
  });
  const p1 = D.loadJSON('x.json').catch(() => 'err');
  const p2 = D.loadJSON('x.json').catch(() => 'err');
  assert.equal(calls, 0); // 아직 마이크로태스크 전
  assert.equal(await p1, 'err');
  assert.equal(await p2, 'err');
  assert.equal(calls, 1);
  assert.equal(D.statusOf('x.json'), 'error');
  fail = false;
  await D.loadJSON('x.json');
  assert.equal(calls, 2);
  assert.equal(D.statusOf('x.json'), 'ok');
  assert.equal(D.anyMock(), true);
  await D.loadJSON('x.json');
  assert.equal(calls, 2); // 캐시
});

console.log(`data.test: ${n}개 통과`);
