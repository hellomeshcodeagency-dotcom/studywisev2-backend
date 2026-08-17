const axios = require('axios')

let authToken = null
let apiUrl = null
let downloadUrl = null
let uploadUrl = null
let uploadAuthToken = null

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

// Step 1: Authorize account
async function authorize() {
  const token = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`).toString('base64')
  const res = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${token}` }
  })
  authToken    = res.data.authorizationToken
  apiUrl       = res.data.apiUrl
  downloadUrl  = res.data.downloadUrl
}

// Step 2: Get upload URL
async function getUploadUrl() {
  const res = await axios.post(`${apiUrl}/b2api/v2/b2_get_upload_url`,
    { bucketId: process.env.B2_BUCKET_ID },
    { headers: { Authorization: authToken } }
  )
  uploadUrl       = res.data.uploadUrl
  uploadAuthToken = res.data.authorizationToken
}

async function uploadFile(buffer, filename) {
  await authorize()
  await getUploadUrl()

  const mimeType  = getMimeType(filename)
  const safeFile  = `${Date.now()}-${filename.replace(/\s+/g, '-')}`
  const sha1      = require('crypto').createHash('sha1').update(buffer).digest('hex')

  const res = await axios.post(uploadUrl, buffer, {
    headers: {
      Authorization:               uploadAuthToken,
      'X-Bz-File-Name':            encodeURIComponent(safeFile),
      'Content-Type':              mimeType,
      'Content-Length':            buffer.length,
      'X-Bz-Content-Sha1':        sha1,
      'X-Bz-Info-b2-content-disposition': encodeURIComponent(`attachment; filename="${filename}"`),
    },
    maxBodyLength: Infinity,
  })

  const fileId   = res.data.fileId
  const fileName = res.data.fileName

  // Generate a signed download URL valid for 7 days
  const authRes = await axios.post(`${apiUrl}/b2api/v2/b2_get_download_authorization`,
    {
      bucketId:               process.env.B2_BUCKET_ID,
      fileNamePrefix:         fileName,
      validDurationInSeconds: 604800, // 7 days
    },
    { headers: { Authorization: authToken } }
  )

  const signedUrl = `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}?Authorization=${authRes.data.authorizationToken}`

  return { url: signedUrl, key: `${fileId}|${fileName}` }
}

async function deleteFile(fileId) {
  try {
    if (!authToken) await authorize()
    // Need fileName to delete — skip for now, just log
    console.log('Delete requested for:', fileId)
  } catch (err) {
    console.error('B2 delete error:', err.message)
  }
}

async function getSignedUrl(fileName) {
  if (!authToken) await authorize()
  const authRes = await axios.post(`${apiUrl}/b2api/v2/b2_get_download_authorization`,
    {
      bucketId:               process.env.B2_BUCKET_ID,
      fileNamePrefix:         fileName,
      validDurationInSeconds: 3600, // 1 hour
    },
    { headers: { Authorization: authToken } }
  )
  return `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}?Authorization=${authRes.data.authorizationToken}`
}

module.exports = { uploadFile, deleteFile, getSignedUrl }
