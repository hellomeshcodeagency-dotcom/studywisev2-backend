require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const rateLimit  = require('express-rate-limit')
const initDB     = require('./db/init')
const seed       = require('./db/seed')

const app  = express()
const PORT = process.env.PORT || 5000

app.set('trust proxy', 1)

app.set('trust proxy', 1)
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests' } }))

// Routes
app.use('/api/auth',    require('./routes/auth'))
app.use('/api/courses', require('./routes/courses'))
app.use('/api/uploads', require('./routes/uploads'))
app.use('/api/tutor',   require('./routes/tutor'))
app.use('/api/gpa',     require('./routes/gpa'))
app.use('/api/search',  require('./routes/search'))
app.use('/api/profile', require('./routes/profile'))
app.use('/api/admin',   require('./routes/admin'))

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0', platform: 'Studiwise' }))

app.get('/api/reseed', async (req, res) => {
  try {
    await require('./db/seed')()
    res.json({ message: 'Reseed complete' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

async function start() {
  await initDB()
  await seed()
  app.listen(PORT, () => console.log(`Studiwise 2.0 running on port ${PORT}`))
}

start().catch(err => { console.error('Startup error:', err); process.exit(1) })
