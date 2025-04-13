import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { success, error, validationError } from '../helpers/response'
import { authenticateToken } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

interface AuthenticatedRequest extends Request {
  user?: { id: string } // ditambahkan oleh middleware JWT
}

interface TransactionBody {
  description: string
  date?: string // ISO format string
  amount: number
  typeId: string
  sourceId: string
  categoryId: string
}

// GET /transactions - hanya transaksi milik user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        type: true,
        category: true,
        source: true,
      },
    })
    res.json(success(transactions))
  } catch (err) {
    console.error('GET /transactions error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
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
  if (!amount) errors.push({ field: 'amount', message: 'Amount is required' })
  if (!typeId) errors.push({ field: 'typeId', message: 'Transaction type is required' })
  if (!sourceId) errors.push({ field: 'sourceId', message: 'Source is required' })
  if (!categoryId) errors.push({ field: 'categoryId', message: 'Category is required' })

  if (errors.length > 0) {
    res.status(400).json(validationError(errors))
    return
  }

  if (!req.user || !req.user.id) {
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
        userId: req.user.id,
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
