// ui-controls.js — 상단 조건 바, 시나리오 선택 창, 기후요소 ⓘ 창, 지역 칩
// 화면은 상태(view.s)로만 그립니다. 버튼은 data-action 속성만 달고, 실제 처리는 main.js 한 곳에서 합니다.
import { T, SCEN_DESC, ELEMENT_INFO, ELEMENT_INFO_LAST, esc } from './text.js';

const pressed = (on) => `aria-pressed="${on ? 'true' : 'false'}"`;

function scenButton(v, slot) {
  const id = slot === 'A' ? v.s.scenA : v.s.scenB;
  const m = id ? v.scenMeta(id) : null;
  const body = m
    ? `<span class="sdot" style="--c:${esc(m.color)}"></span><span class="sl">${esc(m.label)}</span><span class="lv">${esc(m.level)}</span>`
    : `<span class="sl none">${T.noneScenario}</span>`;
  return `<button class="scen-btn" data-action="picker" data-slot="${slot}" data-key="picker-${slot}" aria-haspopup="dialog"
    aria-label="시나리오 ${slot}: ${m ? esc(m.label) : T.noneScenario} — 바꾸기"><span class="slot">${slot}</span>${body}<span class="caret" aria-hidden="true">▾</span></button>`;
}

/** 상단 조건 바 */
export function renderControls(root, v) {
  const { s, manifest } = v;
  if (!manifest) { root.innerHTML = ''; return; }
  const elMeta = v.elMeta;
  const isPrcp = elMeta?.kind === 'prcp';
  const all4Disabled = !!s.regionB;
  root.classList.toggle('collapsed', s.ui.barCollapsed);
  root.innerHTML = `
  <div class="bar-row">
    <span class="bar-label" id="lblEl">요소</span>
    <div class="chips" role="group" aria-labelledby="lblEl">
      ${manifest.elements.map((e) => `<button class="chip" data-action="element" data-id="${esc(e.id)}" data-key="el-${esc(e.id)}" ${pressed(e.id === s.element)}>${esc(e.name)}</button>`).join('')}
    </div>
    <button class="icon-btn" data-action="info" data-key="info" aria-haspopup="dialog" aria-label="${esc(elMeta?.name ?? '')} 설명 보기">ⓘ</button>
  </div>
  <div class="bar-row">
    <span class="bar-label">시나리오</span>
    <div class="scen-pick">${scenButton(v, 'A')}<span class="vs">vs</span>${scenButton(v, 'B')}</div>
    <label class="check${all4Disabled ? ' disabled' : ''}">
      <input type="checkbox" data-change="all4" data-key="all4" ${s.showAll4 && !all4Disabled ? 'checked' : ''} ${all4Disabled ? 'disabled' : ''}>
      <span>4개 모두</span>
    </label>
    ${all4Disabled ? `<span class="hint">${T.all4Disabled}</span>` : ''}
    <div class="seg" role="group" aria-label="표시 방식">
      <button data-action="mode" data-id="abs" data-key="mode-abs" ${pressed(s.mode === 'abs')}>값</button>
      <button data-action="mode" data-id="chg" data-key="mode-chg" ${pressed(s.mode === 'chg')}>변화량</button>
    </div>
    ${isPrcp && s.mode === 'chg' ? `
    <div class="seg" role="group" aria-label="강수량 변화량 단위">
      <button data-action="prcp-unit" data-id="mm" data-key="pu-mm" ${pressed(s.prcpUnit === 'mm')}>mm</button>
      <button data-action="prcp-unit" data-id="pct" data-key="pu-pct" ${pressed(s.prcpUnit === 'pct')}>%</button>
    </div>` : ''}
  </div>`;
}

/** 지도 아래 지역 칩 줄 (지도 영역 안에 들어감) */
export function regionRowHTML(v) {
  const { s } = v;
  const name = (c) => esc(v.regionMeta(c)?.short ?? c);
  let body;
  if (s.pickingRegionB) {
    body = `<span class="pick-hint" role="status">${T.pickRegionB}</span>
      ${s.regionA !== '00' ? `<button class="chip" data-action="nation" data-key="nation">전국</button>` : ''}
      <button class="chip ghost" data-action="cancel-pick" data-key="cancel-pick">취소</button>`;
  } else if (s.regionB) {
    body = `<span class="region-pair"><span class="badge a">A</span>${name(s.regionA)}<span class="sep">·</span><span class="badge b">B</span>${name(s.regionB)}
      <button class="x" data-action="clear-b" data-key="clear-b" aria-label="지역 비교 끝내기">✕</button></span>
      <button class="chip" data-action="nation" data-key="nation" ${pressed(s.regionA === '00')}>전국</button>`;
  } else {
    body = `<span class="region-name">${name(s.regionA)}</span>
      <button class="chip" data-action="nation" data-key="nation" ${pressed(s.regionA === '00')}>전국</button>
      <button class="chip ghost" data-action="pick-b" data-key="pick-b">+ 비교 지역</button>`;
  }
  return `<div class="region-row"><span class="bar-label">지역</span>${body}</div>`;
}

/* ───────────── 시나리오 선택 창 ───────────── */

/** 미니 배출 곡선 — 네 곡선 모두 같은 y축(yr) */
function miniCurve(em, id, color, yr) {
  const W = 132;
  const H = 46;
  const P = 4;
  const ys = em.values?.[id];
  if (!ys) return '';
  const x0 = em.years[0];
  const x1 = em.years[em.years.length - 1];
  const px = (x) => P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const py = (y) => H - P - ((y - yr[0]) / (yr[1] - yr[0] || 1)) * (H - 2 * P);
  const pts = em.years.map((x, i) => (Number.isFinite(ys[i]) ? `${px(x).toFixed(1)},${py(ys[i]).toFixed(1)}` : null));
  // 빈 값이 있으면 선을 끊어서 그림
  const segs = [];
  let cur = [];
  pts.forEach((p) => { if (p) cur.push(p); else { if (cur.length) segs.push(cur); cur = []; } });
  if (cur.length) segs.push(cur);
  const zy = py(0).toFixed(1);
  return `<svg class="mini" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="전 지구 CO₂ 배출 경로 (${esc(em.years[0])}~${esc(x1)})">
    <line x1="${P}" x2="${W - P}" y1="${zy}" y2="${zy}" class="zero"/>
    <text x="${W - P}" y="${Number(zy) - 3}" class="zl" text-anchor="end">0</text>
    ${segs.map((sg) => `<polyline points="${sg.join(' ')}" fill="none" stroke="${esc(color)}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
  </svg>`;
}

function emissionsRange(em) {
  let lo = 0;
  let hi = 0;
  Object.values(em.values || {}).forEach((arr) => arr.forEach((y) => { if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }));
  const pad = (hi - lo) * 0.06 || 1;
  return [lo - pad, hi + pad];
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
    if (v.emStatus === 'error') return `<span class="mini-msg">불러오지 못함</span>`;
    return `<span class="mini-msg">${T.loading}</span>`;
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
  return `
  <div class="dlg-backdrop" data-action="close-dialog"></div>
  <div class="dlg picker" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
    <div class="dlg-head">
      <h2 id="dlgTitle">시나리오 고르기 <span class="slot-tag">${slot}</span></h2>
      <button class="icon-btn" data-action="close-dialog" data-key="dlg-close" aria-label="닫기">✕</button>
    </div>
    <div class="dlg-body">
      <p class="dlg-intro">${T.pickerIntro}</p>
      <ul class="scen-list">${items}${none}</ul>
      <p class="caption"><span class="cap-swatch" aria-hidden="true"></span>미니 그래프: ${T.emissionCaption} ${retry}</p>
      <p class="help">ⓘ ${T.pickerNameHelp}</p>
      <p class="help">ⓘ ${T.pickerTextbook}</p>
    </div>
  </div>`;
}

function infoHTML(v) {
  const m = v.elMeta;
  const info = ELEMENT_INFO[m.id] ?? { def: '', life: '' };
  return `
  <div class="dlg-backdrop" data-action="close-dialog"></div>
  <div class="dlg info" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
    <div class="dlg-head">
      <h2 id="dlgTitle">${esc(m.name)} <span class="unit-tag">${esc(m.unit)}</span></h2>
      <button class="icon-btn" data-action="close-dialog" data-key="dlg-close" aria-label="닫기">✕</button>
    </div>
    <div class="dlg-body">
      <p><b>정의</b> ${esc(info.def)}</p>
      <p><b>생활 연결</b> ${esc(info.life)}</p>
      <p class="think">${ELEMENT_INFO_LAST}</p>
    </div>
  </div>`;
}

let lastDialog = '';
/** 열린 창 그리기 (시나리오 선택 / ⓘ) */
export function renderDialogs(root, v) {
  const { s } = v;
  const key = s.ui.picker ? `picker-${s.ui.picker}` : s.ui.info && v.elMeta ? `info-${v.elMeta.id}` : '';
  if (!key) {
    root.innerHTML = '';
    document.body.classList.remove('dlg-open');
    if (lastDialog) { lastDialog = ''; return { closed: true }; }
    return {};
  }
  root.innerHTML = s.ui.picker ? pickerHTML(v) : infoHTML(v);
  document.body.classList.add('dlg-open');
  const opened = key !== lastDialog;
  lastDialog = key;
  return { opened };
}
