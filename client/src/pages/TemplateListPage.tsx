import { useState, useEffect, useCallback } from 'react';
import type { EmailTemplate } from '../types/index.ts';
import { getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate } from '../services/templates.ts';

export default function TemplateListPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    getTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setSubject('');
    setBody('');
    setToast(null);
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    setEditingId(id);
    setToast(null);
    setModalOpen(true);
    try {
      const t = await getTemplate(id);
      setName(t.name);
      setSubject(t.subject);
      setBody(t.body);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: 'Failed to load template.' });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setName('');
    setSubject('');
    setBody('');
    setToast(null);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    setSaving(true);
    setToast(null);
    const data = { name: name.trim(), subject: subject.trim(), body: body.trim() };
    try {
      if (editingId !== null) {
        await updateTemplate(editingId, data);
      } else {
        await createTemplate(data);
      }
      closeModal();
      loadTemplates();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) { console.error(err); }
  };

  const filtered = templates.filter((t) => {
    if (filterName && !t.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="page-container">
      <div className="toolbar">
        <span className="toolbar-label">Email Templates</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>
          + Add template
        </button>
      </div>

      {!loading && templates.length > 0 && (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-value stat-value--accent">{templates.length}</div>
            <div className="stat-label">Templates</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <span className="spinner" />
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon" role="img" aria-label="template">{'\uD83D\uDCDD'}</span>
          <p className="empty-state-title">No templates yet</p>
          <p className="empty-state-text">
            Create your first email template to use in automations.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th className="col-secondary">Body preview</th>
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
                  <th></th>
                  <th className="col-secondary"></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} onClick={() => openEdit(t.id)}>
                    <td className="cell-name">{t.name}</td>
                    <td className="cell-truncate">{t.subject}</td>
                    <td className="cell-truncate col-secondary">{t.body.substring(0, 80)}{t.body.length > 80 ? '...' : ''}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(t.id)}
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
            {filtered.map((t) => (
              <div
                key={t.id}
                className="automation-card"
                onClick={() => openEdit(t.id)}
              >
                <div className="automation-card-header">
                  <span className="automation-card-name">{t.name}</span>
                </div>
                <div className="automation-card-details">
                  {t.subject}
                </div>
                <div className="automation-card-actions">
                  <span className="automation-card-sent" style={{ flex: 1 }}>
                    {t.body.substring(0, 60)}{t.body.length > 60 ? '...' : ''}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal overlay ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId !== null ? 'Edit Template' : 'New Template'}</h2>
              <button className="modal-close" onClick={closeModal} aria-label="Close">&times;</button>
            </div>

            {toast && (
              <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ margin: '0 24px 12px' }}>
                {toast.type === 'success' ? '\u2713' : '\u2717'} {toast.text}
              </div>
            )}

            <div className="modal-body">
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

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
              >
                {saving ? 'Saving...' : editingId !== null ? 'Update template' : 'Create template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
