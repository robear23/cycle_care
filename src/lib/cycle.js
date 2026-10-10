const { addDays } = require('./dates');

const DAY_MS = 1000 * 60 * 60 * 24;
const MIN_CYCLE_LENGTH = 21;
const MAX_CYCLE_LENGTH = 60;

function startOfUtcDay(date) {
    const d = new Date(date);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Day ranges (1-based, inclusive) of each phase for a cycle of the given length.
 * A range with end < start is empty (e.g. follicular in very short cycles).
 */
function getPhaseRanges(cycleLength = 28, periodDuration = 5) {
    // The 28-day mapping follows the product spec (ovulation on days 14–16);
    // other lengths centre ovulation 14 days before the next period.
    const ovulationCentre = cycleLength === 28 ? 15 : cycleLength - 14;
    const menstrualEnd = periodDuration;
    const ovulationStart = Math.max(ovulationCentre - 1, menstrualEnd + 1);
    const ovulationEnd = ovulationCentre + 1;

    return {
        menstrual: { start: 1, end: menstrualEnd },
        follicular: { start: menstrualEnd + 1, end: ovulationStart - 1 },
        ovulation: { start: ovulationStart, end: ovulationEnd },
        luteal: { start: ovulationEnd + 1, end: cycleLength }
    };
}

/**
 * Calculate the current cycle phase and day.
 *
 * @param {Date} cycleStartDate - Calendar date the last period started (UTC midnight)
 * @param {number} cycleLength - Expected cycle length in days
 * @param {Date} [targetDate=new Date()] - Calendar date to calculate for; pass userToday(tz)
 * @param {number} [periodDuration=5] - Length of the menstrual phase in days
 * @returns {{ phase, day, daysUntilNextPeriod, fertility }}
 */
function calculatePhase(cycleStartDate, cycleLength = 28, targetDate = new Date(), periodDuration = 5) {
    const diffDays = Math.round((startOfUtcDay(targetDate) - startOfUtcDay(cycleStartDate)) / DAY_MS);

    if (diffDays < 0) {
        return { phase: 'unknown', day: 0, daysUntilNextPeriod: 0, fertility: 'Low' };
    }

    // Show the actual elapsed day; never wrap, so an unconfirmed new period
    // doesn't silently reset the cycle to day 1.
    const currentDay = diffDays + 1;
    // Past the expected length, stay in the final (luteal) phase.
    const phaseDay = Math.min(currentDay, cycleLength);

    const ranges = getPhaseRanges(cycleLength, periodDuration);
    const phase = ['menstrual', 'follicular', 'ovulation', 'luteal']
        .find((name) => phaseDay >= ranges[name].start && phaseDay <= ranges[name].end);

    let fertility = 'Low';
    if (phase === 'ovulation') fertility = 'High';
    else if (phase === 'follicular') fertility = 'Medium';

    return {
        phase,
        day: currentDay,
        daysUntilNextPeriod: Math.max(0, cycleLength - currentDay + 1),
        fertility
    };
}

/**
 * Date ranges of the upcoming luteal phase and the menstrual phase after it.
 *
 * @param {Date} cycleStartDate - Calendar date the last period started (UTC midnight)
 * @param {number} cycleLength - Expected cycle length in days
 * @param {Date} [referenceDate=new Date()] - Calendar date to project from; pass userToday(tz)
 * @param {number} [periodDuration=5] - Length of the menstrual phase in days
 * @returns {{ luteal: { start, end }, menstrual: { start, end } }} calendar dates
 */
function getUpcomingPhasesRanges(cycleStartDate, cycleLength = 28, referenceDate = new Date(), periodDuration = 5) {
    const start = new Date(startOfUtcDay(cycleStartDate));
    let currentDay = Math.round((startOfUtcDay(referenceDate) - start.getTime()) / DAY_MS) + 1;

    // If we're past the expected length, project forward to the "current" cycle.
    let projectionStart = start;
    while (currentDay > cycleLength) {
        projectionStart = addDays(projectionStart, cycleLength);
        currentDay -= cycleLength;
    }

    const { luteal } = getPhaseRanges(cycleLength, periodDuration);

    return {
        luteal: {
            start: addDays(projectionStart, luteal.start - 1),
            end: addDays(projectionStart, luteal.end - 1)
        },
        menstrual: {
            start: addDays(projectionStart, cycleLength),
            end: addDays(projectionStart, cycleLength + periodDuration - 1)
        }
    };
}

module.exports = { calculatePhase, getUpcomingPhasesRanges, getPhaseRanges, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH };
