import mongoose from "./db.js";

// 在代码层面对于应的 Schema 进行定义，确保字段与 MongoDB 中的集合结构一致
const userSchema = new mongoose.Schema(
  {
    name: String,
    age: Number,
    interests: [String], // 兴趣爱好，数组类型
  },
  {
    strict: false, // 允许文档中有模式未定义的字段
    versionKey: false,
    collection: "userInfo", // 指定集合名称
  }
);

// 由于自动转换为小写复数形式而去找寻 userinfos 集合，因此需要手动指定集合名称 userInfo
const userModel = mongoose.model("userInfo", userSchema);

// userModel.find().then((res) => console.log('初始数据集合:', res))

export default userModel;
