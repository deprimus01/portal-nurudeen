'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface CommandCenterContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>;
}

/**
 * Returns { isOpen, open, close } when called inside AppShell's tree.
 * Falls back to safe no-ops outside of it so consumers never crash.
 */
export function useCommandCenter(): CommandCenterContextValue {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) {
    return { isOpen: false, open: () => {}, close: () => {} };
  }
  return ctx;
}
