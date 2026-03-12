import { useState, useEffect, useCallback } from 'react';
import type { Event, Automation } from '../types/index.ts';
import { getEvents } from '../services/events.ts';
import { getAutomations, toggleAutomation, deleteAutomation } from '../services/automations.ts';

const TRIGGER_LABELS: Record<Automation['triggerType'], string> = {
  after_purchase: 'After purchase',
  before_event: 'Before event',
  after_event: 'After event',
  reminder: 'Reminder (tickets)',
};

interface Props {
  onAdd: (eventId: number) => void;
  onEdit: (eventId: number, automationId: number) => void;
}

export default function AutomationListPage({ onAdd, onEdit }: Props) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getEvents().then((evts) => {
      setEvents(evts);
      if (evts.length > 0 && selectedEventId === null) {
        setSelectedEventId(evts[0].id);
      }
    }).catch(console.error);
  }, [selectedEventId]);

  const loadAutomations = useCallback(() => {
    if (selectedEventId === null) return;
    setLoading(true);
    getAutomations(selectedEventId)
      .then(setAutomations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleAutomation(id);
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: updated.active } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this automation?')) return;
    try {
      await deleteAutomation(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>Email Automations</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        <label htmlFor="event-selector" style={{ fontWeight: 600 }}>Event:</label>
        <select
          id="event-selector"
          data-testid="event-selector"
          value={selectedEventId ?? ''}
          onChange={(e) => setSelectedEventId(Number(e.target.value))}
          style={{ padding: '6px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>

        <button
          data-testid="add-automation-btn"
          onClick={() => selectedEventId !== null && onAdd(selectedEventId)}
          disabled={selectedEventId === null}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          + Add new automation
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : automations.length === 0 ? (
        <p style={{ color: '#888' }}>No automations yet. Create one to get started.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Campaign</th>
              <th style={{ padding: '8px 12px' }}>Trigger</th>
              <th style={{ padding: '8px 12px' }}>Days</th>
              <th style={{ padding: '8px 12px' }}>Template</th>
              <th style={{ padding: '8px 12px' }}>Ticket filter</th>
              <th style={{ padding: '8px 12px' }}>Active</th>
              <th style={{ padding: '8px 12px' }}>Sent</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {automations.map((a) => (
              <tr
                key={a.id}
                data-testid="automation-row"
                style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                onClick={() => selectedEventId !== null && onEdit(selectedEventId, a.id)}
              >
                <td style={{ padding: '8px 12px' }} data-testid="automation-name">
                  {a.name}
                </td>
                <td style={{ padding: '8px 12px' }}>{TRIGGER_LABELS[a.triggerType]}</td>
                <td style={{ padding: '8px 12px' }}>
                  {a.daysOffset !== null ? a.daysOffset : '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>{a.template?.name ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>{a.ticketType?.name ?? 'All'}</td>
                <td style={{ padding: '8px 12px' }} onClick={(e) => e.stopPropagation()}>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                    <input
                      type="checkbox"
                      data-testid="automation-toggle"
                      checked={a.active}
                      onChange={() => handleToggle(a.id)}
                      style={{ position: 'absolute', opacity: 0, width: 44, height: 24, margin: 0, cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        inset: 0,
                        backgroundColor: a.active ? '#22c55e' : '#ccc',
                        borderRadius: 24,
                        transition: 'background-color 0.2s',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        height: 18,
                        width: 18,
                        left: a.active ? 22 : 3,
                        bottom: 3,
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        transition: 'left 0.2s',
                      }}
                    />
                  </label>
                </td>
                <td style={{ padding: '8px 12px' }} data-testid="sent-count">
                  {a.sentCount}
                </td>
                <td style={{ padding: '8px 12px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    data-testid="automation-delete"
                    onClick={() => handleDelete(a.id)}
                    style={{
                      padding: '4px 10px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
