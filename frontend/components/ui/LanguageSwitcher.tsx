'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Languages } from 'lucide-react';
import { useLanguage } from '../../lib/i18n/language-context';
import { LOCALES, LOCALE_LABELS } from '../../lib/i18n/translations';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
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
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setOpen(false)}
            />
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
