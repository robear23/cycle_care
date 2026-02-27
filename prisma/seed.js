const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const messages = [
    // Menstrual
    { phase: 'menstrual', message_text: "[Partner] is in her period — this can be physically draining and uncomfortable. Take something off her plate today without being asked. Even making tea, handling a chore, or just being quiet company matters more than you think." },
    { phase: 'menstrual', message_text: "Today [Partner] might be dealing with cramps or fatigue. A warm drink, a hot water bottle, or simply asking 'is there anything you need?' can make a real difference. No grand gestures needed." },
    { phase: 'menstrual', message_text: "Menstrual days can feel heavy — energy is low and emotions can run close to the surface. Just being patient and present is genuinely enough today." },
    { phase: 'menstrual', message_text: "During her period, [Partner]'s body is working hard. Encourage rest today. Ask her if she'd like you to draw a bath, make a hot meal, or just turn off the lights and watch a movie." },
    { phase: 'menstrual', message_text: "Pain or discomfort might be subtly draining [Partner]'s energy today. Your best move is to be low-demand and highly supportive. What is one small, completely selfless thing you can do for her right now?" },
    { phase: 'menstrual', message_text: "Don't take short responses or low energy personally today. [Partner] is in her menstrual phase. Offer a gentle back rub, some dark chocolate, or just a quiet evening on the couch." },

    // Follicular
    { phase: 'follicular', message_text: "[Partner] is in her follicular phase — energy levels tend to rise and mood often lifts. A great time to suggest something fun or make plans together." },
    { phase: 'follicular', message_text: "Good energy day for [Partner]. If you've been meaning to plan something — a date night, a weekend trip, a new restaurant — bring it up today." },
    { phase: 'follicular', message_text: "As estrogen rises, [Partner] might be feeling more creative, focused, or talkative. Be a good sounding board today and engage her in interesting conversations!" },
    { phase: 'follicular', message_text: "[Partner] is likely feeling resilient and optimistic today. It's a fantastic day to tackle projects together or try a new activity or hobby that gets you both moving." },
    { phase: 'follicular', message_text: "Capitalize on the great energy of the follicular phase! If [Partner] mentions an idea or something she wants to do, be an enthusiastic 'Yes! Let's do it!' today." },
    { phase: 'follicular', message_text: "The post-menstrual haze has cleared. [Partner] is likely feeling refreshed. Take notice of her good mood and match her energy today!" },

    // Ovulation
    { phase: 'ovulation', message_text: "[Partner] is likely around ovulation — confidence and social energy are often at their peak. Tell her something specific you genuinely admire about her today." },
    { phase: 'ovulation', message_text: "Today is a great day to make [Partner] feel seen. A genuine compliment, a spontaneous plan, or just your full, undivided attention goes a long way right now." },
    { phase: 'ovulation', message_text: "Estrogen and testosterone are at their peak for [Partner]. Social interaction feels effortless and libido may naturally increase. Plan a beautifully intentional date night!" },
    { phase: 'ovulation', message_text: "[Partner] is magnetic today! She is in the ovulation window, where biologically, confidence and communication are deeply heightened. Flirt with her!" },
    { phase: 'ovulation', message_text: "Make [Partner] feel incredibly beautiful today. During ovulation, a thoughtful compliment about how she looks or how she carries herself will land perfectly." },
    { phase: 'ovulation', message_text: "You might notice [Partner] is highly driven and visibly glowing today. Step up your romance game today—she's intensely receptive to connection and affection right now." },

    // Luteal
    { phase: 'luteal', message_text: "The luteal phase can bring mood shifts, fatigue, and heightened sensitivity for [Partner]. Your patience today is a form of love." },
    { phase: 'luteal', message_text: "[Partner] may be craving comfort right now — her favourite meal, a low-key evening, or just sitting together without your phone." },
    { phase: 'luteal', message_text: "As progesterone dominates the luteal phase, [Partner] might feel more inward, nesting, or physically tired. Ask her 'What sounds comforting tonight?'" },
    { phase: 'luteal', message_text: "[Partner] might be experiencing early PMS symptoms today like bloating or gentle irritability. Stay grounded, don't take it personally, and offer a reassuring hug." },
    { phase: 'luteal', message_text: "The luteal phase is a transition towards rest. Overstimulation can be stressful for [Partner] right now. Suggest an incredibly cozy, low-stress night in." },
    { phase: 'luteal', message_text: "[Partner] may doubt herself more today due to hormonal shifts. Be fiercely supportive. A random 'I'm so proud of you' text can completely change her day." },
    { phase: 'luteal', message_text: "If [Partner] seems a bit on edge or overwhelmed today, don't try to 'fix' it. Just listen intensely, validate her feelings entirely, and be her safe space." },

    // General
    { phase: 'general', message_text: "Make [Partner] feel special today with a heartfelt, specific compliment." },
    { phase: 'general', message_text: "Surprise [Partner] with a small gesture — a note, a text, her favourite coffee." }
];

async function main() {
    console.log('Seeding database...');
    for (const msg of messages) {
        await prisma.message.create({
            data: msg
        });
    }
    console.log('Seeding complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
