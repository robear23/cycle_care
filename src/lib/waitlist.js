const crypto = require('crypto');
const { prisma } = require('./prisma');
const { botLink } = require('./botLink');
const { normalizeEmail, sendEmail } = require('./email');

// /start payloads for waitlist leads look like "lead_<token>" (Telegram allows 64 chars).
const LEAD_PAYLOAD_PREFIX = 'lead_';

function newStartToken() {
    return crypto.randomBytes(9).toString('base64url');
}

/**
 * Adds an email to the waitlist and returns the Telegram deep link that
 * pre-fills it during onboarding. Only brand-new leads get the welcome email,
 * so repeat submissions can't be used to spam an address.
 *
 * @returns {Promise<{ ok: true, link: string } | { ok: false, reason: 'invalid_email' }>}
 * @throws on database errors; welcome-email failures are logged, not thrown
 */
async function joinWaitlist(rawEmail) {
    const email = normalizeEmail(rawEmail);
    if (!email) return { ok: false, reason: 'invalid_email' };

    let lead = await prisma.waitlistLead.findUnique({ where: { email } });
    const isNew = !lead;
    if (!lead) {
        lead = await prisma.waitlistLead.create({ data: { email, start_token: newStartToken() } });
    } else if (!lead.start_token) {
        lead = await prisma.waitlistLead.update({ where: { id: lead.id }, data: { start_token: newStartToken() } });
    }

    if (isNew) {
        console.log(`[Waitlist] New lead ${lead.id}`);
        try {
            await sendEmail({ to: email, subject: 'Welcome to CycleCare! Your setup link inside.', html: welcomeEmailHtml() });
        } catch (err) {
            console.error(`[Waitlist] Failed to send welcome email to lead ${lead.id}:`, err);
        }
    }

    return { ok: true, link: botLink(LEAD_PAYLOAD_PREFIX + lead.start_token) };
}

// Resolves a /start payload to the lead's email, or null if it isn't a lead link.
async function emailForStartPayload(payload) {
    if (!payload.startsWith(LEAD_PAYLOAD_PREFIX)) return null;
    const lead = await prisma.waitlistLead.findUnique({
        where: { start_token: payload.slice(LEAD_PAYLOAD_PREFIX.length) }
    });
    return lead ? lead.email : null;
}

function welcomeEmailHtml() {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; color: #333;">
            <h2 style="color: #6366f1;">Welcome to CycleCare! 💜</h2>
            <p>Hi there,</p>
            <p>We’re thrilled to have you.</p>
            <p>You'll receive exactly one short, quiet message per day. No spam, no unnecessary notifications. Just the information you need to understand your partner's current cycle phase and how to best support her today.</p>
            <p>If you haven't finished setting up your daily briefing yet, it takes less than 30 seconds to get started. Just click the button below to open your Telegram assistant:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${botLink()}" style="background-color: #3d5c31; color: white; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">Open CycleCare in Telegram</a>
            </div>

            <h3 style="color: #4b5563;">What happens next?</h3>
            <p>Once you tap start in Telegram, I'll ask you for:</p>
            <ol>
                <li>Her last cycle start date</li>
                <li>What time of day you want your message (e.g., 8:00 AM)</li>
            </ol>

            <h3 style="color: #4b5563;">How do you handle future cycles?</h3>
            <p>Everything is automated! When the bot estimates that a new cycle is beginning, it will send you a quick message asking to confirm if her period started. You just tap "Yes" or "Not Yet", and the bot recalculates automatically.</p>
            <p><em>(Nature can be unpredictable! If her cycle restarts early, you can reset the timeline at any point by typing <code>/update</code> to the bot.)</em></p>

            <p style="font-size: 12px; color: #6b7280;">CycleCare gives estimates only. It is not medical advice and must not be used as contraception.</p>

            <p>Best,<br><strong>The Team at ForestTech Solutions</strong><br>
            <a href="https://foresttechsolutions.net" style="color: #6366f1;">foresttechsolutions.net</a></p>
        </div>
    `;
}

module.exports = { joinWaitlist, emailForStartPayload };
