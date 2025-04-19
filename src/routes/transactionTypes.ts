import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { success, error, validationError } from '../helpers/response'
import { authenticateToken } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

interface AuthenticatedRequest extends Request {
  user?: { id: string }
}

// GET /transaction-types - tampilkan milik user dan default + include categories
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id

  try {
    const types = await prisma.transactionType.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
      },
      orderBy: { name: 'asc' },
      include: {
        categories: true, // 👈 tampilkan kategori yang berelasi
      },
    })

    res.json(success(types))
  } catch (err) {
    console.error('GET /transaction-types error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

// POST /transaction-types
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { name } = req.body

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
    // Cek default
    const defaultExists = await prisma.transactionType.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        userId: null,
      },
    })

    if (defaultExists) {
      res.status(409).json(error('Transaction type already exists in default values', 'TYPE_EXISTS', 409))
      return 
    }

    // Cek user punya
    const userExists = await prisma.transactionType.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        userId,
      },
    })

    if (userExists) {
      res.status(409).json(error('You already have a transaction type with this name', 'TYPE_EXISTS', 409))
      return 
    }

    const created = await prisma.transactionType.create({
      data: { name: trimmedName, userId },
    })

    res.status(201).json(success(created))
  } catch (err) {
    console.error('POST /transaction-types error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

// PUT /transaction-types/:id
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { name } = req.body
  const userId = req.user?.id

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
    const type = await prisma.transactionType.findFirst({
      where: { id, userId },
    })

    if (!type) {
      res.status(404).json(error('Transaction type not found or not owned by user', 'NOT_FOUND', 404))
      return 
    }

    const defaultExists = await prisma.transactionType.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        userId: null,
      },
    })

    if (defaultExists) {
      res.status(409).json(error('Transaction type already exists in default values', 'TYPE_EXISTS', 409))
      return 
    }

    const duplicate = await prisma.transactionType.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        userId,
        NOT: { id },
      },
    })

    if (duplicate) {
      res.status(409).json(error('Another transaction type with this name already exists', 'TYPE_EXISTS', 409))
      return 
    }

    const updated = await prisma.transactionType.update({
      where: { id },
      data: { name: trimmedName },
    })

    res.json(success(updated))
  } catch (err) {
    console.error('PUT /transaction-types/:id error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

// DELETE /transaction-types/:id
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return 
  }

  try {
    const existing = await prisma.transactionType.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      res.status(404).json(error('Transaction type not found or not owned by user', 'NOT_FOUND', 404))
      return 
    }

    // Cek apakah digunakan oleh kategori
    const categoryCount = await prisma.category.count({
      where: { transactionTypeId: id },
    })

    if (categoryCount > 0) {
      res.status(400).json(error('Transaction type is in use by categories and cannot be deleted', 'TYPE_IN_USE', 400))
      return 
    }

    const deleted = await prisma.transactionType.delete({
      where: { id },
    })

    res.json(success({ message: 'Transaction type deleted successfully', deleted }))
  } catch (err) {
    console.error('DELETE /transaction-types/:id error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

export default router
