import React, { useMemo } from 'react';
import { useStore } from '../state';

function pct(a: number, b: number) {
  if (!b) return '0%';
  return Math.round((a / b) * 100) + '%';
}
function pctNum(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function ntColorForSubject(label: string, base: string) {
  // Lighter variants for non-target by subject; fallback to semi-transparent base
  const map: Record<string, string> = {
    Telugu: '#c39bd3',
    English: '#85c1e9',
    Math: '#82e0aa',
  };
  return map[label] || base + '99'; // 60% alpha if supported
}

export function KpiRow() {
  const { state, dispatch } = useStore();
  const subjectsToShow = state.filters.subjects.length ? state.filters.subjects : state.options.subjects;

  const subjectBarsByKpi = useMemo<
    Record<string, Array<{label:string;pct:number;color:string;value:number|string;t?:number;nt?:number}>> | null
  >(() => {
    if (!state.raw) return null;
    const R = state.raw;
    const rk = R.keys.roster, fk = R.keys.facts;
    const rosterById = new Map<string, any>();
    R.roster.forEach(r => { const id = r[rk.StudentID]; if (id) rosterById.set(id, r); });
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

    // Time window
    const dates = R.facts.map(f => f[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
    const maxTs = dates.length ? Math.max(...dates) : Date.now();
    const maxDate = new Date(maxTs);
    let from = new Date(maxDate), to = new Date(maxDate);
    const quick = state.filters.quick;
    if (quick === 'Yesterday') { from.setUTCDate(maxDate.getUTCDate() - 1); to = new Date(from); }
    else if (quick === 'Last 30 Days') { from.setUTCDate(maxDate.getUTCDate() - 29); }
    else { from.setUTCDate(maxDate.getUTCDate() - 6); }
    if (state.filters.range.from) from = new Date(state.filters.range.from + 'T00:00:00Z');
    if (state.filters.range.to) to = new Date(state.filters.range.to + 'T00:00:00Z');
    function inWindow(dateStr: string) {
      const t = new Date(dateStr + 'T00:00:00Z');
      return t >= from && t <= to;
    }

    // Collect per-subject metrics
    const subs = (subjectsToShow.length ? subjectsToShow : state.options.subjects).map(s => normSubj(s));
    const metrics = subs.map(subject => ({ subject, color: colors[subject] || '#888', activeStudents: 0, activeSchools: 0, progressed: 0, sps: 0, avg: 0 }));

    // temp accumulators
    const activeStudentsBySub: Record<string, Set<string>> = {};
    const activeStudentsBySubT: Record<string, Set<string>> = {};
    const activeStudentsBySubNT: Record<string, Set<string>> = {};
    const activeSchoolsBySub: Record<string, Set<string>> = {};
    const activeSchoolsBySubT: Record<string, Set<string>> = {};
    const activeSchoolsBySubNT: Record<string, Set<string>> = {};
    const sessionsBySub: Record<string, number> = {};
    const sessionsBySubT: Record<string, number> = {};
    const sessionsBySubNT: Record<string, number> = {};
    const timeBySub: Record<string, number> = {};
    const timeBySubT: Record<string, number> = {};
    const timeBySubNT: Record<string, number> = {};
    const deltaByStudentBySub: Record<string, Map<string, number>> = {};
    const progressedTBySub: Record<string, number> = {};
    const progressedNTBySub: Record<string, number> = {};

    subs.forEach(s => { 
      activeStudentsBySub[s]=new Set(); activeStudentsBySubT[s]=new Set(); activeStudentsBySubNT[s]=new Set();
      activeSchoolsBySub[s]=new Set(); activeSchoolsBySubT[s]=new Set(); activeSchoolsBySubNT[s]=new Set();
      sessionsBySub[s]=0; sessionsBySubT[s]=0; sessionsBySubNT[s]=0;
      timeBySub[s]=0; timeBySubT[s]=0; timeBySubNT[s]=0;
      deltaByStudentBySub[s]=new Map(); progressedTBySub[s]=0; progressedNTBySub[s]=0;
    });

    R.facts.forEach(fr => {
      const ro = rosterById.get(fr[fk.StudentID]);
      if (!passRoster(ro)) return;
      if (!inWindow(fr[fk.Date])) return;
      const subj = normSubj(fr[fk.Subject] || '');
      if (!subs.includes(subj)) return;
      const s = Number(fr[fk.Sessions] || 0) || 0;
      const tm = Number(fr[fk.TimeMinutes] || 0) || 0;
      const startM = Number(fr[fk.StartMilestone] || 0) || 0;
      const currM = Number(fr[fk.CurrentMilestone] || 0) || 0;
      const isT = ro[rk.TargetFlag] === '1';
      if (s > 0 || tm > 0) {
        activeStudentsBySub[subj].add(fr[fk.StudentID]);
        const sch = ro[rk.SchoolID]; if (sch) activeSchoolsBySub[subj].add(sch);
        if (isT) { activeStudentsBySubT[subj].add(fr[fk.StudentID]); if (sch) activeSchoolsBySubT[subj].add(sch); }
        else { activeStudentsBySubNT[subj].add(fr[fk.StudentID]); if (sch) activeSchoolsBySubNT[subj].add(sch); }
      }
      sessionsBySub[subj] += s; timeBySub[subj] += tm;
      if (isT) { sessionsBySubT[subj] += s; timeBySubT[subj] += tm; } else { sessionsBySubNT[subj] += s; timeBySubNT[subj] += tm; }
      const prev = (deltaByStudentBySub[subj].get(fr[fk.StudentID]) || 0) + (currM - startM);
      deltaByStudentBySub[subj].set(fr[fk.StudentID], prev);
      if (prev > 0) { if (isT) progressedTBySub[subj] += 1; else progressedNTBySub[subj] += 1; }
    });

    metrics.forEach(m => {
      m.activeStudents = activeStudentsBySub[m.subject].size;
      m.activeSchools = activeSchoolsBySub[m.subject].size;
      m.sps = sessionsBySub[m.subject] / Math.max(1, m.activeStudents);
      m.avg = timeBySub[m.subject] / Math.max(1, m.activeStudents);
      let progressed = 0; deltaByStudentBySub[m.subject].forEach(v => { if (v > 0) progressed += 1; }); m.progressed = progressed;
    });

    // Build segmented bars for counts, single bars for rate/avg
    function compBars(tValues: number[], ntValues: number[], labels: string[]) {
      const totals = tValues.map((t, i) => t + (ntValues[i] || 0));
      const max = Math.max(1, ...totals);
      return totals.map((total, i) => ({ label: labels[i], pct: Math.round((total / max) * 100), color: colors[labels[i]] || '#888', value: total, t: tValues[i] || 0, nt: ntValues[i] || 0 }));
    }
    const labels = metrics.map(m => m.subject);
    const activeStudentsBars = compBars(labels.map(s=>activeStudentsBySubT[s].size), labels.map(s=>activeStudentsBySubNT[s].size), labels);
    const activeSchoolsBars = compBars(labels.map(s=>activeSchoolsBySubT[s].size), labels.map(s=>activeSchoolsBySubNT[s].size), labels);
    const progressedBars = compBars(labels.map(s=>progressedTBySub[s]), labels.map(s=>progressedNTBySub[s]), labels);
    const spsBars = labels.map(s => ({ label: s, pct: Math.min(100, Math.round(((sessionsBySub[s] / Math.max(1, activeStudentsBySub[s].size)) / 2) * 100)), color: colors[s] || '#888', value: round2(sessionsBySub[s] / Math.max(1, activeStudentsBySub[s].size)) }));
    const avgBars = labels.map(s => ({ label: s, pct: Math.min(100, Math.round(((timeBySub[s] / Math.max(1, activeStudentsBySub[s].size)) / 200) * 100)), color: colors[s] || '#888', value: Math.round(timeBySub[s] / Math.max(1, activeStudentsBySub[s].size)) }));

    return {
      'Active Students': activeStudentsBars,
      'Active Schools': activeSchoolsBars,
      'Students Progressed': progressedBars,
      'Sessions per Student (7d)': spsBars,
      'Avg Time Spent per student (7d)': avgBars,
    } as Record<string, Array<{label:string;pct:number;color:string;value:number|string;t?:number;nt?:number}>>;
  }, [state]);

  return (
    <div>
      <div className="hstack" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
        <div className="toggle">
          {(['Absolute','Percent'] as const).map(m => (
            <button key={m} className={state.kpiMode === m ? 'on' : ''} onClick={() => dispatch({ type: 'setKpiMode', mode: m })}>{m}</button>
          ))}
        </div>
      </div>
      <div className="row kpis">
        {state.kpis.map((k) => (
          <KpiCard
            key={k.title}
            title={k.title}
            big={k.big}
            reference={k.reference}
            wow={k.wow}
          gauge={k.gauge}
          kpiMode={state.kpiMode}
          subjectBars={subjectBarsByKpi ? subjectBarsByKpi[k.title] : undefined}
            onClick={() => dispatch({ type: 'openKpiDrill', metric: k.title })}
          />
        ))}
      </div>
    </div>
  );
}

function KpiCard(props: any) {
  const gauge = props.gauge;
  return (
    <div className="kpi" onClick={props.onClick} style={{ cursor: 'pointer' }} title={
      'pct' in (gauge || {})
        ? `Progress: ${gauge.pct}%`
        : `In-target: ${gauge.green} | Out-of-target: ${gauge.blue} | Remaining: ${gauge.grey}`
    }>
      <div className="title">{props.title}</div>
      <div className="big">{props.big}</div>
      <div className="ref">{props.reference}</div>
      <div style={{ height: 8 }} />
      {'pct' in (gauge || {}) ? (
        <div className="gauge" title={`${gauge.pct}%`}>
          <div className="fill seg green" style={{ width: `${Math.max(0, Math.min(100, Number(gauge.pct) || 0))}%` }} />
        </div>
      ) : (
        <div className="gauge" title={`G:${gauge.green} B:${gauge.blue} R:${gauge.grey}`}>
          {(() => {
            const g = Number((gauge as any).green) || 0;
            const b = Number((gauge as any).blue) || 0;
            const r = Number((gauge as any).grey) || 0;
            const total = g + b + r;
            const gw = total > 0 ? (g / total) * 100 : 0;
            const bw = total > 0 ? (b / total) * 100 : 0;
            const rw = total > 0 ? (r / total) * 100 : 0;
            return (
              <>
                <div className="seg green" style={{ width: `${gw}%` }} />
                <div className="seg blue" style={{ width: `${bw}%` }} />
                <div className="seg grey" style={{ width: `${rw}%` }} />
              </>
            );
          })()}
        </div>
      )}
      <div style={{ height: 8 }} />
      {/* WoW removed per request */}
      {props.subjectBars && props.subjectBars.length > 0 && (
        <div className="subbars">
          {props.subjectBars.map((sb: any) => (
            <div key={sb.label} className="subrow">
              <div className="sublabel">
                <span style={{ width: 8, height: 8, background: sb.color, display: 'inline-block', borderRadius: 2, marginRight: 6 }} />
                {sb.label}
              </div>
              <div className="subbar" title={`${sb.label}: ${sb.t ?? ''}${sb.t !== undefined ? ' T' : ''} ${sb.nt ?? ''}${sb.nt !== undefined ? ' NT' : ''}`}>
                {sb.t !== undefined && sb.nt !== undefined ? (
                  <>
                    <div className="seg" style={{ background: sb.color, width: `${(sb.t / Math.max(1,(sb.t+sb.nt))) * sb.pct}%`, height: '100%' }} />
                    <div className="seg" style={{ background: ntColorForSubject(sb.label, sb.color), width: `${(sb.nt / Math.max(1,(sb.t+sb.nt))) * sb.pct}%`, height: '100%' }} />
                  </>
                ) : (
                  <div className="fill" style={{ width: `${sb.pct}%`, background: sb.color }} />
                )}
              </div>
              <div className="subvalue">{sb.t !== undefined
                ? ((props.kpiMode === 'Percent')
                    ? `${Math.round((sb.t/Math.max(1,(sb.t+sb.nt)))*100)}% (+${Math.round((sb.nt/Math.max(1,(sb.t+sb.nt)))*100)}%)`
                    : `${sb.t} (+${sb.nt})`)
                : ((props.kpiMode === 'Percent') ? `${sb.pct}%` : String(sb.value))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




