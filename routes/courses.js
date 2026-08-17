const router = require('express').Router()
const pool   = require('../db')
const { authGuard, adminOnly } = require('../middleware/authGuard')

// GET /api/courses — get courses for the logged-in student's department + level
router.get('/', authGuard, async (req, res) => {
  try {
    const { department_id, level_id } = req.user
    const result = await pool.query(`
      SELECT DISTINCT c.*
      FROM courses c
      JOIN department_courses dc ON dc.course_id = c.id
      WHERE dc.department_id = $1 AND dc.level_id = $2 AND c.active = true
      ORDER BY c.semester, c.code`,
      [department_id, level_id])
    res.json({ courses: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/courses/:id — course detail with uploads and past questions
router.get('/:id', authGuard, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM courses WHERE id = $1`, [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Course not found' })
    const course = rows[0]

    const [uploadsRes, pqRes] = await Promise.all([
      pool.query(`
        SELECT u.*, us.name as uploader_name
        FROM uploads u
        LEFT JOIN users us ON u.user_id = us.id
        WHERE u.course_id = $1 AND u.status = 'approved'
        ORDER BY u.approved_at DESC`, [req.params.id]),
      pool.query(`
        SELECT pq.*, u.file_url, u.title as upload_title
        FROM past_questions pq
        JOIN uploads u ON pq.upload_id = u.id
        WHERE pq.course_id = $1
        ORDER BY pq.created_at DESC`, [req.params.id]),
    ])

    res.json({ course, resources: uploadsRes.rows, past_questions: pqRes.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/courses/admin/all — all courses with their department links
router.get('/admin/all', authGuard, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        COALESCE(
          json_agg(
            json_build_object('department_id', dc.department_id, 'level_id', dc.level_id, 'dept_name', d.name)
          ) FILTER (WHERE dc.id IS NOT NULL), '[]'
        ) as departments
      FROM courses c
      LEFT JOIN department_courses dc ON dc.course_id = c.id
      LEFT JOIN departments d ON d.id = dc.department_id
      GROUP BY c.id
      ORDER BY c.semester, c.code`)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/courses/admin — create a new course and link to departments
router.post('/admin', authGuard, adminOnly, async (req, res) => {
  try {
    const { code, title, credit_units, semester, description, objectives, outline, textbooks, department_ids, level_ids } = req.body
    if (!code || !title || !semester) return res.status(400).json({ error: 'Code, title and semester are required' })

    const result = await pool.query(`
      INSERT INTO courses (code, title, credit_units, semester, description, objectives, outline, textbooks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, credit_units = EXCLUDED.credit_units,
        semester = EXCLUDED.semester, description = EXCLUDED.description
      RETURNING *`,
      [code.toUpperCase(), title, credit_units || 2, semester, description || null,
       JSON.stringify(objectives || []), JSON.stringify(outline || []), JSON.stringify(textbooks || [])])

    const course = result.rows[0]

    // Link to departments
    if (department_ids?.length && level_ids?.length) {
      for (let i = 0; i < department_ids.length; i++) {
        await pool.query(`
          INSERT INTO department_courses (department_id, level_id, course_id)
          VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [department_ids[i], level_ids[i], course.id])
      }
    }

    res.status(201).json({ course, message: 'Course created and linked to departments' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/courses/admin/:id — update course
router.patch('/admin/:id', authGuard, adminOnly, async (req, res) => {
  try {
    const { title, description, credit_units, department_ids, level_ids } = req.body
    await pool.query(`
      UPDATE courses SET
        title        = COALESCE($1, title),
        description  = COALESCE($2, description),
        credit_units = COALESCE($3, credit_units)
      WHERE id = $4`,
      [title, description, credit_units, req.params.id])

    // Update department links if provided
    if (department_ids?.length && level_ids?.length) {
      await pool.query(`DELETE FROM department_courses WHERE course_id = $1`, [req.params.id])
      for (let i = 0; i < department_ids.length; i++) {
        await pool.query(`
          INSERT INTO department_courses (department_id, level_id, course_id)
          VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [department_ids[i], level_ids[i], req.params.id])
      }
    }

    res.json({ message: 'Course updated' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/courses/admin/:id/link — link existing course to more departments
router.post('/admin/:id/link', authGuard, adminOnly, async (req, res) => {
  try {
    const { department_id, level_id } = req.body
    await pool.query(`
      INSERT INTO department_courses (department_id, level_id, course_id)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [department_id, level_id, req.params.id])
    res.json({ message: 'Course linked to department' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
