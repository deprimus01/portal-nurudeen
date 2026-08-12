'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Recompute the panel's fixed-position coordinates from the trigger's
  // on-screen position so it can render in a portal, above the table
  // instead of being clipped by the table wrap's overflow.
  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (align === 'left') {
      setCoords({ top: rect.bottom + 6, left: rect.left });
    } else {
      setCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapRef.current && !wrapRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onReposition() {
      updateCoords();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open]);

  if (items.length === 0) return null;

  const panel = open && coords && (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="menu"
          className="dt-menu-panel dt-menu-portal"
          style={{ top: coords.top, left: coords.left, right: coords.right }}
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
    );

  return (
    <div className="dt-menu-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
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
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
