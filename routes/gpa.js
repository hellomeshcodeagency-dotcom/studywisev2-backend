const router = require('express').Router()
const pool   = require('../db')
const { authGuard } = require('../middleware/authGuard')

// Grade point mapping (FUT Minna uses 5.0 scale)
const GRADE_POINTS = { 'A': 5.0, 'B': 4.0, 'C': 3.0, 'D': 2.0, 'E': 1.0, 'F': 0.0 }

function calculateGPA(courses) {
  let totalPoints = 0, totalUnits = 0
  for (const c of courses) {
    const gp = GRADE_POINTS[c.grade?.toUpperCase()] ?? 0
    totalPoints += gp * c.credit_units
    totalUnits  += c.credit_units
  }
  return totalUnits > 0 ? parseFloat((totalPoints / totalUnits).toFixed(2)) : 0
}

// POST /api/gpa — save/update GPA record
router.post('/', authGuard, async (req, res) => {
  try {
    const { semester, session, level, courses } = req.body
    if (!semester || !session || !courses?.length) {
      return res.status(400).json({ error: 'Semester, session and courses are required' })
    }

    const gpa = calculateGPA(courses)

    // Get all records for CGPA calculation
    const allRecords = await pool.query(
      `SELECT gpa, courses FROM gpa_records WHERE user_id = $1 AND NOT (semester = $2 AND session = $3)`,
      [req.user.id, semester, session])

    // Include current semester in CGPA
    const allCourses = allRecords.rows.flatMap(r => r.courses)
    const combinedCourses = [...allCourses, ...courses]
    const cgpa = calculateGPA(combinedCourses)

    const result = await pool.query(`
      INSERT INTO gpa_records (user_id, semester, session, level, courses, gpa, cgpa)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, semester, session)
      DO UPDATE SET courses = $5, gpa = $6, cgpa = $7, updated_at = NOW()
      RETURNING *`,
      [req.user.id, semester, session, level || '100L', JSON.stringify(courses), gpa, cgpa])

    res.json({ record: result.rows[0], gpa, cgpa })
  } catch (err) {
    console.error('GPA error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/gpa — all GPA records for student
router.get('/', authGuard, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM gpa_records WHERE user_id = $1 ORDER BY session DESC, semester ASC`,
      [req.user.id])
    res.json({ records: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/gpa/:id
router.delete('/:id', authGuard, async (req, res) => {
  try {
    await pool.query(`DELETE FROM gpa_records WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
    res.json({ message: 'Record deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
