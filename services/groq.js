const axios = require('axios')

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const MODEL     = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

const PHYSICS_SYSTEM = `You are StudiWise AI — an intelligent academic tutor for 100-Level Physics students at the Federal University of Technology, Minna (FUT Minna), School of Physical Sciences.

Your role:
- Help students understand their courses: PHY 101, PHY 102, PHY 103, PHY 107, PHY 108, MTH 101, MTH 102, CHM 101, CHM 102, COS 101, COS 102, GST 101, GST 102, GST 103, GST 107
- Explain complex concepts in simple, clear language
- Generate practice questions and solutions
- Help students prepare for FUT Minna exams
- Relate explanations to the FUT Minna course syllabus where possible

Rules:
- ONLY answer academic questions related to the courses listed above
- If a student asks something outside these subjects, politely decline and redirect them to their coursework
- Never help with non-academic requests (social media, entertainment, shopping etc.)
- Always be encouraging and supportive — Nigerian students face real challenges
- Use examples relevant to Nigerian and African context where helpful
- For calculations, show working step by step
- Keep answers concise but thorough — avoid unnecessary padding`

async function callGroq(messages, system = PHYSICS_SYSTEM, maxTokens = 1200) {
  const res = await axios.post(`${GROQ_BASE}/chat/completions`, {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...messages],
  }, {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 60000,
  })
  return res.data.choices[0].message.content
}

// Course-aware tutor
async function tutorChat(messages, courseCode = null, courseTitle = null) {
  const system = courseCode
    ? `${PHYSICS_SYSTEM}\n\nThe student is currently studying: ${courseCode} — ${courseTitle}. Focus your help on this course.`
    : PHYSICS_SYSTEM
  return callGroq(messages, system, 1200)
}

// Explain a concept
async function explainConcept(concept, courseCode) {
  const prompt = `Explain "${concept}" as it relates to ${courseCode || 'Physics'} at 100 Level. Use simple language, give a clear definition, explain the key principles, and provide a worked example.`
  return callGroq([{ role: 'user', content: prompt }], PHYSICS_SYSTEM, 1000)
}

// Generate questions from content
async function generateQuestions(content, courseCode, count = 5) {
  const system = `${PHYSICS_SYSTEM}\n\nReturn ONLY valid JSON. Schema: {"questions":[{"question":"string","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"string"}]}`
  const prompt = `Generate ${count} multiple choice exam questions from this ${courseCode} content:\n\n${content.slice(0, 4000)}`
  const raw = await callGroq([{ role: 'user', content: prompt }], system, 1200)
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// AI solution for past question
async function solvePastQuestion(questionText, courseCode) {
  const prompt = `This is a past exam question from ${courseCode} at FUT Minna. Provide a detailed, step-by-step solution:\n\n${questionText}`
  return callGroq([{ role: 'user', content: prompt }], PHYSICS_SYSTEM, 1500)
}

// Summarise uploaded document
async function summariseDocument(content, courseCode) {
  const system = `${PHYSICS_SYSTEM}\n\nReturn ONLY valid JSON. Schema: {"title":"string","overview":"string","key_points":["string"],"topics":[{"name":"string","summary":"string"}]}`
  const prompt = `Summarise this ${courseCode} lecture note/document:\n\n${content.slice(0, 6000)}`
  const raw = await callGroq([{ role: 'user', content: prompt }], system, 1200)
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

module.exports = { callGroq, tutorChat, explainConcept, generateQuestions, solvePastQuestion, summariseDocument }
