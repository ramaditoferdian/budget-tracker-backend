import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const defaultCategories = [
    { name: 'Makan', transactionType: 'Pengeluaran' },
    { name: 'Transportasi', transactionType: 'Pengeluaran' },
    { name: 'Hiburan', transactionType: 'Pengeluaran' },
    { name: 'Gaji', transactionType: 'Pemasukan' },
    { name: 'Bonus', transactionType: 'Pemasukan' },
  ]

  const defaultTransactionTypes = ['Pemasukan', 'Pengeluaran']

  // Seed transaction types
  for (const name of defaultTransactionTypes) {
    const existing = await prisma.transactionType.findFirst({
      where: { name, userId: null },
    })

    if (!existing) {
      await prisma.transactionType.create({
        data: { name, userId: null },
      })
    }
  }

  // Seed categories and link to transaction types
  for (const { name, transactionType } of defaultCategories) {
    const transactionTypeRecord = await prisma.transactionType.findFirst({
      where: { name: transactionType, userId: null },
    })

    if (!transactionTypeRecord) {
      console.log(`Transaction Type "${transactionType}" not found, skipping category "${name}".`)
      continue
    }

    const existing = await prisma.category.findFirst({
      where: { name, userId: null },
    })

    if (!existing) {
      await prisma.category.create({
        data: {
          name,
          userId: null, // Default userId = null
          transactionTypeId: transactionTypeRecord.id, // Link category to transaction type
        },
      })
    }
  }

  console.log('✅ Default categories and transaction types seeded.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
