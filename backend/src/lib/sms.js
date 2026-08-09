// Thin wrapper around Termii's REST API — no SDK dependency, just fetch,
// same shape as email.js. Termii over Africa's Talking: Nigeria-native,
// simple single-endpoint API, "generic" channel routes around Nigerian
// carrier DND restrictions without needing a separate opt-in flow.
const TERMII_API_URL = 'https://api.ng.termii.com/api/sms/send';

// Nigerian numbers are stored in local/national or +234 form inconsistently
// depending on how they were entered (admin CRUD forms don't enforce a
// single format). Termii expects international format without the leading
// "+" (e.g. 234801234567). Normalize defensively rather than trusting
// what's on file.
function toTermiiFormat(phone) {
  const digits = String(phone).replace(/[^\d]/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  return `234${digits}`;
}

export async function sendSms({ to, message }) {
  if (!process.env.TERMII_API_KEY) {
    throw new Error('TERMII_API_KEY is not configured.');
  }

  const res = await fetch(TERMII_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TERMII_API_KEY,
      to: toTermiiFormat(to),
      from: process.env.TERMII_SENDER_ID || 'N-Alert',
      sms: message,
      type: 'plain',
      channel: 'generic',
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.message || `Termii request failed with status ${res.status}`);
  }

  // Termii returns HTTP 200 with an error message body on some failure
  // modes (e.g. insufficient balance, invalid sender ID) rather than a
  // non-2xx status. A successful send always carries a message_id.
  if (!body?.message_id) {
    throw new Error(body?.message || 'Termii request did not return a message_id.');
  }

  return body;
}
