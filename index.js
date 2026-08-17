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
    // Get the one university to keep (newest)
    const keepUni = await pool.query(`SELECT id FROM universities ORDER BY created_at DESC LIMIT 1`)
    const keepUniId = keepUni.rows[0].id

    // Point all users to the correct university
    await pool.query(`UPDATE users SET university_id = $1`, [keepUniId])

    // Delete duplicate universities
    await pool.query(`DELETE FROM universities WHERE id != $1`, [keepUniId])

    // Get the one faculty to keep per short_name (newest)
    const keepFacs = await pool.query(`SELECT DISTINCT ON (short_name) id, short_name FROM faculties ORDER BY short_name, created_at DESC`)
    const keepFacIds = keepFacs.rows.map(r => r.id)

    // Point users to correct faculty
    for (const fac of keepFacs.rows) {
      await pool.query(`UPDATE users SET faculty_id = $1 WHERE faculty_id IN (SELECT id FROM faculties WHERE short_name = $2 AND id != $1)`, [fac.id, fac.short_name])
    }
    await pool.query(`DELETE FROM faculties WHERE id != ALL($1::uuid[])`, [keepFacIds])

    // Get departments to keep per short_name (newest)
    const keepDepts = await pool.query(`SELECT DISTINCT ON (short_name) id, short_name FROM departments ORDER BY short_name, created_at DESC`)
    const keepDeptIds = keepDepts.rows.map(r => r.id)

    // Point users to correct department
    for (const dept of keepDepts.rows) {
      await pool.query(`UPDATE users SET department_id = $1 WHERE department_id IN (SELECT id FROM departments WHERE short_name = $2 AND id != $1)`, [dept.id, dept.short_name])
    }
    await pool.query(`DELETE FROM departments WHERE id != ALL($1::uuid[])`, [keepDeptIds])

    // Get levels to keep per department+name (newest)
    const keepLevels = await pool.query(`SELECT DISTINCT ON (department_id, name) id, department_id, name FROM levels ORDER BY department_id, name, created_at DESC`)
    const keepLevelIds = keepLevels.rows.map(r => r.id)

    // Point users to correct level
    for (const lev of keepLevels.rows) {
      await pool.query(`UPDATE users SET level_id = $1 WHERE level_id IN (SELECT id FROM levels WHERE department_id = $2 AND name = $3 AND id != $1)`, [lev.id, lev.department_id, lev.name])
    }
    await pool.query(`DELETE FROM levels WHERE id != ALL($1::uuid[])`, [keepLevelIds])

    // Report
    const u = await pool.query(`SELECT COUNT(*) FROM universities`)
    const f = await pool.query(`SELECT COUNT(*) FROM faculties`)
    const d = await pool.query(`SELECT COUNT(*) FROM departments`)
    const l = await pool.query(`SELECT COUNT(*) FROM levels`)
    res.json({ message: 'Cleanup done', universities: u.rows[0].count, faculties: f.rows[0].count, departments: d.rows[0].count, levels: l.rows[0].count })
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
