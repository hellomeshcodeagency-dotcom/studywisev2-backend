const axios = require('axios')

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

async function uploadFile(buffer, filename) {
  const mimeType = getMimeType(filename)
  const apiKey = process.env.UPLOADTHING_SECRET

  // Step 1: Get presigned URL
  const presignRes = await axios.put(
    'https://api.uploadthing.com/v6/prepareUpload',
    {
      files: [{ name: filename, size: buffer.length, type: mimeType }],
      routeConfig: { blob: { maxFileSize: '20MB', maxFileCount: 1 } },
    },
    {
      headers: {
        'x-uploadthing-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  )

  console.log('Presign:', JSON.stringify(presignRes.data).substring(0, 300))

  const fileInfo = Array.isArray(presignRes.data) ? presignRes.data[0] : presignRes.data?.data?.[0]

  // Step 2: Upload to presigned URL
  const FormData = require('form-data')
  const form = new FormData()
  if (fileInfo.fields) {
    Object.entries(fileInfo.fields).forEach(([k, v]) => form.append(k, v))
  }
  form.append('file', buffer, { filename, contentType: mimeType })

  await axios.post(fileInfo.url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  })

  // Step 3: Confirm upload
  await axios.post(
    'https://api.uploadthing.com/v6/completeMultipart',
    { fileKey: fileInfo.key, uploadId: fileInfo.uploadId, etags: [] },
    { headers: { 'x-uploadthing-api-key': apiKey } }
  ).catch(() => {})

  return {
    url: fileInfo.fileUrl || fileInfo.ufsUrl || `https://utfs.io/f/${fileInfo.key}`,
    key: fileInfo.key,
  }
}

async function deleteFile(keys) {
  try {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    await axios.delete('https://api.uploadthing.com/v6/files', {
      headers: { 'x-uploadthing-api-key': process.env.UPLOADTHING_SECRET },
      data: { fileKeys: keyArray },
    })
  } catch (err) {
    console.error('Delete error:', err.message)
  }
}

module.exports = { uploadFile, deleteFile }
