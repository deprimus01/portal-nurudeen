import * as XLSX from 'xlsx';

const TEMPLATE_HEADERS = [
  'Student Name',
  'Admission Number',
  'Date of Birth',
  'Gender',
  'Class',
  'Guardian Name',
  'Guardian Phone',
  'Guardian Email',
  'Relationship',
];

const EXAMPLE_ROW = [
  'Ahmad Bello Musa',
  'NSG-2026-014',
  '15/03/2015',
  'Male',
  'JSS1',
  'Musa Bello',
  '+2348012345678',
  'musabello@example.com',
  'Father',
];

export function buildImportTemplateBuffer() {
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE_ROW]);
  sheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Students');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
