import * as XLSX from 'xlsx';

// Guardian info and date of birth are deliberately excluded — this school
// doesn't collect either at enrollment. No serial/admission number column
// either — this school doesn't track one at all; every imported student
// gets an internal one auto-generated the same way a manually created
// student does (see lib/createStudent.js's nextAdmissionNumber()).
const TEMPLATE_HEADERS = [
  'Student Name',
  'Gender',
  'Class',
];

const EXAMPLE_ROWS = [
  ['Ahmad Bello Musa', 'Male', 'JSS1'],
  ['Zainab Sani', 'Female', 'JSS2'],
];

export function buildImportTemplateBuffer() {
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...EXAMPLE_ROWS]);
  sheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Students');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
