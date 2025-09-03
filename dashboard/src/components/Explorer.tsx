import React, { useMemo } from 'react';
import { useStore } from '../state';
import type { EntityRow } from '../types';

export function Explorer() {
  const { state, dispatch } = useStore();

  const headersByLevel: Record<typeof state.drill.level, Array<{ key: keyof EntityRow; label: string }>> = {
    District: [
      { key: 'name', label: 'District' },
      { key: 'targetSchools', label: 'Target Schools' },
      { key: 'activeSchools', label: 'Active Schools' },
      { key: 'schoolsActivePct', label: 'Active/Target Schools %' },
      { key: 'targetStudents', label: 'Target Students' },
      { key: 'activeStudents', label: 'Active Students' },
      { key: 'studentsActivePct', label: 'Active/Target Students %' },
      { key: 'sessionsPerStudent', label: 'Sessions/Student' },
      { key: 'avgTime', label: 'Avg Time' },
    ],
    Mandal: [
      { key: 'name', label: 'Mandal' },
      { key: 'targetSchools', label: 'Target Schools' },
      { key: 'activeSchools', label: 'Active Schools' },
      { key: 'schoolsActivePct', label: 'Active/Target Schools %' },
      { key: 'targetStudents', label: 'Target Students' },
      { key: 'activeStudents', label: 'Active Students' },
      { key: 'studentsActivePct', label: 'Active/Target Students %' },
      { key: 'sessionsPerStudent', label: 'Sessions/Student' },
      { key: 'avgTime', label: 'Avg Time' },
    ],
    School: [
      { key: 'name', label: 'School Name' },
      { key: 'targetStudents', label: 'Target Students' },
      { key: 'activeStudents', label: 'Active Students' },
      { key: 'studentsActivePct', label: 'Active/Target Students %' },
      { key: 'pctOfTarget', label: '% of Target' },
      { key: 'sessionsPerStudent', label: 'Sessions/Student' },
      { key: 'avgTime', label: 'Avg Time' },
    ],
    Student: [
      { key: 'id', label: 'Student ID' },
      { key: 'sessions', label: 'Sessions' },
      { key: 'avgTime', label: 'Time Spent' },
      { key: 'status', label: 'Status' },
    ],
  };

  // Subjects to render (normalized)
  function normSubj(s: string){
    const t=(s||'').toLowerCase();
    if (t.startsWith('math')) return 'Math';
    if (t.startsWith('eng')) return 'English';
    if (t.startsWith('tel')) return 'Telugu';
    return s||'';
  }
  const allSubjects = state.options.subjects.map(normSubj);
  const subjects = (state.filters.subjects.length ? state.filters.subjects : state.options.subjects).map(normSubj);

  // Precompute per-entity per-subject progressed counts using raw facts within current window and filters
  const progressMap = useMemo(() => {
    const m = new Map<string, Map<string, Set<string>>>();
    if (!state.raw) return m;
    const rk = state.raw.keys.roster; const fk = state.raw.keys.facts;
    const rosterById = new Map<string, any>();
    state.raw.roster.forEach(r=>{ const id=r[rk.StudentID]; if (id) rosterById.set(id,r); });
    // Date window
    const dates = state.raw.facts.map(r => r[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
    const maxTs = dates.length ? Math.max(...dates) : Date.now(); const maxDate = new Date(maxTs);
    let from = new Date(maxDate), to = new Date(maxDate);
    const q = state.filters.quick; if (q==='Yesterday'){ from.setUTCDate(maxDate.getUTCDate()-1); to=new Date(from);} else if (q==='Last 30 Days'){ from.setUTCDate(maxDate.getUTCDate()-29);} else { from.setUTCDate(maxDate.getUTCDate()-6);} if (state.filters.range.from) from=new Date(state.filters.range.from+'T00:00:00Z'); if (state.filters.range.to) to=new Date(state.filters.range.to+'T00:00:00Z');
    function inWindow(d: string){ const t=new Date(d+'T00:00:00Z'); return t>=from && t<=to; }
    // Roster filter for scope/classes
    const classSel = new Set(state.filters.classes);
    function passRoster(ro: any){ if (!ro) return false; if (classSel.size && !classSel.has(ro[rk.Grade])) return false; if (state.filters.scope==='Target' && ro[rk.TargetFlag] !== '1') return false; if (state.filters.scope==='Non-Target' && ro[rk.TargetFlag] !== '0') return false; return true; }
    // Entity key getter
    function entityKey(ro: any): string {
      if (state.drill.level==='District') return ro[rk.District];
      if (state.drill.level==='Mandal') return ro[rk.Mandal];
      if (state.drill.level==='School') return ro[rk.SchoolName];
      return ro[rk.StudentID];
    }
    function ensure(ent: string){ if (!m.has(ent)) m.set(ent,new Map()); return m.get(ent)!; }
    function ensureSub(map: Map<string, Set<string>>, subj: string){ if(!map.has(subj)) map.set(subj,new Set()); return map.get(subj)!; }
    state.raw.facts.forEach(fr => {
      // Use full history for student milestone start/current (no date filter)
      const ro = rosterById.get(fr[fk.StudentID]); if (!ro) return;
      if (!passRoster(ro)) return;
      const ent = entityKey(ro); if (!ent) return;
      const subj = normSubj(fr[fk.Subject] || ''); if (!subj) return;
      // Only track subjects in our configured list
      if (!subjects.includes(subj)) return;
      const start = Number(fr[fk.StartMilestone] || 0) || 0; const curr = Number(fr[fk.CurrentMilestone] || 0) || 0;
      if ((curr - start) > 0) {
        const bySubj = ensure(ent);
        ensureSub(bySubj, subj).add(fr[fk.StudentID]);
      }
    });
    return m;
  }, [state]);

  // Student-level per-subject milestone map
  const studentMilestones = useMemo(() => {
    const out = new Map<string, Map<string, { start: number; current: number; improvement: number }>>();
    if (!state.raw) return out;
    const rk = state.raw.keys.roster; const fk = state.raw.keys.facts;
    const rosterById = new Map<string, any>();
    state.raw.roster.forEach(r=>{ const id=r[rk.StudentID]; if (id) rosterById.set(id,r); });
    const dates = state.raw.facts.map(r => r[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
    const maxTs = dates.length ? Math.max(...dates) : Date.now(); const maxDate = new Date(maxTs);
    let from = new Date(maxDate), to = new Date(maxDate);
    const q = state.filters.quick; if (q==='Yesterday'){ from.setUTCDate(maxDate.getUTCDate()-1); to=new Date(from);} else if (q==='Last 30 Days'){ from.setUTCDate(maxDate.getUTCDate()-29);} else { from.setUTCDate(maxDate.getUTCDate()-6);} if (state.filters.range.from) from=new Date(state.filters.range.from+'T00:00:00Z'); if (state.filters.range.to) to=new Date(state.filters.range.to+'T00:00:00Z');
    function inWindow(d: string){ const t=new Date(d+'T00:00:00Z'); return t>=from && t<=to; }
    const classSel = new Set(state.filters.classes);
    function passRoster(ro: any){ if (!ro) return false; if (classSel.size && !classSel.has(ro[rk.Grade])) return false; if (state.filters.scope==='Target' && ro[rk.TargetFlag] !== '1') return false; if (state.filters.scope==='Non-Target' && ro[rk.TargetFlag] !== '0') return false; return true; }
    const acc = new Map<string, Map<string, { firstTs: number; start: number; lastTs: number; current: number }>>();
    function ensureStu(sid: string){ if (!acc.has(sid)) acc.set(sid, new Map()); return acc.get(sid)!; }
    function ensureSub(m: Map<string, any>, s: string){ if (!m.has(s)) m.set(s, { firstTs: Number.POSITIVE_INFINITY, start: 0, lastTs: Number.NEGATIVE_INFINITY, current: 0 }); return m.get(s)!; }
    state.raw.facts.forEach(fr => {
      if (!inWindow(fr[fk.Date])) return;
      const sid = fr[fk.StudentID]; if (!sid) return;
      const ro = rosterById.get(sid); if (!passRoster(ro)) return;
      const subj = normSubj(fr[fk.Subject] || ''); if (!subj || !allSubjects.includes(subj)) return;
      const ts = new Date(fr[fk.Date] + 'T00:00:00Z').getTime();
      const st = Number(fr[fk.StartMilestone] || 0) || 0; const cur = Number(fr[fk.CurrentMilestone] || 0) || 0;
      const mStu = ensureStu(sid); const slot = ensureSub(mStu, subj);
      if (ts < slot.firstTs) { slot.firstTs = ts; slot.start = st; }
      if (ts > slot.lastTs) { slot.lastTs = ts; slot.current = cur; }
    });
    acc.forEach((bySubj, sid) => {
      const m = new Map<string, { start: number; current: number; improvement: number }>();
      bySubj.forEach((v, subj) => { m.set(subj, { start: v.start, current: v.current, improvement: (v.current - v.start) }); });
      out.set(sid, m);
    });
    return out;
  }, [state]);

  function exportCSV() {
    const hdrs = headers as Array<{ key: keyof EntityRow; label: string }>;
    const today = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    const rep = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const meta: string[] = [];
    meta.push(`Report Date,${rep}`);
    meta.push(`Level,${state.drill.level}`);
    if (state.drill.district) meta.push(`District,${state.drill.district}`);
    if (state.drill.mandal) meta.push(`Mandal,${state.drill.mandal}`);
    if (state.drill.school) meta.push(`School,${state.drill.school}`);
    meta.push('');
    const body = [hdrs.map((h) => h.label).join(',')]
      .concat(
        state.table.map((r) => hdrs.map((h) => formatCell(r, h.key, progressMap, studentMilestones)).join(','))
      );
    const csv = meta.concat(body).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `export_${state.drill.level}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Build dynamic headers: add per-subject progressed columns, remove improvementPct if present
  const baseHeaders = headersByLevel[state.drill.level];
  const dynamicHeaders: Array<{ key: keyof EntityRow | any; label: string }> = baseHeaders.filter(h => h.key !== 'improvementPct' && h.key !== 'milestone');
  if (state.drill.level !== 'Student') {
    subjects.forEach(s => dynamicHeaders.push({ key: (`__progress_${s}` as any), label: `Progressed ${s}` }));
  } else {
    allSubjects.forEach(s => {
      dynamicHeaders.push({ key: (`__stu_ms_${s}_start` as any), label: `${s} Start` });
      dynamicHeaders.push({ key: (`__stu_ms_${s}_current` as any), label: `${s} Current` });
      dynamicHeaders.push({ key: (`__stu_ms_${s}_impr` as any), label: `${s} Improvement` });
    });
  }
  const headers = dynamicHeaders as Array<{ key: keyof EntityRow; label: string }>;

  return (
    <div className="panel">
      <div className="hstack" style={{ marginBottom: 8 }}>
        <div className="spacer" />
        <button className="clear" onClick={exportCSV}>Export to CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={String(h.key)} onClick={() => dispatch({ type: 'sortBy', key: h.key })}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.table.map((r) => (
            <tr key={r.id} onClick={() => handleRowClick(r, state.drill.level, dispatch)}>
              {headers.map((h) => (
                <td key={String(h.key)}>{renderCell(r, h.key, progressMap, studentMilestones, state)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {renderAggregateRow(state.table, headers, progressMap)}
        </tfoot>
      </table>
    </div>
  );
}

function renderCell(
  r: EntityRow,
  key: keyof EntityRow | any,
  progressMap?: Map<string, Map<string, Set<string>>>,
  studentMilestones?: Map<string, Map<string, { start: number; current: number; improvement: number }>>,
  stateArg?: any,
) {
  const v = (r as any)[key];
  if (key === 'improvementPct') return `${v}%`;
  if (key === 'avgTime' && typeof v === 'number') return `${v} mins`;
  if (key === 'status') return <span className={`status-badge ${v === 'Target' ? 'badge-target' : 'badge-non-target'}`}>{v}</span>;
  if (key === 'schoolsActivePct') {
    const active = (r.activeTargetSchools ?? 0);
    const target = (r.targetSchools ?? 0);
    const pct = target > 0 ? Math.round((active / target) * 100) : 100;
    return `${pct}%`;
  }
  if (key === 'studentsActivePct') {
    const active = (r.activeTargetStudents ?? 0);
    const target = (r.targetStudents ?? 0);
    const pct = target > 0 ? Math.round((active / target) * 100) : 100;
    return `${pct}%`;
  }
  if (typeof key === 'string' && key.startsWith('__progress_')) {
    const subj = key.replace('__progress_', '');
    const cnt = progressMap?.get(r.name)?.get(subj)?.size || 0;
    return cnt;
  }
  if (typeof key === 'string' && key.startsWith('__stu_ms_')) {
    const sid = r.id;
    const rest = key.replace(/^__stu_ms_/, '');
    const [subj, which] = rest.split('_');
    let rec = studentMilestones?.get(sid)?.get(subj);
    // Fallback: compute on the fly from raw if memo-map missing
    if (!rec && stateArg?.raw) {
      const rk = stateArg.raw.keys.roster; const fk = stateArg.raw.keys.facts;
      const facts = stateArg.raw.facts.filter((fr: any) => fr[fk.StudentID] === sid && (fr[fk.Subject]||'').toLowerCase().startsWith(subj.toLowerCase()));
      if (facts.length) {
        let firstTs = Infinity, lastTs = -Infinity, start = 0, current = 0;
        facts.forEach((fr: any) => {
          const ts = new Date(fr[fk.Date] + 'T00:00:00Z').getTime();
          const st = Number(fr[fk.StartMilestone]||0)||0;
          const cur = Number(fr[fk.CurrentMilestone]||0)||0;
          if (ts < firstTs) { firstTs = ts; start = st; }
          if (ts > lastTs) { lastTs = ts; current = cur; }
        });
        rec = { start, current, improvement: (current - start) } as any;
      }
    }
    if (!rec) return 0;
    if (which === 'start') return rec.start;
    if (which === 'current') return rec.current;
    if (which === 'impr') return rec.improvement;
    return '';
  }
  return v ?? '';
}

function formatCell(r: EntityRow, key: keyof EntityRow | any, progressMap?: Map<string, Map<string, Set<string>>>, studentMilestones?: Map<string, Map<string, { start: number; current: number; improvement: number }>>) {
  const v = (r as any)[key];
  if (key === 'improvementPct') return `${v}%`;
  if (key === 'avgTime' && typeof v === 'number') return `${v} mins`;
  if (key === 'schoolsActivePct') {
    const active = (r.activeTargetSchools ?? 0);
    const target = (r.targetSchools ?? 0);
    const pct = target > 0 ? Math.round((active / target) * 100) : 100;
    return `${pct}%`;
  }
  if (key === 'studentsActivePct') {
    const active = (r.activeTargetStudents ?? 0);
    const target = (r.targetStudents ?? 0);
    const pct = target > 0 ? Math.round((active / target) * 100) : 100;
    return `${pct}%`;
  }
  if (typeof key === 'string' && key.startsWith('__progress_')) {
    const subj = key.replace('__progress_', '');
    const cnt = progressMap?.get(r.name)?.get(subj)?.size || 0;
    return String(cnt);
  }
  if (typeof key === 'string' && key.startsWith('__stu_ms_')) {
    const sid = r.id;
    const rest = key.replace(/^__stu_ms_/, '');
    const [subj, which] = rest.split('_');
    const rec = studentMilestones?.get(sid)?.get(subj);
    if (!rec) return '0';
    if (which === 'start') return String(rec.start);
    if (which === 'current') return String(rec.current);
    if (which === 'impr') return String(rec.improvement);
    return '';
  }
  return v ?? '';
}

function renderAggregateRow(rows: EntityRow[], headers: Array<{ key: keyof EntityRow; label: string }>, progressMap?: Map<string, Map<string, Set<string>>>, studentMilestones?: Map<string, Map<string, { start: number; current: number; improvement: number }>>) {
  const sum = (sel: (r: EntityRow) => number) => rows.reduce((acc, r) => acc + (sel(r) || 0), 0);
  const totals = {
    targetSchools: sum(r => (r.targetSchools as number) || 0),
    activeTargetSchools: sum(r => (r.activeTargetSchools as number) || 0),
    targetStudents: sum(r => (r.targetStudents as number) || 0),
    activeTargetStudents: sum(r => (r.activeTargetStudents as number) || 0),
  };
  const schoolsPct = totals.targetSchools > 0 ? Math.round((totals.activeTargetSchools / totals.targetSchools) * 100) : 100;
  const studentsPct = totals.targetStudents > 0 ? Math.round((totals.activeTargetStudents / totals.targetStudents) * 100) : 100;
  return (
    <tr>
      {headers.map((h, idx) => {
        const k = h.key as keyof EntityRow;
        if (idx === 0) return <td key={String(k)} style={{ fontWeight: 600 }}>Total</td>;
        if (k === 'targetSchools') return <td key={String(k)} style={{ fontWeight: 600 }}>{totals.targetSchools || 0}</td>;
        if (k === 'activeSchools') return <td key={String(k)} style={{ fontWeight: 600 }}>{sum(r => (r.activeSchools as number) || 0) || 0}</td>;
        if (k === 'schoolsActivePct') return <td key={String(k)} style={{ fontWeight: 600 }}>{schoolsPct}%</td>;
        if (k === 'targetStudents') return <td key={String(k)} style={{ fontWeight: 600 }}>{totals.targetStudents || 0}</td>;
        if (k === 'activeStudents') return <td key={String(k)} style={{ fontWeight: 600 }}>{sum(r => (r.activeStudents as number) || 0) || 0}</td>;
        if (k === 'studentsActivePct') return <td key={String(k)} style={{ fontWeight: 600 }}>{studentsPct}%</td>;
        if (typeof k === 'string' && (k as any).toString().startsWith('__progress_')) {
          const subj = (k as any as string).replace('__progress_', '');
          const total = rows.reduce((acc, r) => acc + ((progressMap?.get(r.name)?.get(subj)?.size) || 0), 0);
          return <td key={String(k)} style={{ fontWeight: 600 }}>{total}</td>;
        }
        if (typeof k === 'string' && (k as any).toString().startsWith('__stu_ms_')) {
          const rest = (k as any as string).replace(/^__stu_ms_/, '');
          const [subj, which] = rest.split('_');
          const total = rows.reduce((acc, r) => {
            const rec = studentMilestones?.get(r.id)?.get(subj);
            if (!rec) return acc;
            if (which === 'start') return acc + rec.start;
            if (which === 'current') return acc + rec.current;
            if (which === 'impr') return acc + rec.improvement;
            return acc;
          }, 0);
          return <td key={String(k)} style={{ fontWeight: 600 }}>{total}</td>;
        }
        return <td key={String(k)} />;
      })}
    </tr>
  );
}

function handleRowClick(r: EntityRow, level: 'District' | 'Mandal' | 'School' | 'Student', dispatch: any) {
  if (level === 'District') dispatch({ type: 'drillInto', level: 'Mandal', value: r.name });
  else if (level === 'Mandal') dispatch({ type: 'drillInto', level: 'School', value: r.name });
  else if (level === 'School') dispatch({ type: 'drillInto', level: 'Student', value: r.name });
}
