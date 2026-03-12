import { useState, useEffect, useCallback } from 'react';
import type { Event, Automation } from '../types/index.ts';
import { getEvents } from '../services/events.ts';
import { getAutomations, toggleAutomation, deleteAutomation, duplicateAutomation } from '../services/automations.ts';

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

function formatDuration(totalMinutes: number | null): string {
  if (totalMinutes === null) return '\u2014';
  if (totalMinutes === 0) return 'Immediately';
  if (totalMinutes % 10080 === 0) { const v = totalMinutes / 10080; return `${v}w`; }
  if (totalMinutes % 1440 === 0) { const v = totalMinutes / 1440; return `${v}d`; }
  if (totalMinutes % 60 === 0) { const v = totalMinutes / 60; return `${v}h`; }
  return `${totalMinutes}min`;
}

interface Props {
  onAdd: (eventId: number) => void;
  onEdit: (eventId: number, automationId: number) => void;
}

export default function AutomationListPage({ onAdd, onEdit }: Props) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);

  // Table filters
  const [filterName, setFilterName] = useState('');
  const [filterTrigger, setFilterTrigger] = useState<string>('');
  const [filterTiming, setFilterTiming] = useState<string>('');
  const [filterTemplate, setFilterTemplate] = useState<string>('');
  const [filterTicket, setFilterTicket] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [filterSent, setFilterSent] = useState<string>('');
  const [sortCol, setSortCol] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

  const handleDuplicate = async (id: number) => {
    try {
      await duplicateAutomation(id);
      loadAutomations();
    } catch (err) { console.error(err); }
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIndicator = (col: string) =>
    sortCol === col ? <span className="sort-indicator">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span> : null;

  // Derive unique values for dropdown filters
  const uniqueTemplates = [...new Set(automations.map((a) => a.template?.name).filter(Boolean))] as string[];
  const uniqueTickets = [...new Set(automations.map((a) => a.ticketType?.name).filter(Boolean))] as string[];
  const uniqueTimings = [...new Set(automations.map((a) => formatDuration(a.daysOffset)))];

  const filtered = automations.filter((a) => {
    if (filterName && !a.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterTrigger && a.triggerType !== filterTrigger) return false;
    if (filterTiming && formatDuration(a.daysOffset) !== filterTiming) return false;
    if (filterTemplate) {
      const tplName = a.template?.name ?? '';
      if (filterTemplate === '__none__' ? tplName !== '' : tplName !== filterTemplate) return false;
    }
    if (filterTicket) {
      const tktName = a.ticketType?.name ?? '';
      if (filterTicket === '__all__' ? tktName !== '' : tktName !== filterTicket) return false;
    }
    if (filterActive === 'active' && !a.active) return false;
    if (filterActive === 'inactive' && a.active) return false;
    if (filterSent) {
      if (filterSent === '0' && a.sentCount !== 0) return false;
      if (filterSent === '1+' && a.sentCount < 1) return false;
      if (filterSent === '10+' && a.sentCount < 10) return false;
      if (filterSent === '100+' && a.sentCount < 100) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortCol) {
      case 'name':
        return dir * a.name.localeCompare(b.name);
      case 'triggerType':
        return dir * a.triggerType.localeCompare(b.triggerType);
      case 'daysOffset': {
        const aVal = a.daysOffset ?? (sortDir === 'asc' ? Infinity : -Infinity);
        const bVal = b.daysOffset ?? (sortDir === 'asc' ? Infinity : -Infinity);
        return dir * (Number(aVal) - Number(bVal));
      }
      case 'active':
        return dir * (Number(a.active) - Number(b.active));
      case 'sentCount':
        return dir * (a.sentCount - b.sentCount);
      default:
        return 0;
    }
  });

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
                  <th className="th-sortable" onClick={() => handleSort('name')}>Campaign{sortIndicator('name')}</th>
                  <th className="th-sortable" onClick={() => handleSort('triggerType')}>Trigger{sortIndicator('triggerType')}</th>
                  <th className="th-sortable" onClick={() => handleSort('daysOffset')}>Timing{sortIndicator('daysOffset')}</th>
                  <th className="col-secondary">Template</th>
                  <th className="col-secondary">Ticket filter</th>
                  <th className="th-sortable" onClick={() => handleSort('active')}>Active{sortIndicator('active')}</th>
                  <th className="th-sortable" onClick={() => handleSort('sentCount')}>Sent{sortIndicator('sentCount')}</th>
                  <th></th>
                </tr>
                <tr className="filter-row">
                  <th>
                    <input
                      className="filter-input"
                      type="text"
                      placeholder="Search..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                    />
                  </th>
                  <th>
                    <select
                      className="filter-input"
                      value={filterTrigger}
                      onChange={(e) => setFilterTrigger(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="after_purchase">After purchase</option>
                      <option value="before_event">Before event</option>
                      <option value="after_event">After event</option>
                      <option value="reminder">Reminder</option>
                    </select>
                  </th>
                  <th>
                    <select
                      className="filter-input"
                      value={filterTiming}
                      onChange={(e) => setFilterTiming(e.target.value)}
                    >
                      <option value="">All</option>
                      {uniqueTimings.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </th>
                  <th className="col-secondary">
                    <select
                      className="filter-input"
                      value={filterTemplate}
                      onChange={(e) => setFilterTemplate(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="__none__">No template</option>
                      {uniqueTemplates.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </th>
                  <th className="col-secondary">
                    <select
                      className="filter-input"
                      value={filterTicket}
                      onChange={(e) => setFilterTicket(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="__all__">All tickets</option>
                      {uniqueTickets.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </th>
                  <th>
                    <select
                      className="filter-input"
                      value={filterActive}
                      onChange={(e) => setFilterActive(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </th>
                  <th>
                    <select
                      className="filter-input"
                      value={filterSent}
                      onChange={(e) => setFilterSent(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="0">None (0)</option>
                      <option value="1+">1+</option>
                      <option value="10+">10+</option>
                      <option value="100+">100+</option>
                    </select>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr
                    key={a.id}
                    data-testid="automation-row"
                    onClick={() => selectedEventId !== null && onEdit(selectedEventId, a.id)}
                  >
                    <td className="cell-name" data-testid="automation-name">{a.name}</td>
                    <td><span className={TRIGGER_BADGE[a.triggerType]}>{TRIGGER_LABELS[a.triggerType]}</span></td>
                    <td className="cell-muted">{formatDuration(a.daysOffset)}</td>
                    <td className="cell-truncate col-secondary">{a.template?.name ?? '\u2014'}</td>
                    <td className="col-secondary">{a.ticketType?.name ?? 'All'}</td>
                    <td onClick={(e) => e.stopPropagation()}>{renderToggle(a)}</td>
                    <td data-testid="sent-count"><span className="sent-count">{a.sentCount}</span></td>
                    <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(a.id); }}
                      >
                        Duplicate
                      </button>
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
            {sorted.map((a) => (
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
                  {a.daysOffset !== null && <> &middot; {formatDuration(a.daysOffset)}</>}
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
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(a.id); }}
                  >
                    Duplicate
                  </button>
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
