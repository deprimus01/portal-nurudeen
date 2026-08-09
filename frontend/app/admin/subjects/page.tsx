'use client';

import { SimpleCrud } from '../../../components/SimpleCrud';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function SubjectsPage() {
  const { t } = useLanguage();
  return (
    <SimpleCrud
      title={t('pages.subjects.title')}
      description={t('pages.subjects.subtitle')}
      endpoint="/api/subjects"
      fields={[
        { name: 'name', label: t('fields.subject') + ' name', required: true },
        { name: 'code', label: 'Code (optional)' },
      ]}
      columns={[
        { key: 'name', label: t('fields.name') },
        { key: 'code', label: 'Code' },
      ]}
      emptyDefaults={{ name: '', code: '' }}
    />
  );
}
