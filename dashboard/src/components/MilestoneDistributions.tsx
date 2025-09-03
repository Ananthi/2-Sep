import React, { useMemo, useState } from 'react';
import { useStore } from '../state';

type Part = { label: string; value: number; color: string };

export function MilestoneDistributions() {
  const [mode, setMode] = useState<'Absolute' | 'Percent'>('Absolute');
  const dist = useMilestoneDistributions();
  if (!dist || dist.subjects.length === 0) return null;
  return (
    <div>
      <div className="hstack" style={{ justifyContent: 'space-between', margin: '6px 0' }}>
        <div className="section-title" style={{ margin: 0 }}>Milestone Distribution</div>
        <div className="toggle">
          {(['Absolute','Percent'] as const).map(m => (
            <button key={m} className={mode===m ? 'on' : ''} onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {dist.subjects.map((subj) => (
          <div key={subj} className="panel">
            <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600 }}>{subj}</div>
              <div className="chip" title="Students with positive milestone change in window">
                Progressed: {mode==='Percent'
                  ? `${pctNum(dist.progressed[subj] || 0, dist.studentTotals[subj] || 0)}%`
                  : `${dist.progressed[subj] || 0}`}
              </div>
            </div>
            <div className="bar-row">
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Initial</div>
              <BarDistribution mode={mode} parts={dist.initial[subj]} total={dist.totalsInitial[subj] || 0} showLabel={false} showValues />
            </div>
            <div className="bar-row">
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Current</div>
              <BarDistribution mode={mode} parts={dist.current[subj]} total={dist.totalsCurrent[subj] || 0} showLabel={false} showValues />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarDistribution({ label, parts, total, showLabel = true, showValues = false, mode = 'Absolute' as 'Absolute'|'Percent' }: { label?: string; parts: Part[]; total: number; showLabel?: boolean; showValues?: boolean; mode?: 'Absolute'|'Percent' }) {
  const safeTotal = total > 0 ? total : 1;
  if (!showLabel) {
    return (
      <div className="bar" title={`${label ?? ''} • total ${total}`}>
        {parts.map((p) => {
          const pct = (p.value / safeTotal) * 100;
          return (
            <div key={p.label} style={{ position: 'relative', display: 'inline-block', height: '100%', width: `${pct}%`, background: p.color }} title={`${p.label}: ${p.value}`}>
              {showValues && pct > 8 && (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{mode==='Percent' ? `${Math.round(pct)}%` : p.value}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="bar-row" style={{ marginTop: 6 }}>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
      <div className="bar" title={`${label} • total ${total}`}>
        {parts.map((p) => {
          const pct = (p.value / safeTotal) * 100;
          return (
            <div key={p.label} style={{ position: 'relative', display: 'inline-block', height: '100%', width: `${pct}%`, background: p.color }} title={`${p.label}: ${p.value}`}>
              {showValues && pct > 8 && (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{mode==='Percent' ? `${Math.round(pct)}%` : p.value}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pctNum(a: number, b: number) { if (!b) return 0; return Math.round((a/b)*100); }

function useMilestoneDistributions() {
  const { state } = useStore();
  const raw = state.raw;
  return useMemo(() => {
    if (!raw) return null as any;
    const R = raw;
    const rk = R.keys.roster, fk = R.keys.facts;
    const rosterById = new Map<string, any>();
    R.roster.forEach((r) => { const id = r[rk.StudentID]; if (id) rosterById.set(id, r); });

    // Time window
    const dates = R.facts.map(r => r[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
    const maxTs = dates.length ? Math.max(...dates) : Date.now();
    const maxDate = new Date(maxTs);
    let from = new Date(maxDate), to = new Date(maxDate);
    const quick = state.filters.quick;
    if (quick === 'Yesterday') { from.setUTCDate(maxDate.getUTCDate() - 1); to = new Date(from); }
    else if (quick === 'Last 30 Days') { from.setUTCDate(maxDate.getUTCDate() - 29); }
    else { from.setUTCDate(maxDate.getUTCDate() - 6); }
    if (state.filters.range.from) from = new Date(state.filters.range.from + 'T00:00:00Z');
    if (state.filters.range.to) to = new Date(state.filters.range.to + 'T00:00:00Z');

    // Filters
    const geo = {
      d: new Set(state.filters.districts),
      m: new Set(state.filters.mandals),
      s: new Set(state.filters.schools),
    };
    const classSel = new Set(state.filters.classes);
    const subjectSel = new Set((state.filters.subjects || []).map(s => s.toLowerCase()));

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

    function inWindow(dateStr: string) {
      const t = new Date(dateStr + 'T00:00:00Z');
      return t >= from && t <= to;
    }

    // Collect subjects from filter or data
    const subjects = state.filters.subjects.length
      ? state.filters.subjects
      : Array.from(new Set(R.facts.map(f => (f[fk.Subject] || '').trim()).filter(Boolean)));

    // Prepare containers per subject
    const levels = [0,1,2,3,4,5,6,7,8,9];
    const colors = ['#5b8def','#b37feb','#ff7a45','#2ecc71','#e67e22','#e74c3c','#16a085','#f1c40f','#3498db','#8e44ad'];
    const initial: Record<string, Part[]> = {};
    const current: Record<string, Part[]> = {};
    const totalsInitial: Record<string, number> = {};
    const totalsCurrent: Record<string, number> = {};
    const progressed: Record<string, number> = {};
    const studentTotals: Record<string, number> = {};
    subjects.forEach(s => { initial[s] = levels.map((lv,i)=>({label: String(lv), value: 0, color: colors[i%colors.length]})); current[s] = initial[s].map(p=>({...p, value:0})); totalsInitial[s]=0; totalsCurrent[s]=0; progressed[s]=0; studentTotals[s]=0; });

    const deltaByStudent: Record<string, Map<string, number>> = {};
    subjects.forEach(s => { deltaByStudent[s] = new Map(); });
    const studentsBySubject: Record<string, Set<string>> = {}; subjects.forEach(s => { studentsBySubject[s] = new Set(); });

    R.facts.forEach(fr => {
      if (!inWindow(fr[fk.Date])) return;
      const ro = rosterById.get(fr[fk.StudentID]);
      if (!passRoster(ro)) return;
      const subj = (fr[fk.Subject] || '').trim();
      if (subjectSel.size && !subjectSel.has(subj.toLowerCase())) return;
      if (!subjects.includes(subj)) return;
      studentsBySubject[subj].add(fr[fk.StudentID]);
      const start = Number(fr[fk.StartMilestone] || 0) || 0;
      const curr = Number(fr[fk.CurrentMilestone] || 0) || 0;
      const iBucket = Math.max(0, Math.min(levels.length - 1, start));
      const cBucket = Math.max(0, Math.min(levels.length - 1, curr));
      initial[subj][iBucket].value += 1; totalsInitial[subj] += 1;
      current[subj][cBucket].value += 1; totalsCurrent[subj] += 1;
      const prev = (deltaByStudent[subj].get(fr[fk.StudentID]) || 0) + (curr - start);
      deltaByStudent[subj].set(fr[fk.StudentID], prev);
    });

    subjects.forEach(s => {
      studentTotals[s] = studentsBySubject[s].size;
      let count = 0; deltaByStudent[s].forEach(v => { if (v > 0) count += 1; });
      progressed[s] = count;
    });

    return { subjects, levels, initial, current, totalsInitial, totalsCurrent, progressed, studentTotals };
  }, [state]);
}
