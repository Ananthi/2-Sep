import React, { useMemo } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { useStore } from '../state';
import { MultiSelect } from './MultiSelect';

export function FilterBar() {
  const { state, dispatch } = useStore();

  const mandals = useMemo(() => {
    const sel = state.filters.districts.length ? state.filters.districts : state.options.districts;
    const set = new Set<string>();
    sel.forEach((d) => state.options.mandalsByDistrict[d]?.forEach((m) => set.add(m)));
    return [...set];
  }, [state.filters.districts, state.options.mandalsByDistrict, state.options.districts]);

  const schools = useMemo(() => {
    const sel = state.filters.mandals.length ? state.filters.mandals : mandals;
    const set = new Set<string>();
    sel.forEach((m) => state.options.schoolsByMandal[m]?.forEach((s) => set.add(s)));
    return [...set];
  }, [state.filters.mandals, mandals, state.options.schoolsByMandal]);

  const quicks: (NonNullable<typeof state.filters.quick>)[] = ['Yesterday', 'Last 7 Days', 'Last 30 Days'];

  const scopeOptions: Array<{ key: 'Target' | 'Non-Target' | 'Both'; color: string }> = [
    { key: 'Target', color: 'var(--green)' },
    { key: 'Non-Target', color: 'var(--blue)' },
    { key: 'Both', color: 'var(--muted)' },
  ];

  function onSelectList(key: 'districts' | 'mandals' | 'schools' | 'subjects' | 'classes' | 'improvement', e: React.ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
    dispatch({ type: 'setArray', key, value: values });
  }

  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="hstack">
        {quicks.map((q) => (
          <button key={q} className={['pill', state.filters.quick === q ? 'active' : ''].join(' ')} onClick={() => dispatch({ type: 'setQuick', quick: q })}>
            {q}
          </button>
        ))}
        <div className="hstack" style={{ marginLeft: 8 }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>From</span>
          <input type="date" onChange={(e) => dispatch({ type: 'setRange', from: e.target.value, to: state.filters.range.to })} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>To</span>
          <input type="date" onChange={(e) => dispatch({ type: 'setRange', from: state.filters.range.from, to: e.target.value })} />
        </div>
        <div className="toggle" style={{ marginLeft: 8 }}>
          {scopeOptions.map((o) => (
            <button key={o.key} className={state.filters.scope === o.key ? 'on' : ''} onClick={() => dispatch({ type: 'setScope', scope: o.key })}>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: o.color, borderRadius: 999, marginRight: 6 }} />
              {o.key}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <ThemeToggle />
        <button className="clear" onClick={() => dispatch({ type: 'clearAll' })}>Clear All Filters</button>
      </div>

      <div className="hstack" style={{ gap: 16 }}>
        <MultiSelect
          label="District"
          options={state.options.districts}
          selected={state.filters.districts}
          onChange={(vals) => dispatch({ type: 'setArray', key: 'districts', value: vals })}
          searchable
          width={220}
        />
        <MultiSelect
          label="Mandal"
          options={mandals}
          selected={state.filters.mandals}
          onChange={(vals) => dispatch({ type: 'setArray', key: 'mandals', value: vals })}
          searchable
          width={220}
        />
        <MultiSelect
          label="School"
          options={schools}
          selected={state.filters.schools}
          onChange={(vals) => dispatch({ type: 'setArray', key: 'schools', value: vals })}
          searchable
          width={280}
        />
        <MultiSelect
          label="Subject"
          options={state.options.subjects}
          selected={state.filters.subjects}
          onChange={(vals) => dispatch({ type: 'setArray', key: 'subjects', value: vals })}
          searchable
          width={200}
        />
        <MultiSelect
          label="Class"
          options={state.options.classes}
          selected={state.filters.classes}
          onChange={(vals) => dispatch({ type: 'setArray', key: 'classes', value: vals })}
          searchable
          width={140}
        />
        {/* Improvement filter removed per request */}
      </div>

      <div className="hstack">
        {renderChips(state).map((c) => (
          <span key={c} className="chip">
            {c}
            <span className="x" onClick={() => dispatch({ type: 'removeChip', chip: c.split(': ')[1] || c })}>×</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function renderChips(state: ReturnType<typeof useStore>['state']): string[] {
  const chips: string[] = [];
  if (state.filters.quick) chips.push(`Time: ${state.filters.quick}`);
  if (state.filters.range.from || state.filters.range.to) chips.push(`Range: ${state.filters.range.from ?? '…'} → ${state.filters.range.to ?? '…'}`);
  chips.push(...state.filters.districts.map((d) => `District: ${d}`));
  chips.push(...state.filters.mandals.map((m) => `Mandal: ${m}`));
  chips.push(...state.filters.schools.map((s) => `School: ${s}`));
  chips.push(...state.filters.subjects.map((s) => `Subject: ${s}`));
  chips.push(...state.filters.classes.map((c) => `Class: ${c}`));
  // Improvement filter removed; no chips to render for it
  return chips;
}
