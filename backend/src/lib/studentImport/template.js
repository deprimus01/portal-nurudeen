import * as XLSX from 'xlsx';

// Guardian info and date of birth are deliberately excluded — this school
// doesn't collect either at enrollment. "Serial Number" (not "Admission
// Number") matches the school's own terminology; internally this still
// maps to Student.admissionNumber (renaming that field/column would touch
// attendance, results, report cards, flagging, and search — this is a
// display-label change only, not a data-model change).
const TEMPLATE_HEADERS = [
  'Student Name',
  'Serial Number',
  'Gender',
  'Class',
];

const EXAMPLE_ROW = [
  'Ahmad Bello Musa',
  'NSG-2026-014',
  'Male',
  'JSS1',
];

export function buildImportTemplateBuffer() {
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE_ROW]);
  sheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Students');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
