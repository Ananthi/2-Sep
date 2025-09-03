export type Scope = 'Target' | 'Non-Target' | 'Both';
export type Improvement = 'Improved' | 'No change' | 'Declined';

export interface Filters {
  range: { from?: string; to?: string };
  quick?: 'Yesterday' | 'Last 7 Days' | 'Last 30 Days';
  scope: Scope;
  districts: string[];
  mandals: string[];
  schools: string[];
  subjects: string[];
  classes: string[];
  improvement?: Improvement[];
}

export interface DrillPath {
  level: 'District' | 'Mandal' | 'School' | 'Student';
  district?: string;
  mandal?: string;
  school?: string;
}

export interface KPI {
  title: string;
  big: string;
  reference: string;
  wow: { dir: 'up' | 'down'; value: string };
  gauge?: { green: number; blue: number; grey: number } | { pct: number };
}

export interface EntityRow {
  id: string;
  name: string;
  activeSchools?: number;
  activeStudents: number;
  targetSchools?: number;
  targetStudents?: number;
  activeTargetSchools?: number;
  activeTargetStudents?: number;
  schoolsActivePct?: number; // computed in UI: activeSchools/targetSchools
  studentsActivePct?: number; // computed in UI: activeStudents/targetStudents
  sessionsPerStudent: number;
  avgTime: number; // mins
  improvementPct: number; // 0..100
  pctOfTarget?: number; // for School view
  status?: 'Target' | 'Non-target'; // for Student view
  sessions?: number; // for Student view
  milestone?: string; // for Student view
}
