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

    // Show actual elapsed day — do NOT wrap with modulo.
    // Wrapping caused a bug where the day reset to 1 (Menstrual) when the cycle
    // exceeded its expected length, even if the user hadn't confirmed a new period.
    let currentDay = diffDays + 1;

    // For phase calculation only, clamp to cycleLength so the phase logic
    // stays in the correct range (never shows an out-of-bounds day as follicular).
    const phaseDay = Math.min(currentDay, cycleLength);

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

    if (phaseDay >= 1 && phaseDay <= 5) {
        phase = 'menstrual';
    } else if (phaseDay >= lutealStart && phaseDay <= cycleLength) {
        phase = 'luteal';
    } else if (phaseDay >= ovulationDay - 1 && phaseDay <= ovulationDay + 1) {
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

        if (phaseDay <= 5) {
            phase = 'menstrual';
        } else if (phaseDay > 5 && phaseDay < ovulationStart) {
            phase = 'follicular';
        } else if (phaseDay >= ovulationStart && phaseDay <= ovulationEnd) {
            phase = 'ovulation';
        } else {
            phase = 'luteal';
        }
    } else {
        // Hardcoded map from prompt for 28 days
        if (phaseDay >= 1 && phaseDay <= 5) phase = 'menstrual';
        else if (phaseDay >= 6 && phaseDay <= 13) phase = 'follicular';
        else if (phaseDay >= 14 && phaseDay <= 16) phase = 'ovulation';
        else if (phaseDay >= 17 && phaseDay <= 28) phase = 'luteal';
    }

    let fertility = 'Low';
    if (phase === 'ovulation') fertility = 'High';
    else if (phase === 'follicular') fertility = 'Medium';

    return {
        phase,
        day: currentDay,
        daysUntilNextPeriod: Math.max(0, cycleLength - currentDay + 1),
        fertility: fertility
    };
}

/**
 * Get the date ranges for the upcoming luteal and subsequent menstrual phases.
 * 
 * @param {Date} cycleStartDate - The start date of the last period
 * @param {number} cycleLength - The length of the cycle in days
 * @param {Date} [referenceDate=new Date()] - Date to project from
 * @returns {Object} - { luteal: { start, end }, menstrual: { start, end } }
 */
function getUpcomingPhasesRanges(cycleStartDate, cycleLength = 28, referenceDate = new Date()) {
    const start = new Date(cycleStartDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let currentDay = diffDays + 1;

    // Projection logic: if currentDay is past the cycle length, 
    // we project forward to the "current" cycle.
    let projectionStart = new Date(start);
    while (currentDay > cycleLength) {
        projectionStart.setDate(projectionStart.getDate() + cycleLength);
        currentDay -= cycleLength;
    }

    let lutealStartDay, lutealEndDay;
    if (cycleLength === 28) {
        lutealStartDay = 17;
        lutealEndDay = 28;
    } else {
        const estimatedOvulation = cycleLength - 14;
        lutealStartDay = estimatedOvulation + 2;
        lutealEndDay = cycleLength;
    }

    // Phase 1: Luteal
    const lutealRangeStart = new Date(projectionStart);
    lutealRangeStart.setDate(lutealRangeStart.getDate() + (lutealStartDay - 1));
    const lutealRangeEnd = new Date(projectionStart);
    lutealRangeEnd.setDate(lutealRangeEnd.getDate() + (lutealEndDay - 1));

    // Phase 2: Subsequent Menstrual
    const menstrualRangeStart = new Date(projectionStart);
    menstrualRangeStart.setDate(menstrualRangeStart.getDate() + cycleLength);
    const menstrualRangeEnd = new Date(projectionStart);
    menstrualRangeEnd.setDate(menstrualRangeEnd.getDate() + cycleLength + 4);

    return {
        luteal: { start: lutealRangeStart, end: lutealRangeEnd },
        menstrual: { start: menstrualRangeStart, end: menstrualRangeEnd }
    };
}

module.exports = { calculatePhase, getUpcomingPhasesRanges };
