const { v2: cloudinary } = require('cloudinary')
const multer = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Memory storage — no Cloudinary involvement at multer stage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase()
    if (['pdf','doc','docx','pptx','txt'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, Word, PowerPoint and TXT files are allowed'))
    }
  },
})

async function uploadToCloudinary(buffer, originalname) {
  const safeName = originalname.replace(/\s+/g, '-')
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: `studiwise/uploads/${Date.now()}-${safeName}`,
        use_filename: true,
        unique_filename: false,
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      }
    )
    stream.end(buffer)
  })
}

async function deleteFile(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
  } catch (err) {
    console.error('Cloudinary delete error:', err)
  }
}

module.exports = { cloudinary, upload, uploadToCloudinary, deleteFile }
