'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const EASE = [0.16, 1, 0.3, 1] as const;

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // mode="popLayout" (not the previous "wait"): the incoming page starts
  // animating in immediately instead of waiting ~0.32s for the outgoing
  // page's exit animation to finish first. popLayout takes the exiting
  // page out of layout flow (position: absolute, scoped by .main-content's
  // `position: relative` in globals.css) while it fades out, so the two
  // don't visually stack/jump during the brief overlap - same enter/exit
  // animations as before, just no longer serialized.
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
