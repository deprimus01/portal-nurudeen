'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CornerDownLeft, Search, X } from 'lucide-react';
import type { CommandAction } from '../../lib/commandActions';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
  secondaryActions?: CommandAction[];
  roleLabel: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

function matches(action: CommandAction, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (action.label.toLowerCase().includes(q)) return true;
  return (action.keywords || []).some((k) => k.toLowerCase().includes(q));
}

export function CommandCenter({ isOpen, onClose, actions, secondaryActions = [], roleLabel }: CommandCenterProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const all = [...actions, ...secondaryActions];
    if (!query.trim()) return all;
    return all.filter((a) => matches(a, query));
  }, [actions, secondaryActions, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // focus after the open animation mounts the input
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(action: CommandAction) {
    onClose();
    router.push(action.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) go(chosen);
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

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
            aria-label="Command center"
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
                placeholder={`Search ${roleLabel.toLowerCase()} actions…`}
                aria-label="Search actions"
              />
              <button type="button" className="cmdk-close" onClick={onClose} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            <div className="cmdk-list" ref={listRef}>
              {results.length === 0 ? (
                <div className="cmdk-empty">No matching actions</div>
              ) : (
                results.map((action, idx) => {
                  const Icon = action.icon;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      data-idx={idx}
                      className={`cmdk-item${active ? ' active' : ''}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(action)}
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
                })
              )}
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
