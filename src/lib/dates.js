const chrono = require('chrono-node');
const { DateTime } = require('luxon');

// Calendar dates (period starts, "today") are represented as a Date at UTC
// midnight of that calendar day, so they never shift with the server's timezone.

const MAX_PERIOD_AGE_DAYS = 90;

function calendarDate(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day));
}

// Today's calendar date in the user's timezone.
function userToday(timezone, now = new Date()) {
    const local = DateTime.fromJSDate(now).setZone(timezone || 'UTC');
    return calendarDate(local.year, local.month, local.day);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

// Parses natural-language dates ("14 Feb", "last tuesday") relative to the
// user's local "now". Returns a calendar date, or null if unparseable.
function parseUserDate(text, timezone, now = new Date()) {
    const local = DateTime.fromJSDate(now).setZone(timezone || 'UTC');
    // chrono resolves relative dates against the reference's server-local
    // fields, so build the reference from the user's wall-clock time.
    const reference = new Date(local.year, local.month - 1, local.day, local.hour, local.minute);
    const [result] = chrono.parse(text, reference);
    if (!result) return null;
    const { start } = result;
    return calendarDate(start.get('year'), start.get('month'), start.get('day'));
}

// Returns a user-facing reason a period start date is unacceptable, or null if it's fine.
function periodStartProblem(date, today) {
    if (date > today) {
        return "That date is in the future. Please send the date the period actually started.";
    }
    if (date < addDays(today, -MAX_PERIOD_AGE_DAYS)) {
        return `That's more than ${MAX_PERIOD_AGE_DAYS} days ago. Please send the start date of the most recent period.`;
    }
    return null;
}

function formatCalendarDate(date, options) {
    return date.toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}

module.exports = { userToday, addDays, parseUserDate, periodStartProblem, formatCalendarDate };
