const { addDays, userToday, formatCalendarDate } = require('./dates');
const { partnerName } = require('./briefing');

const DAY_MS = 1000 * 60 * 60 * 24;
const FULL_TERM_DAYS = 280;

// Sizes are rough averages (crown-to-rump until week 20, crown-to-heel after).
const WEEKS = {
    3: { size: 'a grain of sand', measure: 'about 0.1 mm', baby: 'Fertilisation has happened and a tiny ball of cells is on its way to implant in the uterus.', mum: "She probably won't notice much yet — perhaps mild cramps or light spotting as it implants." },
    4:{ size: 'a poppy seed', measure: 'about 1 mm', baby: 'The embryo has just implanted and the placenta is starting to form.', mum: "She may not feel any different yet, or might notice light spotting, tender breasts and tiredness." },
    5: { size: 'a sesame seed', measure: 'about 2 mm', baby: 'The heart is starting to form, along with the beginnings of the brain and spinal cord.', mum: 'Tiredness, sore breasts and needing to wee more often are common now.' },
    6: { size: 'a lentil', measure: 'about 5 mm', baby: 'A tiny heartbeat has started, and buds that will become arms and legs are appearing.', mum: 'Morning sickness often starts around now — and it can strike at any time of day.' },
    7: { size: 'a blueberry', measure: 'about 1 cm', baby: 'The brain is growing fast, and the face is beginning to take shape.', mum: 'Nausea, food aversions and a heightened sense of smell can make meals tricky.' },
    8: { size: 'a raspberry', measure: 'about 1.6 cm', baby: 'Fingers and toes are starting to form, and the baby is making small movements.', mum: 'Exhaustion can be intense in the first trimester. Mood swings are common too.' },
    9: { size: 'a cherry', measure: 'about 2.3 cm', baby: 'All the essential organs have begun to form, and tiny muscles are developing.', mum: 'She may feel bloated, nauseous and emotional — hormones are running high.' },
    10: { size: 'a strawberry', measure: 'about 3 cm', baby: 'The embryo is now officially a foetus. Tiny nails and tooth buds are forming.', mum: 'Waistbands may start to feel tight, and tiredness and nausea may still be hanging around.' },
    11: { size: 'a lime', measure: 'about 4 cm', baby: 'The baby can open and close its fists, and its bones are starting to harden.', mum: 'For many, nausea starts to ease soon. Heartburn and headaches can pop up.' },
    12: { size: 'a plum', measure: 'about 5.4 cm, 14 g', baby: 'Reflexes are developing — the baby can curl its toes and may even suck its thumb.', mum: 'The 12-week scan is usually around now, which can bring a mix of nerves and excitement.' },
    13: { size: 'a lemon', measure: 'about 7.4 cm, 23 g', baby: 'Vocal cords are forming and the intestines are moving into the tummy.', mum: 'This is the last week of the first trimester — energy often starts creeping back.' },
    14: { size: 'a peach', measure: 'about 8.7 cm, 43 g', baby: 'The baby can squint, frown and grimace, and fine hair is growing on its body.', mum: 'Welcome to the second trimester — often the most comfortable stretch. Appetite may return.' },
    15: { size: 'an apple', measure: 'about 10 cm, 70 g', baby: 'The baby can sense light through its eyelids and is practising breathing movements.', mum: 'She may have a stuffy nose or bleeding gums — both are common pregnancy side effects.' },
    16: { size: 'an avocado', measure: 'about 11.6 cm, 100 g', baby: 'The heart is pumping around 25 litres of blood a day, and the eyes can move.', mum: "A small bump may be showing. Some people feel a 'pregnancy glow', others just feel tired." },
    17: { size: 'a pear', measure: 'about 13 cm, 140 g', baby: 'Fat stores are starting to build up and the skeleton is turning from cartilage to bone.', mum: 'Her balance may shift as the bump grows, and she may feel hungrier than usual.' },
    18: { size: 'a bell pepper', measure: 'about 14 cm, 190 g', baby: 'The ears are in position and the baby may be able to hear sounds.', mum: 'She might start to feel the first flutters of movement soon. Back aches can begin.' },
    19: { size: 'a mango', measure: 'about 15 cm, 240 g', baby: 'A waxy coating called vernix is forming to protect the skin.', mum: 'Aches in the hips and lower tummy are common as the ligaments stretch.' },
    20: { size: 'a banana', measure: 'about 25 cm, 300 g', baby: "Halfway there! The baby is swallowing and moving around plenty.", mum: 'The anomaly scan is usually around now. Kicks may be getting easier to feel.' },
    21: { size: 'a carrot', measure: 'about 27 cm, 360 g', baby: 'The baby has regular sleep and wake cycles now.', mum: 'She may notice leg cramps, swollen ankles or Braxton Hicks practice contractions.' },
    22: { size: 'a papaya', measure: 'about 28 cm, 430 g', baby: 'Eyebrows and eyelashes are growing, and the baby can feel touch.', mum: 'Stretch marks may appear, and she might be feeling warmer than usual.' },
    23: { size: 'a grapefruit', measure: 'about 29 cm, 500 g', baby: "The baby can hear your voices — talking to the bump really does reach them.", mum: 'Swelling in the feet and ankles is common. Comfortable shoes help.' },
    24: { size: 'an ear of corn', measure: 'about 30 cm, 600 g', baby: 'The lungs are developing the cells that will let them breathe air.', mum: 'She may be offered a glucose test around now. Sleep may get harder.' },
    25: { size: 'a cauliflower', measure: 'about 34 cm, 660 g', baby: 'The baby is filling out with fat and its skin is getting smoother.', mum: 'Heartburn, back pain and restless legs can all make an appearance.' },
    26: { size: 'a lettuce', measure: 'about 36 cm, 760 g', baby: 'The eyes are starting to open, and the baby may respond to loud sounds.', mum: "She might feel short of breath as the bump pushes up — she's not imagining it." },
    27: { size: 'a cabbage', measure: 'about 37 cm, 875 g', baby: 'The brain is very active, and the baby may get hiccups you can feel.', mum: "Last week of the second trimester. Tiredness may return as she carries more weight." },
    28: { size: 'an aubergine', measure: 'about 38 cm, 1 kg', baby: 'The baby can blink and may be dreaming during REM sleep.', mum: 'Third trimester! Antenatal appointments get more frequent. Sleep can be uncomfortable.' },
    29: { size: 'a butternut squash', measure: 'about 38.5 cm, 1.2 kg', baby: 'Muscles and lungs are maturing and the head is growing to fit the brain.', mum: "Kicks are stronger and she may feel them at night. Constipation is common." },
    30: { size: 'a large cucumber', measure: 'about 40 cm, 1.3 kg', baby: "The baby's bone marrow is now making red blood cells.", mum: 'She may feel clumsy, breathless and more emotional as the due date gets closer.' },
    31: { size: 'a coconut', measure: 'about 41 cm, 1.5 kg', baby: 'The baby can turn its head and is gaining weight quickly.', mum: 'Leaking breasts, back pain and frequent trips to the loo are all normal now.' },
    32: { size: 'a swede', measure: 'about 42 cm, 1.7 kg', baby: 'Toenails have grown and the baby is practising breathing and sucking.', mum: 'She may find it hard to get comfortable in bed — extra pillows can help.' },
    33: { size: 'a pineapple', measure: 'about 43.5 cm, 1.9 kg', baby: "The baby's bones are hardening, though the skull stays soft for birth.", mum: 'Swelling, aching hips and broken sleep are common in these weeks.' },
    34: { size: 'a cantaloupe melon', measure: 'about 45 cm, 2.1 kg', baby: 'The central nervous system and lungs are maturing.', mum: 'She may be thinking about her birth plan and packing a hospital bag.' },
    35: { size: 'a honeydew melon', measure: 'about 46 cm, 2.4 kg', baby: 'Most of the basic development is done — now it is mostly about growing.', mum: 'Running out of room means she may need to wee constantly and feel very full after meals.' },
    36: { size: 'a head of romaine lettuce', measure: 'about 47 cm, 2.6 kg', baby: 'The baby may be moving head-down, getting into position for birth.', mum: "When the baby drops, breathing may get easier but pelvic pressure increases." },
    37: { size: 'a bunch of chard', measure: 'about 48.5 cm, 2.9 kg', baby: 'The baby is now considered early term and is practising breathing.', mum: 'Braxton Hicks may get stronger. Nesting urges are common.' },
    38: { size: 'a leek', measure: 'about 49.5 cm, 3.1 kg', baby: 'The baby has a firm grasp and its organs are ready for life outside.', mum: "She's likely tired, uncomfortable and eager to meet the baby. Patience helps." },
    39: { size: 'a small watermelon', measure: 'about 50.5 cm, 3.3 kg', baby: 'The baby is full term and building fat to keep warm after birth.', mum: 'Any day now could be the day. Keep phones charged and the bag by the door.' },
    40: { size: 'a pumpkin', measure: 'about 51 cm, 3.5 kg', baby: 'The baby is ready to arrive. Only a small number are born exactly on their due date.', mum: 'She may be feeling impatient, uncomfortable or anxious. Lots of reassurance helps.' },
    41: { size: 'a pumpkin', measure: 'about 51.5 cm, 3.6 kg', baby: "The baby is still growing and doing well — many first babies arrive after their due date.", mum: 'She may be offered a membrane sweep or a plan for induction. Waiting is hard.' },
    42: { size: 'a pumpkin', measure: 'about 51.5 cm, 3.7 kg', baby: 'The baby is fully ready to be born.', mum: 'If labour has not started, the midwife will talk through induction. Not long now.' }
};

/**
 * Estimated due date: 280 days after the first day of the last period before
 * pregnancy (Naegele's rule).
 *
 * @param {Date} lastPeriodStart - Calendar date (UTC midnight)
 * @returns {Date} calendar date
 */
function estimateDueDate(lastPeriodStart) {
    return addDays(lastPeriodStart, FULL_TERM_DAYS);
}

/**
 * How far along the pregnancy is on the user's local today. Pregnancy mode keeps
 * cycle_start_date frozen at the last period before pregnancy.
 *
 * @returns {{ weeks: number, days: number, dueDate: Date, daysToGo: number }}
 *   weeks/days are completed weeks plus extra days; daysToGo is negative once overdue
 */
function pregnancyProgress(user, now = new Date()) {
    const dueDate = estimateDueDate(user.cycle_start_date);
    const daysToGo = Math.round((dueDate - userToday(user.timezone, now)) / DAY_MS);
    const elapsed = FULL_TERM_DAYS - daysToGo;
    return { weeks: Math.floor(elapsed / 7), days: ((elapsed % 7) + 7) % 7, dueDate, daysToGo };
}

function countdown(daysToGo) {
    if (daysToGo === 0) return 'that\'s today!';
    if (daysToGo < 0) {
        const over = -daysToGo;
        return `${over} day${over === 1 ? '' : 's'} past — any day now`;
    }
    const weeks = Math.floor(daysToGo / 7);
    const days = daysToGo % 7;
    const parts = [];
    if (weeks) parts.push(`${weeks} week${weeks === 1 ? '' : 's'}`);
    if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
    return `${parts.join(', ')} to go`;
}

// e.g. "📅 Due date: Fri, 25 Jun 2027 (36 weeks, 1 day to go)"
function dueDateLine(user, now = new Date()) {
    const { dueDate, daysToGo } = pregnancyProgress(user, now);
    const dueText = formatCalendarDate(dueDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return `📅 Due date: ${dueText} (${countdown(daysToGo)})`;
}

/**
 * The update for the pregnancy week the user is currently in.
 *
 * @returns {string | null} null outside the weeks we have content for (3–42)
 */
function buildPregnancyUpdate(user, now = new Date()) {
    const { weeks } = pregnancyProgress(user, now);
    const week = WEEKS[weeks];
    if (!week) return null;

    const name = partnerName(user);

    return [
        `🤰 ${weeks} weeks pregnant`,
        `👶 Baby is about the size of ${week.size} (${week.measure}). ${week.baby}`,
        `💜 How ${name || 'your partner'} may be feeling: ${week.mum}`,
        dueDateLine(user, now)
    ].join('\n\n');
}

// Weekly updates go out on the day each new pregnancy week starts.
function isPregnancyUpdateDay(user, now = new Date()) {
    return pregnancyProgress(user, now).days === 0;
}

module.exports = { estimateDueDate, pregnancyProgress, dueDateLine, buildPregnancyUpdate, isPregnancyUpdateDay };
