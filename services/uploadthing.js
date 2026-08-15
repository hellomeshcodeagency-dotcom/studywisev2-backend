const FormData = require('form-data')
const axios = require('axios')

async function uploadFile(buffer, filename) {
  // Get presigned URL from uploadthing
  const mimeType = getMimeType(filename)
  
  const presignRes = await axios.post(
    'https://api.uploadthing.com/v6/uploadFiles',
    {
      files: [{ name: filename, size: buffer.length, type: mimeType }],
      acl: 'public-read',
    },
    {
      headers: {
        'x-uploadthing-api-key': process.env.UPLOADTHING_SECRET,
        'Content-Type': 'application/json',
      },
    }
  )

  const fileData = presignRes.data.data[0]
  
  // Upload to the presigned URL
  const form = new FormData()
  Object.entries(fileData.fields || {}).forEach(([k, v]) => form.append(k, v))
  form.append('file', buffer, { filename, contentType: mimeType })
  
  await axios.post(fileData.url, form, {
    headers: form.getHeaders(),
  })

  return {
    url: fileData.fileUrl,
    key: fileData.key,
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

async function deleteFile(keys) {
  try {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    await axios.delete('https://api.uploadthing.com/v6/files', {
      headers: { 'x-uploadthing-api-key': process.env.UPLOADTHING_SECRET },
      data: { fileKeys: keyArray },
    })
  } catch (err) {
    console.error('Uploadthing delete error:', err.message)
  }
}

module.exports = { uploadFile, deleteFile }
