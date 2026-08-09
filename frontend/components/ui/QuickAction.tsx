'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface QuickActionProps {
  label: string;
  href: string;
  icon: LucideIcon;
  index?: number;
}

export function QuickAction({ label, href, icon: Icon, index = 0 }: QuickActionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={href} className="qa-card">
        <div className="qa-icon">
          <Icon size={17} />
        </div>
        <span className="qa-label">{label}</span>
      </Link>
    </motion.div>
  );
}
