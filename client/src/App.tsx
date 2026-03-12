import { useState } from 'react';
import AutomationListPage from './pages/AutomationListPage.tsx';
import AutomationFormPage from './pages/AutomationFormPage.tsx';

type View =
  | { page: 'list' }
  | { page: 'form'; eventId: number; automationId: number | null };

function App() {
  const [view, setView] = useState<View>({ page: 'list' });

  if (view.page === 'form') {
    return (
      <AutomationFormPage
        eventId={view.eventId}
        automationId={view.automationId}
        onBack={() => setView({ page: 'list' })}
      />
    );
  }

  return (
    <AutomationListPage
      onAdd={(eventId) => setView({ page: 'form', eventId, automationId: null })}
      onEdit={(eventId, automationId) => setView({ page: 'form', eventId, automationId })}
    />
  );
}

export default App;
