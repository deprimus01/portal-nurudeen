'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, LucideIcon, Search } from 'lucide-react';
import { ActionMenu, ActionMenuItem } from './ActionMenu';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Enables sorting on this column. Return the raw comparable value (not the rendered node). */
  sortAccessor?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  /** Where this column's value lands in the mobile card layout. Defaults to 'field'. */
  cardRole?: 'title' | 'subtitle' | 'field' | 'hidden';
  cardLabel?: string;
}

export interface DataTableBulkAction<T> {
  label: string;
  icon?: LucideIcon;
  onClick: (rows: T[]) => void;
  danger?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyState: ReactNode;
  /** Controlled search (e.g. hits the backend). If provided, `rows` is assumed pre-filtered. */
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  /** Uncontrolled/client-side search - provide the text to match against for each row. */
  searchKeys?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra filter chips/selects the page wants next to the search box. */
  filters?: ReactNode;
  pageSize?: number;
  selectable?: boolean;
  bulkActions?: DataTableBulkAction<T>[];
  actions?: (row: T) => ActionMenuItem[];
  renderCard?: (row: T, actionsMenu: ReactNode) => ReactNode;
  rowClassName?: (row: T) => string;
  /** Hides the toolbar entirely (search/filters) - use when the page has nothing to search or filter. */
  hideToolbar?: boolean;
  /**
   * Opt-in server-driven mode for large datasets. When provided, `rows` is
   * assumed to be exactly one already-sorted page of data from the API
   * (not the full dataset) - the table stops doing its own client-side
   * search/sort/slice and instead calls back up to the page for each of
   * those, showing `totalCount`/`page`/`totalPages` from the server
   * response. Omit this prop entirely for the original fully-client-side
   * behavior (small/medium lists fetched in full) - every existing caller
   * that doesn't pass it keeps working exactly as before.
   */
  serverPagination?: {
    page: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    sort?: { key: string; dir: 'asc' | 'desc' } | null;
    onSortChange?: (sort: { key: string; dir: 'asc' | 'desc' } | null) => void;
  };
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function initialsOf(text: string) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  skeletonRows = 5,
  emptyState,
  searchValue,
  onSearchChange,
  searchKeys,
  searchPlaceholder = 'Search…',
  filters,
  pageSize = 10,
  selectable = false,
  bulkActions,
  actions,
  renderCard,
  rowClassName,
  hideToolbar = false,
  serverPagination,
}: DataTableProps<T>) {
  const isControlledSearch = onSearchChange !== undefined;
  const isServerMode = !!serverPagination;
  const [internalQuery, setInternalQuery] = useState('');
  const [internalSort, setInternalSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [internalPage, setInternalPage] = useState(1);
  // Stores full row snapshots, not just ids, so a bulk action still has
  // the data for a row selected on a previous page after server mode has
  // replaced `rows` with the next page's data (a plain Set<id> would
  // silently lose those rows once they're no longer in `rows`).
  const [selectedMap, setSelectedMap] = useState<Map<string, T>>(new Map());

  const sort = isServerMode ? serverPagination.sort ?? null : internalSort;
  const page = isServerMode ? serverPagination.page : internalPage;

  const query = isControlledSearch ? searchValue || '' : internalQuery;
  const hasSearch = isControlledSearch || !!searchKeys;

  const searched = useMemo(() => {
    if (isServerMode || isControlledSearch || !searchKeys || !internalQuery.trim()) return rows;
    const q = internalQuery.trim().toLowerCase();
    return rows.filter((r) => searchKeys(r).toLowerCase().includes(q));
  }, [rows, searchKeys, internalQuery, isControlledSearch, isServerMode]);

  const sorted = useMemo(() => {
    // Server mode: `rows` arrives pre-sorted from the API - re-sorting a
    // single page client-side would only reorder those ~10-50 rows, not
    // the full dataset, so this step is skipped entirely.
    if (isServerMode || !sort) return searched;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return searched;
    const copy = [...searched];
    copy.sort((a, b) => {
      const cmp = compareValues(col.sortAccessor!(a), col.sortAccessor!(b));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [searched, sort, columns, isServerMode]);

  const totalCount = isServerMode ? serverPagination.totalCount : sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const signature = `${rows.length}|${query}`;

  useEffect(() => {
    if (isServerMode) return;
    setInternalPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    if (isServerMode) return;
    if (internalPage > totalPages) setInternalPage(totalPages);
  }, [internalPage, totalPages, isServerMode]);

  const paged = useMemo(() => {
    // Server mode: `rows` already IS the current page.
    if (isServerMode) return sorted;
    return sorted.slice((internalPage - 1) * pageSize, internalPage * pageSize);
  }, [sorted, internalPage, pageSize, isServerMode]);

  function goToPage(next: number) {
    if (isServerMode) serverPagination.onPageChange(next);
    else setInternalPage(next);
  }

  function toggleSort(key: string) {
    const next = (() => {
      if (!sort || sort.key !== key) return { key, dir: 'asc' as const };
      if (sort.dir === 'asc') return { key, dir: 'desc' as const };
      return null;
    })();
    if (isServerMode) serverPagination.onSortChange?.(next);
    else setInternalSort(next);
  }

  function toggleRow(id: string, row: T) {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, row);
      return next;
    });
  }

  const pageIds = paged.map(getRowId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedMap.has(id));

  function toggleSelectAllOnPage() {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        paged.forEach((row) => next.set(getRowId(row), row));
      }
      return next;
    });
  }

  const selectedRows = Array.from(selectedMap.values());
  const colCount = columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0);

  function renderAutoCard(row: T, id: string, actionsMenu: ReactNode) {
    const titleCol = columns.find((c) => c.cardRole === 'title') || columns[0];
    const subtitleCol = columns.find((c) => c.cardRole === 'subtitle');
    const fieldCols = columns.filter(
      (c) => c !== titleCol && c !== subtitleCol && c.cardRole !== 'hidden',
    );
    const titleText = titleCol.render ? titleCol.render(row) : String((row as any)[titleCol.key] ?? '');
    const titlePlain = typeof titleText === 'string' ? titleText : '';

    return (
      <div className={`dt-card${selectedMap.has(id) ? ' dt-row-selected' : ''}`}>
        <div className="dt-card-main">
          {selectable && (
            <div className="dt-card-checkbox">
              <input
                type="checkbox"
                className="dt-checkbox"
                checked={selectedMap.has(id)}
                onChange={() => toggleRow(id, row)}
                aria-label="Select row"
              />
            </div>
          )}
          {titlePlain && (
            <div className="shell-avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>
              {initialsOf(titlePlain).toUpperCase() || '?'}
            </div>
          )}
          <div className="dt-card-body">
            <div className="dt-card-title">{titleText}</div>
            {subtitleCol && (
              <div className="dt-card-subtitle">
                {subtitleCol.render ? subtitleCol.render(row) : String((row as any)[subtitleCol.key] ?? '')}
              </div>
            )}
            <div className="dt-card-fields">
              {fieldCols.map((c) => (
                <span className="dt-card-field" key={c.key}>
                  {c.cardLabel !== '' && <>{c.cardLabel ?? c.label}:</>}{' '}
                  <strong>{c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
        {actionsMenu && <div className="dt-card-actions">{actionsMenu}</div>}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      {!hideToolbar && (hasSearch || filters || rows.length > 0) && (
        <div className="dt-toolbar">
          {hasSearch && (
            <div className="shell-search" style={{ maxWidth: 280, flex: 'none' }}>
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => {
                  if (isControlledSearch) onSearchChange?.(e.target.value);
                  else setInternalQuery(e.target.value);
                }}
                placeholder={searchPlaceholder}
                style={{ border: 'none', background: 'transparent', padding: 0 }}
              />
            </div>
          )}
          {filters && <div className="dt-toolbar-filters">{filters}</div>}
          <div className="dt-toolbar-spacer" />
          {!loading && totalCount > 0 && (
            <span className="dt-count">
              {totalCount} {totalCount === 1 ? 'result' : 'results'}
            </span>
          )}
        </div>
      )}

      {selectable && selectedMap.size > 0 && (
        <div className="dt-bulk-bar">
          <span className="dt-bulk-count">{selectedMap.size} selected</span>
          {bulkActions?.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? 'btn btn-danger' : 'btn btn-outline'}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
              onClick={() => a.onClick(selectedRows)}
            >
              {a.icon && <a.icon size={13} />}
              {a.label}
            </button>
          ))}
          <button type="button" className="dt-bulk-clear" onClick={() => setSelectedMap(new Map())}>
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="dt-skeleton-rows">
          {[...Array(skeletonRows)].map((_, i) => (
            <div key={i} className="dt-skeleton-row">
              <div className="skeleton" style={{ height: 30, width: 30, borderRadius: 8, flexShrink: 0 }} />
              <div className="skeleton" style={{ height: 14, width: `${70 - i * 6}%` }} />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        emptyState
      ) : (
        <>
          <div className="dt-table-view">
            <table>
              <thead>
                <tr>
                  {selectable && (
                    <th className="dt-checkbox-cell">
                      <input
                        type="checkbox"
                        className="dt-checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                  )}
                  {columns.map((c) =>
                    c.sortAccessor ? (
                      <th key={c.key} className="dt-th-sortable" style={{ width: c.width }}>
                        <button
                          type="button"
                          className={`dt-th-btn${sort?.key === c.key ? ' dt-sorted' : ''}`}
                          onClick={() => toggleSort(c.key)}
                          style={{ justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start' }}
                        >
                          {c.label}
                          <span className="dt-th-sort-icon">
                            {sort?.key === c.key ? (
                              sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} />
                            )}
                          </span>
                        </button>
                      </th>
                    ) : (
                      <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
                        {c.label}
                      </th>
                    ),
                  )}
                  {actions && <th className="dt-actions-cell"></th>}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => {
                  const id = getRowId(row);
                  const rowActions = actions?.(row) || [];
                  return (
                    <motion.tr
                      key={id}
                      className={`${selectedMap.has(id) ? 'dt-row-selected ' : ''}${rowClassName?.(row) || ''}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.02 }}
                    >
                      {selectable && (
                        <td className="dt-checkbox-cell">
                          <input
                            type="checkbox"
                            className="dt-checkbox"
                            checked={selectedMap.has(id)}
                            onChange={() => toggleRow(id, row)}
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={c.className} style={{ textAlign: c.align }}>
                          {c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}
                        </td>
                      ))}
                      {actions && (
                        <td className="dt-actions-cell">
                          {rowActions.length > 0 && <ActionMenu items={rowActions} />}
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="dt-card-view">
            <div className="dt-cards">
              {paged.map((row) => {
                const id = getRowId(row);
                const rowActions = actions?.(row) || [];
                const menu = rowActions.length > 0 ? <ActionMenu items={rowActions} /> : null;
                return (
                  <div key={id}>
                    {renderCard ? renderCard(row, menu) : renderAutoCard(row, id, menu)}
                  </div>
                );
              })}
            </div>
          </div>

          {(isServerMode ? totalCount > pageSize : sorted.length > pageSize) && (
            <div className="dt-pagination">
              <span className="dt-pagination-info">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
              </span>
              <div className="dt-pagination-controls">
                <button
                  type="button"
                  className="dt-page-btn"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages })
                  .map((_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<number[]>((acc, p) => {
                    if (acc.length && p - acc[acc.length - 1] > 1) acc.push(-1);
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === -1 ? (
                      <span key={`gap-${i}`} style={{ color: 'var(--muted-2)', fontSize: 12, padding: '0 2px' }}>
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`dt-page-btn${p === page ? ' dt-page-btn-active' : ''}`}
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                <button
                  type="button"
                  className="dt-page-btn"
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
