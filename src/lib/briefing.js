const { calculatePhase } = require('./cycle');
const { userToday } = require('./dates');
const { getDailyMessage } = require('./messages');

// The partner's name, or null if the user skipped it. Older rows may hold the
// literal 'skip' or '/start' from before onboarding filtered them.
function partnerName(user) {
    const name = user.partner_name;
    if (!name || name.toLowerCase() === 'skip' || name === '/start') return null;
    return name;
}

// Last day the period is still "expected" rather than late.
function expectedCycleEnd(user) {
    return user.cycle_length_max || user.cycle_length;
}

function cycleStatus(user, now = new Date()) {
    return calculatePhase(user.cycle_start_date, user.cycle_length, userToday(user.timezone, now), user.period_duration);
}

/**
 * Builds today's briefing for a user: a status header plus a phase message
 * that wasn't sent in the last week.
 *
 * @returns {Promise<{ text: string, messageId: number } | null>} null if no messages exist
 */
async function buildBriefing(user, now = new Date()) {
    const { phase, day, fertility } = cycleStatus(user, now);
    const message = await getDailyMessage(user.id, phase);
    if (!message) return null;

    const name = partnerName(user);
    const body = message.message_text.replace(/\[Partner\]/g, (match, offset) => {
        if (name) return name;
        return offset === 0 ? 'Your partner' : 'your partner';
    });

    const daysLate = day - expectedCycleEnd(user);
    const displayPhase = phase.charAt(0).toUpperCase() + phase.slice(1);
    const header = daysLate > 0
        ? `Day ${day} • Period ${daysLate} day${daysLate === 1 ? '' : 's'} later than expected — send /update once it starts`
        : `Day ${day} • ${displayPhase} • Fertility: ${fertility}`;

    return { text: `${header}\n\n${body}`, messageId: message.id };
}

module.exports = { partnerName, expectedCycleEnd, cycleStatus, buildBriefing };
