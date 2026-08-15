const router = require('express').Router()
const pool   = require('../db')
const { authGuard } = require('../middleware/authGuard')

// GET /api/courses — get all courses for the student's level
router.get('/', authGuard, async (req, res) => {
  try {
    const { semester } = req.query
    let query = `
      SELECT c.*, 
             COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'approved') as resource_count,
             COUNT(DISTINCT pq.id) as past_question_count
      FROM courses c
      LEFT JOIN uploads u  ON u.course_id = c.id AND u.status = 'approved'
      LEFT JOIN past_questions pq ON pq.course_id = c.id
      WHERE c.level_id = $1 AND c.active = true`
    const params = [req.user.level_id]
    if (semester) { query += ` AND c.semester = $2`; params.push(semester) }
    query += ` GROUP BY c.id ORDER BY c.semester, c.code`
    const result = await pool.query(query, params)
    res.json({ courses: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/courses/:id — single course detail
router.get('/:id', authGuard, async (req, res) => {
  try {
    const course = await pool.query(`SELECT * FROM courses WHERE id = $1`, [req.params.id])
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' })

    const resources = await pool.query(`
      SELECT u.id, u.type, u.title, u.description, u.file_url, u.session, u.semester,
             u.downloads, u.created_at, us.name as uploader_name
      FROM uploads u
      JOIN users us ON u.user_id = us.id
      WHERE u.course_id = $1 AND u.status = 'approved'
      ORDER BY u.type, u.created_at DESC`, [req.params.id])

    const pastQs = await pool.query(`
      SELECT pq.*, u.title, u.file_url, u.description, us.name as uploader_name
      FROM past_questions pq
      JOIN uploads u ON pq.upload_id = u.id
      JOIN users us  ON u.user_id = us.id
      WHERE pq.course_id = $1
      ORDER BY pq.session DESC`, [req.params.id])

    res.json({ course: course.rows[0], resources: resources.rows, past_questions: pastQs.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
