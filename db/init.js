const pool = require('./index')

async function initDB() {
  try {
    console.log('Initialising Studiwise 2.0 database...')

    await pool.query(`CREATE TABLE IF NOT EXISTS universities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL, short_name VARCHAR(50) NOT NULL,
      location VARCHAR(200), logo_url TEXT, active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS faculties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL, short_name VARCHAR(50) NOT NULL,
      code VARCHAR(20), created_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL, short_name VARCHAR(50) NOT NULL,
      code VARCHAR(20), created_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS levels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      name VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
      code VARCHAR(20) NOT NULL, title VARCHAR(300) NOT NULL,
      credit_units INTEGER NOT NULL DEFAULT 2,
      semester INTEGER NOT NULL CHECK (semester IN (1,2)),
      description TEXT, lecturer VARCHAR(200),
      objectives JSONB DEFAULT '[]', outline JSONB DEFAULT '[]',
      textbooks JSONB DEFAULT '[]', active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(level_id, code))`)

    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL, email VARCHAR(200) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
      university_id UUID REFERENCES universities(id),
      faculty_id UUID REFERENCES faculties(id),
      department_id UUID REFERENCES departments(id),
      level_id UUID REFERENCES levels(id),
      matric_no VARCHAR(50), avatar_url TEXT,
      study_streak INTEGER DEFAULT 0, last_study_date DATE,
      is_suspended BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS ai_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
      title VARCHAR(300), messages JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS uploads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('past_question','notes','summary','textbook')),
      title VARCHAR(300) NOT NULL, description TEXT,
      file_url TEXT NOT NULL, public_id TEXT, file_size INTEGER,
      semester INTEGER CHECK (semester IN (1,2)), session VARCHAR(20),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      admin_note TEXT, downloads INTEGER DEFAULT 0,
      approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS past_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      session VARCHAR(20) NOT NULL, semester INTEGER NOT NULL,
      has_ai_solution BOOLEAN DEFAULT false, ai_solution TEXT,
      views INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`)

    await pool.query(`CREATE TABLE IF NOT EXISTS gpa_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      semester INTEGER NOT NULL CHECK (semester IN (1,2)),
      session VARCHAR(20) NOT NULL, level VARCHAR(20) NOT NULL,
      courses JSONB NOT NULL DEFAULT '[]',
      gpa DECIMAL(4,2), cgpa DECIMAL(4,2),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, semester, session))`)

    await pool.query(`CREATE TABLE IF NOT EXISTS bookmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_type VARCHAR(50) NOT NULL, resource_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, resource_type, resource_id))`)

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_courses_level  ON courses(level_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_uploads_course ON uploads(course_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_uploads_user   ON uploads(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pq_course      ON past_questions(course_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_user        ON ai_conversations(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gpa_user       ON gpa_records(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email)`)

    console.log('All tables created successfully')
  } catch (err) {
    console.error('DB init error:', err)
    throw err
  }
}

module.exports = initDB
