/**
 * Calculate the current cycle phase and day for a given user.
 * 
 * @param {Date} cycleStartDate - The start date of the last period
 * @param {number} cycleLength - The length of the cycle in days (default 28)
 * @param {Date} [targetDate=new Date()] - The date to calculate for (default today)
 * @returns {Object} - { phase, day, daysUntilNextPeriod }
 */
function calculatePhase(cycleStartDate, cycleLength = 28, targetDate = new Date()) {
    // Normalize dates to start of day to avoid time discrepancies
    const start = new Date(cycleStartDate);
    start.setHours(0, 0, 0, 0);

    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    // Calculate difference in milliseconds
    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Handle future dates or invalid dates
    if (diffDays < 0) {
        return { phase: 'unknown', day: 0, daysUntilNextPeriod: 0 };
    }

    // vital: Handle cycle rollover (e.g. day 29 of a 28-day cycle is day 1 of next cycle?)
    // Actually, standard cycle tracking usually counts day 1 as the first day of period.
    // If we differ from the cycle length, we modulo it.
    // However, simple modulo might result in 0, so we need 1-based index usually.

    // Let's use 0-indexed internally then map to 1-indexed for display if needed.
    // But wait, day 1 is day 1.

    let currentDay = (diffDays % cycleLength) + 1;
    // If diffDays is exactly cycleLength, modulo is 0, so +1 is 1. That's correct?
    // Day 0: diff 0. (0 % 28) + 1 = 1. Correct.
    // Day 27: diff 27. (27 % 28) + 1 = 28. Correct.
    // Day 28: diff 28. (28 % 28) + 1 = 1. Correct.

    // Phase mapping (default 28-day):
    // Days 1–5:   'menstrual'
    // Days 6–13:  'follicular'
    // Days 14–16: 'ovulation'
    // Days 17–28: 'luteal'

    // We need to scale these phases if the cycle length is different?
    // The prompt says "Phase mapping (default 28-day)". 
    // It doesn't explicitly say to scale, but "Day 14" of a 35 day cycle is not ovulation.
    // Ovulation is usually 14 days *before* the next period.
    // Luteal phase is relatively constant (14 days). Follicular phase varies.
    // Let's implement the standard logic: Ovulation = Cycle Length - 14.

    let phase = 'general';

    // Standard logic:
    // Menstrual: 1-5 (User configurable duration usually, but prompt says 1-5 default)
    // Luteal: Last 14 days (approximated)
    // Ovulation: 2-3 days around (CycleLength - 14)
    // Follicular: The rest (after period, before ovulation)

    const ovulationDay = cycleLength - 14;
    const lutealStart = ovulationDay + 2; // Day after ovulation window

    if (currentDay >= 1 && currentDay <= 5) {
        phase = 'menstrual';
    } else if (currentDay >= lutealStart && currentDay <= cycleLength) {
        phase = 'luteal';
    } else if (currentDay >= ovulationDay - 1 && currentDay <= ovulationDay + 1) {
        phase = 'ovulation'; // 3 day window centered on ovulation day
    } else {
        phase = 'follicular';
    }

    // Recalculate based on fixed ranges from prompt if needed, 
    // but the prompt explicitly gave ranges for 28 days.
    // Prompt: 
    // Days 1–5:   'menstrual'
    // Days 6–13:  'follicular'
    // Days 14–16: 'ovulation'
    // Days 17–28: 'luteal'

    // If I strictly follow the prompt's 28-day example without scaling:
    // It might be inaccurate for other cycle lengths.
    // I will use logic that matches the prompt's example for 28 days but adapts for others.

    // Adaptation logic:
    // Menstrual: Always 1-5 (or user period_duration)
    // Ovulation: Always (Length - 14) +/- 1
    // Luteal: Always (Length - 12) to Length
    // Follicular: 6 to (Ovulation Start - 1)

    // Let's refine based on the prompt's explicit ranges for 28 days:
    // Ovulation 14-16 implies Ovulation day is 15? (14, 15, 16). 
    // If Length 28, Ovulation is usually 14. So 13, 14, 15?
    // Prompt says 14-16. Let's stick to the prompt's mapping for 28 days 
    // and scale the Follicular phase for longer cycles.

    if (cycleLength !== 28) {
        // Dynamic calculation
        const estimatedOvulation = cycleLength - 14;
        const ovulationStart = estimatedOvulation - 1;
        const ovulationEnd = estimatedOvulation + 1;

        if (currentDay <= 5) {
            phase = 'menstrual';
        } else if (currentDay > 5 && currentDay < ovulationStart) {
            phase = 'follicular';
        } else if (currentDay >= ovulationStart && currentDay <= ovulationEnd) {
            phase = 'ovulation';
        } else {
            phase = 'luteal';
        }
    } else {
        // Hardcoded map from prompt for 28 days
        if (currentDay >= 1 && currentDay <= 5) phase = 'menstrual';
        else if (currentDay >= 6 && currentDay <= 13) phase = 'follicular';
        else if (currentDay >= 14 && currentDay <= 16) phase = 'ovulation';
        else if (currentDay >= 17 && currentDay <= 28) phase = 'luteal';
    }

    let fertility = 'Low';
    if (phase === 'ovulation') fertility = 'High';
    else if (phase === 'follicular') fertility = 'Medium';

    return {
        phase,
        day: currentDay,
        daysUntilNextPeriod: cycleLength - currentDay + 1,
        fertility: fertility
    };
}

module.exports = { calculatePhase };
