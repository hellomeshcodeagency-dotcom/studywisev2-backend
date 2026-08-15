const cloudinary = require('cloudinary').v2
const multer     = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        'studiwise/uploads',
    resource_type: 'raw',
    public_id:     `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`,
  }),
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain']
    const ext = file.originalname.split('.').pop().toLowerCase()
    if (allowed.includes(file.mimetype) || ['pdf','doc','docx','pptx','txt'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, Word, PowerPoint and TXT files are allowed'))
    }
  },
})

async function deleteFile(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
  } catch (err) {
    console.error('Cloudinary delete error:', err)
  }
}

module.exports = { cloudinary, upload, deleteFile }
