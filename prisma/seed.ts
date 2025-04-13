import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 🔥 Clear all existing data
  await prisma.transaction.deleteMany()
  await prisma.category.deleteMany()
  await prisma.source.deleteMany()
  await prisma.transactionTypes.deleteMany()

  console.log('🧹 Database cleared')

  // Dummy Transaction Types
  const transactionTypes = [
    { name: 'Income' },
    { name: 'Expense' },
  ]
  await prisma.transactionTypes.createMany({
    data: transactionTypes,
    skipDuplicates: true,
  })

  // Dummy Sources
  const sources = [
    { name: 'Cash' },
    { name: 'BCA' },
    { name: 'Dana' },
    { name: 'Gopay' },
    { name: 'OVO' },
  ]
  await prisma.source.createMany({
    data: sources,
    skipDuplicates: true,
  })

  // Dummy Categories
  const categories = [
    { name: 'Makanan' },
    { name: 'Transportasi' },
    { name: 'Hiburan' },
    { name: 'Belanja' },
    { name: 'Tagihan' },
  ]
  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  })

  // Ambil satu data dari masing-masing untuk relasi
  const type = await prisma.transactionTypes.findFirst({ where: { name: 'Expense' } })
  const source = await prisma.source.findFirst({ where: { name: 'Cash' } })
  const category = await prisma.category.findFirst({ where: { name: 'Makanan' } })

  if (!type || !source || !category) {
    console.warn('❗️Skipping transaction seed: Missing type, source, or category')
    return
  }

  // Dummy Transaction
  await prisma.transaction.create({
    data: {
      description: 'Makan malam di warung dekat kos',
      amount: 25000,
      date: new Date(),
      typeId: type.id,
      sourceId: source.id,
      categoryId: category.id
    }
  })

  console.log('✅ Seed completed: Types, Sources, Categories, and 1 Transaction')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
