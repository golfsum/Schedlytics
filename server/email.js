/**
 * Transactional email via SMTP (e.g. Migadu). Configured entirely through env:
 *   SMTP_HOST, SMTP_PORT (default 465), SMTP_USER, SMTP_PASS, SMTP_FROM
 * When those are not set, sendEmail() is a safe no-op so the app keeps working.
 * nodemailer is imported dynamically so a missing dependency never crashes the
 * server, only disables sending.
 */
const SMTP = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
}

export const emailEnabled = Boolean(SMTP.host && SMTP.user && SMTP.pass)

let transporter = null
async function getTransport() {
  if (!emailEnabled) return null
  if (transporter) return transporter
  try {
    const nodemailer = (await import('nodemailer')).default
    transporter = nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.port === 465,
      auth: { user: SMTP.user, pass: SMTP.pass },
    })
    return transporter
  } catch (err) {
    console.warn('[email] nodemailer unavailable:', err.message)
    return null
  }
}

/** Send one email. Returns { sent } or { skipped } when SMTP is not configured. */
export async function sendEmail({ to, subject, html, text }) {
  const t = await getTransport()
  if (!t) {
    console.warn('[email] SMTP not configured; skipping send to', to)
    return { skipped: true }
  }
  await t.sendMail({ from: SMTP.from, to, subject, html, text })
  return { sent: true }
}
