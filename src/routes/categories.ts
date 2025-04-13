import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { success, error, validationError } from '../helpers/response'
import { authenticateToken } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

interface AuthenticatedRequest extends Request {
  user?: { id: string }
}

// GET /categories - tampilkan milik user dan default, atau berdasarkan transactionTypeId dan kondisi lainnya
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { transactionTypeId } = req.query  // Query parameter untuk filter berdasarkan transactionTypeId

  try {
    // Bangun filter untuk kategori berdasarkan query parameter
    const where: any = {
      OR: [{ userId: null }, { userId }],
    }

    // Jika ada transactionTypeId di query, tambahkan ke filter
    if (transactionTypeId && typeof transactionTypeId === 'string') {
      where.transactionTypeId = transactionTypeId
    }

    // Dapatkan kategori dengan filter dinamis
    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        transactionType: true,  // Termasuk informasi tentang transactionType
      },
    })

    res.json(success(categories))
  } catch (err) {
    console.error('GET /categories error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
  }
})

// POST /categories
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
    const existing = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        OR: [
          { userId: null },
          { userId },
        ],
      },
    })

    if (existing) {
      res.status(409).json(error('Category with this name already exists', 'CATEGORY_EXISTS', 409))
      return
    }

    const created = await prisma.category.create({
      data: { name: trimmedName, userId },
    })

    res.status(201).json(success(created))
  } catch (err) {
    console.error('POST /categories error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
    return
  }
})

// PUT /categories/:id
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
    const category = await prisma.category.findFirst({
      where: { id, userId },
    })

    if (!category) {
      res.status(404).json(error('Category not found', 'NOT_FOUND', 404))
      return
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        OR: [
          { userId: null },
          { userId },
        ],
        NOT: { id },
      },
    })

    if (duplicate) {
      res.status(409).json(error('Another category with this name already exists', 'CATEGORY_EXISTS', 409))
      return
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name: trimmedName },
    })

    res.json(success(updated))
  } catch (err) {
    console.error('PUT /categories/:id error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
    return
  }
})

// DELETE /categories/:id
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return
  }

  try {
    const existing = await prisma.category.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      res.status(404).json(error('Category not found or not owned by user', 'NOT_FOUND', 404))
      return
    }

    const deleted = await prisma.category.delete({
      where: { id },
    })

    res.json(success({ message: 'Category deleted successfully', deleted }))
  } catch (err) {
    console.error('DELETE /categories/:id error:', err)
    res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
    return
  }
})

export default router
