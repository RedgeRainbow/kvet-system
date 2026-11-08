/* Outgoing e-mail and SMS. Nothing is sent unless the keys are set as Pages secrets:
     RESEND_API_KEY + MAIL_FROM ("KVET <noreply@kvet.edu.az>", a domain verified in Resend)   -> e-mail through api.resend.com
     SMS_WEBHOOK_URL (+ optional SMS_WEBHOOK_TOKEN)                                            -> POST {to, text} to your SMS gateway */
export const mailReady = env => !!(env?.RESEND_API_KEY && env?.MAIL_FROM);

export async function sendMail(env, { to, subject, html }) {
  if (!mailReady(env) || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}) }) });
    return r.ok;
  } catch { return false; }
}

export async function sendSms(env, { to, text }) {
  if (!env?.SMS_WEBHOOK_URL || !to) return false;
  try {
    const r = await fetch(env.SMS_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json', ...(env.SMS_WEBHOOK_TOKEN ? { authorization: 'Bearer ' + env.SMS_WEBHOOK_TOKEN } : {}) }, body: JSON.stringify({ to, text }) });
    return r.ok;
  } catch { return false; }
}
