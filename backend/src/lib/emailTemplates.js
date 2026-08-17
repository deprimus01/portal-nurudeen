const PORTAL_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function wrap(bodyHtml) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1D29;">
      <div style="background: #10367D; color: #fff; padding: 1.2rem 1.5rem; border-radius: 12px 12px 0 0;">
        <strong style="font-size: 1.05rem;">Nuruddeen Schools Gusau</strong>
      </div>
      <div style="border: 1px solid #E1E4EE; border-top: none; padding: 1.5rem; border-radius: 0 0 12px 12px;">
        ${bodyHtml}
      </div>
      <p style="color: #6B7280; font-size: 0.78rem; margin-top: 1rem;">
        This is an automated message from the Nuruddeen Schools portal.
      </p>
    </div>
  `;
}

export function credentialEmail({ name, email, tempPassword, accountType }) {
  return {
    subject: `Your Nuruddeen Schools ${accountType} portal account is ready`,
    html: wrap(`
      <p>Hi ${name},</p>
      <p>A ${accountType.toLowerCase()} account has been created for you on the Nuruddeen Schools Gusau portal.</p>
      <p style="background: #F7F8FB; border-radius: 8px; padding: 0.8rem 1rem;">
        <strong>Email:</strong> ${email}<br/>
        <strong>One-time login code:</strong> <span style="font-size: 1.15rem; letter-spacing: 0.15em; font-weight: 700;">${tempPassword}</span>
      </p>
      <p>You'll be asked to set a new password the first time you log in.</p>
      <p><a href="${PORTAL_URL}/login" style="color: #0055FB;">Log in to the portal →</a></p>
    `),
    text: `Hi ${name}, a ${accountType.toLowerCase()} account has been created for you.\nEmail: ${email}\nOne-time login code: ${tempPassword}\nLog in and set a new password at ${PORTAL_URL}/login`,
  };
}

// Students have no email/phone of their own on file (see
// routes/students.routes.js), so their login OTP is relayed through a
// guardian's real inbox instead — this is addressed to the guardian
// ("Hi [guardian]") on behalf of the student, distinct from
// credentialEmail's "an account was created for you" framing.
export function studentCredentialEmail({ guardianName, studentName, loginEmail, tempPassword }) {
  return {
    subject: `${studentName}'s Nuruddeen Schools student portal account is ready`,
    html: wrap(`
      <p>Hi ${guardianName},</p>
      <p>A student portal account has been created for <strong>${studentName}</strong> on the Nuruddeen Schools Gusau portal.</p>
      <p style="background: #F7F8FB; border-radius: 8px; padding: 0.8rem 1rem;">
        <strong>Login:</strong> ${loginEmail}<br/>
        <strong>One-time login code:</strong> <span style="font-size: 1.15rem; letter-spacing: 0.15em; font-weight: 700;">${tempPassword}</span>
      </p>
      <p>${studentName} will be asked to set a new password the first time they log in.</p>
      <p><a href="${PORTAL_URL}/login" style="color: #0055FB;">Log in to the portal →</a></p>
    `),
    text: `Hi ${guardianName}, a student portal account has been created for ${studentName}.\nLogin: ${loginEmail}\nOne-time login code: ${tempPassword}\nLog in and set a new password at ${PORTAL_URL}/login`,
  };
}

// Sent when an admin force-resets someone's password (lost/forgotten temp
// password, no other recovery path exists — see auth.routes.js). Distinct
// copy from credentialEmail so recipients don't think a brand new account
// was created; this is explicitly framed as a reset of an existing one.
export function passwordResetEmail({ name, email, tempPassword, accountType }) {
  return {
    subject: `Your Nuruddeen Schools ${accountType} portal password was reset`,
    html: wrap(`
      <p>Hi ${name},</p>
      <p>An administrator reset the password on your ${accountType.toLowerCase()} portal account. If you didn't request this, contact the school office.</p>
      <p style="background: #F7F8FB; border-radius: 8px; padding: 0.8rem 1rem;">
        <strong>Email:</strong> ${email}<br/>
        <strong>One-time login code:</strong> <span style="font-size: 1.15rem; letter-spacing: 0.15em; font-weight: 700;">${tempPassword}</span>
      </p>
      <p>You'll be asked to set a new password the next time you log in.</p>
      <p><a href="${PORTAL_URL}/login" style="color: #0055FB;">Log in to the portal →</a></p>
    `),
    text: `Hi ${name}, an administrator reset the password on your ${accountType.toLowerCase()} portal account.\nEmail: ${email}\nOne-time login code: ${tempPassword}\nLog in and set a new password at ${PORTAL_URL}/login`,
  };
}

// Companion to studentCredentialEmail — same guardian-relay reasoning,
// for the force-reset-password flow instead of new-account creation.
export function studentPasswordResetEmail({ guardianName, studentName, loginEmail, tempPassword }) {
  return {
    subject: `${studentName}'s Nuruddeen Schools student portal password was reset`,
    html: wrap(`
      <p>Hi ${guardianName},</p>
      <p>An administrator reset the password on <strong>${studentName}</strong>'s student portal account. If you didn't request this, contact the school office.</p>
      <p style="background: #F7F8FB; border-radius: 8px; padding: 0.8rem 1rem;">
        <strong>Login:</strong> ${loginEmail}<br/>
        <strong>One-time login code:</strong> <span style="font-size: 1.15rem; letter-spacing: 0.15em; font-weight: 700;">${tempPassword}</span>
      </p>
      <p>${studentName} will be asked to set a new password the next time they log in.</p>
      <p><a href="${PORTAL_URL}/login" style="color: #0055FB;">Log in to the portal →</a></p>
    `),
    text: `Hi ${guardianName}, an administrator reset the password on ${studentName}'s student portal account.\nLogin: ${loginEmail}\nOne-time login code: ${tempPassword}\nLog in and set a new password at ${PORTAL_URL}/login`,
  };
}

export function announcementEmail({ recipientName, title, body, audienceLabel }) {
  return {
    subject: `New announcement: ${title}`,
    html: wrap(`
      <p>Hi ${recipientName},</p>
      <p style="color: #6B7280; font-size: 0.8rem; margin-bottom: 0.3rem;">${audienceLabel}</p>
      <h3 style="margin: 0 0 0.6rem;">${title}</h3>
      <p style="white-space: pre-wrap;">${body}</p>
      <p><a href="${PORTAL_URL}" style="color: #0055FB;">View in the portal →</a></p>
    `),
    text: `${title}\n\n${body}\n\nView in the portal: ${PORTAL_URL}`,
  };
}

export function newMessageEmail({ recipientName, senderName, preview }) {
  return {
    subject: `New message from ${senderName}`,
    html: wrap(`
      <p>Hi ${recipientName},</p>
      <p>You have a new message from <strong>${senderName}</strong>:</p>
      <p style="background: #F7F8FB; border-radius: 8px; padding: 0.8rem 1rem; white-space: pre-wrap;">${preview}</p>
      <p><a href="${PORTAL_URL}" style="color: #0055FB;">Reply in the portal →</a></p>
    `),
    text: `New message from ${senderName}: ${preview}\n\nReply in the portal: ${PORTAL_URL}`,
  };
}
