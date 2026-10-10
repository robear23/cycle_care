const { DateTime } = require('luxon');

const DEFAULT_TIME = '08:00';

function localNow(user, now) {
    const local = DateTime.fromJSDate(now).setZone(user.timezone || 'UTC');
    return local.isValid ? local : DateTime.fromJSDate(now).toUTC();
}

/**
 * UTC instant of the user's next notification_time strictly after `after`,
 * in the user's own timezone.
 */
function nextSendAt(user, after = new Date()) {
    const time = /^\d{2}:\d{2}$/.test(user.notification_time) ? user.notification_time : DEFAULT_TIME;
    const [hour, minute] = time.split(':').map(Number);
    const local = localNow(user, after);
    let slot = local.set({ hour, minute, second: 0, millisecond: 0 });
    if (slot <= local) slot = slot.plus({ days: 1 });
    return slot.toJSDate();
}

/**
 * What to do with a user whose next_send_at is due or unset:
 * - 'send': still the scheduled local day, so deliver (late, if the server was down)
 * - 'reschedule': unset, or a whole local day was missed, so just book the next slot
 */
function dueAction(user, now = new Date()) {
    if (!user.next_send_at) return 'reschedule';
    const scheduledDay = localNow(user, user.next_send_at).toISODate();
    const today = localNow(user, now).toISODate();
    return scheduledDay === today ? 'send' : 'reschedule';
}

module.exports = { nextSendAt, dueAction };
