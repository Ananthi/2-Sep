import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { Filters, DrillPath, EntityRow, KPI } from './types';
import type { CSVRow } from './lib/csv';

type State = {
  filters: Filters;
  drill: DrillPath;
  kpis: KPI[];
  coverage: Record<'Students' | 'Schools' | 'Mandals' | 'Districts', { green: number; amber: number; blue: number; grey: number }>;
  coverageScope: 'Students' | 'Schools' | 'Mandals' | 'Districts';
  coverageMode: 'Absolute' | 'Percent';
  trendCards: Array<{ title: string; value: string; wow: string; points: number[] }>;
  kpiMode?: 'Absolute' | 'Percent';
  funnel: Array<{ stage: string; value: number; pct: number }>;
  table: EntityRow[];
  kpiDrill?: { metric: string; level: 'District'|'Mandal'|'School'|'Student'; district?: string; mandal?: string; school?: string } | null;
  raw?: {
    roster: CSVRow[];
    facts: CSVRow[];
    keys: {
      roster: { StudentID: string; SchoolID: string; SchoolName: string; Mandal: string; District: string; Grade: string; TargetFlag: string };
      facts: { Date: string; StudentID: string; Subject: string; Sessions: string; TimeMinutes: string; DiagnosticsCompleted: string; StartMilestone: string; CurrentMilestone: string };
    };
  };
  options: {
    districts: string[];
    mandalsByDistrict: Record<string, string[]>;
    schoolsByMandal: Record<string, string[]>;
    subjects: string[];
    classes: string[];
  };
  sort?: { key: keyof EntityRow; dir: 'asc' | 'desc' };
};

type Action =
  | { type: 'setQuick'; quick?: State['filters']['quick'] }
  | { type: 'setRange'; from?: string; to?: string }
  | { type: 'setScope'; scope: State['filters']['scope'] }
  | { type: 'setArray'; key: keyof Pick<Filters, 'districts' | 'mandals' | 'schools' | 'subjects' | 'classes' | 'improvement'>; value: string[] }
  | { type: 'clearAll' }
  | { type: 'setCoverageScope'; scope: State['coverageScope'] }
  | { type: 'setCoverageMode'; mode: State['coverageMode'] }
  | { type: 'setKpiMode'; mode: NonNullable<State['kpiMode']> }
  | { type: 'openKpiDrill'; metric: string }
  | { type: 'closeKpiDrill' }
  | { type: 'kpiDrillInto'; level: 'Mandal'|'School'|'Student'; value: string }
  | { type: 'kpiDrillTo'; level: 'District'|'Mandal'|'School' } 
  | { type: 'breadcrumbTo'; level: DrillPath['level'] }
  | { type: 'drillInto'; level: DrillPath['level']; value: string }
  | { type: 'sortBy'; key: keyof EntityRow }
  | { type: 'removeChip'; chip: string }
  | { type: 'hydrate'; payload: { counts: any; kpis: KPI[]; coverage: State['coverage']; trendCards: State['trendCards']; funnel: State['funnel']; table: EntityRow[]; options: Partial<State['options']>; raw: NonNullable<State['raw']> } };

function initialState(): State {
  // Mock options
  const districts = ['Warangal', 'Hyderabad', 'Nizamabad'];
  const mandalsByDistrict = {
    Warangal: ['Mandal A', 'Mandal B'],
    Hyderabad: ['Mandal C', 'Mandal D'],
    Nizamabad: ['Mandal E'],
  } as Record<string, string[]>;
  const schoolsByMandal = {
    'Mandal A': ['School X', 'School Y'],
    'Mandal B': ['School Z'],
    'Mandal C': ['School H1'],
    'Mandal D': ['School H2'],
    'Mandal E': ['School N1'],
  } as Record<string, string[]>;
  const subjects = ['Telugu', 'English', 'Math'];
  const classes = ['3', '4', '5'];

  const kpis: KPI[] = [
    { title: 'Active Students', big: '27K', reference: 'of 37K target (73%)', wow: { dir: 'up', value: '+5%' }, gauge: { green: 22, blue: 5, grey: 10 } },
    { title: 'Active Schools', big: '923', reference: 'of 1740 target (53%)', wow: { dir: 'down', value: '-2%' }, gauge: { green: 800, blue: 123, grey: 817 } },
    { title: 'Students Progressed', big: '6.7K', reference: 'of 37K target (18%)', wow: { dir: 'up', value: '+2%' }, gauge: { green: 5, blue: 1.7, grey: 32 } },
    { title: 'Sessions per Student (7d)', big: '0.52', reference: 'of 2 days goal (26%)', wow: { dir: 'up', value: '+3%' }, gauge: { pct: 26 } },
    { title: 'Avg Time Spent per student (7d)', big: '41 mins', reference: 'of 200 mins goal (21%)', wow: { dir: 'up', value: '+7%' }, gauge: { pct: 21 } },
  ];

  const coverage = {
    Students: { green: 22, amber: 10, blue: 5, grey: 3 },
    Schools: { green: 800, amber: 817, blue: 123, grey: 100 },
    Mandals: { green: 48, amber: 12, blue: 9, grey: 6 },
    Districts: { green: 12, amber: 6, blue: 3, grey: 2 },
  };

  const trendCards = [
    { title: 'Active Students', value: '27K', wow: '+5%', points: [18000, 20000, 22000, 24000, 27000] },
    { title: 'Active Schools', value: '923', wow: '+1%', points: [700, 760, 820, 880, 923] },
    { title: 'Students Progressed', value: '6.7K', wow: '+2%', points: [4000, 4700, 5200, 6100, 6700] },
    { title: 'Sessions per Student', value: '0.52', wow: '+3%', points: [0.3, 0.35, 0.4, 0.45, 0.52] },
    { title: 'Avg Time Spent per student (7d)', value: '41 mins', wow: '+7%', points: [25, 29, 33, 37, 41] },
    { title: 'Diagnostics Completed', value: '63', wow: '+4%', points: [49, 53, 57, 60, 63] },
  ];

  const funnel = [
    { stage: 'Total Students', value: 37000, pct: 100 },
    { stage: 'Completed Diagnostics', value: 25000, pct: 68 },
    { stage: 'Practicing >200 mins', value: 11000, pct: 30 },
    { stage: 'Improved Milestone', value: 6700, pct: 18 },
    { stage: 'Completed All Levels', value: 2100, pct: 6 },
  ];

  const table: EntityRow[] = [
    { id: 'Warangal', name: 'Warangal', activeSchools: 120, targetSchools: 80, activeStudents: 8200, targetStudents: 5900, sessionsPerStudent: 0.6, avgTime: 45, improvementPct: 22 },
    { id: 'Hyderabad', name: 'Hyderabad', activeSchools: 380, targetSchools: 210, activeStudents: 12100, targetStudents: 7600, sessionsPerStudent: 0.5, avgTime: 39, improvementPct: 17 },
    { id: 'Nizamabad', name: 'Nizamabad', activeSchools: 60, targetSchools: 35, activeStudents: 3200, targetStudents: 2100, sessionsPerStudent: 0.47, avgTime: 34, improvementPct: 14 },
  ];

  return {
    filters: { range: {}, scope: 'Both', districts: [], mandals: [], schools: [], subjects, classes, improvement: [] },
    drill: { level: 'District' },
    kpis,
    coverage,
    coverageScope: 'Districts',
    coverageMode: 'Absolute',
    kpiMode: 'Absolute',
    trendCards,
    funnel,
    table,
    options: { districts, mandalsByDistrict, schoolsByMandal, subjects, classes },
    kpiDrill: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setQuick':
      return withDerived({ ...state, filters: { ...state.filters, quick: action.quick } });
    case 'setRange':
      return withDerived({ ...state, filters: { ...state.filters, range: { from: action.from, to: action.to }, quick: undefined } });
    case 'setScope':
      return withDerived({ ...state, filters: { ...state.filters, scope: action.scope } });
    case 'setArray':
      return withDerived({ ...state, filters: { ...state.filters, [action.key]: action.value as any } });
    case 'clearAll':
      return withDerived({ ...state, filters: { ...state.filters, quick: undefined, range: {}, districts: [], mandals: [], schools: [], subjects: [], classes: [], improvement: [] } });
    case 'setCoverageScope':
      return { ...state, coverageScope: action.scope };
    case 'setCoverageMode':
      return { ...state, coverageMode: action.mode };
    case 'setKpiMode':
      return { ...state, kpiMode: action.mode };
    case 'openKpiDrill':
      return { ...state, kpiDrill: { metric: action.metric, level: 'District' } };
    case 'closeKpiDrill':
      return { ...state, kpiDrill: null };
    case 'kpiDrillInto': {
      if (!state.kpiDrill) return state;
      if (action.level === 'Mandal') return { ...state, kpiDrill: { metric: state.kpiDrill.metric, level: 'Mandal', district: action.value } };
      if (action.level === 'School') return { ...state, kpiDrill: { metric: state.kpiDrill.metric, level: 'School', district: state.kpiDrill.district, mandal: action.value } };
      if (action.level === 'Student') return { ...state, kpiDrill: { metric: state.kpiDrill.metric, level: 'Student', district: state.kpiDrill.district, mandal: state.kpiDrill.mandal, school: action.value } };
      return state;
    }
    case 'kpiDrillTo': {
      if (!state.kpiDrill) return state;
      if (action.level === 'District') return { ...state, kpiDrill: { metric: state.kpiDrill.metric, level: 'District' } };
      if (action.level === 'Mandal') return { ...state, kpiDrill: { metric: state.kpiDrill.metric, level: 'Mandal', district: state.kpiDrill.district } };
      if (action.level === 'School') return { ...state, kpiDrill: { metric: state.kpiDrill.metric, level: 'School', district: state.kpiDrill.district, mandal: state.kpiDrill.mandal } };
      return state;
    }
    case 'breadcrumbTo': {
      const next = { ...state } as State;
      if (action.level === 'District') next.drill = { level: 'District' };
      else if (action.level === 'Mandal') next.drill = { level: 'Mandal', district: state.drill.district };
      else if (action.level === 'School') next.drill = { level: 'School', district: state.drill.district, mandal: state.drill.mandal };
      return withDerived(next);
    }
    case 'drillInto': {
      const next = { ...state } as State;
      if (action.level === 'Mandal') next.drill = { level: 'Mandal', district: action.value };
      else if (action.level === 'School') next.drill = { level: 'School', district: state.drill.district, mandal: action.value };
      else if (action.level === 'Student') next.drill = { level: 'Student', district: state.drill.district, mandal: state.drill.mandal, school: action.value };
      return withDerived(next);
    }
    case 'sortBy': {
      const { key } = action;
      const dir = state.sort?.key === key && state.sort?.dir === 'asc' ? 'desc' : 'asc';
      const sorted = [...state.table].sort((a, b) => {
        const av = (a[key] as any) ?? 0;
        const bv = (b[key] as any) ?? 0;
        return dir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
      });
      return { ...state, table: sorted, sort: { key, dir } };
    }
    case 'removeChip': {
      // naive: remove from any matching selection arrays
      const f = { ...state.filters };
      (['districts', 'mandals', 'schools', 'subjects', 'classes'] as const).forEach((k) => {
        f[k] = f[k].filter((x: string) => x !== action.chip);
      });
      if (f.quick === action.chip) f.quick = undefined;
      if (f.improvement?.includes(action.chip as any)) f.improvement = f.improvement?.filter((x) => x !== action.chip as any);
      return withDerived({ ...state, filters: f });
    }
    case 'hydrate': {
      const next = {
        ...state,
        kpis: action.payload.kpis,
        coverage: action.payload.coverage,
        trendCards: action.payload.trendCards,
        funnel: action.payload.funnel,
        table: action.payload.table,
        raw: action.payload.raw,
        options: {
          ...state.options,
          ...action.payload.options,
        },
      } as State;
      return next;
    }
    default:
      return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function Provider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Store not ready');
  return ctx;
}

function genRows(level: 'District' | 'Mandal' | 'School' | 'Student', parent?: string): EntityRow[] {
  function rnd(n: number, variance = 0.25) {
    const delta = n * variance;
    return Math.round(n + (Math.random() * 2 - 1) * delta);
  }
  if (level === 'District') {
    return [
      { id: 'Warangal', name: 'Warangal', activeSchools: rnd(120), targetSchools: rnd(80), activeTargetSchools: rnd(60), activeStudents: rnd(8200), targetStudents: rnd(5900), activeTargetStudents: rnd(4200), sessionsPerStudent: 0.6, avgTime: 45, improvementPct: rnd(22, 0.1) },
      { id: 'Hyderabad', name: 'Hyderabad', activeSchools: rnd(380), targetSchools: rnd(210), activeTargetSchools: rnd(150), activeStudents: rnd(12100), targetStudents: rnd(7600), activeTargetStudents: rnd(5200), sessionsPerStudent: 0.5, avgTime: 39, improvementPct: rnd(17, 0.1) },
      { id: 'Nizamabad', name: 'Nizamabad', activeSchools: rnd(60), targetSchools: rnd(35), activeTargetSchools: rnd(24), activeStudents: rnd(3200), targetStudents: rnd(2100), activeTargetStudents: rnd(1400), sessionsPerStudent: 0.47, avgTime: 34, improvementPct: rnd(14, 0.1) },
    ];
  }
  if (level === 'Mandal') {
    const names = ['Mandal A', 'Mandal B', 'Mandal C', 'Mandal D'].map((m) => `${m}`);
    return names.slice(0, 3).map((m, i) => ({ id: m, name: m, activeSchools: rnd(40 - i * 5), targetSchools: rnd(24 - i * 4), activeTargetSchools: rnd(18 - i * 3), activeStudents: rnd(2500 - i * 400), targetStudents: rnd(1500 - i * 250), activeTargetStudents: rnd(1000 - i * 180), sessionsPerStudent: 0.45 + i * 0.05, avgTime: 35 + i * 3, improvementPct: rnd(12 + i * 3, 0.15) }));
  }
  if (level === 'School') {
    const names = ['School X', 'School Y', 'School Z'].map((s) => `${s}`);
    return names.map((s, i) => ({ id: s, name: s, activeStudents: rnd(300 - i * 30), targetStudents: rnd(180 - i * 24), activeTargetStudents: rnd(120 - i * 16), pctOfTarget: 40 + i * 10, sessionsPerStudent: 0.4 + i * 0.05, avgTime: 30 + i * 5, improvementPct: rnd(10 + i * 2, 0.2) }));
  }
  // Student
  return Array.from({ length: 20 }).map((_, i) => ({ id: `S${i + 1}`, name: `S${i + 1}`, sessions: rnd(6, 0.5), activeStudents: 1, sessionsPerStudent: 0, avgTime: rnd(40, 0.4), improvementPct: rnd(10, 0.5), milestone: 'M2→M3→+1', status: i % 3 === 0 ? 'Non-target' : 'Target' }));
}

// --- Derived computation on filters ---
function withDerived(state: State): State {
  if (!state.raw) return state; // no data loaded yet
  try {
    const derived = computeDerived(state);
    return { ...state, ...derived };
  } catch (e) {
    console.error('computeDerived failed', e);
    return state;
  }
}

function computeDerived(state: State): Pick<State, 'kpis'|'coverage'|'trendCards'|'funnel'|'table'> {
  const { raw, filters, drill } = state;
  const R = raw!;
  const rk = R.keys.roster, fk = R.keys.facts;
  const rosterById = new Map<string, CSVRow>();
  R.roster.forEach(r => { const id = r[rk.StudentID]; if (id) rosterById.set(id, r); });

  // date window
  const dates = R.facts.map(r => r[fk.Date]).filter(Boolean).map(s => new Date(s + 'T00:00:00Z').getTime());
  const maxTs = dates.length ? Math.max(...dates) : Date.now();
  const maxDate = new Date(maxTs);
  let from = new Date(maxDate), to = new Date(maxDate);
  if (filters.quick === 'Yesterday') { from.setUTCDate(maxDate.getUTCDate() - 1); to = new Date(from); }
  else if (filters.quick === 'Last 7 Days' || !filters.quick && !filters.range.from && !filters.range.to) { from.setUTCDate(maxDate.getUTCDate() - 6); }
  else if (filters.quick === 'Last 30 Days') { from.setUTCDate(maxDate.getUTCDate() - 29); }
  if (filters.range.from) from = new Date(filters.range.from + 'T00:00:00Z');
  if (filters.range.to) to = new Date(filters.range.to + 'T00:00:00Z');

  const geoSel = {
    d: new Set(filters.districts),
    m: new Set(filters.mandals),
    s: new Set(filters.schools),
  };
  const subjSel = new Set(filters.subjects.map(s => s.toLowerCase()));
  const classSel = new Set(filters.classes);
  const impSel = new Set((filters.improvement ?? []) as string[]);

  function passRoster(ro: CSVRow) {
    // class filter
    if (classSel.size && !classSel.has(ro[rk.Grade])) return false;
    // geo cascade
    if (geoSel.s.size) { if (!geoSel.s.has(ro[rk.SchoolName])) return false; }
    else if (geoSel.m.size) { if (!geoSel.m.has(ro[rk.Mandal])) return false; }
    else if (geoSel.d.size) { if (!geoSel.d.has(ro[rk.District])) return false; }
    // scope
    if (filters.scope === 'Target' && ro[rk.TargetFlag] !== '1') return false;
    if (filters.scope === 'Non-Target' && ro[rk.TargetFlag] !== '0') return false;
    return true;
  }

  // pass roster but ignore scope (so we can compute both target and non-target onboarding sets)
  function passRosterNoScope(ro: CSVRow) {
    if (classSel.size && !classSel.has(ro[rk.Grade])) return false;
    if (geoSel.s.size) { if (!geoSel.s.has(ro[rk.SchoolName])) return false; }
    else if (geoSel.m.size) { if (!geoSel.m.has(ro[rk.Mandal])) return false; }
    else if (geoSel.d.size) { if (!geoSel.d.has(ro[rk.District])) return false; }
    return true;
  }

  function passFact(fr: CSVRow) {
    const t = new Date(fr[fk.Date] + 'T00:00:00Z');
    if (t < from || t > to) return false;
    const ro = rosterById.get(fr[fk.StudentID]);
    if (!ro) return false;
    if (!passRoster(ro)) return false;
    if (subjSel.size) {
      const subj = (fr[fk.Subject] || '').toLowerCase();
      if (![...subjSel].some(s => subj.startsWith(s.toLowerCase()))) return false;
    }
    return true;
  }

  const facts = R.facts.filter(passFact);

  // improvement status per student within window
  const deltaByStudent = new Map<string, number>();
  facts.forEach(fr => {
    const sid = fr[fk.StudentID];
    const delta = (Number(fr[fk.CurrentMilestone] || 0) || 0) - (Number(fr[fk.StartMilestone] || 0) || 0);
    deltaByStudent.set(sid, (deltaByStudent.get(sid) || 0) + delta);
  });
  if (impSel.size) {
    const keepSids = new Set<string>();
    deltaByStudent.forEach((d, sid) => {
      const label = d > 0 ? 'Improved' : d < 0 ? 'Declined' : 'No change';
      if (impSel.has(label)) keepSids.add(sid);
    });
    // filter facts and deltaByStudent
    const newFacts = facts.filter(fr => keepSids.has(fr[fk.StudentID]));
    facts.length = 0; facts.push(...newFacts);
    [...deltaByStudent.keys()].forEach(k => { if (!keepSids.has(k)) deltaByStudent.delete(k); });
  }

  // aggregates
  const sessionsByStudent = new Map<string, number>();
  const timeByStudent = new Map<string, number>();
  const schoolByStudent = new Map<string, string>();
  const targetByStudent = new Map<string, boolean>();
  const districtByStudent = new Map<string, string>();
  const mandalByStudent = new Map<string, string>();

  facts.forEach(fr => {
    const sid = fr[fk.StudentID];
    const ro = rosterById.get(sid)!;
    const s = Number(fr[fk.Sessions] || 0) || 0;
    const tm = Number(fr[fk.TimeMinutes] || 0) || 0;
    sessionsByStudent.set(sid, (sessionsByStudent.get(sid) || 0) + s);
    timeByStudent.set(sid, (timeByStudent.get(sid) || 0) + tm);
    schoolByStudent.set(sid, ro[rk.SchoolID]);
    targetByStudent.set(sid, ro[rk.TargetFlag] === '1');
    districtByStudent.set(sid, ro[rk.District]);
    mandalByStudent.set(sid, ro[rk.Mandal]);
  });

  const activeStudents = new Set<string>();
  sessionsByStudent.forEach((v, sid) => { if (v > 0 || (timeByStudent.get(sid) || 0) > 0) activeStudents.add(sid); });
  const activeStudentsTarget = new Set([...activeStudents].filter(sid => targetByStudent.get(sid)));
  const activeStudentsNonTarget = new Set([...activeStudents].filter(sid => !targetByStudent.get(sid)));
  const activeSchools = new Set([...activeStudents].map(sid => schoolByStudent.get(sid)).filter(Boolean) as string[]);
  const activeSchoolsTarget = new Set([...activeStudentsTarget].map(sid => schoolByStudent.get(sid)).filter(Boolean) as string[]);
  const activeSchoolsNonTarget = new Set([...activeStudentsNonTarget].map(sid => schoolByStudent.get(sid)).filter(Boolean) as string[]);

  let totalSessions = 0, totalTime = 0, totalDiagnostics = 0;
  facts.forEach(fr => { totalSessions += Number(fr[fk.Sessions] || 0) || 0; totalTime += Number(fr[fk.TimeMinutes] || 0) || 0; totalDiagnostics += Number(fr[fk.DiagnosticsCompleted] || 0) || 0; });

  const totalTargetStudentsWithinScope = R.roster.filter(ro => passRoster(ro) && ro[rk.TargetFlag] === '1').length;
  const totalTargetSchoolsWithinScope = new Set(R.roster.filter(ro => passRoster(ro) && ro[rk.TargetFlag] === '1').map(ro => ro[rk.SchoolID])).size;

  const sessionsPerStudent = totalSessions / Math.max(activeStudents.size, 1);

  // Build previous window aggregates for WoW
  const winDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24*3600*1000)) + 1);
  const prevTo = new Date(from); prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setUTCDate(prevFrom.getUTCDate() - (winDays - 1));
  const factsPrev = R.facts.filter(fr => {
    const t = new Date(fr[fk.Date] + 'T00:00:00Z');
    return t >= prevFrom && t <= prevTo && passRoster(rosterById.get(fr[fk.StudentID]) || {} as any) && (!subjSel.size || [...subjSel].some(s => (fr[fk.Subject] || '').toLowerCase().startsWith(s)));
  });
  const prevSessionsByStudent = new Map<string, number>();
  const prevTimeByStudent = new Map<string, number>();
  const prevSchoolSet = new Set<string>();
  const prevDeltaByStudent = new Map<string, number>();
  factsPrev.forEach(fr => {
    const sid = fr[fk.StudentID];
    const s = Number(fr[fk.Sessions] || 0) || 0; const tm = Number(fr[fk.TimeMinutes] || 0) || 0;
    prevSessionsByStudent.set(sid, (prevSessionsByStudent.get(sid) || 0) + s);
    prevTimeByStudent.set(sid, (prevTimeByStudent.get(sid) || 0) + tm);
    const sch = schoolByStudent.get(sid); if (sch) prevSchoolSet.add(sch);
    const delta = (Number(fr[fk.CurrentMilestone] || 0) || 0) - (Number(fr[fk.StartMilestone] || 0) || 0);
    prevDeltaByStudent.set(sid, (prevDeltaByStudent.get(sid) || 0) + delta);
  });
  const prevActiveStudents = new Set<string>();
  prevSessionsByStudent.forEach((v, sid) => { if (v > 0 || (prevTimeByStudent.get(sid) || 0) > 0) prevActiveStudents.add(sid); });
  const prevActiveSchools = prevSchoolSet;
  let prevTotalSessions = 0, prevTotalTime = 0;
  factsPrev.forEach(fr => { prevTotalSessions += Number(fr[fk.Sessions] || 0) || 0; prevTotalTime += Number(fr[fk.TimeMinutes] || 0) || 0; });
  const prevSessionsPerStudent = prevTotalSessions / Math.max(prevActiveStudents.size, 1);
  const prevProgressedTotal = [...prevDeltaByStudent.entries()].filter(([sid, d]) => d > 0).length;

  function wow(curr: number, prev: number) {
    const diff = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;
    const val = `${Math.round(diff)}%`;
    return { dir: diff >= 0 ? 'up' as const : 'down' as const, value: val };
  }
  const activeSchoolsTargetPct = pctNum(activeSchoolsTarget.size, Math.max(1, totalTargetSchoolsWithinScope));
  const kpis: KPI[] = [
    { title: 'Active Students', big: formatK(activeStudents.size), reference: `of ${formatK(totalTargetStudentsWithinScope)} target (${pct(activeStudents.size, totalTargetStudentsWithinScope)})`, wow: wow(activeStudents.size, prevActiveStudents.size), gauge: { green: activeStudentsTarget.size, blue: activeStudentsNonTarget.size, grey: Math.max(0, totalTargetStudentsWithinScope - activeStudentsTarget.size) } },
    { title: 'Active Schools', big: String(activeSchools.size), reference: `of ${String(totalTargetSchoolsWithinScope)} target (${activeSchoolsTargetPct}%)`, wow: wow(activeSchools.size, prevActiveSchools.size), gauge: { green: activeSchoolsTarget.size, blue: activeSchoolsNonTarget.size, grey: Math.max(0, totalTargetSchoolsWithinScope - activeSchoolsTarget.size) } },
    // Students Progressed: count of students with positive milestone delta in window
    { title: 'Students Progressed', big: formatK([...deltaByStudent.entries()].filter(([_, d]) => d > 0).length), reference: `of ${formatK(totalTargetStudentsWithinScope)} target (${pct([...deltaByStudent.entries()].filter(([sid, d]) => d > 0 && (targetByStudent.get(sid) || false)).length, totalTargetStudentsWithinScope)})`, wow: wow([...deltaByStudent.entries()].filter(([_, d]) => d > 0).length, prevProgressedTotal), gauge: { green: [...deltaByStudent.entries()].filter(([sid, d]) => d > 0 && (targetByStudent.get(sid) || false)).length, blue: [...deltaByStudent.entries()].filter(([sid, d]) => d > 0 && !(targetByStudent.get(sid) || false)).length, grey: Math.max(0, totalTargetStudentsWithinScope - [...deltaByStudent.entries()].filter(([sid, d]) => d > 0 && (targetByStudent.get(sid) || false)).length) } },
    { title: 'Sessions per Student (7d)', big: round2(sessionsPerStudent).toString(), reference: `of 2 days goal (${Math.min(100, Math.round((sessionsPerStudent / 2) * 100))}%)`, wow: wow(sessionsPerStudent, prevSessionsPerStudent), gauge: { pct: Math.min(100, Math.round((sessionsPerStudent / 2) * 100)) } },
    { title: 'Avg Time Spent per student (7d)', big: `${Math.round(totalTime / Math.max(activeStudents.size, 1))} mins`, reference: `of 200 mins goal (${Math.min(100, Math.round(((totalTime / Math.max(activeStudents.size, 1)) / 200) * 100))}%)`, wow: wow(totalTime / Math.max(activeStudents.size, 1), prevTotalTime / Math.max(prevActiveStudents.size, 1)), gauge: { pct: Math.min(100, Math.round(((totalTime / Math.max(activeStudents.size, 1)) / 200) * 100)) } },
  ];

  // Mandals/Districts coverage derived from roster + activity
  const targetMandals = new Set(
    R.roster.filter(ro => passRoster(ro) && ro[rk.TargetFlag] === '1').map(ro => ro[rk.Mandal])
  );
  const activeTargetMandals = new Set(
    [...activeStudentsTarget].map(sid => mandalByStudent.get(sid)).filter(Boolean) as string[]
  );
  const activeNonTargetMandals = new Set(
    [...activeStudentsNonTarget].map(sid => mandalByStudent.get(sid)).filter(Boolean) as string[]
  );
  const mandalsCoverage = {
    green: activeTargetMandals.size,
    amber: Math.max(0, targetMandals.size - activeTargetMandals.size),
    blue: activeNonTargetMandals.size,
  };

  const targetDistricts = new Set(
    R.roster.filter(ro => passRoster(ro) && ro[rk.TargetFlag] === '1').map(ro => ro[rk.District])
  );
  const activeTargetDistricts = new Set(
    [...activeStudentsTarget].map(sid => districtByStudent.get(sid)).filter(Boolean) as string[]
  );
  const activeNonTargetDistricts = new Set(
    [...activeStudentsNonTarget].map(sid => districtByStudent.get(sid)).filter(Boolean) as string[]
  );
  const districtsCoverage = {
    green: activeTargetDistricts.size,
    amber: Math.max(0, targetDistricts.size - activeTargetDistricts.size),
    blue: activeNonTargetDistricts.size,
  };

  // --- Onboarding (ever used once) vs Active (this period) ---
  const onboardedTargetStudents = new Set<string>();
  const onboardedNonTargetStudents = new Set<string>();
  const onboardedTargetSchools = new Set<string>();
  const onboardedNonTargetSchools = new Set<string>();
  const onboardedTargetMandals = new Set<string>();
  const onboardedNonTargetMandals = new Set<string>();
  const onboardedTargetDistricts = new Set<string>();
  const onboardedNonTargetDistricts = new Set<string>();

  R.facts.forEach(fr => {
    const ro = rosterById.get(fr[fk.StudentID]);
    if (!ro || !passRosterNoScope(ro)) return;
    const isTarget = ro[rk.TargetFlag] === '1';
    const sch = ro[rk.SchoolID];
    const man = ro[rk.Mandal];
    const dis = ro[rk.District];
    if (isTarget) {
      onboardedTargetStudents.add(fr[fk.StudentID]);
      if (sch) onboardedTargetSchools.add(sch);
      if (man) onboardedTargetMandals.add(man);
      if (dis) onboardedTargetDistricts.add(dis);
    } else {
      onboardedNonTargetStudents.add(fr[fk.StudentID]);
      if (sch) onboardedNonTargetSchools.add(sch);
      if (man) onboardedNonTargetMandals.add(man);
      if (dis) onboardedNonTargetDistricts.add(dis);
    }
  });

  // Non-target totals by entity based on roster (active + inactive)
  const nonTargetStudentsTotal = new Set(
    R.roster.filter(ro => passRosterNoScope(ro) && ro[rk.TargetFlag] !== '1').map(ro => ro[rk.StudentID])
  ).size;
  const nonTargetSchoolsTotal = new Set(
    R.roster.filter(ro => passRosterNoScope(ro) && ro[rk.TargetFlag] !== '1').map(ro => ro[rk.SchoolID])
  ).size;
  const nonTargetMandalsTotal = new Set(
    R.roster.filter(ro => passRosterNoScope(ro) && ro[rk.TargetFlag] !== '1').map(ro => ro[rk.Mandal])
  ).size;
  const nonTargetDistrictsTotal = new Set(
    R.roster.filter(ro => passRosterNoScope(ro) && ro[rk.TargetFlag] !== '1').map(ro => ro[rk.District])
  ).size;

  // Target totals by entity based on roster
  const totalTargetStudentsScope = R.roster.filter(ro => passRosterNoScope(ro) && ro[rk.TargetFlag] === '1').length;
  const totalTargetSchoolsScope = new Set(R.roster.filter(ro => passRosterNoScope(ro) && ro[rk.TargetFlag] === '1').map(ro => ro[rk.SchoolID])).size;
  const totalTargetMandalsScope = targetMandals.size;
  const totalTargetDistrictsScope = targetDistricts.size;

  let coverage = {
    Students: {
      green: activeStudentsTarget.size,
      amber: Math.max(0, onboardedTargetStudents.size - activeStudentsTarget.size),
      grey: Math.max(0, totalTargetStudentsScope - onboardedTargetStudents.size),
      blue: nonTargetStudentsTotal,
    },
    Schools: {
      green: activeSchoolsTarget.size,
      amber: Math.max(0, onboardedTargetSchools.size - activeSchoolsTarget.size),
      grey: Math.max(0, totalTargetSchoolsScope - onboardedTargetSchools.size),
      blue: nonTargetSchoolsTotal,
    },
    Mandals: {
      green: activeTargetMandals.size,
      amber: Math.max(0, onboardedTargetMandals.size - activeTargetMandals.size),
      grey: Math.max(0, totalTargetMandalsScope - onboardedTargetMandals.size),
      blue: nonTargetMandalsTotal,
    },
    Districts: {
      green: activeTargetDistricts.size,
      amber: Math.max(0, onboardedTargetDistricts.size - activeTargetDistricts.size),
      grey: Math.max(0, totalTargetDistrictsScope - onboardedTargetDistricts.size),
      blue: nonTargetDistrictsTotal,
    },
  } as State['coverage'];

  // If Non-Target scope is selected, show only Non-target segment in Coverage
  if (filters.scope === 'Non-Target') {
    coverage = {
      Students: { green: 0, amber: 0, grey: 0, blue: coverage.Students.blue },
      Schools: { green: 0, amber: 0, grey: 0, blue: coverage.Schools.blue },
      Mandals: { green: 0, amber: 0, grey: 0, blue: coverage.Mandals.blue },
      Districts: { green: 0, amber: 0, grey: 0, blue: coverage.Districts.blue },
    };
  }

  // Trends: last 5 days within [from..to]
  const dayKey = (d: Date) => d.toISOString().slice(0,10);
  const sessionsByDay = new Map<string, number>();
  const timeByDay = new Map<string, number>();
  const diagnosticsByDay = new Map<string, number>();
  const activeStudentsByDay = new Map<string, Set<string>>();
  const activeSchoolsByDay = new Map<string, Set<string>>();
  const progressedByDay = new Map<string, Set<string>>();
  facts.forEach(fr => {
    const d = dayKey(new Date(fr[fk.Date] + 'T00:00:00Z'));
    const s = Number(fr[fk.Sessions] || 0) || 0;
    const tm = Number(fr[fk.TimeMinutes] || 0) || 0;
    const dg = Number(fr[fk.DiagnosticsCompleted] || 0) || 0;
    sessionsByDay.set(d, (sessionsByDay.get(d) || 0) + s);
    timeByDay.set(d, (timeByDay.get(d) || 0) + tm);
    diagnosticsByDay.set(d, (diagnosticsByDay.get(d) || 0) + dg);
    if (s > 0 || tm > 0) {
      if (!activeStudentsByDay.has(d)) activeStudentsByDay.set(d, new Set());
      activeStudentsByDay.get(d)!.add(fr[fk.StudentID]);
      const sch = schoolByStudent.get(fr[fk.StudentID]);
      if (sch) { if (!activeSchoolsByDay.has(d)) activeSchoolsByDay.set(d, new Set()); activeSchoolsByDay.get(d)!.add(sch); }
    }
    const delta = (Number(fr[fk.CurrentMilestone] || 0) || 0) - (Number(fr[fk.StartMilestone] || 0) || 0);
    if (delta > 0) { if (!progressedByDay.has(d)) progressedByDay.set(d, new Set()); progressedByDay.get(d)!.add(fr[fk.StudentID]); }
  });
  const pointsSessions: number[] = [];
  const pointsTime: number[] = [];
  const pointsDiagnostics: number[] = [];
  const pointsActiveStudents: number[] = [];
  const pointsActiveSchools: number[] = [];
  const pointsProgressed: number[] = [];
  for (let offset = 4; offset >= 0; offset--) {
    const d = new Date(to); d.setUTCDate(to.getUTCDate() - offset);
    const key = dayKey(d);
    const dayActive = (activeStudentsByDay.get(key)?.size) || 0;
    pointsSessions.push((sessionsByDay.get(key) || 0) / Math.max(dayActive, 1));
    pointsTime.push((timeByDay.get(key) || 0) / Math.max(dayActive, 1));
    pointsDiagnostics.push(diagnosticsByDay.get(key) || 0);
    pointsActiveStudents.push(dayActive);
    pointsActiveSchools.push((activeSchoolsByDay.get(key)?.size) || 0);
    pointsProgressed.push((progressedByDay.get(key)?.size) || 0);
  }
  const trendCards: State['trendCards'] = [
    { title: 'Active Students', value: String(pointsActiveStudents[pointsActiveStudents.length - 1] || 0), wow: diffPct(pointsActiveStudents), points: pointsActiveStudents },
    { title: 'Active Schools', value: String(pointsActiveSchools[pointsActiveSchools.length - 1] || 0), wow: diffPct(pointsActiveSchools), points: pointsActiveSchools },
    { title: 'Students Progressed', value: String(pointsProgressed[pointsProgressed.length - 1] || 0), wow: diffPct(pointsProgressed), points: pointsProgressed },
    { title: 'Sessions per Student', value: round2(pointsSessions[pointsSessions.length - 1] || 0).toString(), wow: diffPct(pointsSessions), points: pointsSessions.map(n => round2(n)) },
    { title: 'Avg Time Spent per student (7d)', value: `${Math.round(pointsTime[pointsTime.length - 1] || 0)} mins`, wow: diffPct(pointsTime), points: pointsTime.map(n => Math.round(n)) },
    { title: 'Diagnostics Completed', value: String(pointsDiagnostics[pointsDiagnostics.length - 1] || 0), wow: diffPct(pointsDiagnostics), points: pointsDiagnostics },
  ];
  // Funnel (simple totals in filtered set)
  const totalStudents = new Set(facts.map(fr => fr[fk.StudentID])).size;
  const completedDiagnostics = new Set<string>();
  const practiced200 = new Set<string>();
  const improvedMilestone = new Set<string>();
  const completedAllLevels = new Set<string>();
  const timeAll = new Map<string, number>();
  facts.forEach(fr => {
    const sid = fr[fk.StudentID];
    const diag = Number(fr[fk.DiagnosticsCompleted] || 0) || 0; if (diag > 0) completedDiagnostics.add(sid);
    const delta = (Number(fr[fk.CurrentMilestone] || 0) || 0) - (Number(fr[fk.StartMilestone] || 0) || 0); if (delta > 0) improvedMilestone.add(sid);
    timeAll.set(sid, (timeAll.get(sid) || 0) + (Number(fr[fk.TimeMinutes] || 0) || 0));
  });
  timeAll.forEach((v, sid) => { if (v >= 200) practiced200.add(sid); });
  // placeholder heuristic for completed all levels
  deltaByStudent.forEach((d, sid) => { if (d >= 10) completedAllLevels.add(sid); });
  const funnel: State['funnel'] = [
    { stage: 'Total Students', value: totalStudents, pct: 100 },
    { stage: 'Active Students', value: activeStudents.size, pct: pctNum(activeStudents.size, Math.max(totalStudents, 1)) },
    { stage: 'Completed Diagnostics', value: completedDiagnostics.size, pct: pctNum(completedDiagnostics.size, totalStudents) },
    { stage: 'Practicing >200 mins', value: practiced200.size, pct: pctNum(practiced200.size, totalStudents) },
    { stage: 'Improved Milestone', value: improvedMilestone.size, pct: pctNum(improvedMilestone.size, totalStudents) },
    { stage: 'Completed All Levels', value: completedAllLevels.size, pct: pctNum(completedAllLevels.size, totalStudents) },
  ];

  // Table by drill level
  function rowsBy(key: 'District'|'Mandal'|'School'|'Student'): EntityRow[] {
    if (key === 'Student') {
      function schoolNameOf(sid: string) {
        return (R.roster.find(r => r[rk.SchoolID] === schoolByStudent.get(sid))?.[rk.SchoolName]) || (schoolByStudent.get(sid) || 'Unknown');
      }
      const list = [...activeStudents].filter((sid) => !drill.school || schoolNameOf(sid) === drill.school);
      return list.map((sid) => ({
        id: sid,
        name: sid,
        sessions: sessionsByStudent.get(sid) || 0,
        avgTime: Math.round((timeByStudent.get(sid) || 0)),
        milestone: (deltaByStudent.get(sid) || 0) >= 0 ? `Δ +${deltaByStudent.get(sid) || 0}` : `Δ ${deltaByStudent.get(sid)}`,
        activeStudents: 1,
        improvementPct: Math.max(0, Math.sign(deltaByStudent.get(sid) || 0) * 100),
        status: (targetByStudent.get(sid) ? 'Target' : 'Non-target') as any,
        sessionsPerStudent: 0,
      }));
    }
    type KeyGetter = (sid: string) => string;
    const getter: Record<'District'|'Mandal'|'School', KeyGetter> = {
      District: (sid) => districtByStudent.get(sid) || 'Unknown',
      Mandal: (sid) => mandalByStudent.get(sid) || 'Unknown',
      School: (sid) => (R.roster.find(r => r[rk.SchoolID] === schoolByStudent.get(sid))?.[rk.SchoolName]) || (schoolByStudent.get(sid) || 'Unknown'),
    };
    const constraint: Partial<Record<'District'|'Mandal'|'School', string>> = {};
    if (drill.level === 'Mandal' && drill.district) constraint.District = drill.district;
    if (drill.level === 'School' && drill.mandal) constraint.Mandal = drill.mandal;

    const groups = new Map<string, { students: Set<string>; sessions: number; time: number; improved: number; targetStudents: Set<string>; targetSchools: Set<string>; schools: Set<string> }>();
    function ensure(k: string) {
      if (!groups.has(k)) groups.set(k, { students: new Set(), sessions: 0, time: 0, improved: 0, targetStudents: new Set(), targetSchools: new Set(), schools: new Set() });
      return groups.get(k)!;
    }
    [...activeStudents].forEach((sid) => {
      const dKey = getter.District(sid);
      const mKey = getter.Mandal(sid);
      if (constraint.District && dKey !== constraint.District) return;
      if (constraint.Mandal && mKey !== constraint.Mandal) return;
      const k = getter[key as 'District'|'Mandal'|'School'](sid);
      const g = ensure(k);
      g.students.add(sid);
      g.sessions += sessionsByStudent.get(sid) || 0;
      g.time += timeByStudent.get(sid) || 0;
      if ((deltaByStudent.get(sid) || 0) > 0) g.improved += 1;
      if (targetByStudent.get(sid)) {
        g.targetStudents.add(sid);
        const schT = schoolByStudent.get(sid); if (schT) g.targetSchools.add(schT);
      }
      const sch = schoolByStudent.get(sid); if (sch) g.schools.add(sch);
    });
    const rows: EntityRow[] = [];
    groups.forEach((g, name) => {
      const activeCount = g.students.size || 1;
      // Total targets in this group from roster (denominator for %)
      let totalTargetStudents = 0;
      let totalTargetSchools = 0;
      if (key === 'District') {
        const sids = R.roster.filter(r => passRosterNoScope(r) && r[rk.TargetFlag] === '1' && r[rk.District] === name).map(r => r[rk.StudentID]);
        totalTargetStudents = sids.length;
        totalTargetSchools = new Set(R.roster.filter(r => passRosterNoScope(r) && r[rk.TargetFlag] === '1' && r[rk.District] === name).map(r => r[rk.SchoolID])).size;
      } else if (key === 'Mandal') {
        const sids = R.roster.filter(r => passRosterNoScope(r) && r[rk.TargetFlag] === '1' && r[rk.Mandal] === name).map(r => r[rk.StudentID]);
        totalTargetStudents = sids.length;
        totalTargetSchools = new Set(R.roster.filter(r => passRosterNoScope(r) && r[rk.TargetFlag] === '1' && r[rk.Mandal] === name).map(r => r[rk.SchoolID])).size;
      } else if (key === 'School') {
        totalTargetStudents = R.roster.filter(r => r[rk.SchoolName] === name && r[rk.TargetFlag] === '1').length;
        totalTargetSchools = totalTargetStudents > 0 ? 1 : 0;
      }
      const row: EntityRow = {
        id: name,
        name,
        activeSchools: g.schools.size,
        activeStudents: g.students.size,
        targetSchools: totalTargetSchools,
        targetStudents: totalTargetStudents,
        activeTargetSchools: g.targetSchools.size,
        activeTargetStudents: g.targetStudents.size,
        sessionsPerStudent: round2(g.sessions / activeCount),
        avgTime: Math.round(g.time / activeCount),
        improvementPct: Math.round((g.improved / activeCount) * 100),
      };
      if (key === 'School') {
        // Percent of Target = active target students / total target students in school
        row.pctOfTarget = totalTargetStudents ? Math.round((g.targetStudents.size / totalTargetStudents) * 100) : 0;
      }
      rows.push(row);
    });
    return rows;
  }

  const table = rowsBy(drill.level);

  return { kpis, coverage, trendCards, funnel, table };
}

function formatK(n: number) { return n >= 1000 ? Math.round(n/1000) + 'K' : String(n); }
function pct(a: number, b: number) { if (b === 0) return '0%'; return Math.round((a/b)*100) + '%'; }
function pctNum(a: number, b: number) { if (b === 0) return 0; return Math.round((a/b)*100); }
function round2(n: number) { return Math.round(n*100)/100; }
function diffPct(points: number[]) { if (points.length < 2) return '+0%'; const a = points[points.length-2]; const b = points[points.length-1]; const d = a===0?0:((b-a)/Math.abs(a))*100; const s = d>=0?'+':''; return s + Math.round(d) + '%'; }




