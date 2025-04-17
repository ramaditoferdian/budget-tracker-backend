import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { success, error, validationError, result } from '../helpers/response'
import { authenticateToken } from '../middleware/auth'
import { startOfMonth, endOfMonth, format, eachDayOfInterval } from 'date-fns'
import { generatePaginationResult, parsePagination } from '../utils/pagination'

const router = Router()
const prisma = new PrismaClient()

interface AuthenticatedRequest extends Request {
  user?: { id: string }
}

interface TransactionBody {
  description: string
  date?: string
  amount: number
  typeId: string
  sourceId: string
  categoryId: string
  targetSourceId?: string // Untuk transfer
}

// GET /transactions - dengan filter, sort, dan pagination
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { sortBy = 'createdAt', order = 'desc', startDate, endDate, typeId, categoryId, sourceId, page, limit } = req.query;

  // Validasi dan filter berdasarkan query params
  const allowedSortFields = ['createdAt', 'amount', 'updatedAt', 'date'];
  const allowedOrder = ['asc', 'desc'];

  const sortField = allowedSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
  const sortOrder = allowedOrder.includes(String(order)) ? String(order) : 'desc';

  let start: Date;
  let end: Date;

  // Parsing filter tanggal
  if (startDate && endDate) {
    start = new Date(startDate as string);
    end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json(error('Invalid startDate or endDate format. Use YYYY-MM-DD', 'INVALID_DATE_FORMAT', 400));
      return 
    }
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Menggunakan helper pagination
  const pagination = parsePagination({ page, limit });

  const filters: any = {
    userId,
    date: {
      gte: start,
      lte: end,
    },
  };

  // Filter tambahan berdasarkan typeId, categoryId, sourceId
  if (typeId) {
    filters.typeId = typeId;
  }

  if (categoryId) {
    filters.categoryId = categoryId;
  }

  if (sourceId) {
    filters.sourceId = sourceId;
  }

  try {
    // Query untuk mendapatkan transaksi
    const [transactions, totalRows] = await Promise.all([
      prisma.transaction.findMany({
        where: filters,
        orderBy: [
          {[sortField]: sortOrder},
          {createdAt: 'desc'},
        ],
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          type: true,
          category: true,
          source: true,
          targetSource: true,
        },
      }),
      prisma.transaction.count({ where: filters }),
    ]);

    const paginationResult = generatePaginationResult(totalRows, pagination);
    const response = result({ transactions }, paginationResult);

    res.status(200).json(success(response));
  } catch (err) {
    console.error('GET /transactions error:', err);
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500)); 
  }
});

router.get('/calendar', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const monthParam = String(req.query.month)

  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    res.status(400).json(error('Invalid month format. Use YYYY-MM', 'INVALID_MONTH_FORMAT', 400))
    return
  }

  const start = new Date(`${monthParam}-01`)
  const end = endOfMonth(start)

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        type: true,
      },
    })

    const resultMap: Record<string, Record<string, number>> = {}

    for (const tx of transactions) {
      const dateStr = format(tx.date, 'yyyy-MM-dd')
      const typeName = tx.type?.name.toLowerCase() // jaga-jaga biar lowercase

      if (!resultMap[dateStr]) resultMap[dateStr] = {}
      if (typeName !== undefined) {
        if (!resultMap[dateStr][typeName]) resultMap[dateStr][typeName] = 0
        resultMap[dateStr][typeName] += tx.amount
      }
    }

    const allDates = eachDayOfInterval({ start, end }).map(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const types = resultMap[dateStr] || {}

      const pemasukan = types['pemasukan'] || 0
      const pengeluaran = types['pengeluaran'] || 0

      return {
        date: dateStr,
        types,
        netAmount: pemasukan - pengeluaran,
      }
    })

    res.json(success(allDates))
  } catch (err) {
    console.error('GET /transactions/calendar error:', err)
    res.status(500).json(error('Failed to load calendar data', 'INTERNAL_ERROR', 500))
    return
  }
});

// GET /transactions/summary
router.get('/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const monthParam = String(req.query.month)

  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    res.status(400).json(error('Invalid month format. Use YYYY-MM', 'INVALID_MONTH_FORMAT', 400))
    return
  }

  const start = new Date(`${monthParam}-01`)
  const end = endOfMonth(start)

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        type: true,
      },
    })

    // Hitung total pemasukan, pengeluaran, dan tabungan
    let totalPemasukan = 0
    let totalPengeluaran = 0
    let totalTabungan = 0

    transactions.forEach(tx => {
      if (tx.type?.name.toLowerCase() === 'pemasukan') {
        totalPemasukan += tx.amount
      } else if (tx.type?.name.toLowerCase() === 'pengeluaran') {
        totalPengeluaran += tx.amount
      } else if (tx.type?.name.toLowerCase() === 'tabungan') {
        totalTabungan += tx.amount
      }
    })

    // Kembalikan data summary
    const summary = {
      month: monthParam,
      totalPemasukan,
      totalPengeluaran,
      totalTabungan,
      netAmount: totalPemasukan - totalPengeluaran,  // netAmount = pemasukan - pengeluaran
    }

    res.json(success(summary))
  } catch (err) {
    console.error('GET /transactions/summary error:', err)
    res.status(500).json(error('Failed to load summary data', 'INTERNAL_ERROR', 500))
    return
  }
})


// GET /transactions/:id
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        type: true,
        category: true,
        source: true,
        targetSource: true,
      },
    })

    if (!transaction) {
      res.status(404).json(error('Transaction not found', 'NOT_FOUND', 404))
      return
    }

    res.json(success(transaction))
  } catch (err) {
    console.error('GET /transactions/:id error:', err)
    res.status(500).json(error('Failed to fetch transaction', 'INTERNAL_ERROR', 500))
    return
  }
})

// POST /transactions
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const {
    amount,
    typeId,
    sourceId,
    targetSourceId,
    categoryId,
    description,
    date,
  } = req.body as TransactionBody;

  const errors = [];

  if (!description) errors.push({ field: 'description', message: 'Description is required' });
  if (amount === undefined || amount === null || isNaN(amount)) {
    errors.push({ field: 'amount', message: 'Amount must be a valid number' });
  }
  if (!typeId) errors.push({ field: 'typeId', message: 'Transaction type is required' });
  if (!sourceId) errors.push({ field: 'sourceId', message: 'Source is required' });

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401));
    return;
  }

  try {
    const type = await prisma.transactionType.findUnique({ where: { id: typeId } });
    if (!type) {
      res.status(400).json(error('Invalid transaction type', 'INVALID_TYPE', 400));
      return;
    }

    const typeName = type.name.toLowerCase();

    if ((typeName !== 'transfer' && typeName !== 'tabungan') && !categoryId) {
      errors.push({ field: 'categoryId', message: 'Category is required' });
    }

    if ((typeName === 'transfer' || typeName === 'tabungan') && sourceId === targetSourceId) {
      errors.push({ field: 'targetSourceId', message: 'Target source cannot be the same as source' });
    }

    if (errors.length > 0) {
      res.status(400).json(validationError(errors));
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      if (typeName === 'transfer' || typeName === 'tabungan') {
        if (!targetSourceId) {
          return {
            error: true,
            status: 400,
            code: 'TARGET_SOURCE_ID_REQUIRED',
            message: 'Target source id is required for transfer',
          };
        }

        const [source, targetSource] = await Promise.all([
          tx.source.findUnique({ where: { id: sourceId } }),
          tx.source.findUnique({ where: { id: targetSourceId } }),
        ]);

        if (!source || !targetSource) {
          return {
            error: true,
            status: 404,
            code: 'SOURCE_NOT_FOUND',
            message: 'Source or target source not found',
          };
        }

        if (source.balance < amount) {
          return {
            error: true,
            status: 400,
            code: 'INSUFFICIENT_FUNDS',
            message: 'Insufficient balance',
          };
        }

        const transfer = await tx.transaction.create({
          data: {
            description,
            amount,
            typeId,
            sourceId,
            targetSourceId,
            userId,
            date: date ? new Date(date) : undefined,
            categoryId: null,
          },
        });

        await tx.source.update({
          where: { id: sourceId },
          data: { balance: { decrement: amount } },
        });

        await tx.source.update({
          where: { id: targetSourceId },
          data: { balance: { increment: amount } },
        });

        return { data: transfer };
      }

      // Untuk pemasukan dan pengeluaran
      const created = await tx.transaction.create({
        data: {
          description,
          amount,
          typeId,
          sourceId,
          targetSourceId: null,
          categoryId,
          userId,
          date: date ? new Date(date) : undefined,
        },
      });

      if (typeName === 'pemasukan') {
        await tx.source.update({
          where: { id: sourceId },
          data: { balance: { increment: amount } },
        });
      } else if (typeName === 'pengeluaran') {
        const source = await tx.source.findUnique({ where: { id: sourceId } });
        if (!source) {
          return {
            error: true,
            status: 404,
            code: 'SOURCE_NOT_FOUND',
            message: 'Source not found',
          };
        }

        if (source.balance < amount) {
          return {
            error: true,
            status: 400,
            code: 'INSUFFICIENT_FUNDS',
            message: 'Insufficient balance',
          };
        }

        await tx.source.update({
          where: { id: sourceId },
          data: { balance: { decrement: amount } },
        });
      }

      return { data: created };
    });

    if ('error' in result) {
      res.status(result.status!).json(error(result.message!, result.code, result.status));
      return;
    }

    res.status(201).json(success(result.data));
  } catch (err) {
    console.error('POST /transactions error:', err);
    res.status(500).json(error('Failed to create transaction', 'INTERNAL_ERROR', 500));
  }
});


// PUT /transactions/:id
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { id } = req.params;
  const {
    amount,
    typeId,
    sourceId,
    targetSourceId,
    categoryId,
    description,
    date,
  } = req.body as TransactionBody;

  const errors = [];

  if (!description) errors.push({ field: 'description', message: 'Description is required' });
  if (amount === undefined || amount === null || isNaN(amount)) {
    errors.push({ field: 'amount', message: 'Amount must be a valid number' });
  }
  if (!typeId) errors.push({ field: 'typeId', message: 'Transaction type is required' });
  if (!sourceId) errors.push({ field: 'sourceId', message: 'Source is required' });

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401));
    return;
  }

  const existing = await prisma.transaction.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== userId) {
    res.status(404).json(error('Transaction not found', 'NOT_FOUND', 404));
    return;
  }

  try {
    const type = await prisma.transactionType.findUnique({ where: { id: typeId } });
    if (!type) {
      res.status(400).json(error('Invalid transaction type', 'INVALID_TYPE', 400));
      return;
    }

    const typeName = type.name.toLowerCase();

    if ((typeName !== 'transfer' && typeName !== 'tabungan') && !categoryId) {
      errors.push({ field: 'categoryId', message: 'Category is required' });
    }

    if ((typeName === 'transfer' || typeName === 'tabungan') && sourceId === targetSourceId) {
      errors.push({ field: 'targetSourceId', message: 'Target source cannot be the same as source' });
    }

    if (errors.length > 0) {
      res.status(400).json(validationError(errors));
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Revert saldo lama
      const oldType = await tx.transactionType.findUnique({ where: { id: existing.typeId! } });
      const oldTypeName = oldType?.name.toLowerCase();

      if (oldTypeName === 'pemasukan') {
        await tx.source.update({
          where: { id: existing.sourceId! },
          data: { balance: { decrement: existing.amount } },
        });
      } else if (oldTypeName === 'pengeluaran') {
        await tx.source.update({
          where: { id: existing.sourceId! },
          data: { balance: { increment: existing.amount } },
        });
      } else if (oldTypeName === 'transfer' || oldTypeName === 'tabungan') {
        await tx.source.update({
          where: { id: existing.sourceId! },
          data: { balance: { increment: existing.amount } },
        });

        if (existing.targetSourceId) {
          await tx.source.update({
            where: { id: existing.targetSourceId },
            data: { balance: { decrement: existing.amount } },
          });
        }
      }

      // 2. Validasi saldo baru jika pengeluaran atau transfer
      if ((typeName === 'pengeluaran' || typeName === 'transfer' || typeName === 'tabungan') && sourceId) {
        const source = await tx.source.findUnique({ where: { id: sourceId } });
        if (!source || source.balance < amount) {
          return {
            error: true,
            status: 400,
            code: 'INSUFFICIENT_FUNDS',
            message: 'Insufficient balance',
          };
        }
      }

      // 3. Update transaksi
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          description,
          amount,
          typeId,
          sourceId,
          targetSourceId: (typeName === 'transfer' || typeName === 'tabungan') ? targetSourceId : null,
          categoryId: (typeName === 'pemasukan' || typeName === 'pengeluaran') ? categoryId : null,
          date: date ? new Date(date) : undefined,
        },
      });

      // 4. Update saldo baru
      if (typeName === 'pemasukan') {
        await tx.source.update({
          where: { id: sourceId },
          data: { balance: { increment: amount } },
        });
      } else if (typeName === 'pengeluaran') {
        await tx.source.update({
          where: { id: sourceId },
          data: { balance: { decrement: amount } },
        });
      } else if (typeName === 'transfer' || typeName === 'tabungan') {
        await tx.source.update({
          where: { id: sourceId },
          data: { balance: { decrement: amount } },
        });

        if (targetSourceId) {
          await tx.source.update({
            where: { id: targetSourceId },
            data: { balance: { increment: amount } },
          });
        }
      }

      return { data: updated };
    });

    if ('error' in result) {
      res.status(result.status!).json(error(result.message!, result.code, result.status));
      return;
    }

    res.status(200).json(success(result.data));
  } catch (err) {
    console.error('PUT /transactions/:id error:', err);
    res.status(500).json(error('Failed to update transaction', 'INTERNAL_ERROR', 500));
  }
});



// DELETE /transactions/:id - delete a transaction
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        type: true,
        source: true,
        targetSource: true, // Include the linked "in" transaction for transfers
      },
    })

    if (!transaction) {
      res.status(404).json(error('Transaction not found', 'NOT_FOUND', 404))
      return 
    }

    // if (transaction.type.name.toLowerCase() === 'transfer') {
    //   const { sourceId, amount, targetSource } = transaction

    //   await prisma.$transaction(async (tx) => {
    //     // Update the balances of the source and target sources
    //     await tx.source.update({ where: { id: sourceId }, data: { balance: { increment: amount } } })
    //     await tx.source.update({ where: { id: targetSource?.id }, data: { balance: { decrement: amount } } })

    //     // Delete both "in" and "out" transactions
    //     await tx.transaction.delete({ where: { id: transaction.id } })
    //     await tx.transaction.delete({ where: { id: targetSource?.id } })
    //   })

    //   res.status(200).json(success('Transfer transaction and related transactions deleted successfully'))
    //   return 
    // }

    if (transaction.type?.name.toLowerCase() === 'transfer') {
      const { sourceId, amount, targetSourceId } = transaction
    
      const targetTransaction = await prisma.transaction.findFirst({
        where: {
          userId,
          sourceId: targetSourceId || undefined,
          amount,
          description: transaction.description,
          date: transaction.date,
          typeId: transaction.typeId,
        },
      });
    
      await prisma.$transaction(async (tx) => {
        // Kembalikan saldo
        await tx.source.update({ where: { id: sourceId ?? undefined }, data: { balance: { increment: amount } } })
        if (targetSourceId) {
          await tx.source.update({ where: { id: targetSourceId }, data: { balance: { decrement: amount } } })
        }
    
        // Hapus kedua transaksi
        await tx.transaction.delete({ where: { id: transaction.id } })
        if (targetTransaction) {
          await tx.transaction.delete({ where: { id: targetTransaction.id } })
        }
      })
    
      res.status(200).json(success('Transfer transaction and related transaction deleted successfully'))
      return
    }
    

    // For non-transfer transactions, just delete the transaction and adjust the balance
    await prisma.source.update({
      where: { id: transaction.sourceId ?? undefined },
      data: {
        balance: {
          [transaction.type?.name.toLowerCase() === 'pemasukan' ? 'decrement' : 'increment']: transaction.amount,
        },
      },
    })

    await prisma.transaction.delete({ where: { id: transaction.id } })

    res.status(200).json(success('Transaction deleted successfully'))
  } catch (err) {
    console.error('DELETE /transactions/:id error:', err)
    res.status(500).json(error('Failed to delete transaction', 'INTERNAL_ERROR', 500))
  }
})



export default router
