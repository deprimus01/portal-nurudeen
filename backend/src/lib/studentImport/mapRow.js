import {
  normalizeGender,
  normalizeDateOfBirth,
  splitFullName,
  normalizePhone,
  normalizeEmail,
  cleanText,
} from './normalizer.js';

const RELATIONSHIP_MAP = {
  father: 'FATHER',
  dad: 'FATHER',
  mother: 'MOTHER',
  mum: 'MOTHER',
  mom: 'MOTHER',
  guardian: 'GUARDIAN',
  auntie: 'OTHER',
  aunt: 'OTHER',
  uncle: 'OTHER',
  grandfather: 'OTHER',
  grandmother: 'OTHER',
  other: 'OTHER',
};

function normalizeRelationship(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return RELATIONSHIP_MAP[key] || 'GUARDIAN';
}

// Which resolved field(s) a header's claimed slot ends up populating.
// Most slots map to exactly one resolved field, but 'fullName' and
// 'guardianFullName' split into two or three — e.g. a single "Student
// Name" column becomes both firstName and lastName. Used by
// processBatch.js to attach one OCR bounding box to every resolved
// field that came from the column it was read from, since there's no
// finer-grained position data distinguishing "Ahmad" from "Musa" within
// one cell's bounding box — both fields legitimately point at the same
// source-image region.
export const SLOT_TO_RESOLVED_FIELDS = {
  fullName: ['firstName', 'lastName', 'otherNames'],
  firstName: ['firstName'],
  lastName: ['lastName'],
  otherNames: ['otherNames'],
  dateOfBirth: ['dateOfBirth'],
  gender: ['gender'],
  className: ['classInput'],
  guardianFullName: ['guardianFirstName', 'guardianLastName'],
  guardianFirstName: ['guardianFirstName'],
  guardianLastName: ['guardianLastName'],
  guardianPhone: ['guardianPhone'],
  guardianEmail: ['guardianEmail'],
  guardianRelationship: ['guardianRelationship'],
};

// `rawRow` is { originalHeader: cellValue }; `mapping` is
// { originalHeader: fieldSlot } from buildFieldMapping(). Returns the
// normalized-but-not-yet-DB-matched shape rowValidator.js and
// duplicateMatcher.js expect.
export function mapRawRow(rawRow, mapping) {
  const bySlot = {};
  for (const [header, field] of Object.entries(mapping)) {
    bySlot[field] = rawRow[header];
  }

  let firstName = cleanText(bySlot.firstName, { titleCased: true });
  let lastName = cleanText(bySlot.lastName, { titleCased: true });
  let otherNames = cleanText(bySlot.otherNames, { titleCased: true });

  if ((!firstName || !lastName) && bySlot.fullName) {
    const split = splitFullName(bySlot.fullName);
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
    otherNames = otherNames || split.otherNames;
  }

  let guardianFirstName = cleanText(bySlot.guardianFirstName, { titleCased: true });
  let guardianLastName = cleanText(bySlot.guardianLastName, { titleCased: true });

  if ((!guardianFirstName || !guardianLastName) && bySlot.guardianFullName) {
    const split = splitFullName(bySlot.guardianFullName);
    guardianFirstName = guardianFirstName || split.firstName;
    guardianLastName = guardianLastName || split.lastName;
  }

  return {
    firstName,
    lastName,
    otherNames: otherNames || undefined,
    dateOfBirth: normalizeDateOfBirth(bySlot.dateOfBirth),
    gender: normalizeGender(bySlot.gender),
    classInput: cleanText(bySlot.className),
    guardianFirstName,
    guardianLastName,
    guardianPhone: normalizePhone(bySlot.guardianPhone),
    guardianEmail: normalizeEmail(bySlot.guardianEmail),
    guardianRelationship: normalizeRelationship(bySlot.guardianRelationship),
  };
}
