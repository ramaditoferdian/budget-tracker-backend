import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { success, error, validationError, result } from '../helpers/response'
import { authenticateToken } from '../middleware/auth'
import { recalculateBalance } from '../utils/recalculateBalance'
import { generatePaginationResult, parsePagination } from '../utils/pagination'

const router = Router()
const prisma = new PrismaClient()

interface AuthenticatedRequest extends Request {
  user?: { id: string }
}

// Helper function to setup default sources for a new user
async function setupDefaultSources(userId: string) {
  const defaultSources = [
    { name: 'Dompet' },
    { name: 'Tabungan' },
    { name: 'Investasi' }, // you can add more default sources here
  ]

  try {
    for (let source of defaultSources) {
      // Create each default source for the user
      await prisma.source.create({
        data: {
          name: source.name,
          userId,
          accountNumber: null, // Default value for accountNumber
          initialAmount: 0, // Default initial amount
          balance: 0,
        },
      })
    }
  } catch (err) {
    console.error('Error setting up default sources:', err)
  }
}

// GET /sources
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id

  const { page, limit } = req.query
  const pagination = parsePagination({ page, limit });

  const filters: any = {
    OR: [{ userId: null }, { userId }],
  };

  try {
    // Check if user already has sources, if not setup default sources
    const userSources = await prisma.source.findMany({
      where: { userId },
    })

    if (userSources.length === 0) {
      // User has no sources, set up default ones
      await setupDefaultSources(userId!)
    }

    // Fetch all sources for the user including defaults

    const [sources, totalRows] = await Promise.all([
      prisma.source.findMany({
        where: filters,
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.source.count({ where: filters }),
    ])

    const paginationResult = generatePaginationResult(totalRows, pagination);
    const response = result({ sources }, paginationResult);

    res.json(success(response))
  } catch (err) {
    console.error('GET /sources error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

// POST /sources
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { name, accountNumber, initialAmount } = req.body

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return
  }

  if (!name || name.trim() === '') {
    res.status(400).json(validationError([{ field: 'name', message: 'Name is required' }]))
    return
  }

  const trimmedName = name.trim()

  try {
    const existing = await prisma.source.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        OR: [{ userId: null }, { userId }],
      },
    })

    if (existing) {
      res.status(409).json(error('Source with this name already exists', 'SOURCE_EXISTS', 409))
      return
    }

    const validInitialAmount = typeof initialAmount === 'number' && initialAmount >= 0 ? initialAmount : 0

    const created = await prisma.source.create({
      data: { 
        name: trimmedName,
        accountNumber: accountNumber || null,
        initialAmount: validInitialAmount,
        balance: validInitialAmount, // 🟢 Set balance awal sama dengan initialAmount
        userId 
      },
    })

    res.status(201).json(success(created))
  } catch (err) {
    console.error('POST /sources error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

// PUT /sources/:id
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { name, accountNumber, initialAmount } = req.body
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return
  }

  try {
    const existing = await prisma.source.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      res.status(404).json(error('Source not found', 'NOT_FOUND', 404))
      return
    }

    // Check if there are changes to apply (either name, accountNumber, or initialAmount)
    const updatedData: { name?: string, accountNumber?: string | null, initialAmount?: number, balance?: number } = {}

    // Only update name or accountNumber if they are different
    if (name && name.trim() !== existing.name) {
      updatedData.name = name.trim()
    }

    if (accountNumber !== undefined && accountNumber !== existing.accountNumber) {
      updatedData.accountNumber = accountNumber || null
    }

    // If initialAmount is provided and different from the existing one, we need to recalculate the balance
    if (typeof initialAmount === 'number' && initialAmount !== existing.initialAmount) {
      updatedData.initialAmount = initialAmount
    
      // Recalculate balance from scratch
      const pemasukan = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          sourceId: id,
          type: { name: 'Pemasukan' },
        },
      })
    
      const pengeluaran = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          sourceId: id,
          type: { name: 'Pengeluaran' },
        },
      })
    
      // Calculate balance from initialAmount and transaction totals
      updatedData.balance =  await recalculateBalance(id, initialAmount)
    }
    

    // If no updates were made, return a message indicating no change
    if (Object.keys(updatedData).length === 0) {
      res.status(400).json(error('No changes were made to the source', 'NO_CHANGES', 400))
      return
    }

    const updatedSource = await prisma.source.update({
      where: { id },
      data: updatedData,
    })

    res.json(success(updatedSource))
  } catch (err) {
    console.error('PUT /sources/:id error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

// DELETE /sources/:id
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return
  }

  try {
    const existing = await prisma.source.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      res.status(404).json(error('Source not found or not owned by user', 'NOT_FOUND', 404))
      return
    }

    const deleted = await prisma.source.delete({
      where: { id },
    })

    res.json(success({ message: 'Source deleted successfully', deleted }))
  } catch (err) {
    console.error('DELETE /sources/:id error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

export default router
