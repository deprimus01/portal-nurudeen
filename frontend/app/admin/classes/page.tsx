'use client';

import { Layers } from 'lucide-react';
import { SimpleCrud } from '../../../components/SimpleCrud';
import { useLanguage } from '../../../lib/i18n/language-context';

const LEVEL_OPTIONS = [
  { value: 'NURSERY', label: 'Nursery' },
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'JUNIOR_SECONDARY', label: 'Junior Secondary' },
  { value: 'SENIOR_SECONDARY', label: 'Senior Secondary' },
];

export default function ClassesPage() {
  const { t } = useLanguage();
  return (
    <SimpleCrud
      title={t('pages.classes.title')}
      description={t('pages.classes.subtitle')}
      endpoint="/api/classes"
      fields={[
        { name: 'name', label: 'Class name (e.g. JSS1)', required: true },
        { name: 'level', label: t('fields.class') + ' level', type: 'select', options: LEVEL_OPTIONS, required: true },
        { name: 'sortOrder', label: 'Sort order', type: 'number', required: true },
      ]}
      columns={[
        { key: 'name', label: t('fields.name') },
        { key: 'level', label: 'Level' },
        { key: 'sortOrder', label: 'Sort order' },
      ]}
      emptyDefaults={{ name: '', level: '', sortOrder: 0 }}
      emptyIcon={Layers}
      emptyTitle="No classes yet"
      emptyDescription="Create classes like JSS1 or SSS3 to start enrolling students and building timetables."
      emptyTone="gold"
    />
  );
}
