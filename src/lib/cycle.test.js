const { test, describe } = require('node:test');
const assert = require('node:assert');
const { calculatePhase } = require('./cycle');

describe('Cycle Phase Calculation', () => {

    test('Standard 28-day cycle - Menstrual Phase (Day 1)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-01');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 1);
        assert.strictEqual(result.phase, 'menstrual');
    });

    test('Standard 28-day cycle - Menstrual Phase (Day 5)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-05');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 5);
        assert.strictEqual(result.phase, 'menstrual');
    });

    test('Standard 28-day cycle - Follicular Phase (Day 6)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-06');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 6);
        assert.strictEqual(result.phase, 'follicular');
    });

    test('Standard 28-day cycle - Follicular Phase (Day 13)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-13');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 13);
        assert.strictEqual(result.phase, 'follicular');
    });

    test('Standard 28-day cycle - Ovulation Phase (Day 14)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-14');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 14);
        assert.strictEqual(result.phase, 'ovulation');
    });

    test('Standard 28-day cycle - Ovulation Phase (Day 16)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-16');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 16);
        assert.strictEqual(result.phase, 'ovulation');
    });

    test('Standard 28-day cycle - Luteal Phase (Day 17)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-17');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 17);
        assert.strictEqual(result.phase, 'luteal');
    });

    test('Standard 28-day cycle - Luteal Phase (Day 28)', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-28');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 28);
        assert.strictEqual(result.phase, 'luteal');
    });

    test('Cycle Rollover - Day 29 is Day 1 of next cycle', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-29');
        const result = calculatePhase(cycleStart, 28, targetDate);
        assert.strictEqual(result.day, 1);
        assert.strictEqual(result.phase, 'menstrual');
    });

    test('Long Cycle (35 days) - Ovulation is Day 21 (Length - 14)', () => {
        // 35 - 14 = 21. Ovulation window 20, 21, 22
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-21'); // Day 21
        const result = calculatePhase(cycleStart, 35, targetDate);
        assert.strictEqual(result.day, 21);
        assert.strictEqual(result.phase, 'ovulation');
    });

    test('Long Cycle (35 days) - Follicular extends until Day 19', () => {
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-19'); // Day 19
        const result = calculatePhase(cycleStart, 35, targetDate);
        assert.strictEqual(result.day, 19);
        assert.strictEqual(result.phase, 'follicular');
    });

    test('Short Cycle (21 days) - Ovulation is Day 7 (Length - 14)', () => {
        // 21 - 14 = 7. Ovulation window 6, 7, 8
        const cycleStart = new Date('2023-10-01');
        const targetDate = new Date('2023-10-07'); // Day 7
        const result = calculatePhase(cycleStart, 21, targetDate);
        assert.strictEqual(result.day, 7);
        assert.strictEqual(result.phase, 'ovulation');
    });

    test('Future Date Handling', () => {
        // If cycle start is in future vs today? 
        // Logic should handle negative days or return 'unknown'.
        const cycleStart = new Date('2099-01-01'); // Future date
        const targetDate = new Date('2023-10-01'); // Today
        const result = calculatePhase(cycleStart, 28, targetDate);
        // Implementation returns days < 0 as unknown/0
        assert.strictEqual(result.phase, 'unknown');
    });
});
