'use client';

import { ArrowDown, ArrowUp, Layers } from 'lucide-react';
import { SimpleCrud } from '../../../components/SimpleCrud';
import { useLanguage } from '../../../lib/i18n/language-context';
import { api } from '../../../lib/api';
import type { ActionMenuItem } from '../../../components/ui/table/ActionMenu';

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
      ]}
      columns={[
        { key: 'name', label: t('fields.name') },
        { key: 'level', label: 'Level' },
        { key: 'sortOrder', label: 'Sort order' },
      ]}
      emptyDefaults={{ name: '', level: '' }}
      emptyIcon={Layers}
      emptyTitle="No classes yet"
      emptyDescription="Create classes like JSS1 or SSS3 to start enrolling students and building timetables."
      emptyTone="gold"
      extraActions={(item, items, reload) => {
        const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
        const index = sorted.findIndex((c) => c.id === item.id);
        const above = index > 0 ? sorted[index - 1] : null;
        const below = index < sorted.length - 1 ? sorted[index + 1] : null;

        async function swapWith(other: any) {
          // Swap sortOrder values with the neighbor rather than
          // renumbering the whole list - cheaper and avoids gaps/races
          // if two admins reorder around the same time.
          await Promise.all([
            api.patch(`/api/classes/${item.id}`, { sortOrder: other.sortOrder }),
            api.patch(`/api/classes/${other.id}`, { sortOrder: item.sortOrder }),
          ]);
          await reload();
        }

        const actions: ActionMenuItem[] = [
          { label: 'Move up', icon: ArrowUp, disabled: !above, onClick: () => above && swapWith(above) },
          { label: 'Move down', icon: ArrowDown, disabled: !below, onClick: () => below && swapWith(below) },
        ];
        return actions;
      }}
    />
  );
}
