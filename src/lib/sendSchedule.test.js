const { test, describe } = require('node:test');
const assert = require('node:assert');
const { nextSendAt, dueAction } = require('./sendSchedule');

const user = (overrides) => ({ notification_time: '08:00', timezone: 'Europe/London', next_send_at: null, ...overrides });

describe('nextSendAt', () => {
    test('books today\'s slot if it is still ahead', () => {
        // 06:00 UTC = 07:00 London (BST), so 08:00 London is still today.
        const next = nextSendAt(user(), new Date('2026-07-01T06:00:00Z'));
        assert.strictEqual(next.toISOString(), '2026-07-01T07:00:00.000Z');
    });

    test('books tomorrow\'s slot once today\'s has passed', () => {
        const next = nextSendAt(user(), new Date('2026-07-01T07:00:30Z'));
        assert.strictEqual(next.toISOString(), '2026-07-02T07:00:00.000Z');
    });

    test('follows the user\'s timezone', () => {
        const next = nextSendAt(user({ timezone: 'America/New_York' }), new Date('2026-07-01T06:00:00Z'));
        assert.strictEqual(next.toISOString(), '2026-07-01T12:00:00.000Z');
    });

    test('falls back to 08:00 for malformed times', () => {
        const next = nextSendAt(user({ notification_time: '6am', timezone: 'UTC' }), new Date('2026-07-01T00:00:00Z'));
        assert.strictEqual(next.toISOString(), '2026-07-01T08:00:00.000Z');
    });
});

describe('dueAction', () => {
    test('reschedules users who have never been scheduled', () => {
        assert.strictEqual(dueAction(user(), new Date('2026-07-01T09:00:00Z')), 'reschedule');
    });

    test('sends late on the same local day (e.g. after a restart)', () => {
        const u = user({ next_send_at: new Date('2026-07-01T07:00:00Z') });
        assert.strictEqual(dueAction(u, new Date('2026-07-01T07:04:00Z')), 'send');
        assert.strictEqual(dueAction(u, new Date('2026-07-01T18:00:00Z')), 'send');
    });

    test('skips a slot from a previous local day instead of sending it now', () => {
        const u = user({ next_send_at: new Date('2026-07-01T07:00:00Z') });
        assert.strictEqual(dueAction(u, new Date('2026-07-02T06:00:00Z')), 'reschedule');
    });
});
