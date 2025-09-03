import React, { useMemo, useState } from 'react';
import { useStore } from '../state';

export function Coverage() {
  const { state, dispatch } = useStore();
  const scope = state.coverageScope;
  const modePercent = state.coverageMode === 'Percent';
  const [onbDrill, setOnbDrill] = useState<{ subject: string; level: 'District'|'Mandal'|'School'; district?: string; mandal?: string } | null>(null);
  const [onbSort, setOnbSort] = useState<{ key: string; dir: 'asc'|'desc' }>({ key: 'TO', dir: 'desc' });

  // Subjects to display: if filter has selections, show only those; otherwise show all available subjects
  const subjectsToShow = state.filters.subjects.length ? state.filters.subjects : state.options.subjects;

  // Compute per-subject coverage when raw data is available; otherwise fall back to single aggregate bar
  const perSubject = useMemo(() => {
    const raw = state.raw;
    if (!raw) return null as any;
    const R = raw;
    const rk = R.keys.roster, fk = R.keys.facts;

    // Geo/Class filters only (subject is show/hide, not aggregator)
    const geo = { d: new Set(state.filters.districts), m: new Set(state.filters.mandals), s: new Set(state.filters.schools) };
    const classSel = new Set(state.filters.classes);
    function passRosterGeoClass(ro: any) {
      if (!ro) return false;
      if (classSel.size && !classSel.has(ro[rk.Grade])) return false;
      if (geo.s.size) { if (!geo.s.has(ro[rk.SchoolName])) return false; }
      else if (geo.m.size) { if (!geo.m.has(ro[rk.Mandal])) return false; }
      else if (geo.d.size) { if (!geo.d.has(ro[rk.District])) return false; }
      // Apply scope filter to onboarding as well
      if (state.filters.scope === 'Target' && ro[rk.TargetFlag] !== '1') return false;
      if (state.filters.scope === 'Non-Target' && ro[rk.TargetFlag] !== '0') return false;
      return true;
    }

    // Time window for Active
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

    // Totals by entity for Target in scope (geo/class)
    const totalTargetByScope = (() => {
      const filtered = R.roster.filter(ro => passRosterGeoClass(ro) && ro[rk.TargetFlag] === '1');
      if (scope === 'Students') return filtered.length;
      if (scope === 'Schools') return new Set(filtered.map(ro => ro[rk.SchoolID])).size;
      if (scope === 'Mandals') return new Set(filtered.map(ro => ro[rk.Mandal])).size;
      return new Set(filtered.map(ro => ro[rk.District])).size;
    })();

    // Non-target totals by entity (active + inactive) within geo/class
    const nonTargetTotalsByScope = (() => {
      const filtered = R.roster.filter(ro => passRosterGeoClass(ro) && ro[rk.TargetFlag] !== '1');
      if (scope === 'Students') return new Set(filtered.map(ro => ro[rk.StudentID])).size;
      if (scope === 'Schools') return new Set(filtered.map(ro => ro[rk.SchoolID])).size;
      if (scope === 'Mandals') return new Set(filtered.map(ro => ro[rk.Mandal])).size;
      return new Set(filtered.map(ro => ro[rk.District])).size;
    })();

    // Build per-subject bars
    const results: Array<{ subj: string; segs: { green: number; amber: number; grey: number; blue: number } }> = [];
    const rosterById = new Map<string, any>();
    R.roster.forEach(r => { const id = r[rk.StudentID]; if (id) rosterById.set(id, r); });

    function normSubj(s: string) {
      const t = (s || '').trim().toLowerCase();
      if (t.startsWith('math')) return 'math';
      if (t.startsWith('eng')) return 'english';
      if (t.startsWith('tel')) return 'telugu';
      return t;
    }

    subjectsToShow.forEach(subj => {
      const subjKey = normSubj(subj);
      // Onboarded sets for this subject (ever)
      const onboardedTarget = new Set<string>();
      const onboardedNonTarget = new Set<string>();
      // Active sets this period for this subject
      const activeTarget = new Set<string>();
      const activeNonTarget = new Set<string>();

      R.facts.forEach(fr => {
        const ro = rosterById.get(fr[fk.StudentID]);
        if (!passRosterGeoClass(ro)) return;
        const s = normSubj(fr[fk.Subject] || '');
        if (s !== subjKey) return;
        const isTarget = ro[rk.TargetFlag] === '1';
        if (isTarget) onboardedTarget.add(fr[fk.StudentID]); else onboardedNonTarget.add(fr[fk.StudentID]);
        if (inWindow(fr[fk.Date])) {
          if (isTarget) activeTarget.add(fr[fk.StudentID]); else activeNonTarget.add(fr[fk.StudentID]);
        }
      });

      function sizeByScope(setOfStudents: Set<string>, nonTarget = false) {
        if (scope === 'Students') return setOfStudents.size;
        if (scope === 'Schools') {
          const ids = new Set<string>();
          setOfStudents.forEach(sid => { const ro = rosterById.get(sid); if (ro) ids.add(ro[rk.SchoolID]); });
          return ids.size;
        }
        if (scope === 'Mandals') {
          const ids = new Set<string>();
          setOfStudents.forEach(sid => { const ro = rosterById.get(sid); if (ro) ids.add(ro[rk.Mandal]); });
          return ids.size;
        }
        const ids = new Set<string>();
        setOfStudents.forEach(sid => { const ro = rosterById.get(sid); if (ro) ids.add(ro[rk.District]); });
        return ids.size;
      }

      // No Active split: show cumulative onboarding only
      const green = sizeByScope(onboardedTarget); // Target Onboarded (ever)
      const amber = 0; // removed active/not-active split
      const grey = Math.max(0, totalTargetByScope - sizeByScope(onboardedTarget)); // Target Not Onboarded
      const blue = (() => {
        // Non-target onboarded (ever) for this subject
        const n = sizeByScope(onboardedNonTarget, true);
        return n || 0;
      })();

      results.push({ subj, segs: { green, amber, grey, blue } });
    });

    return { list: results, targetTotal: totalTargetByScope };
  }, [state, scope, subjectsToShow]);

  return (
    <div className="panel">
      <div className="hstack" style={{ marginBottom: 12 }}>
        <div className="toggle">
          {(['Districts', 'Mandals', 'Schools', 'Students'] as const).map((s) => (
            <button key={s} className={state.coverageScope === s ? 'on' : ''} onClick={() => dispatch({ type: 'setCoverageScope', scope: s })}>
              {s}
            </button>
          ))}
        </div>
        <div className="toggle" style={{ marginLeft: 8 }}>
          {(['Absolute', 'Percent'] as const).map((m) => (
            <button key={m} className={state.coverageMode === m ? 'on' : ''} onClick={() => dispatch({ type: 'setCoverageMode', mode: m })}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Header row with Target (once) and Legend */}
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12 }}>
          Target: {formatNumber(perSubject?.targetTotal ?? (() => { const d = state.coverage[scope] as any; return (Number(d.green)||0)+(Number(d.amber)||0)+(Number(d.grey)||0); })())}
        </div>
        <div className="hstack" style={{ gap: 12, color: 'var(--muted)', fontSize: 12 }}>
          <LegendItem color="var(--green)" label="Target Onboarded" />
          <LegendItem color="#2c3a4d" label="Target Not Onboarded" />
          <LegendItem color="var(--blue)" label="Non-target" />
        </div>
      </div>

      {perSubject ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(${subjectsToShow.length}, minmax(0, 1fr))` }}>
          {subjectsToShow.map((subj) => {
            const found = perSubject.list.find(p => p.subj === subj);
            const segs = found?.segs || { green: 0, amber: 0, grey: 0, blue: 0 };
            const total = (segs.green || 0) + (segs.amber || 0) + (segs.grey || 0) + (segs.blue || 0);
            return (
              <div key={subj} className="panel" style={{ padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>{subj}</div>
                <div onClick={() => setOnbDrill({ subject: subj, level: 'District' })} style={{ cursor: 'pointer' }}>
                <Donut
                  size={120}
                  thickness={14}
                  total={total}
                  segments={[
                    { key: 'green', label: 'Target Onboarded', value: segs.green, color: 'var(--green)' },
                    { key: 'grey', label: 'Target Not Onboarded', value: segs.grey, color: '#2c3a4d' },
                    { key: 'blue', label: 'Non-target', value: segs.blue, color: 'var(--blue)' },
                  ]}
                  onSegmentClick={(label) => dispatch({ type: 'setScope', scope: label.includes('Non-target') ? 'Non-Target' : 'Target' })}
                  centerLabel={undefined}
                  modePercent={modePercent}
                />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback: single aggregate bar
        (() => {
          const data = state.coverage[scope] as any;
          const total = (Number(data.green) || 0) + (Number(data.amber) || 0) + (Number(data.blue) || 0) + (Number(data.grey) || 0);
          const targetTotal = (Number(data.green) || 0) + (Number(data.amber) || 0) + (Number(data.grey) || 0);
            const rows: Array<{ label: string; value: number; color: string }>[] = [[
            { label: 'Target Onboarded', value: data.green + data.amber, color: 'var(--green)' },
            { label: 'Target Not Onboarded', value: data.grey, color: '#2c3a4d' },
            { label: 'Non-target', value: data.blue, color: 'var(--blue)' },
          ]];
          return (
            <div className="bar-row">
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{scope}</div>
              <div className="bar">
                {rows[0].map((seg) => (
                  <div key={seg.label} title={`${seg.label}: ${seg.value}`} style={{ display: 'inline-block', height: '100%', width: `${total > 0 ? (seg.value / total) * 100 : 0}%`, background: seg.color, cursor: 'pointer' }} onClick={() => dispatch({ type: 'setScope', scope: seg.label.includes('Non-target') ? 'Non-Target' : 'Target' })} />
                ))}
              </div>
            </div>
          );
        })()
      )}
      {!perSubject && (() => {
        const data = state.coverage[scope] as any;
        const total = (Number(data.green) || 0) + (Number(data.amber) || 0) + (Number(data.blue) || 0) + (Number(data.grey) || 0);
        const rows = [
          { label: 'Target Onboarded', value: (data.green||0) + (data.amber||0), color: 'var(--green)' },
          { label: 'Target Not Onboarded', value: data.grey, color: '#2c3a4d' },
          { label: 'Non-target', value: data.blue, color: 'var(--blue)' },
        ];
        return (
          <div className="hstack" style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>
            {rows.map((seg) => (
              <div key={seg.label} className="hstack" style={{ gap: 6, marginRight: 12 }}>
                <span style={{ width: 10, height: 10, background: seg.color, display: 'inline-block', borderRadius: 2 }} />
                {seg.label}: {modePercent ? (total > 0 ? Math.round((seg.value / total) * 100) + '%' : '0%') : `${formatNumber(seg.value)} / ${formatNumber(total)}`}
              </div>
            ))}
          </div>
        );
      })()}
      {onbDrill && state.raw && (
        <div className="panel" style={{ marginTop: 12 }}>
          {(() => {
            const raw = state.raw!; const rk = raw.keys.roster; const fk = raw.keys.facts;
            const rosterById = new Map<string, any>(); raw.roster.forEach(r=>{ const id=r[rk.StudentID]; if (id) rosterById.set(id,r); });
            const normSubj = (s: string) => { const t=(s||'').toLowerCase(); if (t.startsWith('math')) return 'Math'; if (t.startsWith('eng')) return 'English'; if (t.startsWith('tel')) return 'Telugu'; return s||''; };
            const subj = normSubj(onbDrill.subject);
            // Filters
            const geoSel = { d: new Set(state.filters.districts), m: new Set(state.filters.mandals), s: new Set(state.filters.schools) };
            const classSel = new Set(state.filters.classes);
            function passRosterBase(ro: any) {
              if (!ro) return false;
              if (classSel.size && !classSel.has(ro[rk.Grade])) return false;
              if (geoSel.s.size) { if (!geoSel.s.has(ro[rk.SchoolName])) return false; }
              else if (geoSel.m.size) { if (!geoSel.m.has(ro[rk.Mandal])) return false; }
              else if (geoSel.d.size) { if (!geoSel.d.has(ro[rk.District])) return false; }
              return true;
            }
            // Onboarded sets for subject (ever)
            const onboardedTarget = new Set<string>(); const onboardedNonTarget = new Set<string>();
            raw.facts.forEach(fr => { const ro = rosterById.get(fr[fk.StudentID]); if (!passRosterBase(ro)) return; const s = normSubj(fr[fk.Subject]||''); if (s!==subj) return; const isT = ro[rk.TargetFlag]==='1'; if (isT) onboardedTarget.add(fr[fk.StudentID]); else onboardedNonTarget.add(fr[fk.StudentID]); });
            // Group
            const groups = new Map<string, { to: Set<string>; tn: Set<string>; nt: Set<string> }>();
            function ensure(k: string){ if (!groups.has(k)) groups.set(k,{ to:new Set(), tn:new Set(), nt:new Set() }); return groups.get(k)!; }
            const level = onbDrill.level;
            function keyOf(ro: any){ if (level==='District') return ro[rk.District]; if (level==='Mandal') return ro[rk.Mandal]; return ro[rk.SchoolName]; }
            // constrain by breadcrumb path
            raw.roster.forEach(ro => {
              if (!passRosterBase(ro)) return;
              if (onbDrill.district && ro[rk.District] !== onbDrill.district) return;
              if (onbDrill.mandal && ro[rk.Mandal] !== onbDrill.mandal) return;
              const k = keyOf(ro); const g = ensure(k); const sid = ro[rk.StudentID];
              const isT = ro[rk.TargetFlag] === '1';
              if (isT) { if (onboardedTarget.has(sid)) g.to.add(sid); else g.tn.add(sid); }
              else { if (onboardedNonTarget.has(sid)) g.nt.add(sid); }
            });
            type Row = { id: string; name: string; Target: number; TO: number; TN: number; NT: number; pctTO: number };
            let rows: Row[] = [];
            groups.forEach((g,name)=>{ const to=g.to.size, tn=g.tn.size, nt=g.nt.size; const target = to+tn; const denom = target; const pct = denom>0? Math.round((to/denom)*100):0; rows.push({ id:name, name, Target: target, TO:to, TN:tn, NT:nt, pctTO:pct }); });
            // sorting state comes from component-level onbSort
            const sortKey = onbSort.key; const sortDir = onbSort.dir;
            function sortRows(k: string){
              setOnbSort(prev => {
                if (!prev || prev.key !== k) return { key: k, dir: 'desc' } as const;
                return { key: k, dir: prev.dir === 'desc' ? 'asc' : 'desc' } as const;
              });
            }
            rows.sort((a,b)=>{ const va:any=(a as any)[sortKey], vb:any=(b as any)[sortKey]; const cmp = (typeof va==='number' && typeof vb==='number') ? (va-vb) : String(va).localeCompare(String(vb)); return sortDir==='desc' ? -cmp : cmp; });
            function into(levelNext: 'Mandal'|'School', value: string){ if (!onbDrill) return; if (levelNext==='Mandal') setOnbDrill({ subject: onbDrill.subject, level: 'Mandal', district: value }); else setOnbDrill({ subject: onbDrill.subject, level: 'School', district: onbDrill.district, mandal: value }); }
            const cols = (() => {
              const sc = state.filters.scope;
              if (sc === 'Target') return ['Target','TO','TN','pctTO'];
              if (sc === 'Non-Target') return ['NT'];
              return ['Target','TO','TN','NT','pctTO'];
            })();
            function to(levelTo: 'District'|'Mandal'|'School'){ if (!onbDrill) return; if (levelTo==='District') setOnbDrill({ subject: onbDrill.subject, level: 'District' }); else if (levelTo==='Mandal') setOnbDrill({ subject: onbDrill.subject, level: 'Mandal', district: onbDrill.district }); else setOnbDrill({ subject: onbDrill.subject, level: 'School', district: onbDrill.district, mandal: onbDrill.mandal }); }
            return (
              <>
                <div className="hstack" style={{ justifyContent:'space-between', marginBottom:8 }}>
                  <div className="breadcrumb">
                    <a href="#" onClick={(e)=>{e.preventDefault(); to('District');}}>Districts</a>
                    {onbDrill.district && (<><span> {' > '} </span><a href="#" onClick={(e)=>{e.preventDefault(); to('Mandal');}}>{onbDrill.district}</a></>)}
                    {onbDrill.mandal && (<><span> {' > '} </span>{onbDrill.mandal}</>)}
                    <span> {' · '} </span><span>{subj}</span>
                  </div>
                  <button className="clear" onClick={()=>setOnbDrill(null)}>Close</button>
                </div>
                <table className="compact">
                  <thead>
                    <tr>
                      <th onClick={()=>sortRows('name')} style={{ cursor:'pointer' }}>{onbDrill.level}{sortKey==='name'?(sortDir==='desc'?' ▼':' ▲'):''}</th>
                      {cols.map(k=> (
                        <th key={k} onClick={()=>sortRows(k)} style={{ cursor:'pointer' }}>{k}{sortKey===k?(sortDir==='desc'?' ▼':' ▲'):''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} style={{ cursor: onbDrill.level!=='School'?'pointer':'default' }} onClick={()=>{ if(onbDrill.level==='District') into('Mandal', r.name); else if (onbDrill.level==='Mandal') into('School', r.name); }}>
                        <td>{r.name}</td>
                        {cols.map(k => (
                          <td key={k+':'+r.id}>{k==='pctTO' ? `${(r as any)[k]}%` : ((r as any)[k] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function formatNumber(n: number) {
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="hstack" style={{ gap: 6 }}>
      <span style={{ width: 10, height: 10, background: color, display: 'inline-block', borderRadius: 2 }} />
      {label}
    </span>
  );
}

function Donut({ size, thickness, total, segments, onSegmentClick, centerLabel, modePercent, showLabels, showLegendValues }:
  { size: number; thickness: number; total: number; segments: Array<{ key: string; label: string; value: number; color: string }>; onSegmentClick?: (label: string) => void; centerLabel?: string; modePercent?: boolean; showLabels?: boolean; showLegendValues?: boolean }) {
  const r = (size - thickness) / 2;
  const cx = size / 2; const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const t = Math.max(0, total);
  let acc = 0;
  return (
    <div style={{ display: 'inline-block' }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' as any }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0b1320" strokeWidth={thickness} />
      {segments.map((s) => {
        const frac = t > 0 ? s.value / t : 0;
        const len = frac * circumference;
        const dasharray = `${len} ${circumference - len}`;
        const el = (
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={dasharray}
            strokeDashoffset={-acc}
            style={{ cursor: 'default' }}
          />
        );
        acc += len;
        return el;
      })}
      {/* External data labels with leader lines (high-contrast text) - gated */}
      {showLabels && (() => {
        if (t === 0) return null as any;
        let accFrac = 0;
        return segments.map((s, idx) => {
          const frac = s.value / t;
          if (frac <= 0) return null;
          const mid = accFrac + frac / 2;
          accFrac += frac;
          const angle = -Math.PI / 2 + mid * 2 * Math.PI;
          const sx = cx + (r + 2) * Math.cos(angle);
          const sy = cy + (r + 2) * Math.sin(angle);
          // Place label just outside the ring but within the SVG bounds
          const labelRadius = r + thickness + 8;
          const ex = cx + labelRadius * Math.cos(angle);
          const ey = cy + labelRadius * Math.sin(angle);
          // Horizontal extension for label placement
          const right = Math.cos(angle) >= 0;
          const lx = ex + (right ? 14 : -14);
          const ly = ey;
          const align = right ? 'start' : 'end';
          const label = modePercent ? `${Math.round(frac * 100)}%` : formatNumber(s.value as any as number);
          return (
            <g key={`lbl_${idx}`}>
              <polyline points={`${sx},${sy} ${ex},${ey} ${lx},${ly}`} fill="none" stroke={s.color} strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                fill="var(--text)"
                fontSize="12"
                fontWeight={700}
                textAnchor={align as any}
                alignmentBaseline="middle"
                style={{ paintOrder: 'stroke' as any, stroke: '#0b1320', strokeWidth: 2 }}
              >
                {label}
              </text>
            </g>
          );
        });
      })()}
      {(() => {
        const greenSeg = segments.find(s => (s as any).key === 'green');
        const greySeg = segments.find(s => (s as any).key === 'grey');
        const greenVal = Number(greenSeg?.value || 0);
        const targetTotal = greenVal + Number(greySeg?.value || 0);
        const pct = targetTotal > 0 ? Math.round((greenVal / targetTotal) * 100) : 0;
        const centerText = modePercent ? `${pct}%` : formatNumber(greenVal);
        return (
          <text
            x={cx}
            y={cy + 4}
            fill="var(--text)"
            fontSize="16"
            fontWeight={700}
            textAnchor="middle"
            style={{ paintOrder: 'stroke' as any, stroke: 'var(--center-outline)', strokeWidth: 1, letterSpacing: 0.1, fontVariantNumeric: 'tabular-nums' as any }}
          >
            {centerText}
          </text>
        );
      })()}
    </svg>
    {showLegendValues !== false && (() => {
      const greenVal = Number((segments.find(s => (s as any).key === 'green')?.value) || 0);
      const greyVal = Number((segments.find(s => (s as any).key === 'grey')?.value) || 0);
      const blueVal = Number((segments.find(s => (s as any).key === 'blue')?.value) || 0);
      return (
        <div className="hstack legend-values">
          <span className="hstack" style={{ gap: 6 }}>
            <span className="label">Total:</span>
            <span className="value num">{formatNumber(t)}</span>
          </span>
          <span className="hstack" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, background: 'var(--green)', display: 'inline-block', borderRadius: 2 }} />
            <span className="label">TO:</span> <span className="value num">{formatNumber(greenVal)}</span>
          </span>
          <span className="hstack" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, background: '#2c3a4d', display: 'inline-block', borderRadius: 2 }} />
            <span className="label">TN:</span> <span className="value num">{formatNumber(greyVal)}</span>
          </span>
          <span className="hstack" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, background: 'var(--blue)', display: 'inline-block', borderRadius: 2 }} />
            <span className="label">NT:</span> <span className="value num">{formatNumber(blueVal)}</span>
          </span>
        </div>
      );
    })()}
    </div>
  );
}

function formatLegendValue(prefix: string, value: number, total: number, percent: boolean) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const val = `${formatNumber(value)} / ${formatNumber(total)}`;
  return percent ? `${prefix}: ${val} (${pct}%)` : `${prefix}: ${val}`;
}
