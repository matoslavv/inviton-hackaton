import { useState, useEffect } from 'react';
import { getTemplate, createTemplate, updateTemplate } from '../services/templates.ts';

interface Props {
  templateId: number | null;
  onBack: () => void;
}

export default function TemplateFormPage({ templateId, onBack }: Props) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (templateId === null) return;
    getTemplate(templateId)
      .then((t) => {
        setName(t.name);
        setSubject(t.subject);
        setBody(t.body);
      })
      .catch(console.error);
  }, [templateId]);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    setSaving(true);
    setToast(null);
    const data = { name: name.trim(), subject: subject.trim(), body: body.trim() };
    try {
      if (templateId !== null) {
        await updateTemplate(templateId, data);
      } else {
        await createTemplate(data);
      }
      onBack();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <button className="btn-ghost" onClick={onBack}>
        &larr; Back to templates
      </button>

      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ maxWidth: 640, margin: '0 auto 16px' }}>
          {toast.type === 'success' ? '\u2713' : '\u2717'} {toast.text}
        </div>
      )}

      <div className="form-card">
        <div className="form-card-header">
          <h2>{templateId !== null ? 'Edit Template' : 'New Template'}</h2>
        </div>

        <div className="form-card-body">
          <div className="form-section">
            <div className="form-section-title">Template details</div>
            <div className="form-field">
              <label htmlFor="template-name">Name</label>
              <input
                id="template-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome Email"
              />
            </div>
            <div className="form-field">
              <label htmlFor="template-subject">Subject</label>
              <input
                id="template-subject"
                className="form-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Welcome to {{event_name}}!"
              />
            </div>
            <div className="form-field">
              <label htmlFor="template-body">Body</label>
              <textarea
                id="template-body"
                className="form-input template-body-input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email content here..."
                rows={12}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
            >
              {saving ? 'Saving...' : templateId !== null ? 'Update template' : 'Create template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
