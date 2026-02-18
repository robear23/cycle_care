const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getDailyMessage(userId, phase) {
    // Logic:
    // 1. Get all messages for the phase
    // 2. Filter out messages sent recently (e.g. last 7 days) to this user
    // 3. Randomly select one

    // Get recent message logs for this user
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentLogs = await prisma.messageLog.findMany({
        where: {
            user_id: userId,
            sent_at: {
                gte: sevenDaysAgo
            }
        },
        select: { message_id: true }
    });

    const recentMessageIds = recentLogs.map(log => log.message_id);

    // Find eligible messages
    const messages = await prisma.message.findMany({
        where: {
            phase: phase,
            id: { notIn: recentMessageIds }
        }
    });

    if (messages.length === 0) {
        // Fallback: fetch any message from this phase, ignoring history
        const allPhaseMessages = await prisma.message.findMany({ where: { phase } });
        if (allPhaseMessages.length > 0) {
            const randomIndex = Math.floor(Math.random() * allPhaseMessages.length);
            return allPhaseMessages[randomIndex];
        }

        // Fallback to general if phase is empty
        if (phase !== 'general') {
            return getDailyMessage(userId, 'general');
        }
        return null;
    }

    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}

module.exports = { getDailyMessage };
