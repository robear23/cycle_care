const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = 'CycleCare <contact@foresttechsolutions.net>';
const REPLY_TO = 'contact@foresttechsolutions.net';
const MAX_EMAIL_LENGTH = 254;

// Trimmed, lower-cased email, or null if it isn't a plausible address.
function normalizeEmail(input) {
    if (typeof input !== 'string') return null;
    const email = input.trim().toLowerCase();
    if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
}

function isEmailConfigured() {
    return resend !== null;
}

// Sends a transactional email. Returns false (and sends nothing) if RESEND_API_KEY is unset.
// Resend reports API failures in the result rather than throwing, so surface them as errors.
async function sendEmail({ to, subject, html }) {
    if (!resend) return false;
    const { error } = await resend.emails.send({ from: FROM, replyTo: REPLY_TO, to, subject, html });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return true;
}

module.exports = { normalizeEmail, isEmailConfigured, sendEmail };
