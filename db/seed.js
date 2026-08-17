const pool   = require('./index')
const bcrypt = require('bcryptjs')

async function seed() {
  try {
    console.log('Seeding Studiwise 2.0...')

    // ── University ──────────────────────────────────
    await pool.query(`INSERT INTO universities (name, short_name, location)
      VALUES ('Federal University of Technology, Minna', 'FUT Minna', 'Minna, Niger State, Nigeria')
      ON CONFLICT DO NOTHING`)
    const { rows: [uni] } = await pool.query(`SELECT id FROM universities WHERE short_name = 'FUT Minna'`)
    const uniId = uni.id

    // ── Faculty ──────────────────────────────────────
    await pool.query(`INSERT INTO faculties (university_id, name, short_name, code)
      VALUES ($1, 'School of Physical Sciences', 'SPS', 'SPS') ON CONFLICT DO NOTHING`, [uniId])
    const { rows: [fac] } = await pool.query(`SELECT id FROM faculties WHERE short_name = 'SPS' AND university_id = $1`, [uniId])
    const facId = fac.id

    // ── Departments ───────────────────────────────────
    const deptList = [
      { name: 'Physics',      short: 'PHY', code: 'PHY' },
      { name: 'Chemistry',    short: 'CHM', code: 'CHM' },
      { name: 'Geology',      short: 'GEO', code: 'GEO' },
      { name: 'Geophysics',   short: 'GPH', code: 'GPH' },
      { name: 'Geography',    short: 'GEG', code: 'GEG' },
      { name: 'Meteorology',  short: 'MET', code: 'MET' },
      { name: 'Mathematics',  short: 'MTH', code: 'MTH' },
      { name: 'Statistics',   short: 'STA', code: 'STA' },
    ]

    for (const d of deptList) {
      await pool.query(`INSERT INTO departments (faculty_id, name, short_name, code)
        VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [facId, d.name, d.short, d.code])
    }

    const { rows: deptRows } = await pool.query(`SELECT id, short_name FROM departments WHERE faculty_id = $1`, [facId])
    const deptMap = {}
    deptRows.forEach(r => deptMap[r.short_name] = r.id)

    // ── Levels (100L for each department) ────────────
    for (const deptId of Object.values(deptMap)) {
      await pool.query(`INSERT INTO levels (department_id, name) VALUES ($1, '100L') ON CONFLICT DO NOTHING`, [deptId])
    }

    const { rows: levelRows } = await pool.query(`
      SELECT l.id, l.department_id FROM levels l
      JOIN departments d ON l.department_id = d.id
      WHERE d.faculty_id = $1 AND l.name = '100L'`, [facId])
    const levelMap = {}
    levelRows.forEach(r => levelMap[r.department_id] = r.id)

    // ── All unique courses from the CSV ───────────────
    const courses = [
      // Shared
      { code:'MTH 101', title:'Elementary Mathematics I (Algebra & Trigonometry)',        units:3, sem:1 },
      { code:'MTH 102', title:'Elementary Mathematics II (Calculus)',                      units:3, sem:2 },
      { code:'MTH 103', title:'Elementary Mathematics III (Vectors & Geometry)',           units:2, sem:2 },
      { code:'PHY 101', title:'General Physics I (Mechanics & Properties of Matter)',      units:3, sem:1 },
      { code:'PHY 102', title:'General Physics II (Electricity & Magnetism)',              units:3, sem:2 },
      { code:'PHY 103', title:'General Physics Laboratory I',                             units:1, sem:1 },
      { code:'PHY 104', title:'General Physics III (Behavior of Matter)',                  units:2, sem:2 },
      { code:'CHM 101', title:'General Chemistry I (Physical & Inorganic Chemistry)',      units:3, sem:1 },
      { code:'CHM 102', title:'General Chemistry II (Organic & Analytical Chemistry)',     units:3, sem:2 },
      { code:'CHM 103', title:'Practical Chemistry I',                                    units:1, sem:1 },
      { code:'CPT 101', title:'Introduction to Computing',                                units:2, sem:1 },
      { code:'COS 102', title:'Introduction to Problem Solving & Programming',             units:2, sem:2 },
      { code:'GST 101', title:'Communication in English I',                               units:2, sem:1 },
      { code:'GST 102', title:'Library Skills',                                           units:1, sem:1 },
      { code:'GST 103', title:'Nigerian People and Culture',                              units:2, sem:2 },
      { code:'GST 104', title:'Communication in English II',                              units:2, sem:2 },
      { code:'BIO 101', title:'Introductory Biology I',                                   units:3, sem:1 },
      { code:'BIO 102', title:'General Biology II',                                       units:3, sem:2 },
      { code:'STA 111', title:'Descriptive Statistics',                                   units:2, sem:1 },
      // Physics-specific
      { code:'PHY 106', title:'General Physics Laboratory II',                            units:1, sem:2 },
      // Geology-specific
      { code:'GEY 101', title:'Introduction to Geology / Physics of the Earth',           units:2, sem:1 },
      // Geophysics-specific
      { code:'GPH 101', title:'Introduction to Geophysics',                               units:2, sem:1 },
      // Geography-specific
      { code:'GEO 101', title:'Introduction to Physical Geography',                       units:2, sem:1 },
      { code:'GEO 102', title:'Introduction to Human Geography',                          units:2, sem:2 },
      // Meteorology-specific
      { code:'MET 101', title:'Introduction to Meteorology',                              units:2, sem:1 },
      // Statistics-specific
      { code:'STA 112', title:'Introductory Probability Distributions',                   units:2, sem:2 },
    ]

    for (const c of courses) {
      await pool.query(`
        INSERT INTO courses (code, title, credit_units, semester, description, objectives, outline, textbooks)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO NOTHING`,
        [c.code, c.title, c.units, c.sem, '', '[]', '[]', '[]'])
    }
    console.log('✅ Global courses seeded')

    const { rows: courseRows } = await pool.query(`SELECT id, code FROM courses`)
    const courseMap = {}
    courseRows.forEach(r => courseMap[r.code] = r.id)

    // ── Department → Course links (from CSV) ──────────
    const links = {
      'PHY': ['MTH 101','PHY 101','PHY 103','CHM 101','CHM 103','CPT 101','GST 101','GST 102', // sem1
               'MTH 102','MTH 103','PHY 102','PHY 104','PHY 106','CHM 102','COS 102','GST 104','GST 103'], // sem2
      'CHM': ['CHM 101','CHM 103','MTH 101','PHY 101','PHY 103','BIO 101','CPT 101','GST 101','GST 102',
               'CHM 102','MTH 102','MTH 103','PHY 102','BIO 102','COS 102','GST 104','GST 103'],
      'GEO': ['GEY 101','MTH 101','PHY 101','PHY 103','CHM 101','CHM 103','CPT 101','GST 101','GST 102',
               'MTH 102','MTH 103','PHY 102','PHY 104','CHM 102','COS 102','GST 104','GST 103'],
      'GPH': ['GPH 101','MTH 101','PHY 101','PHY 103','CHM 101','CHM 103','CPT 101','GST 101','GST 102',
               'MTH 102','MTH 103','PHY 102','PHY 104','CHM 102','COS 102','GST 104','GST 103'],
      'GEG': ['GEO 101','MTH 101','STA 111','PHY 101','CHM 101','BIO 101','CPT 101','GST 101','GST 102',
               'GEO 102','MTH 102','PHY 102','CHM 102','BIO 102','GST 104','GST 103'],
      'MET': ['MET 101','MTH 101','STA 111','PHY 101','CHM 101','BIO 101','CPT 101','GST 101','GST 102',
               'GEO 102','MTH 102','PHY 102','CHM 102','BIO 102','GST 104','GST 103'],
      'MTH': ['MTH 101','STA 111','PHY 101','PHY 103','CHM 101','CPT 101','GST 101','GST 102',
               'MTH 102','MTH 103','STA 112','PHY 102','PHY 104','COS 102','GST 104','GST 103'],
      'STA': ['MTH 101','STA 111','PHY 101','PHY 103','CHM 101','CPT 101','GST 101','GST 102',
               'MTH 102','MTH 103','STA 112','PHY 102','PHY 104','COS 102','GST 104','GST 103'],
    }

    for (const [deptShort, codes] of Object.entries(links)) {
      const deptId  = deptMap[deptShort]
      const levelId = levelMap[deptId]
      if (!deptId || !levelId) { console.log(`Skipping ${deptShort} — no dept/level found`); continue }
      for (const code of codes) {
        const courseId = courseMap[code]
        if (!courseId) { console.log(`Course not found: ${code}`); continue }
        await pool.query(`
          INSERT INTO department_courses (department_id, level_id, course_id)
          VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [deptId, levelId, courseId])
      }
      console.log(`✅ ${deptShort} courses linked`)
    }

    // ── Admin user ────────────────────────────────────
    const phyId      = deptMap['PHY']
    const phyLevelId = levelMap[phyId]
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12)
    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, university_id, faculty_id, department_id, level_id)
      VALUES ('Admin', $1, $2, 'admin', $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING`,
      [process.env.ADMIN_EMAIL || 'admin@studiwise.com', hash, uniId, facId, phyId, phyLevelId])

    console.log('✅ Seed complete')
  } catch (err) {
    console.error('Seed error:', err)
    throw err
  }
}

module.exports = seed
