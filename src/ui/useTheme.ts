import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  try {
    const saved = localStorage.getItem('wig-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('wig-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return { theme, toggle };
}
