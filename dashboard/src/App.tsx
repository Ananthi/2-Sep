import React from 'react';
import { Provider } from './state';
import { FilterBar } from './components/FilterBar';
import { DataLoader } from './components/DataLoader';
import { Breadcrumbs } from './components/Breadcrumbs';
import { KpiRow } from './components/KpiRow';
import { Coverage } from './components/Coverage';
import { Trends } from './components/Trends';
import { ProgressFunnel } from './components/ProgressFunnel';
import { Explorer } from './components/Explorer';
import { MilestoneDistributions } from './components/MilestoneDistributions';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KpiExplorer } from './components/KpiExplorer';

export default function App() {
  // Minimal debug mode if query contains ?debug=min
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'min') {
    console.log('Rendering minimal debug view');
    return <div className="container" style={{ padding: 16 }}>Hello — minimal debug view. If you see this, React is rendering.</div>;
  }
  console.log('Rendering full App…');
  return (
    <ErrorBoundary>
      <Provider>
        <div className="container">
          <div style={{padding: '8px 0', fontWeight: 600}}>Dashboard Loaded — sections render below.</div>
          <DataLoader />
          <div className="sticky-top panel">
            <FilterBar />
          </div>

        <div className="section-title">Onboarding</div>
        <Coverage />

        <div style={{ height: 10 }} />
        <KpiRow />
        <KpiExplorer />

        <div className="section-title">Trends & Improvement</div>
        <Trends />

        <div className="section-title">Progress Funnel</div>
        <ProgressFunnel />

        <MilestoneDistributions />

          <div className="section-title">Drill-down Explorer</div>
          <Breadcrumbs />
          <Explorer />
        </div>
      </Provider>
    </ErrorBoundary>
  );
}
