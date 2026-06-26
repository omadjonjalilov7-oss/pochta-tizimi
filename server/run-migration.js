const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding columns to external_read_receipts...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE external_read_receipts 
      ADD COLUMN IF NOT EXISTS read_link_token VARCHAR(128) UNIQUE
    `);
    console.log('✓ read_link_token column added');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE external_read_receipts 
      ADD COLUMN IF NOT EXISTS read_method VARCHAR(20)
    `);
    console.log('✓ read_method column added');
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_external_read_receipts_read_link_token 
      ON external_read_receipts(read_link_token)
    `);
    console.log('✓ Index created');
    
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
