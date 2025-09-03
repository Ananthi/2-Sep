import React, { useMemo } from 'react';
import { useStore } from '../state';

export function ProgressFunnel() {
  const { state } = useStore();
  const subjectFunnels = useSubjectFunnels();
  if (!subjectFunnels || subjectFunnels.length === 0) {
    // Fallback to existing aggregate funnel if no data loaded yet
    const max = Math.max(...state.funnel.map((f) => f.value));
    return (
      <div className="panel">
        {state.funnel.map((f) => (
          <div key={f.stage} className="hstack" style={{ marginBottom: 8 }}>
            <div style={{ width: 180, color: 'var(--muted)', fontSize: 12 }}>{f.stage}</div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 18, background: '#0b1320', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(f.value / max) * 100}%`, height: '100%', background: `linear-gradient(90deg, var(--blue), var(--green))` }} />
              </div>
            </div>
            <div style={{ width: 120, textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>{f.value.toLocaleString()} ({f.pct}%)</div>
          </div>
        ))}
      </div>
    );
  }
  const colorMap: Record<string, string> = { Telugu: '#8e44ad', English: '#3498db', Math: '#2ecc71' };
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {subjectFunnels.map(sf => {
        const c = colorMap[sf.subject] || '#5b8def';
        return (
          <div key={sf.subject} className="panel">
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, background: c, display: 'inline-block', borderRadius: 2, marginRight: 6 }} />
              {sf.subject}
            </div>
            {sf.funnel.map((f) => (
              <div key={sf.subject + '_' + f.stage} className="hstack" style={{ marginBottom: 8 }}>
                <div style={{ width: 180, color: 'var(--muted)', fontSize: 12 }}>{f.stage}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 24, background: '#0e1624', border: '1px solid #2a3a55', borderRadius: 6, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: f.value === 0 ? '0%' : `${Math.max(15, Math.round((f.value / Math.max(1, sf.max)) * 100))}%`,
                        height: '100%',
                        background: c,
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset'
                      }}
                    />
                  </div>
                </div>
                <div style={{ width: 120, textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>{f.value.toLocaleString()} ({f.pct}%)</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function useSubjectFunnels() {
  const { state } = useStore();
  const raw = state.raw; if (!raw) return null as any;
  const R = raw; const rk = R.keys.roster, fk = R.keys.facts;
  const rosterById = new Map<string, any>(); R.roster.forEach(r => { const id = r[rk.StudentID]; if (id) rosterById.set(id, r); });
  function normSubj(s: string) { const t=(s||'').trim().toLowerCase(); if (t.startsWith('math')) return 'Math'; if (t.startsWith('eng')) return 'English'; if (t.startsWith('tel')) return 'Telugu'; return s || ''; }
  const subjects = (state.filters.subjects.length ? state.filters.subjects : state.options.subjects).map(normSubj);
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
  // window
  const dates = R.facts.map(f => f[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
  const maxTs = dates.length ? Math.max(...dates) : Date.now();
  const maxDate = new Date(maxTs); let from = new Date(maxDate), to = new Date(maxDate);
  const quick = state.filters.quick; if (quick==='Yesterday'){ from.setUTCDate(maxDate.getUTCDate()-1); to=new Date(from);} else if (quick==='Last 30 Days'){ from.setUTCDate(maxDate.getUTCDate()-29);} else { from.setUTCDate(maxDate.getUTCDate()-6);} if (state.filters.range.from) from=new Date(state.filters.range.from+'T00:00:00Z'); if (state.filters.range.to) to=new Date(state.filters.range.to+'T00:00:00Z');
  function inWindow(dateStr: string){ const t=new Date(dateStr+'T00:00:00Z'); return t>=from && t<=to; }

  // total students in scope (geo/class/scope)
  const totalStudentsScope = R.roster.filter(ro => passRoster(ro)).length;

  const out: Array<{ subject: string; funnel: { stage: string; value: number; pct: number }[]; max: number }> = [];
  subjects.forEach(subj => {
    const active = new Set<string>();
    const diag = new Set<string>();
    const timeAll = new Map<string, number>();
    const deltaAll = new Map<string, number>();
    R.facts.forEach(fr => {
      const ro = rosterById.get(fr[fk.StudentID]); if (!passRoster(ro)) return; if (!inWindow(fr[fk.Date])) return;
      const s = normSubj(fr[fk.Subject] || ''); if (s !== subj) return;
      const sessions = Number(fr[fk.Sessions] || 0) || 0; const tm = Number(fr[fk.TimeMinutes] || 0) || 0; const dg = Number(fr[fk.DiagnosticsCompleted] || 0) || 0;
      if (sessions>0 || tm>0) active.add(fr[fk.StudentID]);
      if (dg>0) diag.add(fr[fk.StudentID]);
      timeAll.set(fr[fk.StudentID], (timeAll.get(fr[fk.StudentID])||0) + tm);
      const delta = (Number(fr[fk.CurrentMilestone]||0)||0) - (Number(fr[fk.StartMilestone]||0)||0);
      deltaAll.set(fr[fk.StudentID], (deltaAll.get(fr[fk.StudentID])||0) + delta);
    });
    const practiced200 = new Set<string>(); timeAll.forEach((v,k) => { if (v>=200) practiced200.add(k); });
    const improved = new Set<string>(); deltaAll.forEach((v,k) => { if (v>0) improved.add(k); });
    const completedAll = new Set<string>(); deltaAll.forEach((v,k)=>{ if (v>=10) completedAll.add(k); });

    const funnel = [
      { stage: 'Total Students', value: totalStudentsScope, pct: 100 },
      { stage: 'Active Students', value: active.size, pct: pctNum(active.size, totalStudentsScope) },
      { stage: 'Completed Diagnostics', value: diag.size, pct: pctNum(diag.size, totalStudentsScope) },
      { stage: 'Practicing >200 mins', value: practiced200.size, pct: pctNum(practiced200.size, totalStudentsScope) },
      { stage: 'Improved Milestone', value: improved.size, pct: pctNum(improved.size, totalStudentsScope) },
      { stage: 'Completed All Levels', value: completedAll.size, pct: pctNum(completedAll.size, totalStudentsScope) },
    ];
    const max = Math.max(...funnel.map(f=>f.value));
    out.push({ subject: subj, funnel, max });
  });

  return out;
}

function pctNum(a: number, b: number){ if (!b) return 0; return Math.round((a/b)*100); }
