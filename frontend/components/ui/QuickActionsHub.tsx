'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Command } from 'lucide-react';
import type { CommandAction } from '../../lib/commandActions';
import { useCommandCenter } from '../../lib/command-center-context';

interface QuickActionsHubProps {
  title?: string;
  primary: CommandAction[];
  /** existing shortcuts that weren't in the priority list — shown smaller, still one click away */
  secondary?: CommandAction[];
}

export function QuickActionsHub({ title = 'Quick actions', primary, secondary = [] }: QuickActionsHubProps) {
  const { open } = useCommandCenter();

  return (
    <div className="panel qa-hub" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h3>{title}</h3>
        <button type="button" className="qa-cmdk-hint" onClick={open} aria-label="Open command center">
          <Command size={12} />
          <span>K</span>
        </button>
      </div>

      <div className="qa-grid">
        {primary.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link href={action.href} className="qa-card qa-card-primary">
                <div className="qa-icon">
                  <Icon size={17} />
                </div>
                <span className="qa-label">{action.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {secondary.length > 0 && (
        <div className="qa-grid qa-grid-secondary">
          {secondary.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.id} href={action.href} className="qa-card qa-card-secondary">
                <div className="qa-icon">
                  <Icon size={15} />
                </div>
                <span className="qa-label">{action.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
