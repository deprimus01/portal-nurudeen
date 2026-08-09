'use client';

import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: compact ? 40 : 60,
        height: 32,
        borderRadius: 20,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        padding: 3,
        cursor: 'pointer',
        justifyContent: compact ? 'center' : isDark ? 'flex-end' : 'flex-start',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {!compact && (
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          style={{
            position: 'absolute',
            top: 3,
            left: isDark ? 31 : 3,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: isDark
              ? 'linear-gradient(135deg,#334155,#0f172a)'
              : 'linear-gradient(135deg,#FDE68A,#F59E0B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          }}
        >
          {isDark ? <Moon size={13} color="#fff" /> : <Sun size={13} color="#fff" />}
        </motion.div>
      )}
      {compact && (isDark ? <Moon size={15} /> : <Sun size={15} />)}
    </button>
  );
}
