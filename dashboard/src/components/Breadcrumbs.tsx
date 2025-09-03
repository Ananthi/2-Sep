import React from 'react';
import { useStore } from '../state';

export function Breadcrumbs() {
  const { state, dispatch } = useStore();
  const parts = [
    { label: 'All Districts', level: 'District' as const },
    state.drill.district && { label: state.drill.district, level: 'Mandal' as const },
    state.drill.mandal && { label: state.drill.mandal, level: 'School' as const },
    state.drill.school && { label: state.drill.school, level: 'Student' as const },
  ].filter(Boolean) as Array<{ label: string; level: 'District' | 'Mandal' | 'School' | 'Student' }>;

  return (
    <div className="breadcrumb" style={{ marginBottom: 8 }}>
      {parts.map((p, idx) => (
        <span key={idx}>
          {idx > 0 && ' > '}
          <a href="#" onClick={(e) => { e.preventDefault(); dispatch({ type: 'breadcrumbTo', level: p.level }); }}>{p.label}</a>
        </span>
      ))}
    </div>
  );
}

