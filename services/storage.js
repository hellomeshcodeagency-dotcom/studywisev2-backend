const axios = require('axios')
const crypto = require('crypto')

const B2_KEY_ID  = process.env.B2_KEY_ID
const B2_APP_KEY = process.env.B2_APP_KEY
const B2_BUCKET  = process.env.B2_BUCKET_NAME
const B2_ENDPOINT = process.env.B2_ENDPOINT // s3.us-east-005.backblazeb2.com

function getAuthHeader() {
  const token = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64')
  return `Basic ${token}`
}

async function uploadFile(buffer, filename) {
  const mimeType = getMimeType(filename)
  const safeFilename = `${Date.now()}-${filename.replace(/\s+/g, '-')}`
  const url = `https://${B2_ENDPOINT}/file/${B2_BUCKET}/${safeFilename}`

  await axios.put(url, buffer, {
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': mimeType,
      'Content-Length': buffer.length,
    },
    maxBodyLength: Infinity,
  })

  // Public download URL
  const fileUrl = `https://${B2_ENDPOINT}/file/${B2_BUCKET}/${safeFilename}`

  return { url: fileUrl, key: safeFilename }
}

async function deleteFile(key) {
  try {
    // B2 S3-compatible delete
    await axios.delete(`https://${B2_ENDPOINT}/file/${B2_BUCKET}/${key}`, {
      headers: { 'Authorization': getAuthHeader() },
    })
  } catch (err) {
    console.error('B2 delete error:', err.message)
  }
}

function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const types = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
  }
  return types[ext] || 'application/octet-stream'
}

module.exports = { uploadFile, deleteFile }
