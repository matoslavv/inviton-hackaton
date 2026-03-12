import { useState, useEffect } from 'react';
import AutomationListPage from './pages/AutomationListPage.tsx';
import TemplateListPage from './pages/TemplateListPage.tsx';

type Page = 'automations' | 'templates';
type Theme = 'dark' | 'light';

function App() {
  const [page, setPage] = useState<Page>('automations');
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <>
      <header className="app-header">
        <span className="app-header-logo">Inviton</span>
        <span className="app-header-sep" />
        <nav className="app-nav">
          <button
            className={`app-nav-item ${page === 'automations' ? 'app-nav-item--active' : ''}`}
            onClick={() => setPage('automations')}
          >
            Automations
          </button>
          <button
            className={`app-nav-item ${page === 'templates' ? 'app-nav-item--active' : ''}`}
            onClick={() => setPage('templates')}
          >
            Templates
          </button>
        </nav>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\u{1F319}'}
        </button>
      </header>

      {page === 'templates' ? <TemplateListPage /> : <AutomationListPage />}
    </>
  );
}

export default App;
