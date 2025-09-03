import React from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<string>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  });

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const isLight = theme === 'light';
  return (
    <div className={`toggle ${isLight ? 'light' : ''}`} role="group" aria-label="Theme">
      <button className={!isLight ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button>
      <button className={isLight ? 'on' : ''} onClick={() => setTheme('light')}>Light</button>
    </div>
  );
}

