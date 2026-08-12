'use client';

import { BookOpen } from 'lucide-react';
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
      ]}
      columns={[
        { key: 'name', label: t('fields.name') },
      ]}
      emptyDefaults={{ name: '' }}
      emptyIcon={BookOpen}
      emptyTitle="No subjects yet"
      emptyDescription="Add subjects like Mathematics or English to assign them to classes and exams."
      emptyTone="green"
    />
  );
}
