'use client';

import { SettingsView } from '../../../components/ui/SettingsView';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  return <SettingsView roleLabel={t('role.admin')} />;
}
