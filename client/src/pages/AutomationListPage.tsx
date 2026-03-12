import { useState, useEffect, useCallback } from 'react';
import type { Event, Automation } from '../types/index.ts';
import { getEvents } from '../services/events.ts';
import { getAutomations, toggleAutomation, deleteAutomation } from '../services/automations.ts';

const TRIGGER_LABELS: Record<Automation['triggerType'], string> = {
  after_purchase: 'After purchase',
  before_event: 'Before event',
  after_event: 'After event',
  reminder: 'Reminder',
};

const TRIGGER_BADGE: Record<Automation['triggerType'], string> = {
  after_purchase: 'badge badge-after-purchase',
  before_event: 'badge badge-before-event',
  after_event: 'badge badge-after-event',
  reminder: 'badge badge-reminder',
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

  useEffect(() => { loadAutomations(); }, [loadAutomations]);

  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleAutomation(id);
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: updated.active } : a))
      );
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this automation?')) return;
    try {
      await deleteAutomation(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) { console.error(err); }
  };

  const activeCount = automations.filter((a) => a.active).length;
  const totalSent = automations.reduce((sum, a) => sum + a.sentCount, 0);

  const renderToggle = (a: Automation) => (
    <label className="toggle-switch">
      <input
        type="checkbox"
        data-testid="automation-toggle"
        checked={a.active}
        onChange={() => handleToggle(a.id)}
      />
      <span className={`toggle-track ${a.active ? 'toggle-track--on' : 'toggle-track--off'}`} />
      <span className={`toggle-knob ${a.active ? 'toggle-knob--on' : 'toggle-knob--off'}`} />
    </label>
  );

  return (
    <div className="page-container">
      <div className="toolbar">
        <span className="toolbar-label">Event</span>
        <select
          id="event-selector"
          data-testid="event-selector"
          className="select-styled"
          value={selectedEventId ?? ''}
          onChange={(e) => setSelectedEventId(Number(e.target.value))}
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>

        <div className="toolbar-spacer" />

        <button
          data-testid="add-automation-btn"
          className="btn btn-primary"
          onClick={() => selectedEventId !== null && onAdd(selectedEventId)}
          disabled={selectedEventId === null}
        >
          + Add automation
        </button>
      </div>

      {!loading && automations.length > 0 && (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-value stat-value--accent">{automations.length}</div>
            <div className="stat-label">Campaigns</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-value--green">{activeCount}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-value--muted">{totalSent}</div>
            <div className="stat-label">Emails sent</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <span className="spinner" />
          Loading automations...
        </div>
      ) : automations.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon" role="img" aria-label="mail">{'\u2709\uFE0F'}</span>
          <p className="empty-state-title">No automations yet</p>
          <p className="empty-state-text">
            Create your first email automation to start engaging with attendees.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Trigger</th>
                  <th>Days</th>
                  <th className="col-secondary">Template</th>
                  <th className="col-secondary">Ticket filter</th>
                  <th>Active</th>
                  <th>Sent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {automations.map((a) => (
                  <tr
                    key={a.id}
                    data-testid="automation-row"
                    onClick={() => selectedEventId !== null && onEdit(selectedEventId, a.id)}
                  >
                    <td className="cell-name" data-testid="automation-name">{a.name}</td>
                    <td><span className={TRIGGER_BADGE[a.triggerType]}>{TRIGGER_LABELS[a.triggerType]}</span></td>
                    <td className="cell-muted">{a.daysOffset !== null ? a.daysOffset : '\u2014'}</td>
                    <td className="cell-truncate col-secondary">{a.template?.name ?? '\u2014'}</td>
                    <td className="col-secondary">{a.ticketType?.name ?? 'All'}</td>
                    <td onClick={(e) => e.stopPropagation()}>{renderToggle(a)}</td>
                    <td data-testid="sent-count"><span className="sent-count">{a.sentCount}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        data-testid="automation-delete"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(a.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="automation-cards">
            {automations.map((a) => (
              <div
                key={a.id}
                className="automation-card"
                data-testid="automation-row"
                onClick={() => selectedEventId !== null && onEdit(selectedEventId, a.id)}
              >
                <div className="automation-card-header">
                  <span className="automation-card-name" data-testid="automation-name">{a.name}</span>
                  <span className={TRIGGER_BADGE[a.triggerType]}>{TRIGGER_LABELS[a.triggerType]}</span>
                </div>
                <div className="automation-card-details">
                  {a.template?.name ?? 'No template'} &middot; {a.ticketType?.name ?? 'All tickets'}
                  {a.daysOffset !== null && <> &middot; {a.daysOffset}d</>}
                </div>
                <div className="automation-card-actions">
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {renderToggle(a)}
                    <span style={{ fontSize: 13, color: a.active ? 'var(--green)' : 'var(--text-muted)' }}>
                      {a.active ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <span className="automation-card-sent" data-testid="sent-count">{a.sentCount} sent</span>
                  <button
                    data-testid="automation-delete"
                    className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
