import mongoose from 'mongoose'

const fileSchema = new mongoose.Schema({
  serialNumber: {
    type: Number,
    unique: true,
    // 移除 required: true，因为它会在 pre('save') 之前验证
  },
  fileName: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  mimeType: {
    type: String,
  },
  uploadTime: {
    type: Date,
    default: Date.now,
  },
  imageHeight: {
    type: Number,
  },
})

// 自动生成序列号
fileSchema.pre('save', async function (next) {
  if (this.isNew && !this.serialNumber) {
    try {
      const lastFile = await this.constructor.findOne().sort({ serialNumber: -1 })
      this.serialNumber = lastFile ? lastFile.serialNumber + 1 : 1
    } catch (error) {
      return next(error)
    }
  }
  next()
})

export default mongoose.model('File', fileSchema)
