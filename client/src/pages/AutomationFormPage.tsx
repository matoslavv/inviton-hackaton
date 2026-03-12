import { useState, useEffect } from 'react';
import type { Automation, EmailTemplate, TicketType } from '../types/index.ts';
import { getAutomations, createAutomation, updateAutomation, sendTestEmail } from '../services/automations.ts';
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

const UNIT_OPTIONS: { value: DurationUnit; label: string; short: string; minutes: number }[] = [
  { value: 'minutes', label: 'Minutes', short: 'min', minutes: 1 },
  { value: 'hours', label: 'Hours', short: 'hr', minutes: 60 },
  { value: 'days', label: 'Days', short: 'd', minutes: 1440 },
  { value: 'weeks', label: 'Weeks', short: 'wk', minutes: 10080 },
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

  // Quick presets
  const presets = [
    { label: '30 min', value: 30, unit: 'minutes' as DurationUnit },
    { label: '1 hour', value: 1, unit: 'hours' as DurationUnit },
    { label: '1 day', value: 1, unit: 'days' as DurationUnit },
    { label: '3 days', value: 3, unit: 'days' as DurationUnit },
    { label: '1 week', value: 1, unit: 'weeks' as DurationUnit },
  ];

  const triggerLabel = triggerType === 'after_purchase' ? 'after purchase'
    : triggerType === 'before_event' ? 'before event'
    : 'after event';

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
                  <div className="duration-picker-inputs">
                    <input
                      data-testid="days-offset-input"
                      className="form-input duration-picker-value"
                      type="number"
                      value={durationValue}
                      onChange={(e) => setDurationValue(Math.max(0, Number(e.target.value)))}
                      min={0}
                    />
                    <select
                      className="form-input duration-picker-unit"
                      value={durationUnit}
                      onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="duration-picker-presets">
                    {presets.map((p) => {
                      const isActive = durationValue === p.value && durationUnit === p.unit;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          className={`duration-preset ${isActive ? 'duration-preset--active' : ''}`}
                          onClick={() => { setDurationValue(p.value); setDurationUnit(p.unit); }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  {durationValue > 0 && (
                    <div className="duration-picker-summary">
                      Email will be sent <strong>{durationValue} {durationUnit}</strong> {triggerLabel}
                    </div>
                  )}
                  {durationValue === 0 && (
                    <div className="duration-picker-summary">
                      Email will be sent <strong>immediately</strong> {triggerLabel}
                    </div>
                  )}
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
