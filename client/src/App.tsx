import { useState, useEffect } from 'react';
import AutomationListPage from './pages/AutomationListPage.tsx';
import AutomationFormPage from './pages/AutomationFormPage.tsx';

type View =
  | { page: 'list' }
  | { page: 'form'; eventId: number; automationId: number | null };

type Theme = 'dark' | 'light';

function App() {
  const [view, setView] = useState<View>({ page: 'list' });
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
        <span className="app-header-subtitle">Email Automations</span>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\u{1F319}'}
        </button>
      </header>

      {view.page === 'form' ? (
        <AutomationFormPage
          eventId={view.eventId}
          automationId={view.automationId}
          onBack={() => setView({ page: 'list' })}
        />
      ) : (
        <AutomationListPage
          onAdd={(eventId) => setView({ page: 'form', eventId, automationId: null })}
          onEdit={(eventId, automationId) => setView({ page: 'form', eventId, automationId })}
        />
      )}
    </>
  );
}

export default App;
