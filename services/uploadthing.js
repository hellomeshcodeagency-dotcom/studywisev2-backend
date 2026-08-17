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

  // Step 1: Request presigned URLs
  const presignRes = await axios.post(
    'https://uploadthing.com/api/uploadFiles',
    {
      files: [{ name: filename, size: buffer.length, type: mimeType }],
    },
    {
      headers: {
        'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET,
        'X-Uploadthing-Version': '6.13.2',
        'Content-Type': 'application/json',
      },
    }
  )

  console.log('Presign response:', JSON.stringify(presignRes.data))

  const fileData = presignRes.data.data?.[0] || presignRes.data[0]

  // Step 2: Upload file to presigned URL
  const FormData = require('form-data')
  const form = new FormData()
  if (fileData.fields) {
    Object.entries(fileData.fields).forEach(([k, v]) => form.append(k, v))
  }
  form.append('file', buffer, { filename, contentType: mimeType })

  await axios.post(fileData.url || fileData.presignedUrl, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  })

  return {
    url: fileData.fileUrl || fileData.ufsUrl,
    key: fileData.key,
  }
}

async function deleteFile(keys) {
  try {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    await axios.delete('https://uploadthing.com/api/deleteFiles', {
      headers: { 'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET },
      data: { fileKeys: keyArray },
    })
  } catch (err) {
    console.error('Uploadthing delete error:', err.message)
  }
}

module.exports = { uploadFile, deleteFile }
