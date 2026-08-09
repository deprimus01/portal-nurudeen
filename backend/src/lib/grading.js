// Resolves a numeric score against a grading scheme's bands. Bands are
// validated to be non-overlapping at creation time (see
// createGradingSchemeSchema), so the first match here is also the only
// match. Bands are not required to collectively cover 0–100 — a gap falls
// through to the "No matching band" case below.
export function resolveGrade(scheme, score) {
  const band = scheme.bands.find((b) => score >= b.minScore && score <= b.maxScore);
  if (!band) {
    return { grade: '—', remark: 'No matching band' };
  }
  return { grade: band.grade, remark: band.remark };
}
