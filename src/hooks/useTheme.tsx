import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'lavender' | 'midnight'>(() => {
    return (localStorage.getItem('theme') as 'lavender' | 'midnight') || 'lavender';
  });

  useEffect(() => {
    if (theme === 'midnight') {
      document.body.classList.add('theme-midnight');
    } else {
      document.body.classList.remove('theme-midnight');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'lavender' ? 'midnight' : 'lavender');
  };

  return { theme, toggleTheme };
}
