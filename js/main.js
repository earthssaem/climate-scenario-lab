// main.js — 초기화, 상태 변경 → 전체 다시 그리기
// 모든 화면 영역은 같은 상태(store)로 한꺼번에 다시 그립니다. 각 영역은 상태를 따로 들고 있지 않습니다.
import { createStore, obsAllowed, obsEffective } from './state.js';
import * as D from './data.js';
import { T, conditionSentence } from './text.js';
import { renderControls, renderDialogs } from './ui-controls.js';
import { mountMap, renderMap } from './map.js';
import { renderChart } from './chart.js';
import { renderNumbers } from './numbers.js';

const $ = (id) => document.getElementById(id);
const store = createStore();
const A = store.actions;
let manifest = null;

/* ───────────── 데이터 확보 ───────────── */

const quiet = (p) => p.catch(() => {}); // 실패는 statusOf로 화면에 표시
const elPath = (id) => manifest?.elements.find((e) => e.id === id)?.file;

function ensureElement(id) {
  const path = elPath(id);
  if (!path) return;
  quiet(D.loadJSON(path).then(() => fixPeriodFor(id)));
}
function ensureEmissions() { quiet(D.loadJSON(D.PATHS.emissions)); }

/** 10년 공식값이 없는 요소로 바꿨는데 2061~2080을 보고 있었다면 후반기로 옮김 */
function fixPeriodFor(id) {
  const s = store.get();
  if (s.element !== id) return;
  const meta = manifest.periods.find((p) => p.id === s.period);
  if (meta?.derived && !D.derivedAvailable(D.getLoaded(elPath(id)), meta)) {
    const fallback = [...manifest.periods].reverse().find((p) => !p.derived);
    if (fallback) A.setPeriod(fallback.id);
  }
}

/* ───────────── 화면 모델 ───────────── */

function buildView() {
  const s = store.get();
  const v = { s, manifest };
  if (!manifest) return v;
  const byId = (arr, key = 'id') => Object.fromEntries(arr.map((x) => [x[key], x]));
  const scen = byId(manifest.scenarios);
  const reg = byId(manifest.regions, 'code');
  const per = byId(manifest.periods);
  v.scenMeta = (id) => scen[id] ?? null;
  v.regionMeta = (code) => reg[code] ?? null;
  v.periodMeta = (id) => per[id] ?? null;
  v.elMeta = manifest.elements.find((e) => e.id === s.element) ?? null;
  v.elPath = v.elMeta?.file;
  v.el = v.elPath ? D.getLoaded(v.elPath) : null;
  v.elStatus = v.elPath ? D.statusOf(v.elPath) : 'idle';
  v.pct = v.elMeta?.kind === 'prcp' && s.mode === 'chg' && s.prcpUnit === 'pct';
  v.obsAllowed = obsAllowed(s, manifest);
  v.obsOn = obsEffective(s, manifest);
  v.derivedOk = (meta) => !!v.el && D.derivedAvailable(v.el, meta);
  v.geo = D.getLoaded(D.PATHS.geo);
  v.geoStatus = D.statusOf(D.PATHS.geo);
  v.stations = D.getLoaded(D.PATHS.stations);
  v.stStatus = D.statusOf(D.PATHS.stations);
  v.emissions = D.getLoaded(D.PATHS.emissions);
  v.emStatus = D.statusOf(D.PATHS.emissions);
  return v;
}

/* ───────────── 그리기 ───────────── */

let raf = 0;
function scheduleRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; render(); });
}

function render() {
  const focusKey = document.activeElement?.dataset?.key;
  const v = buildView();

  const banner = $('mockBanner');
  const mock = (manifest && manifest.mock === true) || D.anyMock();
  banner.hidden = !mock;
  document.documentElement.style.setProperty('--banner-h', mock ? `${banner.offsetHeight}px` : '0px');

  if (!manifest) return;
  renderControls($('controls'), v);
  $('barToggle').setAttribute('aria-expanded', String(!v.s.ui.barCollapsed));
  $('barToggle').textContent = v.s.ui.barCollapsed ? '조건 펼치기 ▾' : '조건 접기 ▴';
  $('sentence').textContent = conditionSentence(v);
  renderMap($('mapCard'), v);
  renderChart($('chartCard'), v, A);
  renderNumbers($('numbersCard'), v);
  const dlg = renderDialogs($('dialogRoot'), v);

  // 다시 그린 뒤 키보드 초점 되살리기 / 창이 열리면 창 안으로
  if (dlg.opened) $('dialogRoot').querySelector('[data-key="dlg-close"]')?.focus();
  else if (dlg.closed && lastOpener) document.querySelector(`[data-key="${lastOpener}"]`)?.focus();
  else if (focusKey) document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

/* ───────────── 사용자 조작 → 상태 변경 ───────────── */

let lastOpener = '';
function handle(action, ds, el) {
  switch (action) {
    case 'element': return A.setElement(ds.id);
    case 'info': lastOpener = 'info'; return A.openInfo();
    case 'picker': lastOpener = `picker-${ds.slot}`; ensureEmissions(); return A.openPicker(ds.slot);
    case 'pick-scen': return A.setScenario(ds.slot, ds.id || null);
    case 'close-dialog': return A.closeDialogs();
    case 'retry-emissions': return ensureEmissions();
    case 'mode': return A.setMode(ds.id);
    case 'prcp-unit': return A.setPrcpUnit(ds.id);
    case 'tile': return A.tapRegion(ds.code);
    case 'nation': return A.selectNation();
    case 'pick-b': return A.startPickB();
    case 'cancel-pick': return A.cancelPickB();
    case 'clear-b': return A.clearRegionB();
    case 'period': return A.setPeriod(ds.id);
    case 'clear-year': return A.setYear(null);
    case 'map-view': return A.setMapView(ds.view);
    case 'map-tab': return A.setMapTab(ds.tab);
    case 'toggle-bar': return A.toggleBar();
    case 'retry-element': return ensureElement(store.get().element);
    case 'retry-base':
      quiet(D.loadJSON(D.PATHS.geo));
      quiet(D.loadJSON(D.PATHS.stations));
      return ensureElement(store.get().element);
    default:
      if (el) console.warn('알 수 없는 동작', action);
  }
  return undefined;
}

function onChange(e) {
  const t = e.target;
  switch (t.dataset.change) {
    case 'all4': return A.setAll4(t.checked);
    case 'obs-on': return A.setObsOn(t.checked);
    case 'obs-series': return A.setObsSeries(t.value);
    default: return undefined;
  }
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    if (t.tagName === 'A') e.preventDefault();
    handle(t.dataset.action, t.dataset, t);
  });
  document.addEventListener('change', (e) => { if (e.target.dataset?.change) onChange(e); });
  // SVG 타일처럼 <button>이 아닌 누름 대상: Enter / Space
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (store.get().ui.picker || store.get().ui.info)) { A.closeDialogs(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest?.('[data-action][role="button"]');
    if (!t || t.tagName === 'BUTTON' || t.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    handle(t.dataset.action, t.dataset, t);
  });
  // 제목(로고·앱 이름)을 누르면 기본 상태로 — 학생이 저장한 것은 없으므로 상태만 처음으로
  $('homeLink').addEventListener('click', (e) => {
    e.preventDefault();
    A.reset();
    window.scrollTo(0, 0);
  });
}

/* ───────────── 시작 ───────────── */

function showFatal() {
  const box = $('fatal');
  box.hidden = false;
  box.innerHTML = `<p>${T.loadFail}</p><button class="chip" id="fatalRetry">${T.retry}</button>`;
  $('fatalRetry').addEventListener('click', () => { box.hidden = true; boot(); });
}

async function boot() {
  try {
    manifest = await D.loadJSON(D.PATHS.manifest, { revalidate: true });
  } catch (err) {
    console.error(err);
    showFatal();
    return;
  }
  D.setVersion(manifest.version);
  store.setManifest(manifest);
  // 첫 접속에 꼭 필요한 것만: 지도 모양, 기본 요소(평균기온), 장기관측
  quiet(D.loadJSON(D.PATHS.geo));
  ensureElement(store.get().element);
  quiet(D.loadJSON(D.PATHS.stations));
  scheduleRender();
}

store.subscribe((s, prev) => {
  if (s.element !== prev.element) ensureElement(s.element);
  scheduleRender();
});
D.onDataChange(scheduleRender);
bindEvents();
window.addEventListener('resize', scheduleRender);
mountMap($('mapCard'), scheduleRender);
boot();
