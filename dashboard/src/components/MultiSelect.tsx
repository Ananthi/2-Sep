import React, { useEffect, useMemo, useRef, useState } from 'react';

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  placeholder,
  width = 220,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  placeholder?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const display = selected.length === 0
    ? (placeholder || `Select ${label}`)
    : selected.length <= 3
      ? selected.join(', ')
      : `${selected.length} selected`;

  function toggle(val: string) {
    const s = new Set(selected);
    if (s.has(val)) s.delete(val); else s.add(val);
    onChange(Array.from(s));
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  const allCount = options.length;
  const filteredCount = filtered.length;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isAllSelected = (query ? filtered : options).every((o) => selectedSet.has(o)) && (query ? filteredCount > 0 : allCount > 0);

  function selectAll(e: React.MouseEvent) {
    e.stopPropagation();
    const source = query ? filtered : options;
    onChange(source.slice());
  }

  return (
    <div className="ms" ref={ref} style={{ width }}>
      <div className="ms-label">{label}</div>
      <button className="ms-control" onClick={() => setOpen(!open)}>
        <span className="ms-value">{display}</span>
        <span className="ms-caret">▾</span>
      </button>
      {open && (
        <div className="ms-menu">
          <div className="ms-top">
            {searchable && (
              <input
                className="ms-search"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            <div className="ms-actions">
              <button className="ms-link" onClick={selectAll} title={`Select all ${query ? 'filtered' : 'options'}`}>
                {isAllSelected ? 'All selected' : 'Select all'}
              </button>
              <button className="ms-link" onClick={clearAll} title="Clear selection">Clear</button>
            </div>
          </div>
          <div className="ms-list">
            {filtered.map((opt) => (
              <label key={opt} className="ms-item">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                <span>{opt}</span>
              </label>
            ))}
            {filtered.length === 0 && <div className="ms-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

