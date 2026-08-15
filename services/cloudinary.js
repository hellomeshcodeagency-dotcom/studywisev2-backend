const cloudinary = require('cloudinary').v2
const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Use CloudinaryStorage with unsigned preset
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    upload_preset: 'ml_default',
    resource_type: 'auto',
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase()
    if (['pdf','doc','docx','pptx','txt'].includes(ext)) cb(null, true)
    else cb(new Error('Only PDF, Word, PowerPoint and TXT files are allowed'))
  },
})

async function deleteFile(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => {})
  } catch (err) {
    console.error('Cloudinary delete error:', err)
  }
}

module.exports = { cloudinary, upload, deleteFile }
