const { UTApi } = require('uploadthing/server')

const utapi = new UTApi({
  apiKey: process.env.UPLOADTHING_SECRET,
})

async function uploadFile(buffer, filename) {
  const blob = new Blob([buffer])
  const file = new File([blob], filename)
  const response = await utapi.uploadFiles(file)
  if (response.error) throw new Error(response.error.message)
  return {
    url: response.data.url,
    key: response.data.key,
  }
}

async function deleteFile(key) {
  try {
    await utapi.deleteFiles(key)
  } catch (err) {
    console.error('Uploadthing delete error:', err)
  }
}

module.exports = { uploadFile, deleteFile }
