const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const pool    = require('../db')
const { authGuard } = require('../middleware/authGuard')

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' })
}

// GET /api/auth/setup
router.get('/setup', async (req, res) => {
  try {
    const unis  = await pool.query(`SELECT id, name, short_name FROM universities WHERE active = true ORDER BY name`)
    const facs  = await pool.query(`SELECT id, university_id, name, short_name FROM faculties ORDER BY name`)
    const depts = await pool.query(`SELECT id, faculty_id, name, short_name FROM departments ORDER BY name`)
    const levs  = await pool.query(`SELECT id, department_id, name FROM levels ORDER BY name`)
    res.json({ universities: unis.rows, faculties: facs.rows, departments: depts.rows, levels: levs.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, university_id, faculty_id, department_id, level_id, matric_no } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (!university_id || !faculty_id || !department_id || !level_id)
      return res.status(400).json({ error: 'Please select your university, faculty, department and level' })

    const exists = await pool.query(`SELECT id, is_suspended FROM users WHERE email = $1`, [email.toLowerCase()])
    if (exists.rows.length > 0) {
      if (exists.rows[0].is_suspended) return res.status(403).json({ error: 'This account has been suspended. Contact admin.' })
      return res.status(400).json({ error: 'Email already registered' })
    }

    const isAdmin = email.toLowerCase().trim() === (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
    const role    = isAdmin ? 'admin' : 'student'

    const hash = await bcrypt.hash(password, 12)
    const result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, university_id, faculty_id, department_id, level_id, matric_no)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, role, university_id, faculty_id, department_id, level_id, matric_no, study_streak`,
      [name.trim(), email.toLowerCase().trim(), hash, role, university_id, faculty_id, department_id, level_id, matric_no || null])

    const user  = result.rows[0]
    const token = signToken(user.id)
    res.status(201).json({ token, user })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed. Try again.' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.password_hash, u.role,
             u.matric_no, u.avatar_url, u.study_streak, u.is_suspended,
             u.university_id, u.faculty_id, u.department_id, u.level_id,
             un.name as university_name, un.short_name as university_short,
             f.name  as faculty_name,    f.short_name  as faculty_short,
             d.name  as department_name, d.short_name  as department_short,
             l.name  as level_name
      FROM users u
      LEFT JOIN universities un ON u.university_id = un.id
      LEFT JOIN faculties f     ON u.faculty_id    = f.id
      LEFT JOIN departments d   ON u.department_id = d.id
      LEFT JOIN levels l        ON u.level_id      = l.id
      WHERE u.email = $1`, [email.toLowerCase()])

    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid email or password' })
    const user = result.rows[0]
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended. Contact admin.' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' })

    delete user.password_hash

    // Auto-fix level_id if it doesn't match current department levels
    if (user.department_id) {
      const levelCheck = await pool.query(
        `SELECT id FROM levels WHERE department_id = $1 AND id = $2`,
        [user.department_id, user.level_id]
      )
      if (levelCheck.rows.length === 0) {
        // level_id is stale — find the correct one by name
        const correctLevel = await pool.query(
          `SELECT l.id FROM levels l
           JOIN levels old ON old.id = $1
           WHERE l.department_id = $2 AND l.name = old.name
           LIMIT 1`,
          [user.level_id, user.department_id]
        )
        if (correctLevel.rows.length > 0) {
          const newLevelId = correctLevel.rows[0].id
          await pool.query(`UPDATE users SET level_id = $1 WHERE id = $2`, [newLevelId, user.id])
          user.level_id = newLevelId
        }
      }
    }

    const token = signToken(user.id)
    res.json({ token, user })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed. Try again.' })
  }
})

// GET /api/auth/me
router.get('/me', authGuard, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.matric_no, u.avatar_url, u.study_streak, u.created_at,
             un.name as university_name, un.short_name as university_short,
             f.name  as faculty_name,    f.short_name  as faculty_short,
             d.name  as department_name, d.short_name  as department_short,
             l.name  as level_name
      FROM users u
      LEFT JOIN universities un ON u.university_id = un.id
      LEFT JOIN faculties f     ON u.faculty_id    = f.id
      LEFT JOIN departments d   ON u.department_id = d.id
      LEFT JOIN levels l        ON u.level_id      = l.id
      WHERE u.id = $1`, [req.user.id])
    res.json({ user: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/change-password
router.post('/change-password', authGuard, async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    if (!current_password || !new_password) return res.status(400).json({ error: 'All fields required' })
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
    const result = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id])
    const valid  = await bcrypt.compare(current_password, result.rows[0].password_hash)
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' })
    const hash = await bcrypt.hash(new_password, 12)
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, req.user.id])
    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
