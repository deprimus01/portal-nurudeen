// Plain-text SMS copy — deliberately not a trimmed-down version of
// emailTemplates.js. Termii bills per 160-char GSM-7 segment, so these
// stay inside one segment wherever the content allows it; the school name
// prefix is kept short for the same reason. No links (a temp password
// pasted from an SMS into a phone browser is a real flow for parents
// without email; the credential itself is the actionable content).

const SCHOOL = 'Nuruddeen Schools';

export function credentialSms({ email, tempPassword, accountType }) {
  return `${SCHOOL}: Your ${accountType.toLowerCase()} portal account is ready. Login: ${email} Temp password: ${tempPassword} You'll set a new password on first login.`;
}

export function passwordResetSms({ email, tempPassword, accountType }) {
  return `${SCHOOL}: Your ${accountType.toLowerCase()} portal password was reset by an admin. Login: ${email} Temp password: ${tempPassword} If you didn't request this, contact the school office.`;
}

export function announcementSms({ title, audienceLabel }) {
  return `${SCHOOL}: New announcement (${audienceLabel}) - ${title}. Open the portal app to read the full message.`;
}

export function newMessageSms({ senderName }) {
  return `${SCHOOL}: New message from ${senderName}. Open the portal app to read and reply.`;
}
