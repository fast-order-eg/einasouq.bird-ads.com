import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const cols = await prisma.$queryRawUnsafe('DESCRIBE pagepost;');
    console.log('pagepost columns:', cols);

    // Add missing columns if needed
    const colNames = cols.map(c => c.Field.toLowerCase());
    if (!colNames.includes('viewsCount'.toLowerCase())) {
      console.log('Adding viewsCount...');
      await prisma.$queryRawUnsafe('ALTER TABLE pagepost ADD COLUMN viewsCount INT NOT NULL DEFAULT 0;');
    }
    if (!colNames.includes('permalinkUrl'.toLowerCase())) {
      console.log('Adding permalinkUrl...');
      await prisma.$queryRawUnsafe('ALTER TABLE pagepost ADD COLUMN permalinkUrl TEXT NULL;');
    }
    if (!colNames.includes('attachmentsJson'.toLowerCase())) {
      console.log('Adding attachmentsJson...');
      await prisma.$queryRawUnsafe('ALTER TABLE pagepost ADD COLUMN attachmentsJson LONGTEXT NULL;');
    }
    if (!colNames.includes('analysisJson'.toLowerCase())) {
      console.log('Adding analysisJson...');
      await prisma.$queryRawUnsafe('ALTER TABLE pagepost ADD COLUMN analysisJson LONGTEXT NULL;');
    }
    console.log('Database migration verified successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
