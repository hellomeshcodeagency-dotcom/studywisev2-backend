const router = require('express').Router()
const pool   = require('../db')
const { authGuard, adminOnly } = require('../middleware/authGuard')

router.use(authGuard, adminOnly)

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, allUploads, pendingUploads, approvedUploads, rejectedUploads, conversations, courses, gpaRecords] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users`),
      pool.query(`SELECT COUNT(*) FROM uploads`),
      pool.query(`SELECT COUNT(*) FROM uploads WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) FROM uploads WHERE status = 'approved'`),
      pool.query(`SELECT COUNT(*) FROM uploads WHERE status = 'rejected'`),
      pool.query(`SELECT COUNT(*) FROM ai_conversations`),
      pool.query(`SELECT COUNT(*) FROM courses`),
      pool.query(`SELECT COUNT(*) FROM gpa_records`),
    ])
    res.json({
      total_users:       parseInt(users.rows[0].count),
      total_uploads:     parseInt(allUploads.rows[0].count),
      pending_uploads:   parseInt(pendingUploads.rows[0].count),
      approved_uploads:  parseInt(approvedUploads.rows[0].count),
      rejected_uploads:  parseInt(rejectedUploads.rows[0].count),
      total_chats:       parseInt(conversations.rows[0].count),
      total_courses:     parseInt(courses.rows[0].count),
      total_gpa_records: parseInt(gpaRecords.rows[0].count),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.matric_no, u.study_streak,
             u.is_suspended, u.created_at,
             d.name as department_name, l.name as level_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN levels l ON u.level_id = l.id
      ORDER BY u.created_at DESC`)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/admin/users/:id — toggle admin role
router.patch('/users/:id', async (req, res) => {
  try {
    const { is_admin } = req.body
    const role = is_admin ? 'admin' : 'student'
    await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, req.params.id])
    res.json({ message: 'User updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id])
    res.json({ message: 'User deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/courses
router.get('/courses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, code, title, description, credit_units, semester
      FROM courses ORDER BY semester, code`)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/admin/courses/:id
router.patch('/courses/:id', async (req, res) => {
  try {
    const { title, description, credit_units } = req.body
    await pool.query(`
      UPDATE courses SET
        title        = COALESCE($1, title),
        description  = COALESCE($2, description),
        credit_units = COALESCE($3, credit_units)
      WHERE id = $4`,
      [title, description, credit_units, req.params.id])
    res.json({ message: 'Course updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
