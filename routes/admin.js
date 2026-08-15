const router = require('express').Router()
const pool   = require('../db')
const { authGuard, adminOnly } = require('../middleware/authGuard')

router.use(authGuard, adminOnly)

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, uploads, pendingUploads, conversations, courses] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE role = 'student'`),
      pool.query(`SELECT COUNT(*) FROM uploads WHERE status = 'approved'`),
      pool.query(`SELECT COUNT(*) FROM uploads WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) FROM ai_conversations`),
      pool.query(`SELECT COUNT(*) FROM courses WHERE active = true`),
    ])
    const recentUsers = await pool.query(`
      SELECT u.id, u.name, u.email, u.created_at, d.name as dept, l.name as level
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN levels l ON u.level_id = l.id
      WHERE u.role = 'student' ORDER BY u.created_at DESC LIMIT 5`)

    res.json({
      stats: {
        total_students:   parseInt(users.rows[0].count),
        approved_uploads: parseInt(uploads.rows[0].count),
        pending_uploads:  parseInt(pendingUploads.rows[0].count),
        ai_conversations: parseInt(conversations.rows[0].count),
        active_courses:   parseInt(courses.rows[0].count),
      },
      recent_users: recentUsers.rows,
    })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const offset = (page - 1) * limit
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.matric_no, u.study_streak,
             u.is_suspended, u.created_at,
             d.name as department, l.name as level
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN levels l ON u.level_id = l.id
      WHERE u.role = 'student'`
    const params = []
    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`
    }
    query += ` ORDER BY u.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`
    params.push(limit, offset)
    const result = await pool.query(query, params)
    const total  = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'student'`)
    res.json({ users: result.rows, total: parseInt(total.rows[0].count) })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/admin/users/:id/suspend
router.patch('/users/:id/suspend', async (req, res) => {
  try {
    const { suspended } = req.body
    await pool.query(`UPDATE users SET is_suspended = $1 WHERE id = $2`, [suspended, req.params.id])
    res.json({ message: suspended ? 'User suspended' : 'User unsuspended' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1 AND role = 'student'`, [req.params.id])
    res.json({ message: 'User deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/admin/courses/:id — update course info
router.patch('/courses/:id', async (req, res) => {
  try {
    const { lecturer, description, objectives, outline, textbooks } = req.body
    await pool.query(`
      UPDATE courses SET
        lecturer    = COALESCE($1, lecturer),
        description = COALESCE($2, description),
        objectives  = COALESCE($3, objectives),
        outline     = COALESCE($4, outline),
        textbooks   = COALESCE($5, textbooks)
      WHERE id = $6`,
      [lecturer, description, objectives ? JSON.stringify(objectives) : null,
       outline ? JSON.stringify(outline) : null,
       textbooks ? JSON.stringify(textbooks) : null, req.params.id])
    res.json({ message: 'Course updated' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
