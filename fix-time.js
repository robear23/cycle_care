require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    await prisma.user.updateMany({
        where: { notification_time: '6am' },
        data: { notification_time: '06:00' }
    });
    console.log('Fixed time for user');

    // Also check all users to be sure
    const users = await prisma.user.findMany();
    console.log(users.map(u => ({ id: u.id, time: u.notification_time })));
    await prisma.$disconnect();
}

fix();
