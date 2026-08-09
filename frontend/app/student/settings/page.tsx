'use client';

import { SettingsView } from '../../../components/ui/SettingsView';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function StudentSettingsPage() {
  const { t } = useLanguage();
  return <SettingsView roleLabel={t('role.student')} />;
}
