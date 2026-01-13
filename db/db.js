import mongoose from "mongoose";

// 本地连接（无需用户名密码，除非你手动开启了 auth）
mongoose.connect("mongodb://jlw:wsjlw-12@115.190.184.29:27017/userInfo");

// 如果你需要连接远程数据库，请取消下面注释并注释掉上面的本地连接
// mongoose.connect('mongodb://jlw:wsjlw-12@121.37.23.86:27017/userInfo')

const db = mongoose.connection;
db.on("error", (err) => {
  console.log("MongoDB 连接失败");
  console.error("连接错误详情:", err); // 增加详细错误输出
});
db.on("connected", () => {
  console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);
});
db.once("open", () => {
  console.log("MongoDB 连接成功");
});

export default mongoose;
