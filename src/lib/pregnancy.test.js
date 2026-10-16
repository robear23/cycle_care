const { test, describe } = require('node:test');
const assert = require('node:assert');
const { estimateDueDate, pregnancyProgress, dueDateLine, buildPregnancyUpdate, isPregnancyUpdateDay } = require('./pregnancy');

const user = (overrides) => ({
    cycle_start_date: new Date('2026-01-01'),
    cycle_length: 28,
    timezone: 'Europe/London',
    partner_name: 'Sam',
    ...overrides
});

describe('estimateDueDate', () => {
    test('is 280 days after the first day of the last period', () => {
        assert.strictEqual(estimateDueDate(new Date('2026-01-01')).toISOString(), '2026-10-08T00:00:00.000Z');
    });
});

describe('pregnancyProgress', () => {
    test('counts completed weeks and days from the last period', () => {
        // 85 days after 1 Jan = 12 weeks 1 day.
        const progress = pregnancyProgress(user(), new Date('2026-03-27T12:00:00Z'));
        assert.deepStrictEqual([progress.weeks, progress.days, progress.daysToGo], [12, 1, 195]);
    });

    test('ignores the usual cycle length', () => {
        // 18 Sep with a 31-day cycle setting: still 4 weeks on 16 Oct, due 25 Jun.
        const progress = pregnancyProgress(user({ cycle_start_date: new Date('2026-09-18'), cycle_length: 31 }), new Date('2026-10-16T08:00:00Z'));
        assert.deepStrictEqual([progress.weeks, progress.days], [4, 0]);
        assert.strictEqual(progress.dueDate.toISOString(), '2027-06-25T00:00:00.000Z');
    });

    test('uses the user\'s local date', () => {
        // 23:30 UTC on 25 Mar is already 26 Mar in Auckland: exactly 12 weeks.
        const progress = pregnancyProgress(user({ timezone: 'Pacific/Auckland' }), new Date('2026-03-25T23:30:00Z'));
        assert.deepStrictEqual([progress.weeks, progress.days], [12, 0]);
    });
});

describe('isPregnancyUpdateDay', () => {
    test('is true only on the first day of each pregnancy week', () => {
        assert.strictEqual(isPregnancyUpdateDay(user(), new Date('2026-03-26T12:00:00Z')), true);
        assert.strictEqual(isPregnancyUpdateDay(user(), new Date('2026-03-27T12:00:00Z')), false);
        assert.strictEqual(isPregnancyUpdateDay(user(), new Date('2026-04-02T12:00:00Z')), true);
    });
});

describe('buildPregnancyUpdate', () => {
    test('covers baby size, how she is feeling, and ends with the due date', () => {
        const text = buildPregnancyUpdate(user(), new Date('2026-03-26T12:00:00Z'));
        assert.match(text, /^🤰 12 weeks pregnant/);
        assert.match(text, /size of a plum/);
        assert.match(text, /How Sam may be feeling:/);
        const lastLine = text.split('\n').pop();
        assert.strictEqual(lastLine, '📅 Due date: Thu, 8 Oct 2026 (28 weeks to go)');
    });

    test('falls back to "your partner" without a name', () => {
        const text = buildPregnancyUpdate(user({ partner_name: null }), new Date('2026-03-26T12:00:00Z'));
        assert.match(text, /How your partner may be feeling:/);
    });

    test('shows weeks and days left mid-week, and overdue days past the due date', () => {
        assert.match(buildPregnancyUpdate(user(), new Date('2026-03-27T12:00:00Z')), /\(27 weeks, 6 days to go\)$/);
        assert.match(buildPregnancyUpdate(user(), new Date('2026-10-08T12:00:00Z')), /\(that's today!\)$/);
        assert.match(buildPregnancyUpdate(user(), new Date('2026-10-11T12:00:00Z')), /\(3 days past — any day now\)$/);
    });

    test('has content for every week from 3 to 42 and nothing outside', () => {
        for (let week = 3; week <= 42; week++) {
            const now = new Date(Date.UTC(2026, 0, 1 + week * 7, 12));
            assert.ok(buildPregnancyUpdate(user(), now), `week ${week}`);
        }
        assert.strictEqual(buildPregnancyUpdate(user(), new Date('2026-01-15T12:00:00Z')), null);
        assert.strictEqual(buildPregnancyUpdate(user(), new Date('2026-10-29T12:00:00Z')), null);
    });
});

describe('dueDateLine', () => {
    test('gives the due date and countdown on its own', () => {
        assert.strictEqual(dueDateLine(user(), new Date('2026-01-15T12:00:00Z')), '📅 Due date: Thu, 8 Oct 2026 (38 weeks to go)');
    });
});
