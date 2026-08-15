const router = require('express').Router()
const pool   = require('../db')
const { authGuard } = require('../middleware/authGuard')

// GET /api/profile/stats
router.get('/stats', authGuard, async (req, res) => {
  try {
    const [convos, uploads, bookmarks] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ai_conversations WHERE user_id = $1`, [req.user.id]),
      pool.query(`SELECT COUNT(*) FROM uploads WHERE user_id = $1`, [req.user.id]),
      pool.query(`SELECT COUNT(*) FROM bookmarks WHERE user_id = $1`, [req.user.id]),
    ])
    const streak = await pool.query(`SELECT study_streak, last_study_date FROM users WHERE id = $1`, [req.user.id])
    res.json({
      conversations: parseInt(convos.rows[0].count),
      uploads:       parseInt(uploads.rows[0].count),
      bookmarks:     parseInt(bookmarks.rows[0].count),
      study_streak:  streak.rows[0]?.study_streak || 0,
      last_study:    streak.rows[0]?.last_study_date,
    })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/profile — update name/matric
router.patch('/', authGuard, async (req, res) => {
  try {
    const { name, matric_no } = req.body
    await pool.query(`UPDATE users SET name = COALESCE($1, name), matric_no = COALESCE($2, matric_no), updated_at = NOW() WHERE id = $3`,
      [name?.trim() || null, matric_no?.trim() || null, req.user.id])
    res.json({ message: 'Profile updated' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/profile/bookmark
router.post('/bookmark', authGuard, async (req, res) => {
  try {
    const { resource_type, resource_id } = req.body
    await pool.query(`
      INSERT INTO bookmarks (user_id, resource_type, resource_id)
      VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.user.id, resource_type, resource_id])
    res.json({ message: 'Bookmarked' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/profile/bookmark
router.delete('/bookmark', authGuard, async (req, res) => {
  try {
    const { resource_type, resource_id } = req.body
    await pool.query(`DELETE FROM bookmarks WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
      [req.user.id, resource_type, resource_id])
    res.json({ message: 'Bookmark removed' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/profile/bookmarks
router.get('/bookmarks', authGuard, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id])
    res.json({ bookmarks: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
