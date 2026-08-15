require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const rateLimit  = require('express-rate-limit')
const initDB     = require('./db/init')
const seed       = require('./db/seed')

const app  = express()
const PORT = process.env.PORT || 5000

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

// TEMPORARY — run once to fix old private uploads, then remove
app.get('/api/fix-cloudinary-access', async (req, res) => {
  const { v2: cloudinary } = require('cloudinary')
  const pool = require('./db')
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  const result = await pool.query(`SELECT id, title, public_id FROM uploads WHERE public_id IS NOT NULL`)
  const results = []
  for (const upload of result.rows) {
    try {
      await cloudinary.api.update(upload.public_id, { resource_type: 'raw', access_mode: 'public' })
      results.push({ title: upload.title, status: 'fixed' })
    } catch (err) {
      results.push({ title: upload.title, status: 'failed', error: err.message })
    }
  }
  res.json({ total: result.rows.length, results })
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
