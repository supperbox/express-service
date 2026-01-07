import mongoose from 'mongoose'

mongoose.connect('mongodb://jlw:wsjlw-12@121.37.23.86:27017/userInfo')

const db = mongoose.connection
db.on('error', (err) => {
  console.log('MongoDB 连接失败')
  console.error('连接错误详情:', err) // 增加详细错误输出
})
db.on('connected', () => {
  console.log(`Connected to database: ${mongoose.connection.db.databaseName}`)
})
db.once('open', () => {
  console.log('MongoDB 连接成功')
})

export default mongoose
