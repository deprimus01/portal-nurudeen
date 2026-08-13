// Matches an inline guardian row (phone/email) against an existing
// Guardian, so import doesn't spawn duplicate guardian records for a
// parent who already has other children enrolled. Phone is checked first
// — it's the unique, more reliably-entered field in this dataset;
// email is optional and only tried as a fallback.

export async function matchGuardian(prisma, { phone, email }) {
  if (phone) {
    const byPhone = await prisma.guardian.findUnique({ where: { phone } });
    if (byPhone) return byPhone;
  }
  if (email) {
    const byEmail = await prisma.guardian.findUnique({ where: { email } });
    if (byEmail) return byEmail;
  }
  return null;
}
