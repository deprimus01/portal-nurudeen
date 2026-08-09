'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { useLanguage } from '../../lib/i18n/language-context';

interface WelcomeCardProps {
  name: string;
  subtitle?: string;
  icon: LucideIcon;
}

const DATE_LOCALE: Record<string, string> = {
  en: 'en-GB',
  ha: 'en-GB',
  yo: 'en-GB',
};

export function WelcomeCard({ name, subtitle, icon: Icon }: WelcomeCardProps) {
  const { t, locale } = useLanguage();

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? 'common.greetingMorning' : hour < 17 ? 'common.greetingAfternoon' : 'common.greetingEvening';

  const dateLabel = new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="welcome-card"
    >
      <div className="welcome-card-body">
        <div className="welcome-card-date">{dateLabel}</div>
        <h1 className="welcome-card-title">
          {t(greetingKey)}, {name}
        </h1>
        {subtitle && <p className="welcome-card-sub">{subtitle}</p>}
      </div>
      <div className="welcome-card-badge">
        <Icon size={24} />
      </div>
    </motion.div>
  );
}
