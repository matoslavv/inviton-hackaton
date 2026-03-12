import { useState, useEffect, useCallback } from 'react';
import type { Event, Automation, EmailTemplate, TicketType } from '../types/index.ts';
import { getEvents } from '../services/events.ts';
import {
  getAutomations, createAutomation, updateAutomation,
  toggleAutomation, deleteAutomation, duplicateAutomation,
  sendTestEmail, getAutomationLogs,
} from '../services/automations.ts';
import type { AutomationLog } from '../services/automations.ts';
import { getTemplates } from '../services/templates.ts';
import { getTicketTypes } from '../services/ticketTypes.ts';
import { uploadPdf } from '../services/upload.ts';

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

// ── Duration picker helpers ──────────────────────────────────────────
type TriggerType = Automation['triggerType'];
type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'after_purchase', label: 'After purchase' },
  { value: 'before_event', label: 'Before event' },
  { value: 'after_event', label: 'After event' },
  { value: 'reminder', label: 'Reminder (tickets)' },
];

const UNIT_OPTIONS: { value: DurationUnit; label: string; short: string; minutes: number; max: number; step: number }[] = [
  { value: 'minutes', label: 'Minutes', short: 'min', minutes: 1, max: 120, step: 5 },
  { value: 'hours', label: 'Hours', short: 'hr', minutes: 60, max: 72, step: 1 },
  { value: 'days', label: 'Days', short: 'd', minutes: 1440, max: 30, step: 1 },
  { value: 'weeks', label: 'Weeks', short: 'wk', minutes: 10080, max: 12, step: 1 },
];

function minutesToBestUnit(totalMinutes: number): { value: number; unit: DurationUnit } {
  if (totalMinutes === 0) return { value: 0, unit: 'days' };
  if (totalMinutes % 10080 === 0) return { value: totalMinutes / 10080, unit: 'weeks' };
  if (totalMinutes % 1440 === 0) return { value: totalMinutes / 1440, unit: 'days' };
  if (totalMinutes % 60 === 0) return { value: totalMinutes / 60, unit: 'hours' };
  return { value: totalMinutes, unit: 'minutes' };
}

function unitToMinutes(value: number, unit: DurationUnit): number {
  const multiplier = UNIT_OPTIONS.find((u) => u.value === unit)!.minutes;
  return Math.round(value * multiplier);
}

function formatEquivalent(totalMinutes: number): string[] {
  if (totalMinutes === 0) return [];
  const parts: string[] = [];
  let rem = totalMinutes;
  if (rem >= 10080) { const w = Math.floor(rem / 10080); parts.push(`${w}w`); rem %= 10080; }
  if (rem >= 1440) { const d = Math.floor(rem / 1440); parts.push(`${d}d`); rem %= 1440; }
  if (rem >= 60) { const h = Math.floor(rem / 60); parts.push(`${h}h`); rem %= 60; }
  if (rem > 0) parts.push(`${rem}m`);
  return parts;
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    created: 'Created', updated: 'Updated', toggled: 'Toggled',
    deleted: 'Deleted', duplicated: 'Duplicated', test_sent: 'Test sent',
  };
  return map[action] ?? action;
}

const PRESETS = [
  { label: 'Instant', value: 0, unit: 'minutes' as DurationUnit, icon: '\u26A1' },
  { label: '30 min', value: 30, unit: 'minutes' as DurationUnit, icon: '' },
  { label: '1 hour', value: 1, unit: 'hours' as DurationUnit, icon: '' },
  { label: '1 day', value: 1, unit: 'days' as DurationUnit, icon: '' },
  { label: '3 days', value: 3, unit: 'days' as DurationUnit, icon: '' },
  { label: '1 week', value: 1, unit: 'weeks' as DurationUnit, icon: '' },
  { label: '2 weeks', value: 2, unit: 'weeks' as DurationUnit, icon: '' },
];

export default function AutomationListPage() {
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

  // ── Modal / form state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('after_purchase');
  const [durationValue, setDurationValue] = useState<number>(0);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [ticketTypeId, setTicketTypeId] = useState<number | ''>('');
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [showTestInput, setShowTestInput] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);

  const isReminder = triggerType === 'reminder';
  const totalMinutes = unitToMinutes(durationValue, durationUnit);

  // ── List data loading ──
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

  // ── Modal open / close ──
  const resetForm = () => {
    setFormName('');
    setTriggerType('after_purchase');
    setDurationValue(0);
    setDurationUnit('days');
    setTemplateId('');
    setTicketTypeId('');
    setPdfPath(null);
    setPdfError(null);
    setTestEmail('');
    setShowTestInput(false);
    setToast(null);
    setLogs([]);
  };

  const openCreate = () => {
    if (selectedEventId === null) return;
    setEditingId(null);
    resetForm();
    setModalOpen(true);
    getTemplates().then(setTemplates).catch(console.error);
    getTicketTypes(selectedEventId).then(setTicketTypes).catch(console.error);
  };

  const openEdit = (automationId: number) => {
    if (selectedEventId === null) return;
    setEditingId(automationId);
    resetForm();
    setModalOpen(true);
    getTemplates().then(setTemplates).catch(console.error);
    getTicketTypes(selectedEventId).then(setTicketTypes).catch(console.error);
    getAutomations(selectedEventId)
      .then((list) => {
        const found = list.find((a) => a.id === automationId);
        if (found) {
          setFormName(found.name);
          setTriggerType(found.triggerType);
          if (found.daysOffset !== null) {
            const { value, unit } = minutesToBestUnit(found.daysOffset);
            setDurationValue(value);
            setDurationUnit(unit);
          }
          setTemplateId(found.templateId);
          setTicketTypeId(found.ticketTypeId ?? '');
          setPdfPath(found.pdfPath);
        }
      })
      .catch(console.error);
    getAutomationLogs(automationId).then(setLogs).catch(console.error);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    resetForm();
  };

  // ── Form handlers ──
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setPdfError('File size must be under 2 MB');
      e.target.value = '';
      return;
    }
    try {
      const result = await uploadPdf(file);
      setPdfPath(result.path);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || selectedEventId === null) return;
    setSaving(true);
    setToast(null);
    const data: Partial<Automation> = {
      name: formName.trim(),
      triggerType,
      daysOffset: isReminder ? null : totalMinutes,
      templateId: templateId === '' ? undefined : templateId,
      ticketTypeId: isReminder ? null : (ticketTypeId === '' ? null : ticketTypeId as number),
      pdfPath: isReminder ? null : pdfPath,
    };
    try {
      if (editingId !== null) {
        await updateAutomation(editingId, data);
      } else {
        await createAutomation(selectedEventId, data);
      }
      closeModal();
      loadAutomations();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim() || editingId === null) return;
    setTestSending(true);
    setToast(null);
    try {
      await sendTestEmail(editingId, testEmail.trim());
      setToast({ type: 'success', text: 'Test email sent!' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: 'Failed to send test email.' });
    } finally {
      setTestSending(false);
    }
  };

  // ── Duration picker derived state ──
  const currentUnitOpt = UNIT_OPTIONS.find((u) => u.value === durationUnit)!;
  const sliderMax = currentUnitOpt.max;
  const sliderStep = currentUnitOpt.step;
  const sliderPercent = sliderMax > 0 ? Math.min((durationValue / sliderMax) * 100, 100) : 0;
  const equivalentParts = formatEquivalent(totalMinutes);

  const handleStep = (delta: number) => setDurationValue((prev) => Math.max(0, prev + delta));
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => setDurationValue(Number(e.target.value));

  const handleUnitTab = (unit: DurationUnit) => {
    const currentMinutes = unitToMinutes(durationValue, durationUnit);
    const newUnitOpt = UNIT_OPTIONS.find((u) => u.value === unit)!;
    const converted = currentMinutes / newUnitOpt.minutes;
    const rounded = unit === 'minutes' ? Math.round(converted) : Math.round(converted * 10) / 10;
    setDurationUnit(unit);
    setDurationValue(Math.max(0, rounded));
  };

  const triggerLabel = triggerType === 'after_purchase' ? 'after purchase'
    : triggerType === 'before_event' ? 'before event' : 'after event';
  const triggerIcon = triggerType === 'after_purchase' ? '\uD83D\uDED2'
    : triggerType === 'before_event' ? '\u23F3' : '\u2705';

  // ── List handlers ──
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
      case 'name': return dir * a.name.localeCompare(b.name);
      case 'triggerType': return dir * a.triggerType.localeCompare(b.triggerType);
      case 'daysOffset': {
        const aVal = a.daysOffset ?? (sortDir === 'asc' ? Infinity : -Infinity);
        const bVal = b.daysOffset ?? (sortDir === 'asc' ? Infinity : -Infinity);
        return dir * (Number(aVal) - Number(bVal));
      }
      case 'active': return dir * (Number(a.active) - Number(b.active));
      case 'sentCount': return dir * (a.sentCount - b.sentCount);
      default: return 0;
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
          onClick={openCreate}
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
                    <input className="filter-input" type="text" placeholder="Search..."
                      value={filterName} onChange={(e) => setFilterName(e.target.value)} />
                  </th>
                  <th>
                    <select className="filter-input" value={filterTrigger} onChange={(e) => setFilterTrigger(e.target.value)}>
                      <option value="">All</option>
                      <option value="after_purchase">After purchase</option>
                      <option value="before_event">Before event</option>
                      <option value="after_event">After event</option>
                      <option value="reminder">Reminder</option>
                    </select>
                  </th>
                  <th>
                    <select className="filter-input" value={filterTiming} onChange={(e) => setFilterTiming(e.target.value)}>
                      <option value="">All</option>
                      {uniqueTimings.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </th>
                  <th className="col-secondary">
                    <select className="filter-input" value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)}>
                      <option value="">All</option>
                      <option value="__none__">No template</option>
                      {uniqueTemplates.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </th>
                  <th className="col-secondary">
                    <select className="filter-input" value={filterTicket} onChange={(e) => setFilterTicket(e.target.value)}>
                      <option value="">All</option>
                      <option value="__all__">All tickets</option>
                      {uniqueTickets.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </th>
                  <th>
                    <select className="filter-input" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </th>
                  <th>
                    <select className="filter-input" value={filterSent} onChange={(e) => setFilterSent(e.target.value)}>
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
                  <tr key={a.id} data-testid="automation-row" onClick={() => openEdit(a.id)}>
                    <td className="cell-name" data-testid="automation-name">{a.name}</td>
                    <td><span className={TRIGGER_BADGE[a.triggerType]}>{TRIGGER_LABELS[a.triggerType]}</span></td>
                    <td className="cell-muted">{formatDuration(a.daysOffset)}</td>
                    <td className="cell-truncate col-secondary">{a.template?.name ?? '\u2014'}</td>
                    <td className="col-secondary">{a.ticketType?.name ?? 'All'}</td>
                    <td onClick={(e) => e.stopPropagation()}>{renderToggle(a)}</td>
                    <td data-testid="sent-count"><span className="sent-count">{a.sentCount}</span></td>
                    <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(a.id); }}>
                        Duplicate
                      </button>
                      <button data-testid="automation-delete" className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(a.id)}>
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
              <div key={a.id} className="automation-card" data-testid="automation-row"
                onClick={() => openEdit(a.id)}>
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
                  <button className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(a.id); }}>
                    Duplicate
                  </button>
                  <button data-testid="automation-delete" className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
         Automation create / edit modal
         ══════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId !== null ? 'Edit Automation' : 'New Automation'}</h2>
              <button className="modal-close" onClick={closeModal} aria-label="Close">&times;</button>
            </div>

            {toast && (
              <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ margin: '0 24px 12px' }}>
                {toast.type === 'success' ? '\u2713' : '\u2717'} {toast.text}
              </div>
            )}

            <div className="modal-body">
              {/* ── Basic info ── */}
              <div className="form-section">
                <div className="form-section-title">Basic info</div>
                <div className="form-field">
                  <label htmlFor="campaign-name">Campaign name</label>
                  <input
                    id="campaign-name"
                    data-testid="campaign-name-input"
                    className="form-input"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. VIP Welcome Package"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="trigger-type">Trigger</label>
                  <select
                    id="trigger-type"
                    data-testid="trigger-type-select"
                    className="form-input"
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                  >
                    {TRIGGER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* ── Smart duration picker ── */}
                {!isReminder && (
                  <div className="form-field">
                    <label>Send timing</label>
                    <div className="duration-picker">
                      <div className="dp-unit-tabs">
                        {UNIT_OPTIONS.map((u) => (
                          <button key={u.value} type="button"
                            className={`dp-unit-tab ${durationUnit === u.value ? 'dp-unit-tab--active' : ''}`}
                            onClick={() => handleUnitTab(u.value)}>
                            {u.label}
                          </button>
                        ))}
                      </div>
                      <div className="dp-stepper">
                        <button type="button" className="dp-stepper-btn"
                          onClick={() => handleStep(-sliderStep)} disabled={durationValue <= 0} aria-label="Decrease">
                          &minus;
                        </button>
                        <div className="dp-stepper-display">
                          <input data-testid="days-offset-input" className="dp-stepper-input" type="number"
                            value={durationValue} onChange={(e) => setDurationValue(Math.max(0, Number(e.target.value)))} min={0} />
                          <span className="dp-stepper-unit">{currentUnitOpt.short}</span>
                        </div>
                        <button type="button" className="dp-stepper-btn"
                          onClick={() => handleStep(sliderStep)} aria-label="Increase">+</button>
                      </div>
                      <div className="dp-slider-wrap">
                        <input type="range" className="dp-slider" min={0} max={sliderMax} step={sliderStep}
                          value={Math.min(durationValue, sliderMax)} onChange={handleSlider}
                          style={{ '--slider-pct': `${sliderPercent}%` } as React.CSSProperties} />
                        <div className="dp-slider-labels">
                          <span>0</span>
                          <span>{Math.round(sliderMax / 2)} {currentUnitOpt.short}</span>
                          <span>{sliderMax} {currentUnitOpt.short}</span>
                        </div>
                      </div>
                      <div className="dp-presets">
                        {PRESETS.map((p) => {
                          const presetMinutes = unitToMinutes(p.value, p.unit);
                          const isActive = totalMinutes === presetMinutes;
                          return (
                            <button key={p.label} type="button"
                              className={`duration-preset ${isActive ? 'duration-preset--active' : ''}`}
                              onClick={() => { setDurationValue(p.value); setDurationUnit(p.unit); }}>
                              {p.icon && <span className="dp-preset-icon">{p.icon}</span>}
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className={`dp-summary ${totalMinutes === 0 ? 'dp-summary--instant' : ''}`}>
                        <div className="dp-summary-main">
                          <span className="dp-summary-icon">{totalMinutes === 0 ? '\u26A1' : triggerIcon}</span>
                          <span>
                            {totalMinutes === 0
                              ? <>Email sent <strong>immediately</strong> {triggerLabel}</>
                              : <>Email sent <strong>{durationValue} {currentUnitOpt.label.toLowerCase()}</strong> {triggerLabel}</>}
                          </span>
                        </div>
                        {totalMinutes > 0 && equivalentParts.length > 0 && (
                          <div className="dp-summary-equiv">
                            = {equivalentParts.join(' ')} ({totalMinutes.toLocaleString()} total min)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Template & targeting ── */}
              <div className="form-section">
                <div className="form-section-title">Template & targeting</div>
                <div className="form-field">
                  <label htmlFor="template">Email template</label>
                  <select id="template" data-testid="template-select" className="form-input"
                    value={templateId} onChange={(e) => setTemplateId(e.target.value === '' ? '' : Number(e.target.value))}>
                    <option value="">&mdash; Select template &mdash;</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                {!isReminder && (
                  <div className="form-field">
                    <label htmlFor="ticket-type">Ticket type filter</label>
                    <select id="ticket-type" data-testid="ticket-type-select" className="form-input"
                      value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value === '' ? '' : Number(e.target.value))}>
                      <option value="">All ticket types</option>
                      {ticketTypes.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* ── Attachment ── */}
              {!isReminder && (
                <div className="form-section">
                  <div className="form-section-title">Attachment</div>
                  <div className="form-field">
                    <label htmlFor="pdf-upload">PDF file (max 2 MB)</label>
                    <input id="pdf-upload" data-testid="pdf-upload" type="file" accept=".pdf" onChange={handlePdfChange} />
                    {pdfError && <span data-testid="pdf-error" className="form-error">{pdfError}</span>}
                    {pdfPath && !pdfError && <span className="form-success">Uploaded: {pdfPath}</span>}
                  </div>
                </div>
              )}

              {/* ── Test preview ── */}
              {editingId !== null && (
                <>
                  <hr className="form-divider" />
                  <div className="form-field">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowTestInput(!showTestInput)}>
                      Send test preview
                    </button>
                    {showTestInput && (
                      <div className="test-row">
                        <input data-testid="test-email-input" className="form-input" type="email"
                          value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
                        <button data-testid="send-test-btn" className="btn btn-primary"
                          onClick={handleSendTest} disabled={testSending || !testEmail.trim()}>
                          {testSending ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Activity log ── */}
              {editingId !== null && logs.length > 0 && (
                <div className="form-section">
                  <div className="form-section-title">Activity log</div>
                  <div className="activity-log">
                    {logs.map(log => (
                      <div key={log.id} className="activity-log-item">
                        <span className="activity-log-action">{formatAction(log.action)}</span>
                        {log.detail && <span className="activity-log-detail">{log.detail}</span>}
                        <span className="activity-log-time">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button data-testid="save-btn" className="btn btn-primary"
                onClick={handleSave} disabled={saving || !formName.trim()}>
                {saving ? 'Saving...' : editingId !== null ? 'Update automation' : 'Create automation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
