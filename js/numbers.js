// numbers.js — 수치 비교 표 + 기간별 차이 막대그래프(B−A)
// 데이터에 나타난 값을 그대로 보여 줍니다. 증가·감소 같은 결론 문구를 자동으로 붙이지 않습니다.
import * as D from './data.js';
import { rangeOf } from './scales.js';
import { T, esc, fmtNum, fmtSigned, fmtDiff, unitOf, withUnit, derivedShort, periodOnlyNote } from './text.js';
import { chartTitle, obsLabelText } from './chart.js';

function cellButton(pid, enabled, big, small, label) {
  return `<button class="cell" data-action="period" data-id="${esc(pid)}" ${enabled ? '' : 'disabled'}
    aria-label="${esc(label)}"><span class="big">${big}</span>${small ? `<span class="small">${small}</span>` : ''}</button>`;
}

/* ───────────── 표 ───────────── */

function tableHTML(v) {
  const { s, el, elMeta, manifest } = v;
  const periods = manifest.periods;
  const regions = [s.regionA, ...(s.regionB ? [s.regionB] : [])];
  const compare = regions.length === 2;
  const A = v.scenMeta(s.scenA);
  const B = s.scenB ? v.scenMeta(s.scenB) : null;
  const scens = s.showAll4 && !compare
    ? [A, ...(B ? [B] : []), ...manifest.scenarios.filter((m) => m.id !== s.scenA && m.id !== s.scenB)]
    : [A, ...(B ? [B] : [])];
  const nm = (c) => v.regionMeta(c)?.short ?? c;
  const valUnit = elMeta.unit;
  const chgUnit = unitOf(elMeta, v.pct, 'change');
  const selCol = s.year == null ? s.period : null;
  const pOk = (p) => !p.derived || v.derivedOk(p);

  const head = `<tr><th scope="col" class="rowh">시나리오</th>${periods.map((p) => {
    const cls = [p.id === selCol ? 'sel' : '', pOk(p) ? '' : 'off'].join(' ').trim();
    const sub = p.derived ? `${T.appCalc}` : `${p.start}~${p.end}`;
    return `<th scope="col" class="${cls}">${esc(p.label)}${p.derived ? '*' : ''}<span class="yr">${sub}</span></th>`;
  }).join('')}</tr>`;

  const td = (p, inner) => `<td class="${p.id === selCol ? 'sel' : ''}">${inner}</td>`;
  const raw = (scen, pid, r) => D.periodValue(el, scen, pid, r, periods);
  const shown = (scen, pid, r) => D.toMode(raw(scen, pid, r), D.curValue(el, r), s.mode, v.pct);

  const scenRow = (m, r) => `<tr><th scope="row" class="rowh"><span class="nm"><span class="sdot" style="--c:${esc(m.color)}"></span>${esc(m.label)}</span><span class="lv">${esc(m.level)}</span></th>
    ${periods.map((p) => {
      if (!pOk(p)) return td(p, cellButton(p.id, false, '—', '', `${p.label} 자료 없음`));
      const value = raw(m.id, p.id, r);
      const change = D.toMode(value, D.curValue(el, r), 'chg', v.pct);
      const valTxt = withUnit(fmtNum(value), valUnit);
      const chgTxt = withUnit(fmtSigned(change), chgUnit);
      if (p.id === 'cur') {
        // 현재 열은 기준값 — 모든 시나리오가 같은 값
        return td(p, cellButton(p.id, true, valTxt, '기준', `${m.label} ${p.label} ${valTxt}, 변화량 기준`));
      }
      const [big, small] = s.mode === 'abs' ? [valTxt, chgTxt] : [chgTxt, valTxt];
      return td(p, cellButton(p.id, true, big, D.isNum(value) ? small : '', `${m.label} ${p.label} ${big}`));
    }).join('')}</tr>`;

  const diffRow = (r) => `<tr class="diff"><th scope="row" class="rowh">차이 B−A<span class="lv">${T.appCalc}</span></th>
    ${periods.map((p) => {
      if (p.id === 'cur') return td(p, cellButton(p.id, true, '—', '', `${p.label} 시나리오 차이 없음`));
      if (!pOk(p)) return td(p, cellButton(p.id, false, '—', '', `${p.label} 자료 없음`));
      const d = D.diffBA(shown(s.scenA, p.id, r), shown(s.scenB, p.id, r));
      const txt = fmtDiff(d, elMeta, v.pct);
      return td(p, cellButton(p.id, true, txt, '', `${p.label} B−A ${txt}`));
    }).join('')}</tr>`;

  const regionDiffRow = (m) => `<tr class="rdiff"><th scope="row" class="rowh">지역 차이 A−B<span class="lv">${esc(m.label)} · ${T.appCalc}</span></th>
    ${periods.map((p) => {
      if (!pOk(p)) return td(p, cellButton(p.id, false, '—', '', `${p.label} 자료 없음`));
      // 값 모드: 값의 차이 / 변화량 모드: 변화량의 차이(% 모드면 %p)
      const a = shown(m.id, p.id, s.regionA);
      const b = shown(m.id, p.id, s.regionB);
      const dd = D.isNum(a) && D.isNum(b) ? a - b : null;
      const txt = s.mode === 'abs' ? withUnit(fmtSigned(dd), valUnit) : fmtDiff(dd, elMeta, v.pct);
      return td(p, cellButton(p.id, true, txt, '', `${m.label} ${p.label} 지역 차이 ${txt}`));
    }).join('')}</tr>`;

  let body = '';
  regions.forEach((r) => {
    if (compare) body += `<tr class="group"><th colspan="${periods.length + 1}"><span class="badge">${r === s.regionA ? 'A' : 'B'}</span> ${esc(nm(r))}</th></tr>`;
    scens.forEach((m) => { body += scenRow(m, r); });
    if (B) body += diffRow(r);
  });
  if (compare) {
    body += `<tr class="group"><th colspan="${periods.length + 1}">${esc(nm(s.regionA))} − ${esc(nm(s.regionB))}</th></tr>`;
    [A, ...(B ? [B] : [])].forEach((m) => { body += regionDiffRow(m); });
  }
  return `<div class="tbl-wrap"><table class="num-tbl">
    <caption class="sr-only">기간 × 시나리오 수치 비교. 칸을 누르면 그 기간으로 지도와 그래프가 바뀝니다.</caption>
    <thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/* ───────────── 기간별 차이 막대 (B−A) ───────────── */

function barsHTML(v, width) {
  const { s, el, elMeta, manifest } = v;
  if (s.scenMode === 'single') return '';   // 하나만 보기: 시나리오 차이 막대는 두 개 비교에서만
  if (!s.scenB) return `<p class="bars-title">기간별 시나리오 차이 (B − A, ${T.appCalc})</p><p class="note">${T.needB}</p>`;
  const A = v.scenMeta(s.scenA);
  const B = v.scenMeta(s.scenB);
  const periods = manifest.periods.filter((p) => p.id !== 'cur');
  const regions = [s.regionA, ...(s.regionB ? [s.regionB] : [])];
  const nm = (c) => v.regionMeta(c)?.short ?? c;
  const unit = unitOf(elMeta, v.pct, 'diff');
  const vals = periods.map((p) => regions.map((r) => {
    if (p.derived && !v.derivedOk(p)) return null;
    const base = D.curValue(el, r);
    const a = D.toMode(D.periodValue(el, s.scenA, p.id, r, manifest.periods), base, s.mode, v.pct);
    const b = D.toMode(D.periodValue(el, s.scenB, p.id, r, manifest.periods), base, s.mode, v.pct);
    return D.diffBA(a, b);
  }));

  // 세로 범위: 요소 파일의 고정 scale(diff / pctDiff)을 써서 조건을 바꿔도 막대 축이 과장되지 않게
  const sc = el.scale?.period ?? el.scale ?? {};   // 기간 범위 (scale이 기간/연별로 나뉜 형식도 받음)
  const dr = rangeOf(v.pct ? sc.pctDiff : sc.diff);   // [최솟값, 최댓값] 또는 예전 대칭 값
  let m = dr ? Math.max(Math.abs(dr[0]), Math.abs(dr[1])) : null;
  const all = vals.flat().filter(D.isNum);
  const maxAbs = all.length ? Math.max(...all.map(Math.abs)) : 0;
  if (!D.isNum(m) || m <= 0) m = maxAbs || 1;
  m = Math.max(m, maxAbs); // 범위를 넘는 값이 있으면 잘리지 않게만 넓힘

  const W = Math.max(300, Math.round(width));   // 화면 폭 그대로(글자가 작아지지 않게)
  const H = 210;
  const padL = 46;
  const padR = 10;
  const top = 22;
  const bottom = 34;
  const plotH = H - top - bottom;
  const zeroY = top + plotH / 2;
  const yOf = (val) => zeroY - (val / m) * (plotH / 2);
  const groupW = (W - padL - padR) / periods.length;
  const nR = regions.length;
  const barW = Math.min(46, (groupW - 18) / nR);
  const fillFor = (ri) => (ri === 0 ? '#5b6475' : '#aab1bc');
  const selP = s.year == null ? s.period : null;

  let g = '';
  // 선택한 기간 바탕 → 축과 0선 → 막대 순서로 그림
  const selIdx = periods.findIndex((p) => p.id === selP);
  if (selIdx > -1) g += `<rect x="${padL + selIdx * groupW + 3}" y="${top - 18}" width="${groupW - 6}" height="${plotH + 36}" fill="#f0f2f5" rx="8"/>`;
  const dec = Number.isInteger(m / 2) ? 0 : Number.isInteger(m * 5) ? 1 : 2;
  [m, m / 2, 0, -m / 2, -m].forEach((t) => {
    const y = yOf(t);
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="${t === 0 ? '#5b6475' : '#e6e9ee'}" stroke-width="${t === 0 ? 1.4 : 1}"/>`;
    g += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end">${t === 0 ? '0' : fmtSigned(t, dec)}</text>`;
  });
  periods.forEach((p, i) => {
    const gx = padL + i * groupW;
    const cx = gx + groupW / 2;
    const off = p.derived && !v.derivedOk(p);
    let inner = `<rect class="hit" x="${gx + 3}" y="${top - 18}" width="${groupW - 6}" height="${plotH + 36}" fill="transparent" rx="8"/>`;
    regions.forEach((r, ri) => {
      const val = vals[i][ri];
      const x = cx - (nR * barW) / 2 + ri * barW + 2;
      if (!D.isNum(val)) {
        inner += `<text x="${x + (barW - 4) / 2}" y="${zeroY - 6}" text-anchor="middle" class="pl">${off ? '—' : '자료 없음'}</text>`;
        return;
      }
      const y = Math.min(yOf(val), zeroY);
      const h = Math.max(1, Math.abs(yOf(val) - zeroY));
      inner += `<rect x="${x}" y="${y}" width="${barW - 4}" height="${h}" fill="${fillFor(ri)}" rx="2"/>`;
      const ty = val >= 0 ? y - 5 : y + h + 14;
      inner += `<text x="${x + (barW - 4) / 2}" y="${ty}" text-anchor="middle" class="v">${esc(fmtSigned(val))}</text>`;
    });
    inner += `<text x="${cx}" y="${H - 12}" text-anchor="middle" class="pl${p.id === selP ? ' sel' : ''}">${esc(p.label)}${p.derived ? '*' : ''}</text>`;
    g += `<g class="bar-g" data-action="period" data-id="${esc(p.id)}" role="button" tabindex="${off ? -1 : 0}" ${off ? 'aria-disabled="true"' : ''}
      aria-label="${esc(p.label)} B−A ${vals[i].map((x) => (D.isNum(x) ? fmtSigned(x) + unit : '자료 없음')).join(', ')}">${inner}</g>`;
  });

  const legend = nR === 2
    ? `<div class="bars-legend"><span><span class="sw" style="background:${fillFor(0)}"></span>A ${esc(nm(s.regionA))}</span><span><span class="sw" style="background:${fillFor(1)}"></span>B ${esc(nm(s.regionB))}</span></div>`
    : '';
  return `<p class="bars-title">기간별 시나리오 차이 (B − A, ${T.appCalc})</p>
    <p class="bars-sub">${esc(B.label)} − ${esc(A.label)} · 단위 ${esc(unit)}${regions.length === 1 ? ` · ${esc(nm(s.regionA))}` : ''}</p>
    <svg class="bars-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="기간별 시나리오 차이 막대그래프">${g}</svg>${legend}`;
}

/* ───────────── 숫자 카드 (오른쪽 그래프 패널의 제목 바로 아래) ─────────────
   머리 줄: 무엇의 값인지(기간 20년 평균 또는 연도) — 예전 그래프 위 연도 정보 줄을 여기에 합침
   현재기후(현재기후 기간, 2000~2019년)는 시나리오와 무관하므로 A·B로 나누지 않고 한 값만 */
export function renderKeybar(root, v) {
  if (!root) return;
  const { s, el, elMeta, manifest } = v;
  if (!manifest || !elMeta) return;
  const detailsBtn = `<button class="details-btn" data-action="toggle-details" data-key="details" aria-expanded="${s.ui.details}" aria-controls="details">
        ${s.ui.details ? '▴' : '▾'} ${T.details}</button>`;
  if (!el) {
    root.innerHTML = `<div class="kb-card"><div class="kb-rows"><span class="pill">${v.elStatus === 'error' ? T.loadFail : `<span class="spinner"></span>${T.loading}`}</span></div></div>`;
    return;
  }
  const periods = manifest.periods;
  const regions = [s.regionA, ...(s.regionB ? [s.regionB] : [])];
  const compare = regions.length === 2;
  const A = v.scenMeta(s.scenA);
  const B = s.scenB ? v.scenMeta(s.scenB) : null;
  const year = s.year;
  const pMeta = year == null ? v.periodMeta(s.period) : null;
  const src = year != null ? D.yearSource(el, year) : null;
  const curLike = (pMeta && pMeta.id === 'cur') || src === 'current';
  const badge = v.mock ? `<span class="mock-badge">${T.mockBadge}</span>` : '';
  const unit = elMeta.unit;
  const chgUnit = unitOf(elMeta, v.pct, 'change');
  const nm = (c) => esc(v.regionMeta(c)?.short ?? c);
  const obsSeries = year != null && v.obsOn && v.stations ? v.stations.series?.[s.obsLayer.series] : null;
  const obsVal = obsSeries ? D.obsYearValue(obsSeries, year) : null;
  const r1 = (x) => Math.round(x * 10) / 10;

  // 머리 줄
  let when;
  if (pMeta) when = `${esc(pMeta.label)}(${pMeta.start}~${pMeta.end}) · 20년 평균`;
  else if (src === 'projection') when = `${year}년 · 기후모델 전망(5개 모델 평균)`;
  else if (src === 'current') when = `${year}년 · 현재기후`;
  else when = obsSeries ? `${year}년 · 관측` : `${year}년`;
  const calc = pMeta?.derived ? `<span class="kb-calc">${T.appCalcValue}</span>` : '';
  const obsExtra = obsSeries && src !== 'none'
    ? `<span class="kb-obs"><span class="obs-dot"></span>${esc(obsLabelText(obsSeries))} ${D.isNum(obsVal) ? withUnit(fmtSigned(obsVal), '℃') : T.noData}</span>` : '';

  // 현재기후 값 아래 안내: 시나리오가 갈라지는 해(전망 시작 연도)
  const projStart = D.blockRange(el, 'projection')?.[0] ?? periods.find((p) => p.id !== 'cur')?.start;
  const curHint = `<span class="kb-hint">${T.curHint(projStart)}</span>`;
  // "현재기후" 옆 ⓘ — 기간 버튼 옆 ⓘ와 같은 설명 창
  const curInfoBtn = `<button class="lg-info kb-info" data-action="note" data-id="cur" data-key="note-cur-kb" aria-haspopup="dialog" aria-label="현재기후 설명">ⓘ</button>`;
  const cell = (lbl, val, cls = '') => `<div class="kb-item${cls ? ` ${cls}` : ''}">${lbl}<span class="kb-val">${val}</span></div>`;
  const lblScen = (slot, m) => `<span class="kb-lbl"><span class="ab">${slot}</span><span class="sdot" style="--c:${esc(m.color)}"></span>${esc(m.label)}</span>`;
  const lblText = (t) => `<span class="kb-lbl">${t}</span>`;
  const noteCell = (text) => cell(lblText(T.scenDiff), `<span class="kb-msg">${text}</span>`, 'diff');
  const raw = (scen, r) => (year != null ? D.regionYearValue(el, scen, r, year) : D.periodValue(el, scen, s.period, r, periods));
  const missing = (r) => (year != null && !D.hasAnnual(el, r) ? T.noYearValue : T.noData);

  const scenCell = (slot, m, r) => {
    const value = raw(m.id, r);
    if (!D.isNum(value)) return cell(lblScen(slot, m), `<b class="big na">${missing(r)}</b>`);
    const valTxt = withUnit(fmtNum(value), unit);
    const chgTxt = withUnit(fmtSigned(D.toMode(value, D.curValue(el, r), 'chg', v.pct)), chgUnit);
    const [big, small] = s.mode === 'abs' ? [valTxt, chgTxt] : [chgTxt, valTxt];
    return cell(lblScen(slot, m), `<b class="big">${big}</b><span class="small">(${small})</span>${badge}`);
  };
  const diffCell = (r) => {
    const a = D.toMode(raw(s.scenA, r), D.curValue(el, r), s.mode, v.pct);
    const b = D.toMode(raw(s.scenB, r), D.curValue(el, r), s.mode, v.pct);
    const d = D.diffBA(a, b);
    return cell(lblText(T.scenDiff), D.isNum(d) ? `<b class="big">${fmtDiff(d, elMeta, v.pct)}</b>${badge}` : `<b class="big na">${missing(r)}</b>`, 'diff');
  };
  // 현재기후: 한 값만. 연도면 "2014년 15.5일 (현재기후 평균 31.2일보다 15.7일 적음)" — 변화량 모드여도 같은 형식
  const curCell = (r) => {
    const base = D.curValue(el, r);
    const value = year != null ? D.regionYearValue(el, s.scenA, r, year) : base;
    const lbl = lblText(`${T.curClimate}${compare ? '' : ` · ${nm(r)}`}${curInfoBtn}`);
    if (!D.isNum(value)) return cell(lbl, `<b class="big na">${missing(r)}</b>`, 'wide');
    const valTxt = withUnit(fmtNum(value), unit);
    if (year == null) return cell(lbl, `<b class="big">${valTxt}</b><span class="small">(${T.curBase})</span>${badge}${curHint}`, 'wide');
    let cmp = '';
    if (D.isNum(base)) {
      const d = r1(r1(value) - r1(base));   // 화면에 보이는 두 수의 차이와 같게
      const word = d > 0 ? (elMeta.kind === 'temp' ? '높음' : '많음') : (elMeta.kind === 'temp' ? '낮음' : '적음');
      cmp = d === 0 ? `현재기후 평균(${withUnit(fmtNum(base), unit)})과 같음`
        : `현재기후 평균 ${withUnit(fmtNum(base), unit)}보다 ${withUnit(fmtNum(Math.abs(d)), unit)} ${word}`;
    }
    return cell(lbl, `<b class="yr">${year}년</b> <b class="big">${valTxt}</b>${cmp ? ` <span class="small">(${cmp})</span>` : ''}${badge}${curHint}`, 'wide');
  };
  const noneCell = (r) => (obsSeries
    ? cell(lblText(`<span class="obs-dot"></span>${esc(obsLabelText(obsSeries))}`), D.isNum(obsVal)
      ? `<b class="yr">${year}년</b> <b class="big">${withUnit(fmtSigned(obsVal), '℃')}</b><span class="small">(지점별 2000~2019 평균 대비)</span>` : `<b class="big na">${T.noData}</b>`, 'wide')
    : cell(lblText(nm(r)), `<b class="big na">${T.noData}</b>`, 'wide'));

  // 하나만 보기: 고른 시나리오의 값과 현재기후 대비 변화량을 나란히 (A·B·차이 없음)
  const single = s.scenMode === 'single';
  const singleCells = (m, r) => {
    const value = raw(m.id, r);
    const lbl = `<span class="kb-lbl"><span class="sdot" style="--c:${esc(m.color)}"></span>${esc(m.label)} · 값</span>`;
    if (!D.isNum(value)) return cell(lbl, `<b class="big na">${missing(r)}</b>`);
    const base = D.curValue(el, r);
    const chg = D.toMode(value, base, 'chg', v.pct);
    return cell(lbl, `<b class="big">${withUnit(fmtNum(value), unit)}</b>${badge}`)
      + cell(lblText(v.pct ? '현재기후 대비 변화율' : '현재기후 대비 변화량'), D.isNum(chg)
        ? `<b class="big">${withUnit(fmtSigned(chg), chgUnit)}</b>${D.isNum(base) ? `<span class="small">(현재기후 ${withUnit(fmtNum(base), unit)} 기준)${curInfoBtn}</span>` : ''}`
        : `<b class="big na">${T.noData}</b>`, 'diff');
  };
  const rowFor = (r, i) => {
    let cells;
    if (year != null && !D.hasAnnual(el, r)) {
      cells = cell(lblText(nm(r)), `<span class="kb-msg">${esc(periodOnlyNote(v.regionMeta(r)?.short ?? r))}</span>`, 'wide') + (B ? noteCell('—') : '');
    } else if (curLike) {
      cells = curCell(r);   // 현재기후는 시나리오와 무관 — 두 시나리오 차이 칸 없이, 값 아래 안내 한 줄
    } else if (year != null && src === 'none') {
      cells = noneCell(r) + (B ? noteCell(obsSeries ? T.obsNoScen : T.noData) : '');
    } else if (single) {
      cells = singleCells(A, r);
    } else {
      cells = scenCell('A', A, r) + (B ? scenCell('B', B, r) + diffCell(r) : '');
    }
    return `<div class="kb-row">${compare ? `<span class="kb-region"><span class="badge${i ? ' b' : ''}">${i ? 'B' : 'A'}</span>${nm(r)}</span>` : ''}
      <div class="kb-stats">${cells}</div></div>`;
  };

  // 머리 줄(무엇의 값인지) 오른쪽 끝에 [기간별 표], 그 아래 숫자 줄은 카드 폭 전체를 씀
  root.innerHTML = `<div class="kb-card">
    <div class="kb-when">${when}${calc}${obsExtra}</div>
    ${detailsBtn}
    <div class="kb-rows">${regions.map(rowFor).join('')}</div>
  </div>`;
}

/* ───────────── 펼쳐 보기: 기간별 표 + 차이 막대 + 보조 분석 자리 ───────────── */

export function renderDetails(root, v) {
  root.hidden = !v.s.ui.details;
  if (root.hidden || !v.manifest || !v.el) return;
  const derived = v.manifest.periods.find((p) => p.derived);
  root.innerHTML = `
    <div class="card-head"><h2>${T.details} <span class="dt-cond">· ${esc(chartTitle(v))}</span></h2><span class="note">칸을 누르면 그 기간으로 바뀌어요</span></div>
    ${tableHTML(v)}
    <p class="note" style="margin-top:6px">${T.curColumnNote}${derived ? ` ${esc(derivedShort(derived, D.derivedMethod(v.el, derived)))}` : ''}</p>
    ${barsHTML(v, root.clientWidth - 40)}
    <details class="aux"><summary>${T.auxTitle}</summary><p class="placeholder">${T.auxBody}</p></details>`;
}
