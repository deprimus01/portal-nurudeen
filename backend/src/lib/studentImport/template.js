import * as XLSX from 'xlsx';

// Guardian info and date of birth are deliberately excluded — this school
// doesn't collect either at enrollment. "Serial Number" (not "Admission
// Number") matches the school's own terminology, and internally still
// maps to Student.admissionNumber — renaming that field/column would
// touch attendance, results, report cards, flagging, and search, so this
// is a display-label change only, not a data-model change.
//
// Serial numbers are sequential *within each class* (e.g. "1", "2", "3"
// — reused across classes, not a school-wide unique code), enforced via
// a composite (class, serial number) uniqueness constraint rather than a
// single global one. Two example rows are shown so the reused-numbering
// pattern is obvious rather than looking like a mistake.
const TEMPLATE_HEADERS = [
  'Student Name',
  'Serial Number',
  'Gender',
  'Class',
];

const EXAMPLE_ROWS = [
  ['Ahmad Bello Musa', '1', 'Male', 'JSS1'],
  ['Zainab Sani', '1', 'Female', 'JSS2'],
];

export function buildImportTemplateBuffer() {
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...EXAMPLE_ROWS]);
  sheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Students');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
