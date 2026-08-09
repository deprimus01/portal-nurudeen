// Thin wrapper around Resend's REST API — no SDK dependency, just fetch
// (Node 18+ has it globally, which Render's runtime provides). Runs
// alongside sms.js (Termii) for every notification — see notify.js's
// notifyBoth(), which fires both channels in parallel per send.
const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Nuruddeen Schools Gusau <onboarding@resend.dev>',
      to,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Resend request failed with status ${res.status}`);
  }

  return res.json();
}
