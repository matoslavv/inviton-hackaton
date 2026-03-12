import { useState, useEffect } from 'react';
import AutomationListPage from './pages/AutomationListPage.tsx';
import AutomationFormPage from './pages/AutomationFormPage.tsx';
import TemplateListPage from './pages/TemplateListPage.tsx';
import TemplateFormPage from './pages/TemplateFormPage.tsx';

type View =
  | { page: 'automations' }
  | { page: 'automation-form'; eventId: number; automationId: number | null }
  | { page: 'templates' }
  | { page: 'template-form'; templateId: number | null };

type Theme = 'dark' | 'light';

type Module = 'automations' | 'templates';

function App() {
  const [view, setView] = useState<View>({ page: 'automations' });
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const currentModule: Module =
    view.page === 'templates' || view.page === 'template-form' ? 'templates' : 'automations';

  const navigateModule = (mod: Module) => {
    if (mod === 'templates') setView({ page: 'templates' });
    else setView({ page: 'automations' });
  };

  return (
    <>
      <header className="app-header">
        <span className="app-header-logo">Inviton</span>
        <span className="app-header-sep" />
        <nav className="app-nav">
          <button
            className={`app-nav-item ${currentModule === 'automations' ? 'app-nav-item--active' : ''}`}
            onClick={() => navigateModule('automations')}
          >
            Automations
          </button>
          <button
            className={`app-nav-item ${currentModule === 'templates' ? 'app-nav-item--active' : ''}`}
            onClick={() => navigateModule('templates')}
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

      {view.page === 'automation-form' ? (
        <AutomationFormPage
          eventId={view.eventId}
          automationId={view.automationId}
          onBack={() => setView({ page: 'automations' })}
        />
      ) : view.page === 'template-form' ? (
        <TemplateFormPage
          templateId={view.templateId}
          onBack={() => setView({ page: 'templates' })}
        />
      ) : view.page === 'templates' ? (
        <TemplateListPage
          onAdd={() => setView({ page: 'template-form', templateId: null })}
          onEdit={(templateId) => setView({ page: 'template-form', templateId })}
        />
      ) : (
        <AutomationListPage
          onAdd={(eventId) => setView({ page: 'automation-form', eventId, automationId: null })}
          onEdit={(eventId, automationId) => setView({ page: 'automation-form', eventId, automationId })}
        />
      )}
    </>
  );
}

export default App;
