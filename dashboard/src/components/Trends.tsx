import React, { useMemo, useState } from 'react';
import { useStore } from '../state';
import { Modal } from './Modal';

export function Trends() {
  const { state } = useStore();
  const subjectSeriesByTrend = useSubjectSeriesForTrends();
  const [detail, setDetail] = useState<string | null>(null);
  return (
    <div className="panel">
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(${state.trendCards.length}, minmax(0, 1fr))` }}>
        {state.trendCards.map((t) => (
          <TrendCard
            key={t.title}
            title={t.title}
            value={t.value}
            wow={t.wow}
            points={t.points}
            series={subjectSeriesByTrend ? subjectSeriesByTrend[t.title] : undefined}
            kpiMode={state.kpiMode}
            onOpenDetail={() => setDetail(t.title)}
          />)
        )}
      </div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail || ''}>
        <DetailTrend metric={detail || ''} />
      </Modal>
    </div>
  );
}

function TrendCard({ title, value, wow, points, series, kpiMode, onOpenDetail }: { title: string; value: string; wow: string; points: number[]; series?: Array<{ label: string; color: string; points: number[] }>; kpiMode?: 'Absolute' | 'Percent'; onOpenDetail?: () => void }) {
  return (
    <div className="kpi" title={points.map((p, i) => `W${i + 1}: ${p}`).join(' | ')} onClick={onOpenDetail} style={{ cursor: 'pointer' }}>
      <div className="title">{title}</div>
      {/* No aggregate number */}
      {/* WoW hidden to align with KPI behaviour */}
      {series && series.length > 0 ? (
        <MultiSparkline series={series} />
      ) : (
        <Sparkline points={points} />
      )}
      {/* Click card to see detailed chart */}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 120; const h = 40; const pad = 4;
  const min = Math.min(...points); const max = Math.max(...points);
  const pts = points.map((p, i) => {
    const x = pad + (i * (w - pad * 2)) / (points.length - 1);
    const y = h - pad - ((p - min) / (max - min || 1)) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ marginTop: 8 }}>
      <polyline fill="none" stroke="var(--blue)" strokeWidth="2" points={pts} />
      {pts && <circle r="3" fill="var(--green)" cx={Number(pts.split(' ').pop()?.split(',')[0])} cy={Number(pts.split(' ').pop()?.split(',')[1])} />}
    </svg>
  );
}

function MultiSparkline({ series }: { series: Array<{ label: string; color: string; points: number[] }> }) {
  const w = 140; const h = 46; const pad = 4;
  const all = series.flatMap(s => s.points);
  const min = Math.min(...all); const max = Math.max(...all);
  function line(points: number[]) {
    return points.map((p, i) => {
      const x = pad + (i * (w - pad * 2)) / (points.length - 1);
      const y = h - pad - ((p - min) / (max - min || 1)) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
  }
  return (
    <div style={{ marginTop: 6 }}>
      <svg width={w} height={h}>
        {series.map((s, idx) => (
          <polyline key={s.label} fill="none" stroke={s.color} strokeWidth="2" points={line(s.points)} />
        ))}
      </svg>
      <div className="hstack" style={{ gap: 8, marginTop: 4 }}>
        {series.map(s => (
          <span key={s.label} className="sublabel"><span style={{ width: 8, height: 8, background: s.color, display: 'inline-block', borderRadius: 2, marginRight: 6 }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
}

function useSubjectBarsForTrends() {
  const { state } = useStore();
  const raw = state.raw;
  return useMemo(() => {
    if (!raw) return null as any;
    const R = raw; const rk = R.keys.roster, fk = R.keys.facts;
    const rosterById = new Map<string, any>(); R.roster.forEach(r=>{ const id=r[rk.StudentID]; if (id) rosterById.set(id,r); });
    const geo = { d: new Set(state.filters.districts), m: new Set(state.filters.mandals), s: new Set(state.filters.schools) };
    const classSel = new Set(state.filters.classes);
    function passRoster(ro: any) {
      if (!ro) return false;
      if (classSel.size && !classSel.has(ro[rk.Grade])) return false;
      if (geo.s.size) { if (!geo.s.has(ro[rk.SchoolName])) return false; }
      else if (geo.m.size) { if (!geo.m.has(ro[rk.Mandal])) return false; }
      else if (geo.d.size) { if (!geo.d.has(ro[rk.District])) return false; }
      if (state.filters.scope === 'Target' && ro[rk.TargetFlag] !== '1') return false;
      if (state.filters.scope === 'Non-Target' && ro[rk.TargetFlag] !== '0') return false;
      return true;
    }
    function normSubj(s: string) {
      const t = (s || '').trim().toLowerCase();
      if (t.startsWith('math')) return 'Math';
      if (t.startsWith('eng')) return 'English';
      if (t.startsWith('tel')) return 'Telugu';
      return s || '';
    }
    const colors: Record<string, string> = { Telugu: '#8e44ad', English: '#3498db', Math: '#2ecc71' };

    // window
    const dates = R.facts.map(f => f[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
    const maxTs = dates.length ? Math.max(...dates) : Date.now();
    const maxDate = new Date(maxTs); let from = new Date(maxDate), to = new Date(maxDate);
    const quick = state.filters.quick;
    if (quick === 'Yesterday') { from.setUTCDate(maxDate.getUTCDate()-1); to = new Date(from); }
    else if (quick === 'Last 30 Days') { from.setUTCDate(maxDate.getUTCDate()-29); }
    else { from.setUTCDate(maxDate.getUTCDate()-6); }
    if (state.filters.range.from) from = new Date(state.filters.range.from + 'T00:00:00Z');
    if (state.filters.range.to) to = new Date(state.filters.range.to + 'T00:00:00Z');
    function inWindow(dateStr: string) { const t = new Date(dateStr + 'T00:00:00Z'); return t >= from && t <= to; }

    const subjects = (state.filters.subjects.length ? state.filters.subjects : state.options.subjects).map(normSubj);
    const labels = subjects;
    // accumulators per subject
    const activeStudents: Record<string, Set<string>> = {}; const activeStudentsT: Record<string, Set<string>> = {}; const activeStudentsNT: Record<string, Set<string>> = {};
    const activeSchools: Record<string, Set<string>> = {}; const activeSchoolsT: Record<string, Set<string>> = {}; const activeSchoolsNT: Record<string, Set<string>> = {};
    const sessions: Record<string, number> = {}; const time: Record<string, number> = {}; const diags: Record<string, number> = {};
    const deltaByStudent: Record<string, Map<string, number>> = {}; const progT: Record<string, number> = {}; const progNT: Record<string, number> = {};
    labels.forEach(s=>{ activeStudents[s]=new Set(); activeStudentsT[s]=new Set(); activeStudentsNT[s]=new Set(); activeSchools[s]=new Set(); activeSchoolsT[s]=new Set(); activeSchoolsNT[s]=new Set(); sessions[s]=0; time[s]=0; diags[s]=0; deltaByStudent[s]=new Map(); progT[s]=0; progNT[s]=0; });

    R.facts.forEach(fr => {
      const ro = rosterById.get(fr[fk.StudentID]); if (!passRoster(ro)) return; if (!inWindow(fr[fk.Date])) return;
      const subj = normSubj(fr[fk.Subject] || ''); if (!labels.includes(subj)) return;
      const s = Number(fr[fk.Sessions] || 0) || 0; const tm = Number(fr[fk.TimeMinutes] || 0) || 0; const dg = Number(fr[fk.DiagnosticsCompleted] || 0) || 0;
      const isT = ro[rk.TargetFlag] === '1'; const sch = ro[rk.SchoolID];
      if (s>0 || tm>0) { activeStudents[subj].add(fr[fk.StudentID]); if (sch) activeSchools[subj].add(sch); if (isT) { activeStudentsT[subj].add(fr[fk.StudentID]); if (sch) activeSchoolsT[subj].add(sch);} else { activeStudentsNT[subj].add(fr[fk.StudentID]); if (sch) activeSchoolsNT[subj].add(sch);} }
      sessions[subj]+=s; time[subj]+=tm; diags[subj]+=dg;
      const prev=(deltaByStudent[subj].get(fr[fk.StudentID])||0)+(Number(fr[fk.CurrentMilestone]||0)-Number(fr[fk.StartMilestone]||0));
      deltaByStudent[subj].set(fr[fk.StudentID], prev); if (prev>0) { if (isT) progT[subj]+=1; else progNT[subj]+=1; }
    });

    function ntColorForSubject(label: string, base: string) {
      const map: Record<string, string> = { Telugu: '#c39bd3', English: '#85c1e9', Math: '#82e0aa' }; return map[label] || base + '99';
    }
    function compBars(tVals: number[], ntVals: number[], labels: string[]) {
      const totals = tVals.map((t,i)=>t+(ntVals[i]||0)); const max = Math.max(1,...totals);
      return totals.map((total,i)=>({ label: labels[i], pct: Math.round((total/max)*100), color: (colors[labels[i]]||'#888'), value: total, t: tVals[i]||0, nt: ntVals[i]||0 }));
    }
    const activeStudentsBars = compBars(labels.map(s=>activeStudentsT[s].size), labels.map(s=>activeStudentsNT[s].size), labels);
    const activeSchoolsBars = compBars(labels.map(s=>activeSchoolsT[s].size), labels.map(s=>activeSchoolsNT[s].size), labels);
    const progressedBars = compBars(labels.map(s=>progT[s]), labels.map(s=>progNT[s]), labels);
    const spsBars = labels.map(s => ({ label:s, pct: Math.min(100, Math.round(((sessions[s]/Math.max(1,activeStudents[s].size))/2)*100)), color: colors[s]||'#888', value: (Math.round((sessions[s]/Math.max(1,activeStudents[s].size))*100)/100) }));
    const avgBars = labels.map(s => ({ label:s, pct: Math.min(100, Math.round(((time[s]/Math.max(1,activeStudents[s].size))/200)*100)), color: colors[s]||'#888', value: Math.round(time[s]/Math.max(1,activeStudents[s].size)) }));
    const diagBars = labels.map(s => ({ label:s, pct: Math.min(100, Math.round(((diags[s])/Math.max(1, Math.max(...labels.map(l=>diags[l]))))*100)), color: colors[s]||'#888', value: diags[s] }));

    return {
      'Active Students': activeStudentsBars,
      'Active Schools': activeSchoolsBars,
      'Students Progressed': progressedBars,
      'Sessions per Student': spsBars,
      'Avg Time Spent per student (7d)': avgBars,
      'Diagnostics Completed': diagBars,
    } as Record<string, Array<{label:string;pct:number;color:string;value:number|string;t?:number;nt?:number}>>;
  }, [state]);
}

function useSubjectSeriesForTrends() {
  const { state } = useStore();
  const raw = state.raw; if (!raw) return null as any;
  const R = raw; const rk = R.keys.roster, fk = R.keys.facts;
  const rosterById = new Map<string, any>(); R.roster.forEach(r=>{ const id=r[rk.StudentID]; if (id) rosterById.set(id,r); });
  const geo = { d: new Set(state.filters.districts), m: new Set(state.filters.mandals), s: new Set(state.filters.schools) };
  const classSel = new Set(state.filters.classes);
  function passRoster(ro: any) {
    if (!ro) return false;
    if (classSel.size && !classSel.has(ro[rk.Grade])) return false;
    if (geo.s.size) { if (!geo.s.has(ro[rk.SchoolName])) return false; }
    else if (geo.m.size) { if (!geo.m.has(ro[rk.Mandal])) return false; }
    else if (geo.d.size) { if (!geo.d.has(ro[rk.District])) return false; }
    if (state.filters.scope === 'Target' && ro[rk.TargetFlag] !== '1') return false;
    if (state.filters.scope === 'Non-Target' && ro[rk.TargetFlag] !== '0') return false;
    return true;
  }
  function normSubj(s: string) { const t=(s||'').trim().toLowerCase(); if (t.startsWith('math')) return 'Math'; if (t.startsWith('eng')) return 'English'; if (t.startsWith('tel')) return 'Telugu'; return s||''; }
  const colors: Record<string,string> = { Telugu:'#8e44ad', English:'#3498db', Math:'#2ecc71' };
  // window
  const dates = R.facts.map(f => f[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
  const maxTs = dates.length ? Math.max(...dates) : Date.now();
  const maxDate = new Date(maxTs); let from = new Date(maxDate), to = new Date(maxDate);
  const quick = state.filters.quick; if (quick==='Yesterday'){ from.setUTCDate(maxDate.getUTCDate()-1); to=new Date(from);} else if (quick==='Last 30 Days'){ from.setUTCDate(maxDate.getUTCDate()-29);} else { from.setUTCDate(maxDate.getUTCDate()-6);} if (state.filters.range.from) from=new Date(state.filters.range.from+'T00:00:00Z'); if (state.filters.range.to) to=new Date(state.filters.range.to+'T00:00:00Z');
  function inWindow(d: Date) { return d>=from && d<=to; }
  function dayKey(d: Date){ return d.toISOString().slice(0,10); }
  const labels = (state.filters.subjects.length ? state.filters.subjects : state.options.subjects).map(normSubj);
  const days: string[] = []; for (let off=4; off>=0; off--){ const d=new Date(to); d.setUTCDate(to.getUTCDate()-off); days.push(dayKey(d)); }

  // Initialize per subject per day containers
  const actStu: Record<string, Record<string, Set<string>>> = {}; const actSch: Record<string, Record<string, Set<string>>> = {}; const ses: Record<string, Record<string, number>> = {}; const tim: Record<string, Record<string, number>> = {}; const dia: Record<string, Record<string, number>> = {}; const progDelta: Record<string, Record<string, Map<string, number>>> = {};
  labels.forEach(s=>{ actStu[s]={}; actSch[s]={}; ses[s]={}; tim[s]={}; dia[s]={}; progDelta[s]={}; days.forEach(d=>{ actStu[s][d]=new Set(); actSch[s][d]=new Set(); ses[s][d]=0; tim[s][d]=0; dia[s][d]=0; progDelta[s][d]=new Map(); }); });

  R.facts.forEach(fr=>{
    const ro = rosterById.get(fr[fk.StudentID]); if (!passRoster(ro)) return; const d=new Date(fr[fk.Date]+'T00:00:00Z'); if (!inWindow(d)) return; const dk=dayKey(d); if (!days.includes(dk)) return; const subj=normSubj(fr[fk.Subject]||''); if (!labels.includes(subj)) return;
    const s=Number(fr[fk.Sessions]||0)||0; const tm=Number(fr[fk.TimeMinutes]||0)||0; const dg=Number(fr[fk.DiagnosticsCompleted]||0)||0;
    if (s>0||tm>0){ actStu[subj][dk].add(fr[fk.StudentID]); const sch=ro[rk.SchoolID]; if (sch) actSch[subj][dk].add(sch); }
    ses[subj][dk]+=s; tim[subj][dk]+=tm; dia[subj][dk]+=dg; const delta=(Number(fr[fk.CurrentMilestone]||0)||0)-(Number(fr[fk.StartMilestone]||0)||0); progDelta[subj][dk].set(fr[fk.StudentID], (progDelta[subj][dk].get(fr[fk.StudentID])||0)+delta);
  });

  function seriesFor(metric: string) {
    return labels.map(lbl => ({ label: lbl, color: colors[lbl]||'#888', points: days.map(dk => {
      const active = actStu[lbl][dk].size || 1;
      if (metric==='Active Students') return actStu[lbl][dk].size;
      if (metric==='Active Schools') return actSch[lbl][dk].size;
      if (metric==='Students Progressed') { let cnt=0; progDelta[lbl][dk].forEach(v=>{ if (v>0) cnt+=1; }); return cnt; }
      if (metric==='Sessions per Student') return (ses[lbl][dk] / active);
      if (metric==='Avg Time Spent per student (7d)') return (tim[lbl][dk] / active);
      if (metric==='Diagnostics Completed') return dia[lbl][dk];
      return 0;
    }) }));
  }

  return {
    'Active Students': seriesFor('Active Students'),
    'Active Schools': seriesFor('Active Schools'),
    'Students Progressed': seriesFor('Students Progressed'),
    'Sessions per Student': seriesFor('Sessions per Student'),
    'Avg Time Spent per student (7d)': seriesFor('Avg Time Spent per student (7d)'),
    'Diagnostics Completed': seriesFor('Diagnostics Completed'),
  } as Record<string, Array<{label:string;color:string;points:number[]}>>;
}

function DetailTrend({ metric }: { metric: string }) {
  const { state, dispatch } = useStore();
  const series = useSubjectSeriesForTrends()?.[metric] || [];
  const w = 700; const h = 280; const padL = 40; const padB = 28; const padT = 10; const padR = 10;

  // Build day labels to show on X axis (last 5 days in window)
  function dayKey(d: Date){ return d.toISOString().slice(0,10); }
  const datesAll = (state.raw?.facts || []).map((f:any)=>f[state.raw!.keys.facts.Date]).filter(Boolean).map((s:string)=> new Date(s + 'T00:00:00Z').getTime());
  const maxTs = datesAll.length ? Math.max(...datesAll) : Date.now();
  const toD = new Date(maxTs);
  const days: string[] = []; for (let off=4; off>=0; off--){ const d=new Date(toD); d.setUTCDate(toD.getUTCDate()-off); const ds = dayKey(d); days.push(ds.slice(5)); }

  const all = series.flatMap(s => s.points);
  const minRaw = Math.min(...all); const maxRaw = Math.max(...all);
  const min = Math.min(0, isFinite(minRaw) ? minRaw : 0);
  const max = isFinite(maxRaw) ? maxRaw : 1;

  function xAt(i: number, n: number){ return padL + (i * (w - padL - padR)) / Math.max(1,(n - 1)); }
  function yAt(v: number){ return (h - padB) - ((v - min) / (max - min || 1)) * (h - padT - padB); }
  function line(points: number[]) { return points.map((p,i)=> `${xAt(i, points.length)},${yAt(p)}`).join(' '); }

  function mapMetricToKpi(m: string): string | null {
    const map: Record<string,string> = {
      'Active Students': 'Active Students',
      'Active Schools': 'Active Schools',
      'Students Progressed': 'Students Progressed',
      'Sessions per Student': 'Sessions per Student (7d)',
      'Avg Time Spent per student (7d)': 'Avg Time Spent per student (7d)',
      'Diagnostics Completed': '',
    };
    return map[m] || null;
  }
  return (
    <div>
      <svg width={w} height={h} style={{ display: 'block', background: 'transparent' }}>
        {/* Y-axis grid and labels */}
        {Array.from({ length: 5 }).map((_, i) => {
          const t = i/4; const val = min + (max - min) * (1 - t); const y = yAt(val);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#223047" strokeDasharray="4 4" />
              <text x={padL - 6} y={y + 4} fill="var(--muted)" fontSize={10} textAnchor="end">{Math.round(val*100)/100}</text>
            </g>
          );
        })}
        {/* X-axis and labels */}
        <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="#223047" />
        {days.map((d, i) => (
          <text key={d} x={xAt(i, days.length)} y={h - 8} fill="var(--muted)" fontSize={10} textAnchor="middle">{d}</text>
        ))}
        {/* Series lines and points */}
        {series.map((s) => (
          <g key={s.label}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" points={line(s.points)} />
            {s.points.map((p, i) => (
              <circle key={i} cx={xAt(i, s.points.length)} cy={yAt(p)} r={3} fill={s.color} />
            ))}
          </g>
        ))}
      </svg>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' as const, marginTop: 8 }}>
        {series.map(s => (
          <button key={s.label} className="chip" onClick={() => { const k = mapMetricToKpi(metric); if (k) { dispatch({ type: 'openKpiDrill', metric: k }); dispatch({ type: 'setArray', key: 'subjects', value: [s.label] }); } }}>
            <span style={{ width: 8, height: 8, background: s.color, display: 'inline-block', borderRadius: 2, marginRight: 6 }} />
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Tip: click a subject to open a KPI drill for that metric with the subject filter applied.</div>
    </div>
  );
}

function ntColorForSubject(label: string, base: string) {
  const map: Record<string, string> = { Telugu: '#c39bd3', English: '#85c1e9', Math: '#82e0aa' };
  return map[label] || base + '99';
}
