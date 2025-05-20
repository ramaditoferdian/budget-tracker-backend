import { prisma } from '../lib/prisma';

async function main() {
  const transactionTypes = [
    { id: 'income-type', name: 'Income' },
    { id: 'expense-type', name: 'Expense' },
    { id: 'transfer-type', name: 'Transfer' },
  ];

  const categories = [
    { id: 'food-cat', name: '🍽️ Food & Beverages', transactionTypeId: 'expense-type' },
    { id: 'transport-cat', name: '🚗 Transportation', transactionTypeId: 'expense-type' },
    { id: 'entertainment-cat', name: '🎤 Entertainment & Leisure', transactionTypeId: 'expense-type' },
    { id: 'salary-cat', name: '💰 Salary', transactionTypeId: 'income-type' },
    { id: 'bonus-cat', name: '🎉 Bonus', transactionTypeId: 'income-type' },
    { id: 'in-trans-cat', name: '📥 Incoming Funds', transactionTypeId: 'transfer-type' },
    { id: 'out-trans-cat', name: '📤 Outgoing Funds', transactionTypeId: 'transfer-type' },
  ];
  

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
