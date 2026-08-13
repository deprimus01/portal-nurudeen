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
    admissionNumber: cleanText(bySlot.admissionNumber),
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
