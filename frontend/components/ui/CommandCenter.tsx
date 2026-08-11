'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  Clock3,
  CornerDownLeft,
  FileText,
  Layers,
  Megaphone,
  MessageSquare,
  Search,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { CommandAction } from '../../lib/commandActions';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../lib/auth-context';
import type { SearchResultItem, SearchResultType, SearchResponse } from '../../lib/types';
import { SEARCH_CATEGORY_LABELS, SEARCH_CATEGORY_ORDER, SEARCH_TYPE_LABELS, searchResultHref } from '../../lib/searchNav';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
  secondaryActions?: CommandAction[];
  roleLabel: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const RECENT_KEY_PREFIX = 'nuruddeen_sms_recent_searches_';
const MAX_RECENT = 6;
const DEBOUNCE_MS = 220;
const MIN_QUERY_LENGTH = 2;

const RESULT_TYPE_ICONS: Record<SearchResultType, React.ComponentType<any>> = {
  STUDENT: Users,
  GUARDIAN: UserCheck,
  STAFF: Briefcase,
  CLASS: Layers,
  SUBJECT: BookOpen,
  EXAM: FileText,
  RESULT: Award,
  ANNOUNCEMENT: Megaphone,
  MESSAGE: MessageSquare,
  FEE: Wallet,
};

function matches(action: CommandAction, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (action.label.toLowerCase().includes(q)) return true;
  return (action.keywords || []).some((k) => k.toLowerCase().includes(q));
}

// Flat item the keyboard cursor walks across — either a static quick
// action or a live entity search result, in the same order they render.
type FlatEntry = { kind: 'action'; action: CommandAction } | { kind: 'entity'; item: SearchResultItem };

export function CommandCenter({ isOpen, onClose, actions, secondaryActions = [], roleLabel }: CommandCenterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [entityResults, setEntityResults] = useState<SearchResultItem[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const storageKey = `${RECENT_KEY_PREFIX}${user?.id || 'anon'}`;
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setRecent(raw ? JSON.parse(raw) : []);
    } catch {
      setRecent([]);
    }
  }, [storageKey]);

  const addRecent = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setRecent((prev) => {
        const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // localStorage unavailable (private mode) - recent searches just won't persist.
        }
        return next;
      });
    },
    [storageKey],
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const filteredActions = useMemo(() => {
    const all = [...actions, ...secondaryActions];
    if (!query.trim()) return all;
    return all.filter((a) => matches(a, query));
  }, [actions, secondaryActions, query]);

  // Grouped for display; category order/labels shared with the rest of
  // the search feature (see lib/searchNav.ts).
  const groupedEntities = useMemo(() => {
    const map = new Map<SearchResultType, SearchResultItem[]>();
    for (const item of entityResults) {
      if (!map.has(item.type)) map.set(item.type, []);
      map.get(item.type)!.push(item);
    }
    return SEARCH_CATEGORY_ORDER.filter((t) => map.has(t)).map((t) => ({ type: t, items: map.get(t)! }));
  }, [entityResults]);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const flatList: FlatEntry[] = useMemo(() => {
    const actionEntries: FlatEntry[] = filteredActions.map((action) => ({ kind: 'action', action }));
    const entityEntries: FlatEntry[] = entityResults.map((item) => ({ kind: 'entity', item }));
    // While actively searching, lead with live results (more specific
    // than a generic action) and keep matching quick actions underneath.
    return isSearching ? [...entityEntries, ...actionEntries] : actionEntries;
  }, [filteredActions, entityResults, isSearching]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setEntityResults([]);
      setEntityError(null);
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Debounced live search across Students/Guardians/Staff/Classes/
  // Subjects/Exams/Results/Announcements/Messages/Fees, scoped to what
  // the signed-in role can see (see backend search.routes.js).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isSearching) {
      setEntityResults([]);
      setEntityLoading(false);
      setEntityError(null);
      return;
    }

    setEntityLoading(true);
    setEntityError(null);
    const myRequestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
        if (requestIdRef.current !== myRequestId) return;
        // Defensive fallback, same as elsewhere - but doubly important
        // here: CommandCenter renders inside AppShell itself (the layout,
        // not the page), and Next.js error.tsx boundaries do NOT catch
        // errors thrown by the layout in their own segment - only by the
        // page/children below it. A crash here would bypass even the new
        // app/admin/error.tsx and go straight to the root boundary,
        // unmounting the whole app regardless.
        setEntityResults(data?.results ?? []);
      } catch (err) {
        if (requestIdRef.current !== myRequestId) return;
        setEntityError(getErrorMessage(err, 'Search failed. Try again.'));
        setEntityResults([]);
      } finally {
        if (requestIdRef.current === myRequestId) setEntityLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, isSearching]);

  function goToAction(action: CommandAction) {
    onClose();
    router.push(action.href);
  }

  function goToEntity(item: SearchResultItem) {
    if (!user?.role) return;
    const href = searchResultHref(item, user.role);
    if (!href) return;
    addRecent(trimmedQuery);
    onClose();
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatList.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = flatList[activeIndex];
      if (!chosen) return;
      if (chosen.kind === 'action') goToAction(chosen.action);
      else goToEntity(chosen.item);
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const showRecent = trimmedQuery.length === 0 && recent.length > 0;
  const showEmpty = isSearching && !entityLoading && filteredActions.length === 0 && entityResults.length === 0 && !entityError;

  // activeIndex is a single cursor across [entities..., actions...] (see
  // flatList) - these running indices let each rendered section look up
  // its own slice's active state without recomputing offsets inline.
  let entityBaseIndex = 0;
  const actionBaseIndex = isSearching ? entityResults.length : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="cmdk-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            className="cmdk-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Search and command center"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            onKeyDown={handleKeyDown}
          >
            <div className="cmdk-search">
              <Search size={16} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search students, guardians, classes, results… or run a ${roleLabel.toLowerCase()} action`}
                aria-label="Search"
                autoComplete="off"
                spellCheck={false}
              />
              {entityLoading && <span className="cmdk-spinner" aria-hidden="true" />}
              <button type="button" className="cmdk-close" onClick={onClose} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            <div className="cmdk-list" ref={listRef}>
              {showRecent && (
                <div className="cmdk-section">
                  <div className="cmdk-section-head">
                    <span>Recent searches</span>
                    <button type="button" className="cmdk-clear" onClick={clearRecent}>
                      Clear
                    </button>
                  </div>
                  <div className="cmdk-recent-list">
                    {recent.map((term) => (
                      <button key={term} type="button" className="cmdk-recent-chip" onClick={() => setQuery(term)}>
                        <Clock3 size={12} />
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isSearching && entityLoading && entityResults.length === 0 && (
                <div className="cmdk-skeletons">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="cmdk-skeleton-row">
                      <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: 11, width: '50%', marginBottom: 6 }} />
                        <div className="skeleton" style={{ height: 9, width: '32%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {entityError && <p className="error-text" style={{ padding: '4px 10px' }}>{entityError}</p>}

              {isSearching &&
                groupedEntities.map((group) => {
                  const sectionStartIndex = entityBaseIndex;
                  entityBaseIndex += group.items.length;
                  return (
                    <div className="cmdk-section" key={group.type}>
                      <div className="cmdk-section-head">
                        <span>{SEARCH_CATEGORY_LABELS[group.type]}</span>
                      </div>
                      {group.items.map((item, i) => {
                        const idx = sectionStartIndex + i;
                        const Icon = RESULT_TYPE_ICONS[item.type];
                        const active = idx === activeIndex;
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            data-idx={idx}
                            className={`cmdk-item cmdk-result-item${active ? ' active' : ''}`}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => goToEntity(item)}
                          >
                            <span className="cmdk-item-icon">
                              <Icon size={15} strokeWidth={2} />
                            </span>
                            <span className="cmdk-result-text">
                              <span className="cmdk-result-top">
                                <span className="cmdk-result-type">{SEARCH_TYPE_LABELS[item.type]}</span>
                                <span className="cmdk-item-label">{item.title}</span>
                              </span>
                              {item.subtitle && <span className="cmdk-result-subtitle">{item.subtitle}</span>}
                            </span>
                            {item.meta && <span className="cmdk-result-meta">{item.meta}</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

              {filteredActions.length > 0 && (
                <div className="cmdk-section">
                  {isSearching && (
                    <div className="cmdk-section-head">
                      <span>Actions</span>
                    </div>
                  )}
                  {filteredActions.map((action, i) => {
                    const idx = actionBaseIndex + i;
                    const Icon = action.icon;
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        data-idx={idx}
                        className={`cmdk-item${active ? ' active' : ''}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goToAction(action)}
                      >
                        <span className="cmdk-item-icon">
                          <Icon size={16} />
                        </span>
                        <span className="cmdk-item-label">{action.label}</span>
                        {active ? (
                          <span className="cmdk-item-hint">
                            <CornerDownLeft size={13} />
                          </span>
                        ) : (
                          <span className="cmdk-item-arrow">
                            <ArrowRight size={13} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {showEmpty && (
                <div className="cmdk-empty">No matching actions or results for &ldquo;{trimmedQuery}&rdquo;.</div>
              )}
              {!isSearching && filteredActions.length === 0 && <div className="cmdk-empty">No matching actions</div>}
            </div>

            <div className="cmdk-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> select
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
