'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string | undefined;
  href?: string;
  icon: LucideIcon;
  accent?: 'blue' | 'gold' | 'navy' | 'green';
  index?: number;
}

export function StatCard({ label, value, href, icon: Icon, accent = 'blue', index = 0 }: StatCardProps) {
  const content = (
    <>
      <div className="icon-wrap">
        <Icon size={19} />
      </div>
      <div className="num mono">{value ?? <span className="skeleton" style={{ display: 'inline-block', width: 40, height: 22 }} />}</div>
      <div className="lbl">{label}</div>
    </>
  );

  const Wrapper = motion.div;
  const inner = (
    <Wrapper
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className={`stat-card c-${accent}`}
    >
      {content}
    </Wrapper>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
