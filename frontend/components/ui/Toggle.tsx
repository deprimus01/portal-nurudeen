'use client';

import { motion } from 'framer-motion';

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: 44,
        height: 26,
        borderRadius: 20,
        border: '1px solid var(--border)',
        background: checked ? 'var(--blue)' : 'var(--surface-2)',
        padding: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        position: 'relative',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.18s ease, border-color 0.18s ease',
      }}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}
