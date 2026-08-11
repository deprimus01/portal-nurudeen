'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface CommandCenterContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Wire this to <AnimatePresence onExitComplete>: tells the provider the
   *  backdrop/panel have actually finished leaving the DOM, so it's safe
   *  to flush a reopen that arrived mid-exit (see `open` below). */
  onExitComplete: () => void;
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // True while a close() is still animating out (i.e. AnimatePresence is
  // mid-exit for the backdrop/panel). Framer Motion's exit choreography
  // can't cleanly hand off to a fresh enter if isOpen flips back to true
  // before the exit actually finishes - the two lifecycles overlap and
  // can leave a duplicate/orphaned node behind. So instead of setting
  // isOpen straight back to true, a reopen requested during this window
  // is queued and only applied once onExitComplete confirms the previous
  // instance is fully gone.
  const closingRef = useRef(false);
  const pendingOpenRef = useRef(false);

  const open = useCallback(() => {
    if (closingRef.current) {
      pendingOpenRef.current = true;
      return;
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen((prev) => {
      // Only arm the "exit in progress" guard if we're actually
      // transitioning from open -> closed - a no-op close() (already
      // closed) must never leave closingRef stuck true, since nothing
      // will exit to trigger onExitComplete and clear it.
      if (prev) closingRef.current = true;
      return false;
    });
  }, []);

  const onExitComplete = useCallback(() => {
    closingRef.current = false;
    if (pendingOpenRef.current) {
      pendingOpenRef.current = false;
      setIsOpen(true);
    }
  }, []);

  const value = useMemo(
    () => ({ isOpen, open, close, onExitComplete }),
    [isOpen, open, close, onExitComplete],
  );

  return <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>;
}

/**
 * Returns { isOpen, open, close, onExitComplete } when called inside
 * AppShell's tree. Falls back to safe no-ops outside of it so consumers
 * never crash.
 */
export function useCommandCenter(): CommandCenterContextValue {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) {
    return { isOpen: false, open: () => {}, close: () => {}, onExitComplete: () => {} };
  }
  return ctx;
}
