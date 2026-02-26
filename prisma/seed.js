const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const messages = [
    // Menstrual
    { phase: 'menstrual', message_text: "[Partner] is in her period — this can be physically draining and uncomfortable. Take something off her plate today without being asked. Even making tea, handling a chore, or just being quiet company matters more than you think." },
    { phase: 'menstrual', message_text: "Today [Partner] might be dealing with cramps or fatigue. A warm drink, a hot water bottle, or simply asking 'is there anything you need?' can make a real difference. No grand gestures needed." },
    { phase: 'menstrual', message_text: "Menstrual days can feel heavy — energy is low and emotions can run close to the surface. Just being patient and present is genuinely enough today." },

    // Follicular
    { phase: 'follicular', message_text: "[Partner] is in her follicular phase — energy levels tend to rise and mood often lifts. A great time to suggest something fun or make plans together." },
    { phase: 'follicular', message_text: "Good energy day for [Partner]. If you've been meaning to plan something — a date night, a weekend trip, a new restaurant — bring it up today." },

    // Ovulation
    { phase: 'ovulation', message_text: "[Partner] is likely around ovulation — confidence and social energy are often at their peak. Tell her something specific you genuinely admire about her today." },
    { phase: 'ovulation', message_text: "Today is a great day to make [Partner] feel seen. A genuine compliment, a spontaneous plan, or just your full, undivided attention goes a long way right now." },

    // Luteal
    { phase: 'luteal', message_text: "The luteal phase can bring mood shifts, fatigue, and heightened sensitivity for [Partner]. Your patience today is a form of love." },
    { phase: 'luteal', message_text: "[Partner] may be craving comfort right now — her favourite meal, a low-key evening, or just sitting together without your phone." },

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
