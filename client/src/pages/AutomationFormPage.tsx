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

interface Props {
  eventId: number;
  automationId: number | null;
  onBack: () => void;
}

export default function AutomationFormPage({ eventId, automationId, onBack }: Props) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('after_purchase');
  const [daysOffset, setDaysOffset] = useState<number>(0);
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

  const isReminder = triggerType === 'reminder';

  // Load templates and ticket types
  useEffect(() => {
    getTemplates().then(setTemplates).catch(console.error);
    getTicketTypes(eventId).then(setTicketTypes).catch(console.error);
  }, [eventId]);

  // Load existing automation for edit
  useEffect(() => {
    if (automationId === null) return;
    getAutomations(eventId)
      .then((list) => {
        const found = list.find((a) => a.id === automationId);
        if (found) {
          setName(found.name);
          setTriggerType(found.triggerType);
          setDaysOffset(found.daysOffset ?? 0);
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
    const data: Partial<Automation> = {
      name: name.trim(),
      triggerType,
      daysOffset: isReminder ? null : daysOffset,
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
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim() || automationId === null) return;
    setTestSending(true);
    try {
      await sendTestEmail(automationId, testEmail.trim());
      alert('Test email sent!');
    } catch (err) {
      console.error(err);
      alert('Failed to send test email');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <button
        data-testid="back-btn"
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginBottom: 16, color: '#2563eb', minHeight: 44 }}
      >
        &larr; Back to list
      </button>

      <div className="form-card" style={{ maxWidth: 600, margin: '0 auto', padding: 32, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
        <h2 style={{ marginTop: 0, marginBottom: 24 }}>
          {automationId !== null ? 'Edit Automation' : 'New Automation'}
        </h2>

        <div className="form-field" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="campaign-name">Campaign name *</label>
          <input
            id="campaign-name"
            data-testid="campaign-name-input"
            className="form-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome email"
            required
            style={{ padding: '8px 12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>

        <div className="form-field" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="trigger-type">Trigger type</label>
          <select
            id="trigger-type"
            data-testid="trigger-type-select"
            className="form-input"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
            style={{ padding: '8px 12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 4 }}
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {!isReminder && (
          <div className="form-field" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="days-offset">Days offset</label>
            <input
              id="days-offset"
              data-testid="days-offset-input"
              className="form-input"
              type="number"
              value={daysOffset}
              onChange={(e) => setDaysOffset(Number(e.target.value))}
              min={0}
              style={{ padding: '8px 12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 4, width: 120 }}
            />
          </div>
        )}

        <div className="form-field" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="template">Email template</label>
          <select
            id="template"
            data-testid="template-select"
            className="form-input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ padding: '8px 12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="">— Select template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {!isReminder && (
          <>
            <div className="form-field" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="ticket-type">Ticket type filter</label>
              <select
                id="ticket-type"
                data-testid="ticket-type-select"
                className="form-input"
                value={ticketTypeId}
                onChange={(e) => setTicketTypeId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ padding: '8px 12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 4 }}
              >
                <option value="">All ticket types</option>
                {ticketTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>{tt.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="pdf-upload">PDF attachment (max 2 MB)</label>
              <input
                id="pdf-upload"
                data-testid="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handlePdfChange}
              />
              {pdfError && (
                <span data-testid="pdf-error" style={{ color: '#ef4444', fontSize: 13 }}>
                  {pdfError}
                </span>
              )}
              {pdfPath && !pdfError && (
                <span style={{ color: '#22c55e', fontSize: 13 }}>Uploaded: {pdfPath}</span>
              )}
            </div>
          </>
        )}

        {automationId !== null && (
          <div className="form-field" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <button
              type="button"
              className="form-btn-secondary"
              onClick={() => setShowTestInput(!showTestInput)}
              style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, padding: '10px 20px', width: 'fit-content' }}
            >
              Send test preview
            </button>
            {showTestInput && (
              <div className="test-email-row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  data-testid="test-email-input"
                  className="form-input"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  style={{ padding: '8px 12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 4, flex: 1 }}
                />
                <button
                  data-testid="send-test-btn"
                  className="form-btn-primary"
                  onClick={handleSendTest}
                  disabled={testSending || !testEmail.trim()}
                  style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}
                >
                  {testSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button
            data-testid="save-btn"
            className="form-btn-primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, opacity: saving || !name.trim() ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
