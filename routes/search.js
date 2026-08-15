const router = require('express').Router()
const pool   = require('../db')
const { authGuard } = require('../middleware/authGuard')

// GET /api/search?q=...
router.get('/', authGuard, async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Search query too short' })

    const term = `%${q.trim().toLowerCase()}%`

    const [courses, uploads] = await Promise.all([
      pool.query(`
        SELECT id, code, title, credit_units, semester, description, 'course' as type
        FROM courses
        WHERE level_id = $1 AND active = true
          AND (LOWER(code) LIKE $2 OR LOWER(title) LIKE $2 OR LOWER(description) LIKE $2)
        ORDER BY code LIMIT 10`, [req.user.level_id, term]),

      pool.query(`
        SELECT u.id, u.type, u.title, u.description, u.session, u.semester,
               c.code as course_code, c.title as course_title
        FROM uploads u
        LEFT JOIN courses c ON u.course_id = c.id
        WHERE u.status = 'approved'
          AND (LOWER(u.title) LIKE $1 OR LOWER(u.description) LIKE $1 OR LOWER(c.code) LIKE $1)
        ORDER BY u.approved_at DESC LIMIT 10`, [term]),
    ])

    res.json({
      query:   q,
      results: {
        courses: courses.rows,
        uploads: uploads.rows,
        total:   courses.rows.length + uploads.rows.length,
      }
    })
  } catch (err) {
    res.status(500).json({ error: 'Search error' })
  }
})

module.exports = router
