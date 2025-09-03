import React from 'react';

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={onClose}>
      <div
        className="panel"
        style={{ width: '90%', maxWidth: 900, maxHeight: '80%', overflow: 'auto', margin: '5% auto', padding: 16, background: 'var(--panel)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button className="clear" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

