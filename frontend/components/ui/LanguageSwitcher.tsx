'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Languages } from 'lucide-react';
import { useLanguage } from '../../lib/i18n/language-context';
import { LOCALES, LOCALE_LABELS } from '../../lib/i18n/translations';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click/Escape via a scoped listener (matches ActionMenu's
  // pattern) instead of a full-screen backdrop div. A `position: fixed;
  // inset: 0` backdrop sits on top of the *entire* page while open, so any
  // click meant for another button - anywhere on the page - just gets
  // absorbed closing this menu instead of reaching its real target. Since
  // this component renders on both the login page and every role's
  // Settings page, that made the whole page look frozen until refresh.
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

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} ref={wrapRef}>
      <button
        type="button"
        className="shell-icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change language"
        title="Change language"
        style={compact ? undefined : { width: 'auto', padding: '0 10px', gap: 6, display: 'flex', alignItems: 'center' }}
      >
        <Languages size={16} />
        {!compact && <span style={{ fontSize: '0.82rem' }}>{LOCALE_LABELS[locale]}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="shell-profile-menu"
              style={{ right: 0, width: 160, zIndex: 41 }}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16 }}
            >
              {LOCALES.map((l) => (
                <div
                  key={l}
                  className="shell-profile-menu-item"
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => {
                    setLocale(l);
                    setOpen(false);
                  }}
                >
                  <span>{LOCALE_LABELS[l]}</span>
                  {locale === l && <Check size={14} />}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
