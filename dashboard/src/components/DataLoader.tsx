import React, { useRef, useState } from 'react';
import { parseCSV } from '../lib/csv';
import { useStore } from '../state';

export function DataLoader() {
  const rosterRef = useRef<HTMLInputElement>(null);
  const factsRef = useRef<HTMLInputElement>(null);
  const { dispatch } = useStore();
  const [status, setStatus] = useState<string>('');

  async function onLoad() {
    const rosterFile = rosterRef.current?.files?.[0];
    const factsFile = factsRef.current?.files?.[0];
    if (!rosterFile || !factsFile) { setStatus('Please select both files'); return; }
    setStatus('Parsing CSVs…');
    const [rosterText, factsText] = await Promise.all([rosterFile.text(), factsFile.text()]);
    const roster = parseCSV(rosterText);
    const facts = parseCSV(factsText);
    setStatus('Computing metrics…');
    const payload = computeFrom(roster, facts);
    dispatch({ type: 'hydrate', payload: { ...payload, raw: payload.raw } as any });
    setStatus(`Loaded: ${payload.counts.students} students, ${payload.counts.schools} schools, ${payload.counts.facts} fact rows`);
  }

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Load Data (CSV)</div>
      <div className="hstack">
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Student Roster CSV</div>
          <input type="file" accept=".csv" ref={rosterRef} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Engagement Facts CSV</div>
          <input type="file" accept=".csv" ref={factsRef} />
        </div>
        <button className="pill" onClick={onLoad}>Load</button>
        <div style={{ color: 'var(--muted)' }}>{status}</div>
      </div>
    </div>
  );
}

function computeFrom(roster: ReturnType<typeof parseCSV>, facts: ReturnType<typeof parseCSV>) {
  // Map roster by StudentID
  const sid = normalizeKey(roster.headers, 'StudentID');
  const schoolId = normalizeKey(roster.headers, 'SchoolID');
  const schoolName = normalizeKey(roster.headers, 'SchoolName');
  const mandal = normalizeKey(roster.headers, 'Mandal');
  const district = normalizeKey(roster.headers, 'District');
  const targetFlag = normalizeKey(roster.headers, 'TargetFlag');
  const rosterById = new Map<string, any>();
  roster.rows.forEach((r) => { if (r[sid]) rosterById.set(r[sid], r); });

  // Facts basics
  const fDate = normalizeKey(facts.headers, 'Date');
  const fSid = normalizeKey(facts.headers, 'StudentID');
  const fSessions = normalizeKey(facts.headers, 'Sessions');
  const fTime = normalizeKey(facts.headers, 'TimeMinutes');
  const fDiag = normalizeKey(facts.headers, 'DiagnosticsCompleted');
  const fStart = normalizeKey(facts.headers, 'StartMilestone');
  const fCurr = normalizeKey(facts.headers, 'CurrentMilestone');

  const parseDate = (s: string) => new Date(s + 'T00:00:00Z');
  let maxDate = new Date(0);
  facts.rows.forEach(r => { const d = parseDate(r[fDate]); if (!isNaN(d as any) && d > maxDate) maxDate = d; });
  const last7Start = new Date(maxDate); last7Start.setUTCDate(maxDate.getUTCDate() - 6);

  // Aggregations
  const activeStudents = new Set<string>();
  const activeStudentsTarget = new Set<string>();
  const activeStudentsNonTarget = new Set<string>();
  const activeSchools = new Set<string>();
  const activeSchoolsTarget = new Set<string>();
  const activeSchoolsNonTarget = new Set<string>();

  let totalSessions7 = 0; let totalTime7 = 0; let totalDiagnostics = 0;
  const deltaByStudent7 = new Map<string, number>();

  const byDistrict = new Map<string, any>();

  function ensureDistrict(d: string) {
    if (!byDistrict.has(d)) byDistrict.set(d, { activeSchools: new Set<string>(), activeStudents: new Set<string>(), sessions: 0, time: 0, improved: 0, studentsImprovement: new Map<string, number>() });
    return byDistrict.get(d);
  }

  facts.rows.forEach((r) => {
    const d = parseDate(r[fDate]);
    const sidVal = r[fSid];
    if (!sidVal) return;
    const rosterRow = rosterById.get(sidVal);
    const isTarget = rosterRow?.[targetFlag] === '1';
    const isInLast7 = d >= last7Start && d <= maxDate;
    const sessions = Number(r[fSessions] || 0) || 0;
    const time = Number(r[fTime] || 0) || 0;
    const diag = Number(r[fDiag] || 0) || 0;
    const startM = Number(r[fStart] || 0) || 0;
    const currM = Number(r[fCurr] || 0) || 0;

    totalDiagnostics += diag;

    if (isInLast7) {
      if (sessions > 0 || time > 0) {
        activeStudents.add(sidVal);
        const sch = rosterRow?.[schoolId];
        if (sch) {
          activeSchools.add(sch);
          if (isTarget) activeSchoolsTarget.add(sch); else activeSchoolsNonTarget.add(sch);
        }
        if (isTarget) activeStudentsTarget.add(sidVal); else activeStudentsNonTarget.add(sidVal);
      }
      totalSessions7 += sessions;
      totalTime7 += time;
      const dist = rosterRow?.[district] || 'Unknown';
      const dAgg = ensureDistrict(dist);
      dAgg.activeSchools.add(rosterRow?.[schoolId]);
      dAgg.activeStudents.add(sidVal);
      dAgg.sessions += sessions;
      dAgg.time += time;
      const delta = currM - startM;
      if (delta !== 0) {
        dAgg.studentsImprovement.set(sidVal, (dAgg.studentsImprovement.get(sidVal) || 0) + delta);
        deltaByStudent7.set(sidVal, (deltaByStudent7.get(sidVal) || 0) + delta);
      }
    }
  });

  // District table rows
  const districtRows = Array.from(byDistrict.entries()).map(([name, agg]) => {
    const improvedCount = Array.from(agg.studentsImprovement.values()).filter((d: number) => d > 0).length;
    const activeStudentsCount = agg.activeStudents.size || 1; // avoid div by zero
    // Totals and active target breakdowns per district
    const totalTargetStudentsInDistrict = roster.rows.filter(r => r[targetFlag] === '1' && r[district] === name).length;
    const totalTargetSchoolsInDistrict = new Set(roster.rows.filter(r => r[targetFlag] === '1' && r[district] === name).map(r => r[schoolId])).size;
    const activeTargetStudentsInDistrict = [...activeStudentsTarget].filter(sidv => (rosterById.get(sidv)?.[district]) === name).length;
    // Compute unique active target schools in this district
    const activeTargetSchoolsSet = new Set<string>();
    activeStudentsTarget.forEach(sidv => {
      const ro = rosterById.get(sidv);
      if (!ro) return;
      if (ro[district] !== name) return;
      const sch = ro[schoolId]; if (sch) activeTargetSchoolsSet.add(sch);
    });
    return {
      id: name,
      name,
      targetSchools: totalTargetSchoolsInDistrict,
      activeSchools: agg.activeSchools.size,
      activeTargetSchools: activeTargetSchoolsSet.size,
      targetStudents: totalTargetStudentsInDistrict,
      activeStudents: agg.activeStudents.size,
      activeTargetStudents: activeTargetStudentsInDistrict,
      sessionsPerStudent: round2(agg.sessions / activeStudentsCount),
      avgTime: Math.round(agg.time / activeStudentsCount),
      improvementPct: Math.round((improvedCount / activeStudentsCount) * 100),
    } as any;
  });

  // KPIs
  const totalTargetStudents = roster.rows.filter((r) => r[targetFlag] === '1').length;
  const sps = totalSessions7 / Math.max(activeStudents.size, 1);
  // Previous 7-day window WoW
  const prevEnd = new Date(last7Start); prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setUTCDate(prevStart.getUTCDate() - 6);
  const inPrev = (d: Date) => d >= prevStart && d <= prevEnd;
  let prevSess = 0, prevTime = 0;
  const prevStudents = new Set<string>();
  const prevSchools = new Set<string>();
  const deltaPrev = new Map<string, number>();
  facts.rows.forEach(r => {
    const d = parseDate(r[fDate]);
    if (!inPrev(d)) return;
    const sidv = r[fSid];
    const ro = rosterById.get(sidv);
    if (!ro) return;
    const s = Number(r[fSessions] || 0) || 0; const t = Number(r[fTime] || 0) || 0;
    if (s > 0 || t > 0) {
      prevStudents.add(sidv);
      const sch = ro[schoolId]; if (sch) prevSchools.add(sch);
    }
    prevSess += s; prevTime += t;
    const delta = (Number(r[fCurr] || 0) || 0) - (Number(r[fStart] || 0) || 0);
    deltaPrev.set(sidv, (deltaPrev.get(sidv) || 0) + delta);
  });
  function wow(curr: number, prev: number) {
    const diff = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;
    const val = `${Math.round(diff)}%`;
    return { dir: diff >= 0 ? 'up' as const : 'down' as const, value: val };
  }
  const progressedTarget = [...deltaByStudent7.entries()].filter(([sid, d]) => d > 0 && activeStudents.has(sid) && (rosterById.get(sid)?.[targetFlag] === '1')).length;
  const progressedNonTarget = [...deltaByStudent7.entries()].filter(([sid, d]) => d > 0 && activeStudents.has(sid) && (rosterById.get(sid)?.[targetFlag] !== '1')).length;
  const progressedTotal = progressedTarget + progressedNonTarget;
  const totalTargetSchoolsAll = new Set(roster.rows.filter(r => r[targetFlag] === '1').map(r => r[schoolId])).size;
  const kpis = [
    { title: 'Active Students', big: formatK(activeStudents.size), reference: `of ${formatK(totalTargetStudents)} target (${pct(activeStudents.size, totalTargetStudents)})`, wow: wow(activeStudents.size, prevStudents.size), gauge: { green: activeStudentsTarget.size, blue: activeStudentsNonTarget.size, grey: Math.max(0, totalTargetStudents - activeStudentsTarget.size) } },
    { title: 'Active Schools', big: String(activeSchools.size), reference: `of ${String(totalTargetSchoolsAll)} target (${pctNum(activeSchoolsTarget.size, Math.max(1, totalTargetSchoolsAll))}%)`, wow: wow(activeSchools.size, prevSchools.size), gauge: { green: activeSchoolsTarget.size, blue: activeSchoolsNonTarget.size, grey: Math.max(0, totalTargetSchoolsAll - activeSchoolsTarget.size) } },
    { title: 'Students Progressed', big: formatK(progressedTotal), reference: `of ${formatK(totalTargetStudents)} target (${pct(progressedTarget, totalTargetStudents)})`, wow: wow(progressedTotal, [...deltaPrev.values()].filter(d => d > 0).length), gauge: { green: progressedTarget, blue: progressedNonTarget, grey: Math.max(0, totalTargetStudents - progressedTarget) } },
    { title: 'Sessions per Student (7d)', big: round2(sps).toString(), reference: `of 2 days goal (${Math.min(100, Math.round((sps / 2) * 100))}%)`, wow: wow(sps, prevSess / Math.max(prevStudents.size, 1)), gauge: { pct: Math.min(100, Math.round((sps / 2) * 100)) } },
    { title: 'Avg Time Spent per student (7d)', big: `${Math.round(totalTime7 / Math.max(activeStudents.size, 1))} mins`, reference: `of 200 mins goal (${Math.min(100, Math.round(((totalTime7 / Math.max(activeStudents.size, 1)) / 200) * 100))}%)`, wow: wow(totalTime7 / Math.max(activeStudents.size, 1), prevTime / Math.max(prevStudents.size, 1)), gauge: { pct: Math.min(100, Math.round(((totalTime7 / Math.max(activeStudents.size, 1)) / 200) * 100)) } },
  ];

  // Coverage (Students)
  // Onboarding (ever used once) vs Active (this period)
  const onboardedTargetStudents = new Set<string>();
  const onboardedNonTargetStudents = new Set<string>();
  const onboardedTargetSchools = new Set<string>();
  const onboardedNonTargetSchools = new Set<string>();
  const onboardedTargetMandals = new Set<string>();
  const onboardedNonTargetMandals = new Set<string>();
  const onboardedTargetDistricts = new Set<string>();
  const onboardedNonTargetDistricts = new Set<string>();
  facts.rows.forEach(r => {
    const ro = rosterById.get(r[fSid]); if (!ro) return;
    const isTarget = ro[targetFlag] === '1';
    const sch = ro[schoolId]; const man = ro[mandal]; const dis = ro[district];
    if (isTarget) {
      onboardedTargetStudents.add(r[fSid]); if (sch) onboardedTargetSchools.add(sch); if (man) onboardedTargetMandals.add(man); if (dis) onboardedTargetDistricts.add(dis);
    } else {
      onboardedNonTargetStudents.add(r[fSid]); if (sch) onboardedNonTargetSchools.add(sch); if (man) onboardedNonTargetMandals.add(man); if (dis) onboardedNonTargetDistricts.add(dis);
    }
  });
  // Non-target totals (active + inactive) by entity based on roster
  const nonTargetStudentsTotal = new Set(roster.rows.filter(r => r[targetFlag] !== '1').map(r => r[sid])).size;
  const nonTargetSchoolsTotal = new Set(roster.rows.filter(r => r[targetFlag] !== '1').map(r => r[schoolId])).size;
  const nonTargetMandalsTotal = new Set(roster.rows.filter(r => r[targetFlag] !== '1').map(r => r[mandal])).size;
  const nonTargetDistrictsTotal = new Set(roster.rows.filter(r => r[targetFlag] !== '1').map(r => r[district])).size;

  // Target totals by entity based on roster
  const totalTargetStudentsScope = roster.rows.filter(r => r[targetFlag] === '1').length;
  const totalTargetSchoolsScope = new Set(roster.rows.filter(r => r[targetFlag] === '1').map(r => r[schoolId])).size;
  const totalTargetMandalsScope = new Set(roster.rows.filter(r => r[targetFlag] === '1').map(r => r[mandal])).size;
  const totalTargetDistrictsScope = new Set(roster.rows.filter(r => r[targetFlag] === '1').map(r => r[district])).size;

  const coverage = {
    Students: { green: activeStudentsTarget.size, amber: Math.max(0, onboardedTargetStudents.size - activeStudentsTarget.size), grey: Math.max(0, totalTargetStudentsScope - onboardedTargetStudents.size), blue: nonTargetStudentsTotal },
    Schools: { green: activeSchoolsTarget.size, amber: Math.max(0, onboardedTargetSchools.size - activeSchoolsTarget.size), grey: Math.max(0, totalTargetSchoolsScope - onboardedTargetSchools.size), blue: nonTargetSchoolsTotal },
    Mandals: { green: new Set([...activeStudentsTarget].map(sid => rosterById.get(sid)?.[mandal]).filter(Boolean) as string[]).size, amber: Math.max(0, onboardedTargetMandals.size - new Set([...activeStudentsTarget].map(sid => rosterById.get(sid)?.[mandal]).filter(Boolean) as string[]).size), grey: Math.max(0, totalTargetMandalsScope - onboardedTargetMandals.size), blue: nonTargetMandalsTotal },
    Districts: { green: new Set([...activeStudentsTarget].map(sid => rosterById.get(sid)?.[district]).filter(Boolean) as string[]).size, amber: Math.max(0, onboardedTargetDistricts.size - new Set([...activeStudentsTarget].map(sid => rosterById.get(sid)?.[district]).filter(Boolean) as string[]).size), grey: Math.max(0, totalTargetDistrictsScope - onboardedTargetDistricts.size), blue: nonTargetDistrictsTotal },
  };

  // Trend cards (simple 5-day series ending at maxDate)
  const dayKey = (d: Date) => d.toISOString().slice(0,10);
  const sessionsByDay = new Map<string, number>();
  const timeByDay = new Map<string, number>();
  facts.rows.forEach(r => {
    const d = dayKey(parseDate(r[fDate]));
    sessionsByDay.set(d, (sessionsByDay.get(d) || 0) + (Number(r[fSessions] || 0) || 0));
    timeByDay.set(d, (timeByDay.get(d) || 0) + (Number(r[fTime] || 0) || 0));
  });
  const pointsSessions: number[] = [];
  const pointsTime: number[] = [];
  for (let offset = 4; offset >= 0; offset--) {
    const d = new Date(maxDate); d.setUTCDate(maxDate.getUTCDate() - offset);
    const key = dayKey(d);
    pointsSessions.push((sessionsByDay.get(key) || 0) / Math.max(activeStudents.size, 1));
    pointsTime.push((timeByDay.get(key) || 0) / Math.max(activeStudents.size, 1));
  }
  const trendCards = [
    { title: 'Active Students', value: String(activeStudents.size), wow: '+0%', points: [0, 0, 0, 0, activeStudents.size] },
    { title: 'Active Schools', value: String(activeSchools.size), wow: '+0%', points: [0, 0, 0, 0, activeSchools.size] },
    { title: 'Students Progressed', value: String(progressedTotal), wow: '+0%', points: [0, 0, 0, 0, progressedTotal] },
    { title: 'Sessions per Student', value: round2(pointsSessions[pointsSessions.length - 1]).toString(), wow: diffPct(pointsSessions), points: pointsSessions.map(n => round2(n)) },
    { title: 'Avg Time Spent per student (7d)', value: `${Math.round(pointsTime[pointsTime.length - 1])} mins`, wow: diffPct(pointsTime), points: pointsTime.map(n => Math.round(n)) },
    { title: 'Diagnostics Completed', value: String(totalDiagnostics), wow: '+0%', points: [0, 0, 0, 0, totalDiagnostics] },
  ];

  // Funnel (approx using totals across facts)
  const totalStudents = roster.rows.length;
  const completedDiagnostics = new Set<string>();
  const practiced200 = new Map<string, number>();
  const improvedMilestone = new Set<string>();
  const completedAllLevels = new Set<string>();
  const deltas = new Map<string, number>();
  const timeAll = new Map<string, number>();
  facts.rows.forEach(r => {
    const sidv = r[fSid];
    const diag = Number(r[fDiag] || 0) || 0; if (diag > 0) completedDiagnostics.add(sidv);
    const startM = Number(r[fStart] || 0) || 0; const currM = Number(r[fCurr] || 0) || 0; const delta = currM - startM; if (delta > 0) improvedMilestone.add(sidv);
    deltas.set(sidv, (deltas.get(sidv) || 0) + delta);
    timeAll.set(sidv, (timeAll.get(sidv) || 0) + (Number(r[fTime] || 0) || 0));
  });
  timeAll.forEach((v, k) => { if (v >= 200) practiced200.set(k, v); });
  deltas.forEach((v, k) => { if (v >= 10) completedAllLevels.add(k); }); // arbitrary demo threshold

  const funnel = [
    { stage: 'Total Students', value: totalStudents, pct: 100 },
    { stage: 'Active Students', value: activeStudents.size, pct: pctNum(activeStudents.size, Math.max(totalStudents, 1)) },
    { stage: 'Completed Diagnostics', value: completedDiagnostics.size, pct: pctNum(completedDiagnostics.size, totalStudents) },
    { stage: 'Practicing >200 mins', value: practiced200.size, pct: pctNum(practiced200.size, totalStudents) },
    { stage: 'Improved Milestone', value: improvedMilestone.size, pct: pctNum(improvedMilestone.size, totalStudents) },
    { stage: 'Completed All Levels', value: completedAllLevels.size, pct: pctNum(completedAllLevels.size, totalStudents) },
  ];

  // Filters/options
  const districts = Array.from(new Set(roster.rows.map(r => r[district]).filter(Boolean)));
  const mandalsByDistrict: Record<string, string[]> = {};
  const schoolsByMandal: Record<string, string[]> = {};
  roster.rows.forEach(r => {
    const d = r[district]; const m = r[mandal]; const s = r[schoolName];
    if (!mandalsByDistrict[d]) mandalsByDistrict[d] = [];
    if (m && !mandalsByDistrict[d].includes(m)) mandalsByDistrict[d].push(m);
    if (!schoolsByMandal[m]) schoolsByMandal[m] = [];
    if (s && !schoolsByMandal[m].includes(s)) schoolsByMandal[m].push(s);
  });

  // derive subjects and grades (classes)
  const subjectsSet = new Set<string>();
  facts.rows.forEach(r => { const s = subjectNorm(r['Subject'] || ''); if (s) subjectsSet.add(s); });
  const classesSet = new Set<string>();
  roster.rows.forEach(r => { const g = (r['Grade'] || '').trim(); if (g) classesSet.add(g); });

  return {
    counts: { students: totalStudents, schools: new Set(roster.rows.map(r => r[schoolId])).size, facts: facts.rows.length },
    kpis,
    coverage,
    trendCards,
    funnel,
    table: districtRows,
    options: { districts, mandalsByDistrict, schoolsByMandal, subjects: Array.from(subjectsSet), classes: Array.from(classesSet) },
    raw: {
      roster: roster.rows,
      facts: facts.rows,
      keys: {
        roster: { StudentID: sid, SchoolID: schoolId, SchoolName: schoolName, Mandal: mandal, District: district, Grade: 'Grade', TargetFlag: targetFlag },
        facts: { Date: fDate, StudentID: fSid, Subject: 'Subject', Sessions: fSessions, TimeMinutes: fTime, DiagnosticsCompleted: fDiag, StartMilestone: fStart, CurrentMilestone: fCurr },
      },
    },
  };
}

function normalizeKey(headers: string[], wanted: string) {
  const idx = headers.findIndex(h => h.toLowerCase() === wanted.toLowerCase());
  return headers[idx] ?? wanted;
}

function formatK(n: number) { return n >= 1000 ? Math.round(n/1000) + 'K' : String(n); }
function pct(a: number, b: number) { if (b === 0) return '0%'; return Math.round((a/b)*100) + '%'; }
function pctNum(a: number, b: number) { if (b === 0) return 0; return Math.round((a/b)*100); }
function round2(n: number) { return Math.round(n*100)/100; }
function diffPct(points: number[]) { if (points.length < 2) return '+0%'; const a = points[points.length-2]; const b = points[points.length-1]; const d = a===0?0:((b-a)/Math.abs(a))*100; const s = d>=0?'+':''; return s + Math.round(d) + '%'; }

function subjectNorm(s: string) {
  const t = s.trim().toLowerCase();
  if (t.startsWith('math')) return 'Math';
  if (t.startsWith('eng')) return 'English';
  if (t.startsWith('tel')) return 'Telugu';
  return s || '';
}



