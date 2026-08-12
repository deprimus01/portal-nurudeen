'use client';

import { useEffect, useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Inbox, LucideIcon, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, EmptyStateTone } from './ui/EmptyState';
import { getErrorMessage } from '../lib/errors';
import { DataTable, DataTableColumn } from './ui/table/DataTable';
import type { ActionMenuItem } from './ui/table/ActionMenu';

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
  /** Icon shown in the empty state - defaults to a generic inbox if not provided. */
  emptyIcon?: LucideIcon;
  /** Empty-state heading override - defaults to "No {title} yet". */
  emptyTitle?: string;
  /** Empty-state description override. */
  emptyDescription?: string;
  /** Empty-state icon accent color. */
  emptyTone?: EmptyStateTone;
  /**
   * Extra row-menu items shown above the built-in Edit/Delete, e.g. Move
   * Up/Down for manually-orderable lists. Receives the full loaded list (so
   * an item can find its neighbors) and a `reload` callback to refresh the
   * table after the action's own API call(s) complete.
   */
  extraActions?: (item: any, items: any[], reload: () => Promise<void>) => ActionMenuItem[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function SimpleCrud({
  title,
  description,
  endpoint,
  fields,
  columns,
  emptyDefaults = {},
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyTone = 'blue',
  extraActions,
}: SimpleCrudProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, unknown>>(emptyDefaults);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return '';
    // Deep-link support for the global search feature - lets a search
    // result land here with the matching row already filtered into view.
    return new URLSearchParams(window.location.search).get('q') || '';
  });

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<any[]>(endpoint);
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load.'));
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
      await load();
      setJustSaved(true);
      setTimeout(() => {
        setJustSaved(false);
        closeForm();
      }, 550);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
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
      setError(getErrorMessage(err, 'Failed to delete.'));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete(rows: any[]) {
    if (rows.length === 0) return;
    if (!window.confirm(`Delete ${rows.length} item(s)? This can't be undone.`)) return;
    setError(null);
    try {
      await Promise.all(rows.map((item) => api.delete(`${endpoint}/${item.id}`)));
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete selected items.'));
    }
  }

  const singular = title.replace(/s$/, '');

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{title}</h1>
          {description && <p className="page-sub" style={{ margin: 0 }}>{description}</p>}
        </div>
        <button className="btn" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancel' : `Add ${singular}`}
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
                Editing "{singular}"
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
            <button
              className={`btn${justSaved ? ' btn-flash-success' : ''}`}
              type="submit"
              disabled={submitting}
              style={{ marginTop: '1.1rem' }}
            >
              {submitting ? (
                <span className="login-spinner" aria-hidden="true" />
              ) : justSaved ? (
                <>
                  <Check size={15} /> Saved
                </>
              ) : editingId ? (
                'Save changes'
              ) : (
                'Save'
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {!showForm && error && items.length > 0 && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}

      <DataTable<any>
        rows={items}
        getRowId={(item) => item.id}
        loading={loading}
        selectable
        bulkActions={[{ label: 'Delete selected', icon: Trash2, danger: true, onClick: handleBulkDelete }]}
        searchValue={query}
        onSearchChange={setQuery}
        searchKeys={(item) => columns.map((c) => (c.render ? '' : String(item[c.key] ?? ''))).join(' ')}
        searchPlaceholder={`Search ${title.toLowerCase()}…`}
        emptyState={
          <EmptyState
            icon={emptyIcon || Inbox}
            title={items.length === 0 ? (emptyTitle || `No ${title.toLowerCase()} yet`) : `No matching ${title.toLowerCase()}`}
            description={
              items.length === 0
                ? emptyDescription || `Add your first ${singular.toLowerCase()} to get started.`
                : `No ${title.toLowerCase()} match "${query}".`
            }
            tone={emptyTone}
            action={
              items.length === 0 ? (
                <button className="btn" onClick={() => setShowForm(true)}>
                  <Plus size={15} /> Add {singular}
                </button>
              ) : undefined
            }
          />
        }
        columns={columns.map((c, i) => ({
          key: c.key,
          label: c.label,
          cardRole: i === 0 ? 'title' : i === 1 ? 'subtitle' : 'field',
          sortAccessor: c.render ? undefined : (item: any) => item[c.key],
          render: c.render,
        })) as DataTableColumn<any>[]}
        actions={(item: any) => {
          const items2: ActionMenuItem[] = [
            ...(extraActions?.(item, items, load) || []),
            { label: `Edit`, icon: Pencil, onClick: () => startEdit(item) },
            {
              label: deletingId === item.id ? 'Deleting…' : 'Delete',
              icon: Trash2,
              danger: true,
              disabled: deletingId === item.id,
              onClick: () => handleDelete(item),
              separatorBefore: true,
            },
          ];
          return items2;
        }}
      />
    </div>
  );
}
