import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { success, error, validationError } from '../helpers/response'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret'

interface AuthBody {
  email: string
  password: string
}

// POST /auth/register
router.post('/register', async (req: Request<{}, {}, AuthBody>, res: Response) => {
  const { email, password } = req.body

  const errors = []
  if (!email) errors.push({ field: 'email', message: 'Email is required' })
  if (!password) errors.push({ field: 'password', message: 'Password is required' })

  if (errors.length > 0) {
    res.status(400).json(validationError(errors))
    return 
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      res.status(400).json(error('Email is already registered', 'DUPLICATE_EMAIL', 400))
      return 
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    })

    res.status(201).json(success({ id: user.id, email: user.email }))
  } catch (err) {
    console.error('POST /auth/register error:', err)
    res.status(500).json(error('Failed to register user'))
  }
})

// POST /auth/login
router.post('/login', async (req: Request<{}, {}, AuthBody>, res: Response) => {
  const { email, password } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      res.status(401).json(error('Invalid credentials', 'INVALID_CREDENTIALS', 401))
      return 
    }

    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      res.status(401).json(error('Invalid credentials', 'INVALID_CREDENTIALS', 401))
      return 
    }

    const token = jwt.sign({ 
      id: user.id,
      email: user.email,
      isFirstTimeLogin: user.isFirstTimeLogin,
    }, JWT_SECRET, { expiresIn: '7d' })

    res.json(success({
      token,
      user: {
        id: user.id,
        email: user.email,
        isFirstTimeLogin: user.isFirstTimeLogin,
      },
    }))
  } catch (err) {
    console.error('POST /auth/login error:', err)
    res.status(500).json(error('Failed to login'))
  }
})

// Tambahkan route ini di bawah /login
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        sources: true,
        categories: true,
        transactionTypes: true,
        isFirstTimeLogin: true,
      },
    })

    if (!user) {
      res.status(404).json(error('User not found', 'USER_NOT_FOUND', 404))
      return 
    }

    res.json(success(user))
  } catch (err) {
    console.error('GET /auth/me error:', err)
    res.status(500).json(error('Failed to get user'))
  }
})

// POST /auth/onboarding-complete
router.post('/onboarding-complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id

  
  try {
    let user = await prisma.user.findUnique({ where: { id: userId } })
  
    if (!user) {
      res.status(401).json(error('Invalid credentials', 'INVALID_CREDENTIALS', 401))
      return 
    }

    await prisma.user.update({
      where: { id: user?.id },
      data: { isFirstTimeLogin: false },
    })
    
    user =  await prisma.user.findUnique({ where: { id: userId } })

    const token = jwt.sign({ 
      id: user?.id,
      email: user?.email,
      isFirstTimeLogin: user?.isFirstTimeLogin,
    }, JWT_SECRET, { expiresIn: '7d' })

    res.json(success({
      token,
      user: {
        id: user?.id,
        email: user?.email,
        isFirstTimeLogin: user?.isFirstTimeLogin,
      },
    }))
  } catch (err) {
    console.error('POST /auth/onboarding-complete error:', err)
    res.status(500).json(error('Failed to update onboarding status'))
  }
})



export default router
