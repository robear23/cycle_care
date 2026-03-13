const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getDailyTip(req, res) {
    try {
        // Count total messages
        const count = await prisma.message.count();
        if (count === 0) {
            return res.status(404).json({ error: 'No messages found' });
        }

        // Pick a random one
        const skip = Math.floor(Math.random() * count);
        const randomMessage = await prisma.message.findFirst({
            skip: skip
        });

        if (!randomMessage) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Format for Social Media (Twitter/X style)
        const phaseEmoji = {
            menstrual: '🩸',
            follicular: '🌱',
            ovulation: '✨',
            luteal: '🍂',
            general: '💜'
        }[randomMessage.phase] || '💜';

        const platformText = `${phaseEmoji} Cycle Support Tip:\n\n${randomMessage.message_text.replace(/\[Partner\]/g, 'your partner')}\n\n#CycleCare #RelationshipTips #Support`;

        res.json({
            id: randomMessage.id,
            phase: randomMessage.phase,
            raw_text: randomMessage.message_text,
            formatted_text: platformText
        });
    } catch (error) {
        console.error('Error fetching social tip:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { getDailyTip };
