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
    // Step 1: Null out all user foreign keys so we can delete freely
    await pool.query(`UPDATE users SET university_id = NULL, faculty_id = NULL, department_id = NULL, level_id = NULL`)

    // Step 2: Delete duplicates — keep newest per unique key
    const keepUni = await pool.query(`SELECT id FROM universities ORDER BY created_at DESC LIMIT 1`)
    const keepUniId = keepUni.rows[0].id
    await pool.query(`DELETE FROM universities WHERE id != $1`, [keepUniId])

    // faculties cascade from universities so just keep newest per short_name
    const keepFacs = await pool.query(`SELECT DISTINCT ON (short_name) id, short_name FROM faculties ORDER BY short_name, created_at DESC`)
    const keepFacIds = keepFacs.rows.map(r => r.id)
    if (keepFacIds.length) await pool.query(`DELETE FROM faculties WHERE id != ALL($1::uuid[])`, [keepFacIds])

    const keepDepts = await pool.query(`SELECT DISTINCT ON (short_name) id, short_name FROM departments ORDER BY short_name, created_at DESC`)
    const keepDeptIds = keepDepts.rows.map(r => r.id)
    if (keepDeptIds.length) await pool.query(`DELETE FROM departments WHERE id != ALL($1::uuid[])`, [keepDeptIds])

    const keepLevels = await pool.query(`SELECT DISTINCT ON (department_id, name) id, department_id, name FROM levels ORDER BY department_id, name, created_at DESC`)
    const keepLevelIds = keepLevels.rows.map(r => r.id)
    if (keepLevelIds.length) await pool.query(`DELETE FROM levels WHERE id != ALL($1::uuid[])`, [keepLevelIds])

    // Step 3: Reassign users to correct rows based on their department name
    const depts = await pool.query(`SELECT d.id, d.short_name, d.faculty_id, f.university_id FROM departments d JOIN faculties f ON f.id = d.faculty_id`)
    const levels = await pool.query(`SELECT id, department_id, name FROM levels`)

    const users = await pool.query(`SELECT id, department_id FROM users WHERE department_id IS NOT NULL`)
    // department_id is now null so we can't use it — just reassign everyone to Physics for now
    // They'll need to re-register or be manually fixed
    // Just restore the university/faculty for all users
    const { rows: [physics] } = await pool.query(`SELECT id FROM departments WHERE short_name = 'PHY' LIMIT 1`)
    const { rows: [phyLevel] } = await pool.query(`SELECT id FROM levels WHERE department_id = $1 AND name = '100L' LIMIT 1`, [physics?.id])
    const { rows: [faculty] } = await pool.query(`SELECT id FROM faculties LIMIT 1`)

    await pool.query(`UPDATE users SET university_id = $1, faculty_id = $2, department_id = $3, level_id = $4`,
      [keepUniId, faculty?.id, physics?.id, phyLevel?.id])

    const u = await pool.query(`SELECT COUNT(*) FROM universities`)
    const f = await pool.query(`SELECT COUNT(*) FROM faculties`)
    const d = await pool.query(`SELECT COUNT(*) FROM departments`)
    const l = await pool.query(`SELECT COUNT(*) FROM levels`)
    res.json({ message: 'Cleanup done — users reset to Physics/100L, please delete and re-register', universities: u.rows[0].count, faculties: f.rows[0].count, departments: d.rows[0].count, levels: l.rows[0].count })
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
