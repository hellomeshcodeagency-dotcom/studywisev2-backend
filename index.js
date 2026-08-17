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

// ONE-TIME cleanup — hit this URL once then remove
app.get('/api/cleanup-duplicates', async (req, res) => {
  const pool = require('./db')
  try {
    // Keep only 1 university (newest)
    await pool.query(`DELETE FROM universities WHERE id NOT IN (SELECT id FROM universities ORDER BY created_at DESC LIMIT 1)`)
    // Keep only 1 faculty per short_name
    await pool.query(`DELETE FROM faculties WHERE id NOT IN (SELECT DISTINCT ON (short_name) id FROM faculties ORDER BY short_name, created_at DESC)`)
    // Keep only 1 department per short_name
    await pool.query(`DELETE FROM departments WHERE id NOT IN (SELECT DISTINCT ON (short_name) id FROM departments ORDER BY short_name, created_at DESC)`)
    // Keep only 1 level per department+name
    await pool.query(`DELETE FROM levels WHERE id NOT IN (SELECT DISTINCT ON (department_id, name) id FROM levels ORDER BY department_id, name, created_at DESC)`)
    // Report
    const u = await pool.query(`SELECT COUNT(*) FROM universities`)
    const f = await pool.query(`SELECT COUNT(*) FROM faculties`)
    const d = await pool.query(`SELECT COUNT(*) FROM departments`)
    const l = await pool.query(`SELECT COUNT(*) FROM levels`)
    res.json({ universities: u.rows[0].count, faculties: f.rows[0].count, departments: d.rows[0].count, levels: l.rows[0].count })
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
