import React from 'react';

type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: any): State {
    return { hasError: true, message: String(error) };
  }
  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Dashboard failed to render</div>
          <div style={{ color: 'var(--muted)' }}>{this.state.message}</div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

