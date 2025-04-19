import { Router, Request, Response } from 'express'
import { Prisma, PrismaClient } from '@prisma/client'
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
  const { name, transactionTypeId } = req.body

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return
  }

  if (!name || name.trim() === '') {
    res.status(400).json(validationError([{ field: 'name', message: 'Name is required' }]))
    return
  }

  if (!transactionTypeId) {
    res.status(400).json(validationError([{ field: 'transactionTypeId', message: 'Transaction type is required' }]))
    return
  }

  const trimmedName = name.trim()

  try {
    // Cek jika kategori default (userId: null) sudah ada dengan nama ini
    const defaultExists = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        userId: null,  // kategori default
      },
    })

    if (defaultExists) {
      res.status(409).json(error(
        'Category name already exists in default values',
        'CATEGORY_EXISTS',
        409
      ));
      return 
    }

    // Cek jika user sudah memiliki kategori dengan nama yang sama
    const userExists = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        userId,
      },
    })

    if (userExists) {
      res.status(409).json(error(
        'You already have a category with this name',
        'CATEGORY_EXISTS',
        409
      ))
      return 
    }

    // Cek jika transactionTypeId valid
    const transactionTypeExists = await prisma.transactionType.findUnique({
      where: { id: transactionTypeId },
    })

    if (!transactionTypeExists) {
      res.status(400).json(error(
        'Invalid transaction type ID',
        'INVALID_TRANSACTION_TYPE',
        400
      ))
      return
    }

    // Create category
    const created = await prisma.category.create({
      data: { name: trimmedName, userId, transactionTypeId },
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
  const { name, transactionTypeId } = req.body
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json(error('Unauthorized', 'UNAUTHORIZED', 401))
    return
  }

  if (!name || name.trim() === '') {
    res.status(400).json(validationError([{ field: 'name', message: 'Name is required' }]))
    return
  }

  if (!transactionTypeId) {
    res.status(400).json(validationError([{ field: 'transactionTypeId', message: 'Transaction type is required' }]))
    return
  }

  const trimmedName = name.trim()

  try {
    const category = await prisma.category.findFirst({
      where: { id, userId },
    })

    if (!category) {
      res.status(404).json(error('Category not found or not owned by user', 'NOT_FOUND', 404))
      return
    }

    // Cek jika kategori default (userId: null) sudah ada dengan nama ini
    const defaultExists = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        userId: null,  // kategori default
      },
    })

    if (defaultExists) {
      res.status(409).json(error(
        'Category name already exists in default values',
        'CATEGORY_EXISTS',
        409
      ));
      return 
    }

    // Cek jika user lain sudah memiliki kategori dengan nama yang sama
    const duplicate = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        userId,
        NOT: { id },  // Jangan periksa kategori yang sedang diperbarui
      },
    })

    if (duplicate) {
      res.status(409).json(error(
        'Another category with this name already exists',
        'CATEGORY_EXISTS',
        409
      ));
      return 
    }

    // Cek jika transactionTypeId valid
    const transactionTypeExists = await prisma.transactionType.findUnique({
      where: { id: transactionTypeId },
    })

    if (!transactionTypeExists) {
      res.status(400).json(error(
        'Invalid transaction type ID',
        'INVALID_TRANSACTION_TYPE',
        400
      ))
      return
    }

    // Update category
    const updated = await prisma.category.update({
      where: { id },
      data: { name: trimmedName, transactionTypeId },
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
    // Cek jika kategori ada dan milik user
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    })

    if (!existingCategory || existingCategory.userId !== userId) {
      res.status(404).json(error('Category not found or not owned by user', 'NOT_FOUND', 404))
      return 
    }

    // Pastikan kategori tidak digunakan dalam transaksi
    const transactionCount = await prisma.transaction.count({
      where: { categoryId: id },
    })

    if (transactionCount > 0) {
      res.status(400).json(error('Category is in use by transactions and cannot be deleted', 'CATEGORY_IN_USE', 400))
      return 
    }

    // Hapus kategori jika tidak digunakan dalam transaksi
    const deletedCategory = await prisma.category.delete({
      where: { id },
    })

    res.json(success({ message: 'Category deleted successfully', deletedCategory }))
  } catch (err) {
    console.error('DELETE /categories/:id error:', err)
    // Penanganan error yang lebih spesifik
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      res.status(500).json(error('Database error occurred', 'DATABASE_ERROR', 500))
    } else {
      res.status(500).json(error('Internal server error', 'INTERNAL_ERROR', 500))
    }
  }
})

export default router
