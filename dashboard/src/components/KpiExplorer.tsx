import React, { useMemo, useState } from 'react';
import { useStore } from '../state';

export function KpiExplorer() {
  const { state, dispatch } = useStore();
  if (!state.kpiDrill || !state.raw) return null;

  const data = useMemo(() => buildRows(state), [state]);
  const [sort, setSort] = useState<{ key: string; dir: 'asc'|'desc' } | null>(null);
  const sortedRows = useMemo(() => {
    if (!data) return [] as ReturnType<typeof buildRows>['rows'];
    const rows = [...data.rows];
    if (!sort) return rows;
    const getVal = (r: any, key: string) => {
      if (key === '__name__') return r.name;
      const v = r.values[key];
      if (typeof v === 'string') {
        // Try to map Yes/No to numeric for sensible ordering
        if (v.toLowerCase() === 'yes') return 1;
        if (v.toLowerCase() === 'no') return 0;
        const num = Number(v);
        if (!isNaN(num)) return num;
        return v.toLowerCase();
      }
      return v ?? 0;
    };
    rows.sort((a, b) => {
      const av: any = getVal(a, sort.key);
      const bv: any = getVal(b, sort.key);
      const isNum = (x: any) => typeof x === 'number' && !isNaN(x as any);
      let cmp: number;
      if (isNum(av) && isNum(bv)) cmp = (av as number) - (bv as number);
      else cmp = String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, sort]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
    });
  }
  if (!data) return null;

  return (
    <div className="panel compact-panel" style={{ marginTop: 16 }}>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>KPI Drill — {state.kpiDrill.metric}</div>
        <button className="clear" onClick={() => dispatch({ type: 'closeKpiDrill' })}>Close</button>
      </div>
      <div className="breadcrumb" style={{ marginBottom: 8 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); dispatch({ type: 'kpiDrillTo', level: 'District' }); }}>Districts</a>
        {state.kpiDrill.district && (
          <>
            {' > '}<a href="#" onClick={(e) => { e.preventDefault(); dispatch({ type: 'kpiDrillTo', level: 'Mandal' }); }}>{state.kpiDrill.district}</a>
          </>
        )}
        {state.kpiDrill.mandal && (
          <>
            {' > '}<a href="#" onClick={(e) => { e.preventDefault(); dispatch({ type: 'kpiDrillTo', level: 'School' }); }}>{state.kpiDrill.mandal}</a>
          </>
        )}
        {state.kpiDrill.school && (<> {' > '} {state.kpiDrill.school}</>)}
      </div>
      <table className="compact">
        <thead>
          <tr>
            <th onClick={() => toggleSort('__name__')} style={{ cursor: 'pointer' }}>
              {data.level}{sort?.key==='__name__' ? (sort.dir==='desc' ? ' ▼' : ' ▲') : ''}
            </th>
            {data.columns.map(c => (
              <th key={c} onClick={() => toggleSort(c)} style={{ cursor: 'pointer' }}>
                {c}{sort?.key===c ? (sort.dir==='desc' ? ' ▼' : ' ▲') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(r => (
            <tr key={r.id} onClick={() => handleRowClick(r, state, dispatch)} style={{ cursor: data.nextLevel ? 'pointer' : 'default' }}>
              <td>{r.name}</td>
              {data.columns.map(c => (<td key={r.id+'_'+c}>{r.values[c] ?? ''}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildRows(state: ReturnType<typeof useStore>['state']) {
  const raw = state.raw!; const rk = raw.keys.roster; const fk = raw.keys.facts;
  const rosterById = new Map<string, any>(); raw.roster.forEach(r=>{ const id=r[rk.StudentID]; if (id) rosterById.set(id,r); });
  // Determine current kpi drill level and next
  const level = state.kpiDrill!.level;
  const nextLevel = level === 'District' ? 'Mandal' : level === 'Mandal' ? 'School' : (level === 'School' ? 'Student' : undefined);
  // Filters (geo/class/scope)
  const geoSel = { d: new Set(state.filters.districts), m: new Set(state.filters.mandals), s: new Set(state.filters.schools) };
  const classSel = new Set(state.filters.classes);
  function passRoster(ro: any) {
    if (!ro) return false;
    if (classSel.size && !classSel.has(ro[rk.Grade])) return false;
    // Constrain to current drill selection if present
    if (state.kpiDrill?.district && ro[rk.District] !== state.kpiDrill.district) return false;
    if (state.kpiDrill?.mandal && ro[rk.Mandal] !== state.kpiDrill.mandal) return false;
    if (state.kpiDrill?.school && ro[rk.SchoolName] !== state.kpiDrill.school) return false;
    if (geoSel.s.size) { if (!geoSel.s.has(ro[rk.SchoolName])) return false; }
    else if (geoSel.m.size) { if (!geoSel.m.has(ro[rk.Mandal])) return false; }
    else if (geoSel.d.size) { if (!geoSel.d.has(ro[rk.District])) return false; }
    if (state.filters.scope === 'Target' && ro[rk.TargetFlag] !== '1') return false;
    if (state.filters.scope === 'Non-Target' && ro[rk.TargetFlag] !== '0') return false;
    return true;
  }
  // Window
  const dates = raw.facts.map(r => r[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
  const maxTs = dates.length ? Math.max(...dates) : Date.now(); const maxDate = new Date(maxTs);
  let from = new Date(maxDate), to = new Date(maxDate);
  const q = state.filters.quick; if (q==='Yesterday'){ from.setUTCDate(maxDate.getUTCDate()-1); to=new Date(from);} else if (q==='Last 30 Days'){ from.setUTCDate(maxDate.getUTCDate()-29);} else { from.setUTCDate(maxDate.getUTCDate()-6);} if (state.filters.range.from) from=new Date(state.filters.range.from+'T00:00:00Z'); if (state.filters.range.to) to=new Date(state.filters.range.to+'T00:00:00Z');
  function inWindow(d: string){ const t=new Date(d+'T00:00:00Z'); return t>=from && t<=to; }
  // Subjects to segment
  function normSubj(s: string){ const t=(s||'').toLowerCase(); if (t.startsWith('math')) return 'Math'; if (t.startsWith('eng')) return 'English'; if (t.startsWith('tel')) return 'Telugu'; return s||''; }
  const subjectsSelected = (state.filters.subjects.length ? state.filters.subjects : state.options.subjects).map(normSubj);
  const allSubjects = state.options.subjects.map(normSubj);
  const subjects = (level === 'Student' ? allSubjects : subjectsSelected);

  // Grouping key per current level
  function keyOf(ro: any): { id: string; name: string } {
    if (level === 'District') return { id: ro[rk.District], name: ro[rk.District] };
    if (level === 'Mandal') return { id: ro[rk.Mandal], name: ro[rk.Mandal] };
    if (level === 'School') return { id: ro[rk.SchoolID], name: ro[rk.SchoolName] };
    return { id: ro[rk.StudentID], name: ro[rk.StudentID] };
  }

  // Precompute per-student per-subject changes across full history (ignoring date window)
  const improvementsAll = new Map<string, Map<string, number>>();
  const firstLastByStuSubj = new Map<string, { firstTs: number; start: number; lastTs: number; current: number }>();
  raw.facts.forEach(fr => {
    const ro = rosterById.get(fr[fk.StudentID]); if (!passRoster(ro)) return;
    const subj = normSubj(fr[fk.Subject] || ''); if (!subj) return;
    const sid = fr[fk.StudentID];
    const key = sid + '||' + subj;
    const ts = new Date(fr[fk.Date] + 'T00:00:00Z').getTime();
    const st = (Number(fr[fk.StartMilestone]||0)||0);
    const cur = (Number(fr[fk.CurrentMilestone]||0)||0);
    const slot = firstLastByStuSubj.get(key) || { firstTs: Number.POSITIVE_INFINITY, start: 0, lastTs: Number.NEGATIVE_INFINITY, current: 0 };
    if (ts < slot.firstTs) { slot.firstTs = ts; slot.start = st; }
    if (ts > slot.lastTs) { slot.lastTs = ts; slot.current = cur; }
    firstLastByStuSubj.set(key, slot);
  });
  firstLastByStuSubj.forEach((v, key) => {
    const [sid, subj] = key.split('||');
    if (!improvementsAll.has(sid)) improvementsAll.set(sid, new Map());
    improvementsAll.get(sid)!.set(subj, (v.current - v.start));
  });

  type Row = { id: string; name: string; values: Record<string, number|string>; sub?: any; targetFlag?: 'Yes'|'No'; subFlags?: Record<string,{ active:boolean; progressed:boolean; hasSess:boolean; hasTime:boolean }> };
  const rowsMap = new Map<string, Row>();
  function ensure(ro: any){ const k=keyOf(ro); if (!rowsMap.has(k.id)) rowsMap.set(k.id,{ id:k.id, name:k.name, values:{}, sub:{} }); return rowsMap.get(k.id)!; }

  // Prepare per-subject metrics depending on metric
  const metric = state.kpiDrill!.metric;

  // Accumulators per row and subject
  raw.facts.forEach(fr => {
    if (!inWindow(fr[fk.Date])) return; const ro = rosterById.get(fr[fk.StudentID]); if (!passRoster(ro)) return;
    const subj = normSubj(fr[fk.Subject] || ''); if (!subjects.includes(subj)) return;
    const s = Number(fr[fk.Sessions]||0)||0; const tm = Number(fr[fk.TimeMinutes]||0)||0;
    const r = ensure(ro);
    const isT = ro[rk.TargetFlag] === '1';
    const deltaVal = (Number(fr[fk.CurrentMilestone]||0)||0) - (Number(fr[fk.StartMilestone]||0)||0);
    // capture per-subject flags for student-level rendering
    if (!r.subFlags) r.subFlags = {};
    if (!r.subFlags[subj]) r.subFlags[subj] = { active:false, progressed:false, hasSess:false, hasTime:false };
    if (s>0 || tm>0) { r.subFlags[subj].active = true; if (s>0) r.subFlags[subj].hasSess = true; if (tm>0) r.subFlags[subj].hasTime = true; }
    if (deltaVal > 0) r.subFlags[subj].progressed = true;
    if (metric === 'Active Students'){
      if (s>0 || tm>0){ const key = `${subj} ${isT?'T':'NT'}`; r.values[key] = (r.values[key] as number || 0) + 1; r.values['Target'] = ((r.values['Target'] as number)||0) + (isT?1:0); }
    } else if (metric === 'Active Schools'){
      if (s>0 || tm>0){ const sch = ro[rk.SchoolID]; const memoKey = `seen_${isT?'T':'NT'}_${subj}`; (r as any)[memoKey] = (r as any)[memoKey] || new Set<string>(); if (!(r as any)[memoKey].has(sch)){ (r as any)[memoKey].add(sch); const sk = `${subj} ${isT?'T':'NT'}`; r.values[sk] = (r.values[sk] as number || 0) + 1; r.values['Target'] = ((r.values['Target'] as number)||0) + (isT?1:0); } }
    } else if (metric === 'Students Progressed'){
      if (deltaVal>0){ const key = `${subj} ${isT?'T':'NT'}`; r.values[key] = (r.values[key] as number || 0) + 1; r.values['Target'] = ((r.values['Target'] as number)||0) + (isT?1:0); }
    } else if (metric === 'Sessions per Student (7d)'){
      r.values[`Sess ${subj}`] = ((r.values[`Sess ${subj}`] as number)||0) + s; r.values[`Stu ${subj}`] = ((r.values[`Stu ${subj}`] as number)||0) + ((s>0||tm>0)?1:0);
    } else if (metric === 'Avg Time Spent per student (7d)'){
      r.values[`Time ${subj}`] = ((r.values[`Time ${subj}`] as number)||0) + tm; r.values[`Stu ${subj}`] = ((r.values[`Stu ${subj}`] as number)||0) + ((s>0||tm>0)?1:0);
    }
  });

  // Finalize rows and columns based on metric
  const rows = Array.from(rowsMap.values());
  // Ensure student-level rows include all students in the drilled school even if no in-window activity
  if (level === 'Student') {
    raw.roster.forEach(ro => {
      if (!passRoster(ro)) return;
      if (state.kpiDrill?.school && ro[rk.SchoolName] !== state.kpiDrill.school) return;
      ensure(ro);
    });
  }
  let columns: string[] = [];
  if (metric === 'Active Students'){
    const wantT = state.filters.scope !== 'Non-Target';
    const wantNT = state.filters.scope !== 'Target';
    const subjCols: string[] = [];
    subjects.forEach(s => { if (wantT) subjCols.push(`${s} T`); if (wantNT) subjCols.push(`${s} NT`); });
    columns = [ ...(wantT ? ['Target'] : []), ...subjCols ];
  } else if (metric === 'Active Schools'){
    const wantT = state.filters.scope !== 'Non-Target';
    const wantNT = state.filters.scope !== 'Target';
    const subjCols: string[] = [];
    subjects.forEach(s => { if (wantT) subjCols.push(`${s} T`); if (wantNT) subjCols.push(`${s} NT`); });
    columns = [ ...(wantT ? ['Target'] : []), ...subjCols ];
  } else if (metric === 'Students Progressed'){
    const wantT = state.filters.scope !== 'Non-Target';
    const wantNT = state.filters.scope !== 'Target';
    const subjCols: string[] = [];
    subjects.forEach(s => { if (wantT) subjCols.push(`${s} T`); if (wantNT) subjCols.push(`${s} NT`); });
    columns = [ ...(wantT ? ['Target'] : []), ...subjCols ];
  } else if (metric === 'Sessions per Student (7d)'){
    columns = [...subjects.map(s=>`${s} Avg Sess/Stu`)];
    rows.forEach(r => { subjects.forEach(s=>{ const sess=r.values[`Sess ${s}`] as number || 0; const stu=r.values[`Stu ${s}`] as number || 0; r.values[`${s} Avg Sess/Stu`] = (stu>0 ? (Math.round((sess/stu)*100)/100) : 0); }); });
  } else if (metric === 'Avg Time Spent per student (7d)'){
    columns = [...subjects.map(s=>`${s} Avg mins/Stu`)];
    rows.forEach(r => { subjects.forEach(s=>{ const t=r.values[`Time ${s}`] as number || 0; const stu=r.values[`Stu ${s}`] as number || 0; r.values[`${s} Avg mins/Stu`] = (stu>0 ? Math.round(t/stu) : 0); }); });
  }

  // Special handling for Student level: target column + per-subject values
  if (level === 'Student') {
    // Ensure roster target flag is shown
    rows.forEach(r => {
      const ro = raw.roster.find(rr => rr[rk.StudentID] === r.id);
      const isT = ro?.[rk.TargetFlag] === '1';
      r.values['Target'] = isT ? 'Yes' : 'No';
      // Per-subject values based on KPI
      subjects.forEach(s => {
        if (metric === 'Students Progressed') {
          const delta = improvementsAll.get(r.id)?.get(s);
          r.values[`${s} Change`] = (typeof delta === 'number' ? delta : 0);
        } else {
          // Active for all other KPI types
          r.values[`${s} Active`] = r.subFlags?.[s]?.active ? 'Yes' : 'No';
        }
      });
    });
    // Override columns to yes/no variants
    if (metric === 'Students Progressed') {
      columns = ['Target', ...subjects.map(s => `${s} Change`)];
    } else {
      columns = ['Target', ...subjects.map(s => `${s} Active`)];
    }
  }

  return { level, nextLevel, subjects, columns, rows };
}

function handleRowClick(r: any, state: any, dispatch: any){
  const next = state.kpiDrill?.level === 'District' ? 'Mandal' : state.kpiDrill?.level === 'Mandal' ? 'School' : state.kpiDrill?.level === 'School' ? 'Student' : undefined;
  if (!next) return;
  dispatch({ type: 'kpiDrillInto', level: next, value: r.name });
}
