// src/helpers/modules/transactions/getRangeRecap.ts

import { prisma } from "../../../lib/prisma";

export const getRangeRecap = async ({
  filters,
  sortField,
  sortOrder,
  pagination
}: {
  filters: any;
  sortField: string;
  sortOrder: string;
  pagination: { skip: number; limit: number };
}) => {
  const transactions = await prisma.transaction.findMany({
    where: filters,
    orderBy: [
      {[sortField]: sortOrder},
      {createdAt: 'desc'},
    ],
    // skip: pagination.skip,
    // take: pagination.limit,
    include: {
      type: true,
      category: true,
      source: true,
      targetSource: true,
    },
  });

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((tx) => {
    const typeId = tx.type?.id;

    if (typeId === 'income-type') {
      totalIncome += tx.amount;
    } else if (typeId === 'expense-type') {
      totalExpense += tx.amount;
    }
  });

  return {
    totalIncome,
    totalExpense,
  };
};
