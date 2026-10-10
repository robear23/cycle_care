const { test, describe } = require('node:test');
const assert = require('node:assert');
const { userToday, parseUserDate, periodStartProblem } = require('./dates');

const iso = (date) => date.toISOString().slice(0, 10);

describe('userToday', () => {
    test('uses the user\'s local date, not UTC', () => {
        // 23:30 UTC on 10 Oct is already 11 Oct in Tokyo and still 10 Oct in New York.
        const now = new Date('2026-10-10T23:30:00Z');
        assert.strictEqual(iso(userToday('Asia/Tokyo', now)), '2026-10-11');
        assert.strictEqual(iso(userToday('America/New_York', now)), '2026-10-10');
    });
});

describe('parseUserDate', () => {
    test('resolves "yesterday" relative to the user\'s local day', () => {
        const now = new Date('2026-10-10T23:30:00Z');
        assert.strictEqual(iso(parseUserDate('yesterday', 'Asia/Tokyo', now)), '2026-10-10');
        assert.strictEqual(iso(parseUserDate('yesterday', 'America/New_York', now)), '2026-10-09');
    });

    test('parses explicit dates as calendar dates', () => {
        const now = new Date('2026-10-10T12:00:00Z');
        assert.strictEqual(iso(parseUserDate('2026-09-25', 'Pacific/Auckland', now)), '2026-09-25');
        assert.strictEqual(iso(parseUserDate('14 Sep', 'Europe/London', now)), '2026-09-14');
    });

    test('returns null for nonsense', () => {
        assert.strictEqual(parseUserDate('banana', 'UTC'), null);
    });
});

describe('periodStartProblem', () => {
    const today = new Date('2026-10-10T00:00:00Z');

    test('accepts today and recent dates', () => {
        assert.strictEqual(periodStartProblem(today, today), null);
        assert.strictEqual(periodStartProblem(new Date('2026-09-01T00:00:00Z'), today), null);
    });

    test('rejects future dates', () => {
        assert.match(periodStartProblem(new Date('2026-10-11T00:00:00Z'), today), /future/);
    });

    test('rejects dates more than 90 days ago', () => {
        assert.match(periodStartProblem(new Date('2026-07-01T00:00:00Z'), today), /90 days/);
    });
});
