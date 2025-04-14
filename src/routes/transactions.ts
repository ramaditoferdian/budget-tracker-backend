import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { success, error, validationError } from '../helpers/response'
import { authenticateToken } from '../middleware/auth'
import { startOfMonth, endOfMonth, format, eachDayOfInterval } from 'date-fns'

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
}

// GET /transactions - hanya transaksi milik user dengan dynamic orderBy dan filter by startDate, endDate
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { sortBy = 'createdAt', order = 'desc', startDate, endDate } = req.query

  const allowedSortFields = ['createdAt', 'amount', 'updatedAt', 'date']
  const allowedOrder = ['asc', 'desc']

  const sortField = allowedSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt'
  const sortOrder = allowedOrder.includes(String(order)) ? String(order) : 'desc'

  let start: Date
  let end: Date

  if (startDate && endDate) {
    start = new Date(startDate as string)
    end = new Date(endDate as string)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json(error('Invalid startDate or endDate format. Use YYYY-MM-DD', 'INVALID_DATE_FORMAT', 400))
      return
    }
  } else {
    const now = new Date()
    start = startOfMonth(now)
    end = endOfMonth(now)
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { [sortField]: sortOrder },
      include: {
        type: true,
        category: true,
        source: true,
      },
    })

    res.status(200).json(success(transactions))
    return
  } catch (err) {
    console.error('GET /transactions error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
    return
  }
})


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
      const typeName = tx.type.name.toLowerCase() // jaga-jaga biar lowercase

      if (!resultMap[dateStr]) resultMap[dateStr] = {}
      if (!resultMap[dateStr][typeName]) resultMap[dateStr][typeName] = 0

      resultMap[dateStr][typeName] += tx.amount
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
      if (tx.type.name.toLowerCase() === 'pemasukan') {
        totalPemasukan += tx.amount
      } else if (tx.type.name.toLowerCase() === 'pengeluaran') {
        totalPengeluaran += tx.amount
      } else if (tx.type.name.toLowerCase() === 'tabungan') {
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
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { amount, typeId, sourceId, categoryId, description, date } = req.body as TransactionBody

  const errors = []

  if (!description) errors.push({ field: 'description', message: 'Description is required' })
  if (amount === undefined || amount === null || isNaN(amount)) {
    errors.push({ field: 'amount', message: 'Amount must be a valid number' })
  }
  if (!typeId) errors.push({ field: 'typeId', message: 'Transaction type is required' })
  if (!sourceId) errors.push({ field: 'sourceId', message: 'Source is required' })
  if (!categoryId) errors.push({ field: 'categoryId', message: 'Category is required' })

  if (errors.length > 0) {
    res.status(400).json(validationError(errors))
    return
  }

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return
  }

  try {
    const transaction = await prisma.transaction.create({
      data: {
        description,
        amount,
        typeId,
        sourceId,
        categoryId,
        userId,
        date: date ? new Date(date) : undefined,
      },
    })

    res.status(201).json(success(transaction))
  } catch (err) {
    console.error('POST /transactions error:', err)
    res.status(500).json(error('Failed to create transaction', 'INTERNAL_ERROR', 500))
    return
  }
})

// PUT /transactions/:id - update transaksi milik user
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id
  const { amount, typeId, sourceId, categoryId, description, date } = req.body as TransactionBody

  const errors = []

  if (!description) errors.push({ field: 'description', message: 'Description is required' })
  if (amount === undefined || amount === null || isNaN(amount)) {
    errors.push({ field: 'amount', message: 'Amount must be a valid number' })
  }
  if (!typeId) errors.push({ field: 'typeId', message: 'Transaction type is required' })
  if (!sourceId) errors.push({ field: 'sourceId', message: 'Source is required' })
  if (!categoryId) errors.push({ field: 'categoryId', message: 'Category is required' })

  if (errors.length > 0) {
    res.status(400).json(validationError(errors))
    return
  }

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      res.status(404).json(error('Transaction not found', 'NOT_FOUND', 404))
      return
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        description,
        amount,
        typeId,
        sourceId,
        categoryId,
        date: date ? new Date(date) : undefined,
      },
      include: {
        type: true,
        category: true,
        source: true,
      },
    })

    res.json(success(updated))
  } catch (err) {
    console.error('PUT /transactions/:id error:', err)
    res.status(500).json(error('Failed to update transaction', 'INTERNAL_ERROR', 500))
    return
  }
});

// DELETE /transactions/:id
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      res.status(404).json(error('Transaction not found', 'NOT_FOUND', 404))
      return
    }

    const deleted = await prisma.transaction.delete({ where: { id } })
    res.json(success({ message: 'Transaction deleted successfully', deleted }))
  } catch (err) {
    console.error('DELETE /transactions/:id error:', err)
    res.status(500).json(error('Failed to delete transaction', 'INTERNAL_ERROR', 500))
    return
  }
})



export default router
