const jwt  = require('jsonwebtoken')
const pool = require('../db')

async function authGuard(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }
    const token   = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const result  = await pool.query(
      `SELECT id, name, email, is_admin, university_id, faculty_id, department_id, level_id,
              matric_no, avatar_url, study_streak, is_suspended
       FROM users WHERE id = $1`, [decoded.id])
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' })
    const user = result.rows[0]
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended. Contact admin.' })
    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Session expired. Please log in again.' })
    return res.status(401).json({ error: 'Invalid token' })
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' })
  next()
}

module.exports = { authGuard, adminOnly }
