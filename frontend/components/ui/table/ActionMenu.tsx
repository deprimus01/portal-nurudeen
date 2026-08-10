'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LucideIcon, MoreHorizontal } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Inserts a divider above this item. */
  separatorBefore?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Accessible label for the trigger button, e.g. "Actions for Amina Bello". */
  label?: string;
  align?: 'left' | 'right';
}

// Compact "..." action menu used by every data table row (desktop and
// mobile card view). Keeps row actions out of the way until requested,
// per the "don't clutter the table with buttons" brief.
export function ActionMenu({ items, label = 'Row actions', align = 'right' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="dt-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`dt-menu-trigger${open ? ' dt-menu-open' : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className={`dt-menu-panel${align === 'left' ? ' dt-menu-left' : ''}`}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              const content = (
                <>
                  {Icon && <Icon size={14} />}
                  {item.label}
                </>
              );
              const className = `dt-menu-item${item.danger ? ' dt-menu-item-danger' : ''}`;
              return (
                <div key={item.label + i}>
                  {item.separatorBefore && <div className="dt-menu-divider" />}
                  {item.href ? (
                    <a
                      href={item.href}
                      className={className}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      {content}
                    </a>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className={className}
                      disabled={item.disabled}
                      onClick={() => {
                        setOpen(false);
                        item.onClick?.();
                      }}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
