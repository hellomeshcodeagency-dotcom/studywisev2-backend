const cloudinary = require('cloudinary').v2
const multer     = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Store in memory, upload to Cloudinary manually
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
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
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder: 'studiwise/uploads' },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
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
