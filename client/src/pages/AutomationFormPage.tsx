import { useState, useEffect } from 'react';
import type { Automation, EmailTemplate, TicketType } from '../types/index.ts';
import { getAutomations, createAutomation, updateAutomation, sendTestEmail, getAutomationLogs } from '../services/automations.ts';
import type { AutomationLog } from '../services/automations.ts';
import { getTemplates } from '../services/templates.ts';
import { getTicketTypes } from '../services/ticketTypes.ts';
import { uploadPdf } from '../services/upload.ts';

type TriggerType = Automation['triggerType'];

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'after_purchase', label: 'After purchase' },
  { value: 'before_event', label: 'Before event' },
  { value: 'after_event', label: 'After event' },
  { value: 'reminder', label: 'Reminder (tickets)' },
];

type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';

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
  if (totalMinutes >= 10080) { const w = Math.floor(totalMinutes / 10080); parts.push(`${w}w`); totalMinutes %= 10080; }
  if (totalMinutes >= 1440) { const d = Math.floor(totalMinutes / 1440); parts.push(`${d}d`); totalMinutes %= 1440; }
  if (totalMinutes >= 60) { const h = Math.floor(totalMinutes / 60); parts.push(`${h}h`); totalMinutes %= 60; }
  if (totalMinutes > 0) parts.push(`${totalMinutes}m`);
  return parts;
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    toggled: 'Toggled',
    deleted: 'Deleted',
    duplicated: 'Duplicated',
    test_sent: 'Test sent',
  };
  return map[action] ?? action;
}

interface Props {
  eventId: number;
  automationId: number | null;
  onBack: () => void;
}

export default function AutomationFormPage({ eventId, automationId, onBack }: Props) {
  const [name, setName] = useState('');
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

  useEffect(() => {
    getTemplates().then(setTemplates).catch(console.error);
    getTicketTypes(eventId).then(setTicketTypes).catch(console.error);
  }, [eventId]);

  useEffect(() => {
    if (automationId === null) return;
    getAutomations(eventId)
      .then((list) => {
        const found = list.find((a) => a.id === automationId);
        if (found) {
          setName(found.name);
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
  }, [eventId, automationId]);

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
    if (!name.trim()) return;
    setSaving(true);
    setToast(null);
    const data: Partial<Automation> = {
      name: name.trim(),
      triggerType,
      daysOffset: isReminder ? null : totalMinutes,
      templateId: templateId === '' ? undefined : templateId,
      ticketTypeId: isReminder ? null : (ticketTypeId === '' ? null : ticketTypeId as number),
      pdfPath: isReminder ? null : pdfPath,
    };
    try {
      if (automationId !== null) {
        await updateAutomation(automationId, data);
      } else {
        await createAutomation(eventId, data);
      }
      onBack();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim() || automationId === null) return;
    setTestSending(true);
    setToast(null);
    try {
      await sendTestEmail(automationId, testEmail.trim());
      setToast({ type: 'success', text: 'Test email sent!' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: 'Failed to send test email.' });
    } finally {
      setTestSending(false);
    }
  };

  const currentUnitOpt = UNIT_OPTIONS.find((u) => u.value === durationUnit)!;
  const sliderMax = currentUnitOpt.max;
  const sliderStep = currentUnitOpt.step;
  const sliderPercent = sliderMax > 0 ? Math.min((durationValue / sliderMax) * 100, 100) : 0;

  const equivalentParts = formatEquivalent(totalMinutes);

  const handleStep = (delta: number) => {
    setDurationValue((prev) => Math.max(0, prev + delta));
  };

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationValue(Number(e.target.value));
  };

  const handleUnitTab = (unit: DurationUnit) => {
    // Convert current value to the new unit
    const currentMinutes = unitToMinutes(durationValue, durationUnit);
    const newUnitOpt = UNIT_OPTIONS.find((u) => u.value === unit)!;
    const converted = currentMinutes / newUnitOpt.minutes;
    // Round to reasonable precision
    const rounded = unit === 'minutes' ? Math.round(converted) : Math.round(converted * 10) / 10;
    setDurationUnit(unit);
    setDurationValue(Math.max(0, rounded));
  };

  // Quick presets
  const presets = [
    { label: 'Instant', value: 0, unit: 'minutes' as DurationUnit, icon: '\u26A1' },
    { label: '30 min', value: 30, unit: 'minutes' as DurationUnit, icon: '' },
    { label: '1 hour', value: 1, unit: 'hours' as DurationUnit, icon: '' },
    { label: '1 day', value: 1, unit: 'days' as DurationUnit, icon: '' },
    { label: '3 days', value: 3, unit: 'days' as DurationUnit, icon: '' },
    { label: '1 week', value: 1, unit: 'weeks' as DurationUnit, icon: '' },
    { label: '2 weeks', value: 2, unit: 'weeks' as DurationUnit, icon: '' },
  ];

  const triggerLabel = triggerType === 'after_purchase' ? 'after purchase'
    : triggerType === 'before_event' ? 'before event'
    : 'after event';

  const triggerIcon = triggerType === 'after_purchase' ? '\uD83D\uDED2'
    : triggerType === 'before_event' ? '\u23F3'
    : '\u2705';

  return (
    <div className="page-container">
      <button data-testid="back-btn" className="btn-ghost" onClick={onBack}>
        &larr; Back to list
      </button>

      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ maxWidth: 640, margin: '0 auto 16px' }}>
          {toast.type === 'success' ? '\u2713' : '\u2717'} {toast.text}
        </div>
      )}

      <div className="form-card">
        <div className="form-card-header">
          <h2>{automationId !== null ? 'Edit Automation' : 'New Automation'}</h2>
        </div>

        <div className="form-card-body">
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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                  {/* Unit tabs */}
                  <div className="dp-unit-tabs">
                    {UNIT_OPTIONS.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        className={`dp-unit-tab ${durationUnit === u.value ? 'dp-unit-tab--active' : ''}`}
                        onClick={() => handleUnitTab(u.value)}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>

                  {/* Stepper + input */}
                  <div className="dp-stepper">
                    <button
                      type="button"
                      className="dp-stepper-btn"
                      onClick={() => handleStep(-sliderStep)}
                      disabled={durationValue <= 0}
                      aria-label="Decrease"
                    >
                      &minus;
                    </button>
                    <div className="dp-stepper-display">
                      <input
                        data-testid="days-offset-input"
                        className="dp-stepper-input"
                        type="number"
                        value={durationValue}
                        onChange={(e) => setDurationValue(Math.max(0, Number(e.target.value)))}
                        min={0}
                      />
                      <span className="dp-stepper-unit">{currentUnitOpt.short}</span>
                    </div>
                    <button
                      type="button"
                      className="dp-stepper-btn"
                      onClick={() => handleStep(sliderStep)}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>

                  {/* Slider */}
                  <div className="dp-slider-wrap">
                    <input
                      type="range"
                      className="dp-slider"
                      min={0}
                      max={sliderMax}
                      step={sliderStep}
                      value={Math.min(durationValue, sliderMax)}
                      onChange={handleSlider}
                      style={{ '--slider-pct': `${sliderPercent}%` } as React.CSSProperties}
                    />
                    <div className="dp-slider-labels">
                      <span>0</span>
                      <span>{Math.round(sliderMax / 2)} {currentUnitOpt.short}</span>
                      <span>{sliderMax} {currentUnitOpt.short}</span>
                    </div>
                  </div>

                  {/* Quick presets */}
                  <div className="dp-presets">
                    {presets.map((p) => {
                      const presetMinutes = unitToMinutes(p.value, p.unit);
                      const isActive = totalMinutes === presetMinutes;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          className={`duration-preset ${isActive ? 'duration-preset--active' : ''}`}
                          onClick={() => { setDurationValue(p.value); setDurationUnit(p.unit); }}
                        >
                          {p.icon && <span className="dp-preset-icon">{p.icon}</span>}
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Summary card */}
                  <div className={`dp-summary ${totalMinutes === 0 ? 'dp-summary--instant' : ''}`}>
                    <div className="dp-summary-main">
                      <span className="dp-summary-icon">{totalMinutes === 0 ? '\u26A1' : triggerIcon}</span>
                      <span>
                        {totalMinutes === 0
                          ? <>Email sent <strong>immediately</strong> {triggerLabel}</>
                          : <>Email sent <strong>{durationValue} {currentUnitOpt.label.toLowerCase()}</strong> {triggerLabel}</>
                        }
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
              <select
                id="template"
                data-testid="template-select"
                className="form-input"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">&mdash; Select template &mdash;</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {!isReminder && (
              <div className="form-field">
                <label htmlFor="ticket-type">Ticket type filter</label>
                <select
                  id="ticket-type"
                  data-testid="ticket-type-select"
                  className="form-input"
                  value={ticketTypeId}
                  onChange={(e) => setTicketTypeId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">All ticket types</option>
                  {ticketTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>{tt.name}</option>
                  ))}
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
                <input
                  id="pdf-upload"
                  data-testid="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfChange}
                />
                {pdfError && <span data-testid="pdf-error" className="form-error">{pdfError}</span>}
                {pdfPath && !pdfError && <span className="form-success">Uploaded: {pdfPath}</span>}
              </div>
            </div>
          )}

          {/* ── Test preview ── */}
          {automationId !== null && (
            <>
              <hr className="form-divider" />
              <div className="form-field">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTestInput(!showTestInput)}>
                  Send test preview
                </button>
                {showTestInput && (
                  <div className="test-row">
                    <input
                      data-testid="test-email-input"
                      className="form-input"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="test@example.com"
                    />
                    <button
                      data-testid="send-test-btn"
                      className="btn btn-primary"
                      onClick={handleSendTest}
                      disabled={testSending || !testEmail.trim()}
                    >
                      {testSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Activity log ── */}
          {automationId !== null && logs.length > 0 && (
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

          {/* ── Save ── */}
          <div className="form-actions">
            <button
              data-testid="save-btn"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving...' : automationId !== null ? 'Update automation' : 'Create automation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
