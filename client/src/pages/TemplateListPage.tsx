import { useState, useEffect, useCallback } from 'react';
import type { EmailTemplate } from '../types/index.ts';
import { getTemplates, deleteTemplate } from '../services/templates.ts';

interface Props {
  onAdd: () => void;
  onEdit: (templateId: number) => void;
}

export default function TemplateListPage({ onAdd, onEdit }: Props) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterName, setFilterName] = useState('');

  const loadTemplates = useCallback(() => {
    setLoading(true);
    getTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

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
        <button
          className="btn btn-primary"
          onClick={onAdd}
        >
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
                  <tr key={t.id} onClick={() => onEdit(t.id)}>
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
                onClick={() => onEdit(t.id)}
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
    </div>
  );
}
