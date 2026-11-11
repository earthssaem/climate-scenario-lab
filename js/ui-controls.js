// ui-controls.js — 상단 두 줄(기후요소·표시 방식 / 시나리오·4개 모두·기간), 지도 머리의 분석 지역, 시나리오 선택 창, ⓘ 창
// 화면은 상태(view.s)로만 그립니다. 버튼은 data-action 속성만 달고, 실제 처리는 main.js 한 곳에서 합니다.
import {
  T, SCEN_DESC, ELEMENT_INFO, ELEMENT_INFO_LAST, GRAPH_INFO, esc, derivedNote, periodOnlyNote, periodOnlyHint, sourceLines, linkify,
} from './text.js';
import * as D from './data.js';

const pressed = (on) => `aria-pressed="${on ? 'true' : 'false'}"`;
const shortEl = (name) => name.replace(/일수$/, '');   // 폭염일수 → 폭염 (상단 바용 짧은 이름)

/* ───────────── 1줄: 기후요소 ⓘ | 값/변화량 (강수량 mm/%) ───────────── */

export function renderTopControls(root, v) {
  const { s, manifest } = v;
  if (!manifest) { root.innerHTML = ''; return; }
  const isPrcp = v.elMeta?.kind === 'prcp';
  root.innerHTML = `
    <span class="ctl-label" id="lblEl">기후요소</span>
    <div class="seg el-seg" role="group" aria-labelledby="lblEl">
      ${manifest.elements.map((e) => `<button data-action="element" data-id="${esc(e.id)}" data-key="el-${esc(e.id)}"
        ${pressed(e.id === s.element)} aria-label="${esc(e.name)}">${esc(shortEl(e.name))}</button>`).join('')}
    </div>
    <button class="icon-btn" data-action="info" data-key="info" aria-haspopup="dialog" aria-label="${esc(v.elMeta?.name ?? '')} 설명 보기">ⓘ</button>
    <span class="sep" aria-hidden="true"></span>
    <div class="seg" role="group" aria-label="표시 방식">
      <button data-action="mode" data-id="abs" data-key="mode-abs" ${pressed(s.mode === 'abs')}>값</button>
      <button data-action="mode" data-id="chg" data-key="mode-chg" ${pressed(s.mode === 'chg')}>변화량</button>
    </div>
    ${isPrcp && s.mode === 'chg' ? `<div class="seg" role="group" aria-label="강수량 변화량 단위">
      <button data-action="prcp-unit" data-id="mm" data-key="pu-mm" ${pressed(s.prcpUnit === 'mm')}>mm</button>
      <button data-action="prcp-unit" data-id="pct" data-key="pu-pct" ${pressed(s.prcpUnit === 'pct')}>%</button>
    </div>` : ''}`;
}

/* ───────────── 2줄: 시나리오 A vs B, 4개 모두 | 기간 (지도·그래프 공통 조건) ───────────── */

function scenButton(v, slot) {
  const id = slot === 'A' ? v.s.scenA : v.s.scenB;
  const m = id ? v.scenMeta(id) : null;
  return `<button class="scen-btn" data-action="picker" data-slot="${slot}" data-key="picker-${slot}" aria-haspopup="dialog"
    aria-label="시나리오 ${slot}: ${m ? esc(m.label) : T.noneScenario} — 바꾸기"><span class="ab">${slot}</span>${m
    ? `<span class="sdot" style="--c:${esc(m.color)}"></span><span class="sl">${esc(m.label)}</span>` : `<span class="sl none">${T.noneScenario}</span>`}<span class="caret" aria-hidden="true">▾</span></button>`;
}

export function renderCondRow(root, v) {
  const { s, manifest } = v;
  if (!manifest) { root.innerHTML = ''; return; }
  const all4Disabled = !!s.regionB;
  const period = s.year != null
    ? `<span class="year-chip" role="status">${s.year}년 보기<button class="x" data-action="clear-year" data-key="clear-year" aria-label="${s.year}년 보기 끝내기, 20년 평균으로">✕</button></span>`
    : `<div class="seg period-seg" role="group" aria-labelledby="lblPeriod">${manifest.periods.map((p) => {
      const off = p.derived && !v.derivedOk(p);
      return `<button data-action="period" data-id="${esc(p.id)}" data-key="period-${esc(p.id)}" ${pressed(p.id === s.period)} ${off ? 'disabled' : ''}
        aria-label="${esc(p.label)} ${p.start}~${p.end}년${p.derived ? ` (${T.appCalc})` : ''}${off ? ' — 이 요소는 자료가 없어요' : ''}">${esc(p.derived ? `${p.label}*` : p.label)}</button>`;
    }).join('')}</div>`;
  root.innerHTML = `
    <span class="ctl-label">시나리오</span>
    ${scenButton(v, 'A')}<span class="vs">vs</span>${scenButton(v, 'B')}
    <label class="check${all4Disabled ? ' disabled' : ''}" title="${all4Disabled ? T.all4Disabled : ''}">
      <input type="checkbox" data-change="all4" data-key="all4" ${s.showAll4 && !all4Disabled ? 'checked' : ''} ${all4Disabled ? 'disabled' : ''}>
      <span>4개 모두</span></label>
    <span class="sep" aria-hidden="true"></span>
    <span class="ctl-label" id="lblPeriod">기간</span>
    ${period}`;
}

/** 지도 머리 왼쪽: 분석 지역 + [전국으로] + [+ 비교 지역] / 비교 중 / 비교 지역 고르는 중 */
export function regionToolsHTML(v) {
  const { s } = v;
  const name = (c) => esc(v.regionMeta(c)?.short ?? c);
  if (s.pickingRegionB) {
    return `<span class="pick-hint" role="status">${T.pickRegionB}</span>
      ${s.regionA !== '00' ? `<button class="chip" data-action="nation" data-key="nation">전국</button>` : ''}
      <button class="chip ghost" data-action="cancel-pick" data-key="cancel-pick">취소</button>`;
  }
  const label = `<span class="region-label">분석 지역: <b>${name(s.regionA)}</b>${s.regionB
    ? ` · 비교: <b>${name(s.regionB)}</b><button class="x" data-action="clear-b" data-key="clear-b" aria-label="지역 비교 끝내기">✕</button>` : ''}</span>`;
  const nation = `<button class="chip" data-action="nation" data-key="nation" ${s.regionA === '00' ? 'disabled' : ''}>전국으로</button>`;
  return `${label}${nation}${s.regionB ? '' : `<button class="chip ghost" data-action="pick-b" data-key="pick-b">+ 비교 지역</button>`}`;
}

/* ───────────── 시나리오 선택 창 ───────────── */

/**
 * 미니 배출 곡선 — 네 곡선 모두 같은 y축(yr).
 * x축은 실제 연도 간격(years가 2015, 2020, 2030 … 처럼 고르지 않아도 연도 값 그대로 위치를 잡음, 범주형 축 아님).
 * 자료가 있는 해마다 점과 아래 눈금을 찍어 간격이 보이게 하고, 0선(실선 + "0")을 늘 그림(음수 배출 있음).
 */
function miniCurve(em, id, color, yr) {
  const W = 156;
  const H = 66;
  const L = 16;   // 왼쪽: "0" 글자 자리
  const R = 8;
  const T = 5;
  const B = 20;   // 아래: 연도 글자 자리
  const ys = em.values?.[id];
  if (!ys) return '';
  const years = em.years;
  const x0 = years[0];
  const x1 = years[years.length - 1];
  const px = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const py = (y) => T + (1 - (y - yr[0]) / (yr[1] - yr[0] || 1)) * (H - T - B);
  const pts = years.map((x, i) => (Number.isFinite(ys[i]) ? [px(x), py(ys[i])] : null));
  const segs = [];   // 빈 값이 있으면 선을 끊어서 그림
  let cur = [];
  pts.forEach((pt) => { if (pt) cur.push(pt); else { if (cur.length) segs.push(cur); cur = []; } });
  if (cur.length) segs.push(cur);
  const zy = py(0);
  const base = H - B;
  const f = (n) => n.toFixed(1);
  return `<svg class="mini" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
    aria-label="전 지구 CO₂ 배출 경로 ${esc(x0)}~${esc(x1)}년, ${esc(years.map((y, i) => `${y}년 ${ys[i]}`).join(', '))} GtCO₂/년">
    <line x1="${L}" x2="${W - R}" y1="${f(base)}" y2="${f(base)}" class="axis"/>
    ${years.map((x) => `<line x1="${f(px(x))}" x2="${f(px(x))}" y1="${f(base)}" y2="${f(base + 4)}" class="tick"/>`).join('')}
    <text x="${f(px(x0))}" y="${H - 2}" class="tl" text-anchor="start">${esc(x0)}</text>
    <text x="${f(px(x1))}" y="${H - 2}" class="tl" text-anchor="end">${esc(x1)}</text>
    <line x1="${L}" x2="${W - R}" y1="${f(zy)}" y2="${f(zy)}" class="zero"/>
    <text x="${L - 4}" y="${f(zy + 5)}" class="tl" text-anchor="end">0</text>
    ${segs.map((sg) => `<polyline points="${sg.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="none" stroke="${esc(color)}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
    ${pts.filter(Boolean).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="2.3" fill="${esc(color)}"/>`).join('')}
  </svg>`;
}

function emissionsRange(em) {
  let lo = 0;
  let hi = 0;
  Object.values(em.values || {}).forEach((arr) => arr.forEach((y) => { if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }));
  const pad = (hi - lo) * 0.06 || 1;
  return [lo - pad, hi + pad];
}

function dialogShell(title, body, cls = '') {
  return `<div class="dlg-backdrop" data-action="close-dialog"></div>
  <div class="dlg ${cls}" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
    <div class="dlg-head"><h2 id="dlgTitle">${title}</h2>
      <button class="icon-btn" data-action="close-dialog" data-key="dlg-close" aria-label="닫기">✕</button></div>
    <div class="dlg-body">${body}</div>
  </div>`;
}

function pickerHTML(v) {
  const { s } = v;
  const slot = s.ui.picker;
  const current = slot === 'A' ? s.scenA : s.scenB;
  const other = slot === 'A' ? s.scenB : s.scenA;
  const em = v.emissions;
  const yr = em ? emissionsRange(em) : null;
  const curve = (m) => {
    if (em) return miniCurve(em, m.id, m.color, yr);
    return `<span class="mini-msg">${v.emStatus === 'error' ? '불러오지 못함' : T.loading}</span>`;
  };
  const items = v.manifest.scenarios.map((m) => {
    const disabled = m.id === other;
    return `<li><button class="scen-opt" data-action="pick-scen" data-slot="${slot}" data-id="${esc(m.id)}" data-key="opt-${esc(m.id)}"
      ${pressed(m.id === current)} ${disabled ? 'disabled' : ''}>
      <span class="so-text">
        <span class="so-title"><span class="sdot" style="--c:${esc(m.color)}"></span><b>${esc(m.label)}</b><span class="lv">${esc(m.level)}</span>
          ${disabled ? `<span class="taken">${slot === 'A' ? 'B' : 'A'}에서 선택됨</span>` : ''}</span>
        <span class="so-desc">${esc(SCEN_DESC[m.id] ?? '')}</span>
        <span class="so-co2">${T.co2Label} <b>${esc(m.co2_2100_ppm)}ppm</b></span>
      </span>
      <span class="so-curve">${curve(m)}</span>
    </button></li>`;
  }).join('');
  const none = slot === 'B' ? `<li><button class="scen-opt none" data-action="pick-scen" data-slot="B" data-id="" data-key="opt-none" ${pressed(!s.scenB)}>
      <span class="so-text"><span class="so-title"><b>${T.noneScenario}</b></span><span class="so-desc">${T.noneScenarioDesc}</span></span></button></li>` : '';
  const retry = v.emStatus === 'error' ? `<button class="chip ghost small" data-action="retry-emissions">${T.retry}</button>` : '';
  return dialogShell(`시나리오 고르기 <span class="slot-tag">${slot}</span>`, `
      <p class="dlg-intro">${T.pickerIntro}</p>
      <ul class="scen-list">${items}${none}</ul>
      <p class="caption"><span class="cap-swatch" aria-hidden="true"></span>미니 그래프: ${T.emissionCaption} ${retry}</p>
      <p class="help">ⓘ ${T.pickerNameHelp}</p>
      <p class="help">ⓘ ${T.pickerTextbook}</p>`, 'picker');
}

function infoHTML(v) {
  const m = v.elMeta;
  const info = ELEMENT_INFO[m.id] ?? { def: '', life: '' };
  return dialogShell(`${esc(m.name)} <span class="unit-tag">${esc(m.unit)}</span>`, `
      <p><b>정의</b> ${esc(info.def)}</p>
      ${info.note ? `<p class="def-note">${esc(info.note)}</p>` : ''}
      <p><b>생활 연결</b> ${esc(info.life)}</p>
      <p class="think">${ELEMENT_INFO_LAST}</p>`, 'info');
}

function graphInfoHTML(v) {
  const rows = GRAPH_INFO.map(([k, d]) => `<p><b>${k}</b> ${d}</p>`).join('');
  const dMeta = v.manifest.periods.find((p) => p.derived);
  const method = dMeta && v.el ? D.derivedMethod(v.el, dMeta) : null;
  const methodRow = dMeta ? `<p><b>${dMeta.start}~${dMeta.end} 계산 방법</b> ${esc(method ?? derivedNote(dMeta).replace(/^\* /, ''))} (앱 계산)</p>` : '';
  const periodOnly = v.manifest.regions.filter((r) => [v.s.regionA, v.s.regionB].includes(r.code) && v.el && !D.hasAnnual(v.el, r.code));
  return dialogShell('그래프 읽는 법', `${rows}${methodRow}
    ${periodOnly.length ? `<p class="think">${periodOnly.map((r) => esc(periodOnlyNote(r.short))).join(' / ')}. ${periodOnlyHint}</p>` : ''}
    <p class="help">${T.obsNote}</p>
    <p class="help">${T.ensembleNote}</p>
    ${v.stations?.missingNote ? `<p class="help">${esc(v.stations.missingNote)}</p>` : ''}`, 'info');
}

/** 푸터 [자료 출처 ⓘ] 창: manifest.sources와 지도 파일(sido.json)의 출처·출처표시 문구를 그대로 */
function sourcesHTML(v) {
  const items = sourceLines(v.manifest?.sources).map((l) => `<dt>${esc(l.label)}</dt><dd>${linkify(l.text)}</dd>`);
  const g = v.geo;
  if (g && (g.source || g.attribution)) {
    items.push(`<dt>지도 경계</dt>${g.source ? `<dd>${linkify(g.source)}</dd>` : ''}${g.attribution ? `<dd>${linkify(g.attribution)}</dd>` : ''}`);
  }
  return dialogShell('자료 출처', `<dl class="src-items">${items.join('')}</dl>`, 'info sources');
}

let lastDialog = '';
/** 열린 창 그리기 */
export function renderDialogs(root, v) {
  const { s } = v;
  let key = '';
  let html = '';
  if (s.ui.picker) { key = `picker-${s.ui.picker}`; html = pickerHTML(v); }
  else if (s.ui.info && v.elMeta) { key = `info-${v.elMeta.id}`; html = infoHTML(v); }
  else if (s.ui.graphInfo) { key = 'graphinfo'; html = graphInfoHTML(v); }
  else if (s.ui.sources) { key = 'sources'; html = sourcesHTML(v); }
  if (!key || !html) {
    root.innerHTML = '';
    document.body.classList.remove('dlg-open');
    if (lastDialog) { lastDialog = ''; return { closed: true }; }
    return {};
  }
  root.innerHTML = html;
  document.body.classList.add('dlg-open');
  const opened = key !== lastDialog;
  lastDialog = key;
  return { opened };
}
