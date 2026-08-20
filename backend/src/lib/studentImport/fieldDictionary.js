// Deterministic header → field mapping. This is the Phase 1 mapper: no AI
// involved (PRD/TRD §3, §18 — "Do not introduce OCR or AI until the
// deterministic import pipeline is working"). A header is matched by
// normalizing it (lowercase, strip anything that isn't a letter/number)
// and comparing against a synonym set per canonical field. Ambiguous or
// unrecognized headers are left unmapped and surfaced to the user in the
// preview step — never guessed.

// Canonical "slots" a column can map to. `fullName`/`guardianFullName` are
// split into first/last later in normalizer.js — kept separate here so a
// file using either "Student Name" or "First Name"/"Last Name" both work.
export const FIELD_SLOTS = [
  'fullName',
  'firstName',
  'lastName',
  'otherNames',
  'dateOfBirth',
  'gender',
  'className',
  'guardianFullName',
  'guardianFirstName',
  'guardianLastName',
  'guardianPhone',
  'guardianEmail',
  'guardianRelationship',
];

// Each synonym is matched after normalization (see normalizeHeader below),
// so entries here don't need every spacing/punctuation variant spelled
// out — "Adm No" and "adm. no." both normalize to "admno".
//
// Deliberately no `admissionNumber` slot: this school doesn't track
// admission/serial numbers, and any S/N-looking column in an imported
// file (especially OCR'd paper registers) is just that document's row
// order, not a stable identifier — see lib/createStudent.js's
// nextAdmissionNumber(), which auto-generates a fresh one for every
// imported student the same way it does for manually-created ones.
// Leaving this unmapped means such a column always lands in `unmapped`
// and is simply ignored, never accidentally used.
const SYNONYMS = {
  fullName: ['studentname', 'pupilname', 'fullname', 'name', 'childname'],
  firstName: ['firstname', 'fname', 'givenname'],
  lastName: ['lastname', 'lname', 'surname', 'familyname'],
  otherNames: ['othernames', 'middlename', 'othername'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate', 'birthday'],
  gender: ['gender', 'sex'],
  className: ['class', 'form', 'grade', 'currentclass', 'classform'],
  guardianFullName: ['guardianname', 'parentname', 'fathername', 'mothername', 'nextofkin', 'nok'],
  guardianFirstName: ['guardianfirstname', 'parentfirstname'],
  guardianLastName: ['guardianlastname', 'parentlastname'],
  guardianPhone: ['guardianphone', 'parentphone', 'phone', 'phonenumber', 'mobilenumber', 'contactnumber', 'telephone', 'tel'],
  guardianEmail: ['guardianemail', 'parentemail', 'email', 'emailaddress'],
  guardianRelationship: ['relationship', 'guardianrelationship', 'relation'],
};

export function normalizeHeader(header) {
  return String(header || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

// Returns the canonical field slot for a raw header, or null if nothing
// matched confidently. No partial/fuzzy scoring in Phase 1 — a header
// either normalizes to a known synonym exactly, or it's left for the user
// to map by hand in the preview step. Confidence-scored/AI-assisted
// fallback for ambiguous headers is Phase 4 (PRD/TRD §3.4), deliberately
// not built yet.
export function matchHeaderToField(header) {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  for (const field of FIELD_SLOTS) {
    if (SYNONYMS[field].includes(normalized)) return field;
  }
  return null;
}

// Maps every header in a parsed row's keys to a field slot. Returns
// { mapping, unmapped } where `mapping` is { originalHeader: field } for
// headers that matched, and `unmapped` lists the raw headers that didn't.
export function buildFieldMapping(headers) {
  const mapping = {};
  const unmapped = [];
  const claimedFields = new Set();

  for (const header of headers) {
    const field = matchHeaderToField(header);
    // First header to claim a field slot wins; a later duplicate synonym
    // (e.g. both "Phone" and "Contact Number" present) is left unmapped
    // rather than silently overwriting — surfaced for manual mapping.
    if (field && !claimedFields.has(field)) {
      mapping[header] = field;
      claimedFields.add(field);
    } else {
      unmapped.push(header);
    }
  }

  return { mapping, unmapped };
}
