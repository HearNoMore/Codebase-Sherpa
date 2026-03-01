import { PrismaClient } from "@prisma/client";

// Single Prisma instance shared across the process
const prisma = new PrismaClient();

export default prisma;
