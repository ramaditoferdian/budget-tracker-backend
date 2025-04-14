import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRouter from './routes/auth'
import transactionsRouter from './routes/transactions'
import categoriesRouter from './routes/categories'
import sourcesRouter from './routes/sources'
import transactionTypesRouter from './routes/transactionTypes'
import corsOptions from './config/corsConfig'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(cors(corsOptions))
app.use(express.json())

// ✅ Ini cara yang benar
app.use('/auth', authRouter);
app.use('/transactions', transactionsRouter);
app.use('/categories', categoriesRouter)
app.use('/sources', sourcesRouter)
app.use('/transaction-types', transactionTypesRouter)

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`)
})
