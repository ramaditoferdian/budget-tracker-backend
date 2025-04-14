import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const transactionTypes = [
    { id: 'income-type', name: 'Pemasukan' },
    { id: 'expense-type', name: 'Pengeluaran' },
    { id: 'transfer-type', name: 'Transfer' },
  ]

  const categories = [
    { id: 'makan-cat', name: 'Makan', transactionTypeId: 'expense-type' },
    { id: 'transport-cat', name: 'Transportasi', transactionTypeId: 'expense-type' },
    { id: 'hiburan-cat', name: 'Hiburan', transactionTypeId: 'expense-type' },
    { id: 'gaji-cat', name: 'Gaji', transactionTypeId: 'income-type' },
    { id: 'bonus-cat', name: 'Bonus', transactionTypeId: 'income-type' },
    { id: 'in-trans-cat', name: 'Masuk', transactionTypeId: 'transfer-type' },
    { id: 'out-trans-cat', name: 'Keluar', transactionTypeId: 'transfer-type' },
  ]

  for (const { id, name } of transactionTypes) {
    await prisma.transactionType.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        userId: null,
      },
    })
  }

  for (const { id, name, transactionTypeId } of categories) {
    await prisma.category.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        transactionTypeId,
        userId: null,
      },
    })
  }

  console.log('✅ Seeded with hardcoded IDs.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
