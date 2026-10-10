const { prisma } = require('../lib/prisma');
const { botLink } = require('../lib/botLink');
const { isEmailConfigured, sendEmail } = require('../lib/email');
const { DateTime } = require('luxon');

async function checkAndNurtureLeads() {
    console.log('[Nurture] Checking for leads to nurture...');

    if (!isEmailConfigured()) {
        console.warn('[Nurture] RESEND_API_KEY not found. Skipping nurturing.');
        return;
    }

    const twentyFourHoursAgo = DateTime.utc().minus({ hours: 24 }).toJSDate();

    // Find leads created > 24h ago that haven't been nurtured yet
    const leads = await prisma.waitlistLead.findMany({
        where: {
            nurtured: false,
            created_at: { lt: twentyFourHoursAgo }
        }
    });

    for (const lead of leads) {
        try {
            // Claim the lead first so another instance can't send the same follow-up.
            const claimed = await prisma.waitlistLead.updateMany({
                where: { id: lead.id, nurtured: false },
                data: { nurtured: true }
            });
            if (claimed.count === 0) continue;

            // Already signed up, so no reminder needed
            const user = await prisma.user.findFirst({
                where: { email: lead.email }
            });
            if (user) continue;

            // Send reminder email
            console.log(`[Nurture] Sending follow-up to lead ${lead.id}`);
            await sendEmail({
                to: lead.email,
                subject: 'Ready to start CycleCare? 💜',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; color: #333;">
                        <h2 style="color: #6366f1;">Just a gentle reminder!</h2>
                        <p>Hi there,</p>
                        <p>You recently signed up for the CycleCare waitlist, but it looks like you haven't connected your Telegram bot yet.</p>
                        <p>It takes less than 30 seconds to set up, and you'll start receiving your daily support briefings immediately.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${botLink()}" style="background-color: #3d5c31; color: white; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">Connect now on Telegram</a>
                        </div>
                        
                        <p>If you have any questions, just reply to this email!</p>
                        
                        <p>Best,<br><strong>The Team at ForestTech Solutions</strong><br>
                        <a href="https://foresttechsolutions.net" style="color: #6366f1;">foresttechsolutions.net</a></p>
                    </div>
                `
            });
        } catch (error) {
            console.error(`[Nurture] Error processing lead ${lead.id}:`, error);
        }
    }
}

module.exports = { checkAndNurtureLeads };
