const router = require('express').Router()
const pool   = require('../db')
const { authGuard, adminOnly } = require('../middleware/authGuard')
const { upload, uploadToCloudinary, deleteFile } = require('../services/cloudinary')

// POST /api/uploads — student uploads a file
router.post('/', authGuard, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const { course_id, type, title, description, semester, session } = req.body
    if (!type || !title) return res.status(400).json({ error: 'Type and title are required' })

    const validTypes = ['past_question', 'notes', 'summary', 'textbook']
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid upload type' })

    // Upload buffer to Cloudinary
    const cloudResult = await uploadToCloudinary(req.file.buffer, req.file.originalname)

    const result = await pool.query(`
      INSERT INTO uploads (user_id, course_id, type, title, description, file_url, public_id, file_size, semester, session)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.id, course_id || null, type, title.trim(), description?.trim() || null,
       cloudResult.secure_url, cloudResult.public_id, req.file.size || null,
       semester ? parseInt(semester) : null, session?.trim() || null])

    res.status(201).json({ upload: result.rows[0], message: "Upload submitted for review." })
  } catch (err) {
    console.error('Upload error:', err)
    res.status(500).json({ error: err.message || 'Upload failed. Try again.' })
  }
})

// GET /api/uploads/mine — student's own uploads
router.get('/mine', authGuard, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, c.code as course_code, c.title as course_title
      FROM uploads u LEFT JOIN courses c ON u.course_id = c.id
      WHERE u.user_id = $1 ORDER BY u.created_at DESC`, [req.user.id])
    res.json({ uploads: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/uploads/approved — all approved uploads (for browsing)
router.get('/approved', authGuard, async (req, res) => {
  try {
    const { course_id, type } = req.query
    let query = `
      SELECT u.*, c.code as course_code, c.title as course_title, us.name as uploader_name
      FROM uploads u
      LEFT JOIN courses c ON u.course_id = c.id
      LEFT JOIN users us  ON u.user_id = us.id
      WHERE u.status = 'approved'`
    const params = []
    if (course_id) { params.push(course_id); query += ` AND u.course_id = $${params.length}` }
    if (type)      { params.push(type);      query += ` AND u.type = $${params.length}` }
    query += ` ORDER BY u.approved_at DESC`
    const result = await pool.query(query, params)
    res.json({ uploads: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/uploads/:id/download — redirect to file
router.get('/:id/download', authGuard, async (req, res) => {
  try {
    const result = await pool.query(`SELECT file_url FROM uploads WHERE id = $1`, [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    await pool.query(`UPDATE uploads SET downloads = downloads + 1 WHERE id = $1`, [req.params.id])
    res.redirect(result.rows[0].file_url)
  } catch (err) {
    res.status(500).json({ error: 'Download failed' })
  }
})

// ── ADMIN ROUTES ──────────────────────────────────────

// GET /api/uploads/admin/all — all uploads
router.get('/admin/all', authGuard, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, c.code as course_code, us.name as uploader_name
      FROM uploads u
      LEFT JOIN courses c ON u.course_id = c.id
      LEFT JOIN users us ON u.user_id = us.id
      ORDER BY u.created_at DESC`)
    res.json({ uploads: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/uploads/admin/all — clear all uploads
router.delete('/admin/all', authGuard, adminOnly, async (req, res) => {
  try {
    const { v2: cloudinary } = require('cloudinary')
    const rows = await pool.query(`SELECT public_id FROM uploads WHERE public_id IS NOT NULL`)
    for (const r of rows.rows) {
      await cloudinary.uploader.destroy(r.public_id, { resource_type: 'raw' }).catch(() => {})
    }
    await pool.query(`DELETE FROM uploads`)
    res.json({ message: 'All uploads deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/uploads/admin/pending
router.get('/admin/pending', authGuard, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, c.code as course_code, c.title as course_title, us.name as uploader_name, us.email as uploader_email
      FROM uploads u
      LEFT JOIN courses c ON u.course_id = c.id
      LEFT JOIN users us  ON u.user_id = us.id
      WHERE u.status = 'pending' ORDER BY u.created_at ASC`)
    res.json({ uploads: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/uploads/:id/moderate
router.patch('/:id/moderate', authGuard, adminOnly, async (req, res) => {
  try {
    const { status, admin_note } = req.body
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' })

    const result = await pool.query(`
      UPDATE uploads SET status = $1, admin_note = $2, approved_at = $3
      WHERE id = $4 RETURNING *`,
      [status, admin_note || null, status === 'approved' ? new Date() : null, req.params.id])

    const upload = result.rows[0]

    // If approved and it's a past question, create past_question record
    if (status === 'approved' && upload.type === 'past_question' && upload.course_id) {
      await pool.query(`
        INSERT INTO past_questions (upload_id, course_id, session, semester)
        VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [upload.id, upload.course_id, upload.session || 'Unknown', upload.semester || 1])
    }

    res.json({ upload, message: `Upload ${status}` })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/uploads/:id (admin)
router.delete('/:id', authGuard, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`SELECT public_id FROM uploads WHERE id = $1`, [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Upload not found' })
    if (result.rows[0].public_id) await deleteFile(result.rows[0].public_id)
    await pool.query(`DELETE FROM uploads WHERE id = $1`, [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
