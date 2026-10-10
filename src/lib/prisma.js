const { PrismaClient } = require('@prisma/client');

// Single shared client so the app holds one connection pool.
const prisma = new PrismaClient();

module.exports = { prisma };
