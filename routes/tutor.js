const router = require('express').Router()
const pool   = require('../db')
const { authGuard } = require('../middleware/authGuard')
const { tutorChat, explainConcept, generateQuestions, solvePastQuestion, summariseDocument } = require('../services/groq')

// POST /api/tutor/chat — send a message to AI tutor
router.post('/chat', authGuard, async (req, res) => {
  try {
    const { message, conversation_id, course_id } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' })

    let convo, courseCode = null, courseTitle = null

    // Load or create conversation
    if (conversation_id) {
      const r = await pool.query(`SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversation_id, req.user.id])
      if (r.rows.length > 0) convo = r.rows[0]
    }

    if (course_id) {
      const c = await pool.query(`SELECT code, title FROM courses WHERE id = $1`, [course_id])
      if (c.rows.length > 0) { courseCode = c.rows[0].code; courseTitle = c.rows[0].title }
    } else if (convo?.course_id) {
      const c = await pool.query(`SELECT code, title FROM courses WHERE id = $1`, [convo.course_id])
      if (c.rows.length > 0) { courseCode = c.rows[0].code; courseTitle = c.rows[0].title }
    }

    const history   = convo?.messages || []
    const messages  = [...history, { role: 'user', content: message }]
    const reply     = await tutorChat(messages, courseCode, courseTitle)
    const newHistory = [...messages, { role: 'assistant', content: reply }]

    // Save conversation (keep last 20 messages)
    const trimmed = newHistory.slice(-20)
    const title   = convo?.title || message.slice(0, 60)

    if (convo) {
      await pool.query(`UPDATE ai_conversations SET messages = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(trimmed), convo.id])
    } else {
      const r = await pool.query(`
        INSERT INTO ai_conversations (user_id, course_id, title, messages)
        VALUES ($1, $2, $3, $4) RETURNING id`,
        [req.user.id, course_id || null, title, JSON.stringify(trimmed)])
      convo = { id: r.rows[0].id }
    }

    // Update study streak
    const today = new Date().toISOString().split('T')[0]
    await pool.query(`
      UPDATE users SET last_study_date = $1,
        study_streak = CASE
          WHEN last_study_date = $1::date THEN study_streak
          WHEN last_study_date = ($1::date - INTERVAL '1 day') THEN study_streak + 1
          ELSE 1
        END, updated_at = NOW()
      WHERE id = $2`, [today, req.user.id])

    res.json({ reply, conversation_id: convo.id })
  } catch (err) {
    console.error('Tutor error:', err)
    res.status(500).json({ error: 'AI error. Please try again.' })
  }
})

// GET /api/tutor/conversations — student's conversation history
router.get('/conversations', authGuard, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ac.id, ac.title, ac.course_id, ac.created_at, ac.updated_at,
             c.code as course_code, c.title as course_title
      FROM ai_conversations ac
      LEFT JOIN courses c ON ac.course_id = c.id
      WHERE ac.user_id = $1 ORDER BY ac.updated_at DESC LIMIT 20`, [req.user.id])
    res.json({ conversations: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/tutor/conversations/:id
router.get('/conversations/:id', authGuard, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ac.*, c.code as course_code, c.title as course_title
      FROM ai_conversations ac
      LEFT JOIN courses c ON ac.course_id = c.id
      WHERE ac.id = $1 AND ac.user_id = $2`, [req.params.id, req.user.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' })
    res.json({ conversation: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/tutor/conversations/:id
router.delete('/conversations/:id', authGuard, async (req, res) => {
  try {
    await pool.query(`DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
    res.json({ message: 'Conversation deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/tutor/explain
router.post('/explain', authGuard, async (req, res) => {
  try {
    const { concept, course_id } = req.body
    if (!concept?.trim()) return res.status(400).json({ error: 'Concept is required' })
    let courseCode = null
    if (course_id) {
      const c = await pool.query(`SELECT code FROM courses WHERE id = $1`, [course_id])
      if (c.rows.length > 0) courseCode = c.rows[0].code
    }
    const explanation = await explainConcept(concept, courseCode)
    res.json({ explanation })
  } catch (err) {
    res.status(500).json({ error: 'AI error. Try again.' })
  }
})

// POST /api/tutor/solve — AI solves a past question
router.post('/solve', authGuard, async (req, res) => {
  try {
    const { question_text, course_id, past_question_id } = req.body
    if (!question_text?.trim()) return res.status(400).json({ error: 'Question text required' })

    let courseCode = 'Physics'
    if (course_id) {
      const c = await pool.query(`SELECT code FROM courses WHERE id = $1`, [course_id])
      if (c.rows.length > 0) courseCode = c.rows[0].code
    }

    const solution = await solvePastQuestion(question_text, courseCode)

    // Save solution if linked to past question
    if (past_question_id) {
      await pool.query(`
        UPDATE past_questions SET has_ai_solution = true, ai_solution = $1 WHERE id = $2`,
        [solution, past_question_id])
    }

    res.json({ solution })
  } catch (err) {
    res.status(500).json({ error: 'AI error. Try again.' })
  }
})

module.exports = router
