'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { EmptyState } from './ui/EmptyState';

interface FieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
}

interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

interface SimpleCrudProps {
  title: string;
  description?: string;
  endpoint: string;
  fields: FieldConfig[];
  columns: Column[];
  emptyDefaults?: Record<string, unknown>;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function SimpleCrud({ title, description, endpoint, fields, columns, emptyDefaults = {} }: SimpleCrudProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, unknown>>(emptyDefaults);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<any[]>(endpoint);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (editingId) {
        await api.patch(`${endpoint}/${editingId}`, form);
      } else {
        await api.post(endpoint, form);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

  function closeForm() {
    setForm(emptyDefaults);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(item: any) {
    const next: Record<string, unknown> = {};
    fields.forEach((f) => {
      next[f.name] = item[f.name] ?? '';
    });
    setForm(next);
    setEditingId(item.id);
    setError(null);
    setShowForm(true);
  }

  async function handleDelete(item: any) {
    if (!window.confirm(`Delete "${item[columns[0]?.key] ?? 'this item'}"? This can't be undone.`)) {
      return;
    }
    setDeletingId(item.id);
    setError(null);
    try {
      await api.delete(`${endpoint}/${item.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) =>
      columns.some((c) => {
        const val = c.render ? '' : item[c.key];
        return String(val ?? '').toLowerCase().includes(q);
      }),
    );
  }, [items, query, columns]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{title}</h1>
          {description && <p className="page-sub" style={{ margin: 0 }}>{description}</p>}
        </div>
        <button className="btn" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancel' : `Add ${title.replace(/s$/, '')}`}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            className="card"
            style={{ marginBottom: '1.5rem', overflow: 'hidden' }}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '1.5rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {editingId && (
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 0.9rem' }}>
                Editing "{title.replace(/s$/, '')}"
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
              {fields.map((f) => (
                <div className="field" key={f.name} style={{ marginBottom: 0 }}>
                  <label htmlFor={f.name}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      id={f.name}
                      required={f.required}
                      value={(form[f.name] as string) || ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    >
                      <option value="" disabled>Select…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={f.name}
                      type={f.type || 'text'}
                      required={f.required}
                      value={(form[f.name] as string) || ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn" type="submit" disabled={submitting} style={{ marginTop: '1.1rem' }}>
              {submitting ? <span className="login-spinner" aria-hidden="true" /> : editingId ? 'Save changes' : 'Save'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="table-wrap">
        {items.length > 0 && (
          <div className="table-toolbar">
            <div className="shell-search" style={{ maxWidth: 280, flex: 'none' }}>
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
                style={{ border: 'none', background: 'transparent', padding: 0 }}
              />
            </div>
            <span className="filter-chip active">{filtered.length} of {items.length}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 18, width: `${90 - i * 8}%` }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={`No ${title.toLowerCase()} yet`}
            description={`Add your first ${title.replace(/s$/, '').toLowerCase()} to get started.`}
            action={
              <button className="btn" onClick={() => setShowForm(true)}>
                <Plus size={15} /> Add {title.replace(/s$/, '')}
              </button>
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.02 }}
                >
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(item) : item[c.key]}</td>
                  ))}
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="shell-icon-btn"
                        onClick={() => startEdit(item)}
                        aria-label={`Edit ${item[columns[0]?.key] ?? 'item'}`}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="shell-icon-btn"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        aria-label={`Delete ${item[columns[0]?.key] ?? 'item'}`}
                        title="Delete"
                        style={{ color: 'var(--danger)' }}
                      >
                        {deletingId === item.id ? (
                          <span className="login-spinner" aria-hidden="true" style={{ width: 14, height: 14 }} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
