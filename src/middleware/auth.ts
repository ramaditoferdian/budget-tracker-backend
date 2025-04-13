import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { error } from '../helpers/response'

export interface AuthenticatedRequest extends Request {
  user?: { id: string }
}

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret'

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]

  if (!token) {
    res.status(401).json(error('Token not provided', 'UNAUTHORIZED', 401))
    return 
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string }
    req.user = { id: decoded.id }
    next()
  } catch (err) {
    console.error('Invalid token:', err)
    res.status(401).json(error('Invalid token', 'UNAUTHORIZED', 401))
    return 
  }
}
