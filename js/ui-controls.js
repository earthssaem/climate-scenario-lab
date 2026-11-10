// ui-controls.js — 상단 바, 조건 토큰 줄, 선택 창들(지역·요소·시나리오·기간·표시 방식), ⓘ 창
// 화면은 상태(view.s)로만 그립니다. 버튼은 data-action 속성만 달고, 실제 처리는 main.js 한 곳에서 합니다.
import {
  T, SCEN_DESC, ELEMENT_INFO, ELEMENT_INFO_LAST, GRAPH_INFO, esc, modeName, derivedNote, derivedShort, periodOnlyNote, periodOnlyHint, sourceLines, linkify,
} from './text.js';
import * as D from './data.js';

const pressed = (on) => `aria-pressed="${on ? 'true' : 'false'}"`;
const shortEl = (name) => name.replace(/일수$/, '');   // 폭염일수 → 폭염 (상단 바용 짧은 이름)

/* ───────────── 상단 바 ───────────── */

export function renderTopControls(root, v) {
  const { s, manifest } = v;
  if (!manifest) { root.innerHTML = ''; return; }
  const isPrcp = v.elMeta?.kind === 'prcp';
  root.innerHTML = `
    <div class="seg el-seg" role="group" aria-label="기후요소">
      ${manifest.elements.map((e) => `<button data-action="element" data-id="${esc(e.id)}" data-key="el-${esc(e.id)}"
        ${pressed(e.id === s.element)} aria-label="${esc(e.name)}">${esc(shortEl(e.name))}</button>`).join('')}
    </div>
    <button class="icon-btn" data-action="info" data-key="info" aria-haspopup="dialog" aria-label="${esc(v.elMeta?.name ?? '')} 설명 보기">ⓘ</button>
    <div class="seg" role="group" aria-label="표시 방식">
      <button data-action="mode" data-id="abs" data-key="mode-abs" ${pressed(s.mode === 'abs')}>값</button>
      <button data-action="mode" data-id="chg" data-key="mode-chg" ${pressed(s.mode === 'chg')}>변화량</button>
    </div>
    ${isPrcp && s.mode === 'chg' ? `<div class="seg" role="group" aria-label="강수량 변화량 단위">
      <button data-action="prcp-unit" data-id="mm" data-key="pu-mm" ${pressed(s.prcpUnit === 'mm')}>mm</button>
      <button data-action="prcp-unit" data-id="pct" data-key="pu-pct" ${pressed(s.prcpUnit === 'pct')}>%</button>
    </div>` : ''}`;
}

/* ───────────── 조건 토큰 줄 ───────────── */

function scenToken(v, slot) {
  const id = slot === 'A' ? v.s.scenA : v.s.scenB;
  const m = id ? v.scenMeta(id) : null;
  return `<button class="token scen" data-action="picker" data-slot="${slot}" data-key="tk-${slot}" aria-haspopup="dialog"
    aria-label="시나리오 ${slot}: ${m ? esc(m.label) : T.noneScenario} — 바꾸기"><span class="ab">${slot}</span>${m
    ? `<span class="sdot" style="--c:${esc(m.color)}"></span>${esc(m.label)}` : `<span class="none">${T.noneScenario}</span>`}</button>`;
}

export function renderTokens(root, v) {
  const { s } = v;
  if (!v.manifest || !v.elMeta) { root.innerHTML = ''; return; }
  const nm = (c) => esc(v.regionMeta(c)?.short ?? c);
  const pm = v.periodMeta(s.period);
  const periodText = s.year != null ? `${s.year}년` : pm ? (pm.derived ? `${pm.start}~${pm.end}*` : `${pm.start}~${pm.end}`) : '';
  root.innerHTML = `
    <button class="token" data-action="chooser" data-kind="region" data-key="tk-region" aria-haspopup="dialog" aria-label="지역 바꾸기">
      <span class="ic" aria-hidden="true">📍</span>${nm(s.regionA)}${s.regionB ? `<span class="vs">vs</span>${nm(s.regionB)}` : ''}</button>
    <button class="token" data-action="chooser" data-kind="element" data-key="tk-element" aria-haspopup="dialog" aria-label="기후요소 바꾸기">
      <span class="ic" aria-hidden="true">🌡</span>${esc(v.elMeta.name)}</button>
    <span class="token-pair">${scenToken(v, 'A')}<span class="vs">vs</span>${scenToken(v, 'B')}</span>
    <span class="token-pair">
      <button class="token" data-action="chooser" data-kind="period" data-key="tk-period" aria-haspopup="dialog" aria-label="기간 바꾸기">
        <span class="ic" aria-hidden="true">🕘</span>${periodText}</button>
      ${s.year != null ? `<button class="token-x" data-action="clear-year" data-key="tk-clear-year" aria-label="연도 보기 끝내기, 20년 평균으로">✕</button>` : ''}
    </span>
    <button class="token" data-action="chooser" data-kind="mode" data-key="tk-mode" aria-haspopup="dialog" aria-label="표시 방식 바꾸기">
      <span class="ic" aria-hidden="true">Δ</span>${esc(modeName(s.mode, v.pct))}</button>
    ${s.mapView === 'diff' && s.scenB ? `<span class="tag">${T.diffMapTag}</span>` : ''}`;
}

/** 지도 위 도구 줄 왼쪽: [전국] [+ 비교 지역] / 비교 중 칩 / 고르는 중 안내 */
export function regionToolsHTML(v) {
  const { s } = v;
  const name = (c) => esc(v.regionMeta(c)?.short ?? c);
  if (s.pickingRegionB) {
    return `<span class="pick-hint" role="status">${T.pickRegionB}</span>
      ${s.regionA !== '00' ? `<button class="chip" data-action="nation" data-key="nation">전국</button>` : ''}
      <button class="chip ghost" data-action="cancel-pick" data-key="cancel-pick">취소</button>`;
  }
  const nation = `<button class="chip" data-action="nation" data-key="nation" ${pressed(s.regionA === '00')}>전국</button>`;
  if (s.regionB) {
    return `${nation}<span class="region-pair"><span class="badge">A</span>${name(s.regionA)}<span class="badge b">B</span>${name(s.regionB)}
      <button class="x" data-action="clear-b" data-key="clear-b" aria-label="지역 비교 끝내기">✕</button></span>`;
  }
  return `${nation}<button class="chip ghost" data-action="pick-b" data-key="pick-b">+ 비교 지역</button>`;
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

/* ───────────── 조건 토큰 선택 창 ───────────── */

function regionChooser(v) {
  const { s, manifest } = v;
  const btn = (r, slot, on, disabled = false) => `<button class="opt" data-action="choose-region" data-slot="${slot}" data-id="${esc(r.code)}"
    data-key="cr-${slot}-${esc(r.code)}" ${pressed(on)} ${disabled ? 'disabled' : ''}>${esc(r.short)}</button>`;
  return dialogShell(T.regionChooser, `
    <section class="ch-sec"><h3>${T.regionA}</h3>
      <div class="opt-grid">${manifest.regions.map((r) => btn(r, 'A', r.code === s.regionA)).join('')}</div></section>
    <section class="ch-sec"><h3>${T.regionB} <span class="sub">그래프·수치에서 두 지역을 나란히 비교</span></h3>
      <div class="opt-grid">
        <button class="opt" data-action="choose-region" data-slot="B" data-id="" data-key="cr-B-none" ${pressed(!s.regionB)}>${T.noCompare}</button>
        ${manifest.regions.map((r) => btn(r, 'B', r.code === s.regionB, r.code === s.regionA)).join('')}</div></section>
    <p class="help">지도에서 시도를 눌러도 지역 A가 바뀌어요.</p>`, 'chooser');
}

function elementChooser(v) {
  const { s, manifest } = v;
  return dialogShell(T.elementChooser, `<div class="opt-list">${manifest.elements.map((e) => {
    const info = ELEMENT_INFO[e.id] ?? { def: '', life: '' };
    return `<button class="opt wide" data-action="element" data-id="${esc(e.id)}" data-key="ce-${esc(e.id)}" ${pressed(e.id === s.element)}>
      <b>${esc(e.name)} <span class="unit-tag">${esc(e.unit)}</span></b><span class="d">${esc(info.def)} ${esc(info.life)}</span></button>`;
  }).join('')}</div><p class="think">${ELEMENT_INFO_LAST}</p>`, 'chooser');
}

function periodChooser(v) {
  const { s, manifest } = v;
  const derived = manifest.periods.find((p) => p.derived);
  return dialogShell(T.periodChooser, `
    ${s.year != null ? `<button class="opt wide" data-action="clear-year" data-key="cp-clear-year"><b>${T.endYear}</b><span class="d">지금은 ${s.year}년 값을 보고 있어요. 20년 평균으로 돌아가요.</span></button>` : ''}
    <div class="opt-list">${manifest.periods.map((p) => {
      const off = p.derived && !v.derivedOk(p);
      return `<button class="opt wide" data-action="period" data-id="${esc(p.id)}" data-key="cp-${esc(p.id)}"
        ${pressed(s.year == null && p.id === s.period)} ${off ? 'disabled' : ''}>
        <b>${esc(p.derived ? `${p.label}*` : p.label)}</b><span class="d">${p.start}~${p.end}년${p.derived ? ` · ${T.appCalc}` : ''}${off ? ' · 이 요소는 10년 값이 없어 쓸 수 없어요' : ''}</span></button>`;
    }).join('')}</div>
    ${derived ? `<p class="help">${esc(derivedShort(derived, D.derivedMethod(v.el, derived)))}</p>` : ''}
    <p class="help">그래프 아래 기간 띠를 눌러도 바뀌어요. 그래프를 누르면 한 해의 값을 볼 수 있어요.</p>`, 'chooser');
}

function modeChooser(v) {
  const { s } = v;
  const isPrcp = v.elMeta?.kind === 'prcp';
  const opts = [['abs', 'mm', '값', `${v.elMeta.unit} 그대로`], ['chg', 'mm', '현재 대비 변화량', `현재기후(2000~2019)와의 차이 (${v.elMeta.unit})`]];
  if (isPrcp) opts.push(['chg', 'pct', '현재 대비 변화율(%)', '(값 − 현재) ÷ 현재 × 100. 시나리오 차이는 %p로 표시']);
  return dialogShell(T.modeChooser, `<div class="opt-list">${opts.map(([mode, unit, label, d]) => {
    const on = s.mode === mode && (mode === 'abs' || !isPrcp || s.prcpUnit === unit);
    return `<button class="opt wide" data-action="mode-opt" data-mode="${mode}" data-unit="${unit}" data-key="cm-${mode}-${unit}" ${pressed(on)}>
      <b>${label}</b><span class="d">${d}</span></button>`;
  }).join('')}</div>`, 'chooser');
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
  else if (s.ui.chooser && v.elMeta) {
    key = `chooser-${s.ui.chooser}`;
    html = { region: regionChooser, element: elementChooser, period: periodChooser, mode: modeChooser }[s.ui.chooser]?.(v) ?? '';
  }
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
