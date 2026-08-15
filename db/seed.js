const pool   = require('./index')
const bcrypt = require('bcryptjs')

async function seed() {
  try {
    console.log('Seeding Studiwise 2.0...')

    // University
    await pool.query(`
      INSERT INTO universities (name, short_name, location)
      VALUES ('Federal University of Technology, Minna', 'FUT Minna', 'Minna, Niger State, Nigeria')
      ON CONFLICT DO NOTHING`)
    const uniRes = await pool.query(`SELECT id FROM universities WHERE short_name = 'FUT Minna'`)
    const uniId  = uniRes.rows[0].id

    // Faculty
    await pool.query(`
      INSERT INTO faculties (university_id, name, short_name, code)
      VALUES ($1, 'School of Physical Sciences', 'SPS', 'SPS')
      ON CONFLICT DO NOTHING`, [uniId])
    const facRes = await pool.query(`SELECT id FROM faculties WHERE short_name = 'SPS' AND university_id = $1`, [uniId])
    const facId  = facRes.rows[0].id

    // Department
    await pool.query(`
      INSERT INTO departments (faculty_id, name, short_name, code)
      VALUES ($1, 'Physics', 'PHY', 'PHY')
      ON CONFLICT DO NOTHING`, [facId])
    const deptRes = await pool.query(`SELECT id FROM departments WHERE short_name = 'PHY' AND faculty_id = $1`, [facId])
    const deptId  = deptRes.rows[0].id

    // Level
    await pool.query(`
      INSERT INTO levels (department_id, name)
      VALUES ($1, '100L')
      ON CONFLICT DO NOTHING`, [deptId])
    const levelRes = await pool.query(`SELECT id FROM levels WHERE name = '100L' AND department_id = $1`, [deptId])
    const levelId  = levelRes.rows[0].id

    console.log(`IDs — uni:${uniId} fac:${facId} dept:${deptId} level:${levelId}`)

    // Always clean and re-insert courses using the correct levelId
    await pool.query(`DELETE FROM courses WHERE level_id = $1`, [levelId])
    console.log('Cleared old courses')

    const semester1 = [
      { code:'PHY 101', title:'General Physics I (Mechanics & Properties of Matter)', credit_units:3, description:'An introduction to classical mechanics, including kinematics, dynamics, work, energy, momentum, and properties of matter.', objectives:['Understand Newtonian mechanics','Apply laws of motion to real-world problems','Understand properties and states of matter'], outline:['Units and Measurements','Kinematics','Newton\'s Laws of Motion','Work, Energy and Power','Momentum and Collisions','Circular Motion','Gravitation','Properties of Matter','Elasticity','Fluid Mechanics'], textbooks:['University Physics by Young & Freedman','Physics for Scientists and Engineers by Serway','Fundamentals of Physics by Halliday & Resnick'] },
      { code:'PHY 107', title:'General Practical Physics I', credit_units:1, description:'Laboratory experiments designed to reinforce concepts taught in PHY 101 and develop practical measurement skills.', objectives:['Develop experimental skills','Learn to use physics laboratory equipment','Understand sources of error in measurements'], outline:['Introduction to Laboratory Safety','Measurements and Errors','Experiments on Mechanics','Experiments on Properties of Matter','Report Writing'], textbooks:['Physics Laboratory Manual, FUT Minna'] },
      { code:'MTH 101', title:'Elementary Mathematics I (Algebra & Trigonometry)', credit_units:3, description:'Fundamentals of algebra, trigonometry, and their applications in science and engineering.', objectives:['Master algebraic manipulations','Understand trigonometric functions','Solve real-world mathematical problems'], outline:['Number Systems','Surds and Indices','Logarithms','Polynomials','Quadratic Equations','Binomial Theorem','Trigonometric Functions','Trigonometric Identities','Sequences and Series','Permutation and Combination'], textbooks:['Engineering Mathematics by Stroud','Pure Mathematics by Backhouse'] },
      { code:'CHM 101', title:'General Chemistry I (Physical & Inorganic)', credit_units:3, description:'Introduction to atomic structure, chemical bonding, periodic table, and fundamental chemical reactions.', objectives:['Understand atomic structure','Apply periodic table trends','Understand chemical bonding'], outline:['Atomic Theory','Periodic Table','Chemical Bonding','States of Matter','Stoichiometry','Acid-Base Chemistry','Oxidation and Reduction','Electrochemistry'], textbooks:['Chemistry: The Central Science by Brown','General Chemistry by Ebbing'] },
      { code:'COS 101', title:'Introduction to Computing Sciences', credit_units:2, description:'Fundamentals of computing including hardware, software, programming concepts, and computer applications.', objectives:['Understand computer organisation','Learn basic programming concepts','Use common software applications'], outline:['History of Computing','Computer Hardware','Software and Operating Systems','Introduction to Programming','Internet and Networking','Data Representation','Microsoft Office Applications'], textbooks:['Computer Science Illuminated by Dale & Lewis'] },
      { code:'GST 101', title:'Use of English I', credit_units:2, description:'Development of English language communication skills for academic and professional purposes.', objectives:['Improve reading comprehension','Develop academic writing skills','Enhance oral communication'], outline:['Reading Skills','Vocabulary Development','Grammar and Usage','Essay Writing','Summary Writing','Oral Communication'], textbooks:['Use of English for Nigerian Universities by Oluikpe'] },
      { code:'GST 103', title:'Nigerian Peoples and Culture', credit_units:2, description:'Study of Nigerian peoples, their cultures, history, and the development of Nigeria as a nation.', objectives:['Understand Nigerian cultural diversity','Appreciate national history','Promote national unity'], outline:['Pre-colonial Nigeria','Colonial History','Nigerian Independence','Major Ethnic Groups','Cultural Practices','Nigerian Government and Politics','Contemporary Nigerian Issues'], textbooks:['Nigerian Peoples and Culture by Akintola'] },
    ]

    const semester2 = [
      { code:'PHY 102', title:'General Physics II (Electricity & Magnetism)', credit_units:3, description:'Fundamental concepts of electrostatics, electric circuits, magnetic fields, and electromagnetic induction.', objectives:['Understand electric fields and forces','Analyse DC and AC circuits','Understand magnetic phenomena'], outline:['Electric Charge and Fields','Gauss\'s Law','Electric Potential','Capacitance','Current and Resistance','DC Circuits','Magnetic Fields','Electromagnetic Induction','Faraday\'s Law','Maxwell\'s Equations'], textbooks:['University Physics by Young & Freedman','Introduction to Electrodynamics by Griffiths'] },
      { code:'PHY 103', title:'General Physics III (Behavior of Matter/Optics)', credit_units:2, description:'Study of wave motion, sound, light, and optical phenomena.', objectives:['Understand wave properties','Apply principles of geometrical optics','Understand interference and diffraction'], outline:['Wave Motion','Sound Waves','Doppler Effect','Nature of Light','Reflection and Refraction','Lenses and Mirrors','Optical Instruments','Interference','Diffraction','Polarization'], textbooks:['Optics by Hecht','University Physics by Young & Freedman'] },
      { code:'PHY 108', title:'General Practical Physics II', credit_units:1, description:'Laboratory experiments reinforcing concepts from PHY 102 and PHY 103.', objectives:['Perform electricity experiments','Conduct optics practicals','Develop scientific report writing'], outline:['Electrical Measurements','Circuit Experiments','Optics Experiments','Wave Experiments','Data Analysis'], textbooks:['Physics Laboratory Manual, FUT Minna'] },
      { code:'MTH 102', title:'Elementary Mathematics II (Calculus & Vectors)', credit_units:3, description:'Introduction to differential and integral calculus, and vector algebra.', objectives:['Differentiate and integrate functions','Apply calculus to physical problems','Understand vector operations'], outline:['Limits and Continuity','Differentiation','Applications of Derivatives','Integration','Applications of Integration','Vectors in 2D and 3D','Dot and Cross Products','Vector Functions'], textbooks:['Calculus by Stewart','Engineering Mathematics by Stroud'] },
      { code:'CHM 102', title:'General Chemistry II (Organic & Analytical)', credit_units:3, description:'Introduction to organic chemistry and analytical chemistry techniques.', objectives:['Understand organic functional groups','Learn basic organic reactions','Apply analytical chemistry techniques'], outline:['Introduction to Organic Chemistry','Alkanes and Alkenes','Alkynes','Aromatic Compounds','Alcohols and Ethers','Carboxylic Acids','Qualitative Analysis','Quantitative Analysis'], textbooks:['Organic Chemistry by Morrison & Boyd','Analytical Chemistry by Skoog'] },
      { code:'COS 102', title:'Introduction to Problem Solving', credit_units:2, description:'Fundamentals of algorithmic thinking and problem solving using computers.', objectives:['Develop algorithmic thinking','Design flowcharts and pseudocode','Write basic programs'], outline:['Problem Solving Strategies','Algorithms','Flowcharts','Pseudocode','Introduction to Programming','Data Types and Variables','Control Structures','Functions and Arrays'], textbooks:['Problem Solving with C++ by Savitch'] },
      { code:'GST 102', title:'Use of English II', credit_units:2, description:'Advanced English communication skills including technical and report writing.', objectives:['Write technical reports','Develop research writing skills','Improve presentation skills'], outline:['Technical Writing','Research Methods','Report Writing','Referencing and Citation','Presentation Skills','Critical Thinking'], textbooks:['Academic Writing by Bailey'] },
      { code:'GST 107', title:'History and Philosophy of Science', credit_units:2, description:'Historical development of science and philosophical foundations of scientific inquiry.', objectives:['Understand scientific revolutions','Apply scientific method','Appreciate ethics in science'], outline:['Ancient Science','Scientific Revolution','Modern Physics','Philosophy of Science','Scientific Method','Ethics in Science','Science and Society','Nigerian Science History'], textbooks:['The Structure of Scientific Revolutions by Kuhn'] },
    ]

    for (const course of semester1) {
      await pool.query(
        `INSERT INTO courses (level_id, code, title, credit_units, semester, description, objectives, outline, textbooks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [levelId, course.code, course.title, course.credit_units, 1, course.description, JSON.stringify(course.objectives), JSON.stringify(course.outline), JSON.stringify(course.textbooks)])
    }
    for (const course of semester2) {
      await pool.query(
        `INSERT INTO courses (level_id, code, title, credit_units, semester, description, objectives, outline, textbooks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [levelId, course.code, course.title, course.credit_units, 2, course.description, JSON.stringify(course.objectives), JSON.stringify(course.outline), JSON.stringify(course.textbooks)])
    }

    console.log(`✅ 15 courses inserted for level ${levelId}`)

    // Admin user
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12)
    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, university_id, faculty_id, department_id, level_id)
      VALUES ('Admin', $1, $2, 'admin', $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING`,
      [process.env.ADMIN_EMAIL || 'admin@studiwise.com', hash, uniId, facId, deptId, levelId])

    console.log('✅ Seed complete')
  } catch (err) {
    console.error('Seed error:', err)
    throw err
  }
}

module.exports = seed
